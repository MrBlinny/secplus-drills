// Every enumerable list in the syllabus, in one place, for writing out by hand.
//
// This is a *derived* view, never a second copy. objectives.md is parsed
// structurally so a list can never drift from the source it is supposed to
// teach, and the six blank-paper taxonomies are taken verbatim from
// content.js so the page shows exactly what blank-paper mode grades against.
// If those two disagreed, the page would be teaching a list the app then marks
// wrong.
//
// Expected lengths are asserted at load for the lists whose length is itself a
// fact worth being sure of, so an edit the parser stops following fails loudly
// instead of quietly serving a short list.

import fs from 'node:fs';
import { OBJECTIVES_FILE } from './paths.js';
import { TAXONOMIES, DOMAIN_LABELS } from './content.js';
import { readAttempts } from './attempts.js';
import { recallKey } from './grade.js';

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/**
 * Short headings for the lists that sit directly under a `##` objective and so
 * would otherwise be titled with the whole "Given a scenario, …" sentence.
 * A display label only — the terms underneath are untouched.
 */
const SHORT_TITLE = {
  '1.3': 'AI life cycle',
  '2.1': 'Threat-modeling resources',
  '2.3': 'Access controls',
  '2.5': 'Monitoring and auditing',
  '3.2': 'How AI enables attack vectors',
  '3.3': 'Automating security tasks',
  '4.3': 'Compliance instruments',
};

/* ------------------------------------------------------------------ */
/* objectives.md — structural parse                                     */
/* ------------------------------------------------------------------ */

/**
 * Walk the objective sections and emit one list per bullet group.
 *
 * A group is either a bold header followed by bullets ("**Attacks**") or the
 * bullets that sit directly under a `##` objective heading with no header of
 * their own (1.3, 2.1, 2.3, 2.5, 3.2, 3.3, 4.3). A bold header with no bullets
 * under it is a term in its own right — "Watermarking", "Guardrail testing and
 * validation" — and is kept as a one-term list rather than dropped.
 */
function parseObjectiveLists(text) {
  const lines = text.split(/\r?\n/);
  const end = lines.findIndex((l) => l.trim() === '# Acronym list');
  const body = lines.slice(0, end === -1 ? lines.length : end);

  const out = [];
  let domain = null;
  let code = null;
  let objective = null;
  let cur = null;

  const close = () => {
    if (!cur) return;
    // A bold header that never got bullets is itself the term.
    if (!cur.terms.length) cur.terms.push({ term: cur.group, gloss: null, sub: false });
    out.push(cur);
    cur = null;
  };

  const open = (group, note) => {
    close();
    cur = {
      id: `${code}-${slug(group)}`,
      domain,
      code,
      objective,
      group,
      note: note ?? null,
      source: 'objectives.md',
      terms: [],
    };
  };

  for (const raw of body) {
    const line = raw.trimEnd();
    let m;

    if ((m = line.match(/^#\s+(\d\.0)\s+/))) {
      close();
      domain = m[1];
      code = null;
      continue;
    }
    if ((m = line.match(/^##\s+(\d\.\d)\s+(.+)$/))) {
      close();
      code = m[1];
      objective = m[2].trim();
      continue;
    }
    if (!code) continue;

    // **Header** optionally followed by an italic annotation in parentheses.
    if ((m = line.match(/^\*\*(.+?)\*\*\s*(?:\*\((.+?)\)\*)?\s*$/))) {
      open(m[1].trim(), m[2]?.trim() ?? null);
      continue;
    }

    if ((m = line.match(/^(\s*)-\s+(.+)$/))) {
      if (!cur) open(SHORT_TITLE[code] ?? objective, null);
      const parts = m[2].match(/^(.*?)(?:\s+—\s+(.+))?$/);
      cur.terms.push({
        term: parts[1].replace(/\*\*/g, '').trim(),
        gloss: parts[2]?.trim() ?? null,
        sub: m[1].length >= 2,
      });
      continue;
    }

    if (line.trim() === '') continue;
    close();                       // any other prose, or `---`, ends the group
  }
  close();
  return out;
}

/* ------------------------------------------------------------------ */
/* the six graded taxonomies take precedence                            */
/* ------------------------------------------------------------------ */

/**
 * Which parsed groups each blank-paper taxonomy stands in for. The canonical
 * list replaces the first of them and the rest are dropped, because blank
 * paper grades one flat list where objectives.md shows two headers plus a
 * loose bold term. `caveat` explains the difference, since the difference is
 * itself examinable.
 */
const GRADED = [
  { taxonomy: '1.1-categories', code: '1.1', groups: ['Categories'], ordered: false,
    caveat: 'Category answers the question "what kind of thing is it" — a person, a '
      + 'document, a machine, a wall. Control type answers "what does it do to the attack".' },
  { taxonomy: '1.1-control-types', code: '1.1', groups: ['Control types'], ordered: false,
    caveat: 'Deterrent discourages before the fact, preventive actually stops it, '
      + 'directive tells someone what to do. Compensating is the one you reach for only '
      + 'when the control you wanted is not available.' },
  { taxonomy: '1.2-zt-control-plane', code: '1.2', groups: ['Zero Trust — Control Plane'],
    ordered: false,
    caveat: 'Control Plane decides. Policy Engine makes the call, Policy Administrator '
      + 'carries it out. Both live here — the Enforcement Point does not.' },
  { taxonomy: '1.2-zt-data-plane', code: '1.2', groups: ['Zero Trust — Data Plane'],
    ordered: false,
    caveat: 'Data Plane acts. The Policy Enforcement Point is on this side, which is the '
      + 'single most-tested Zero Trust distinction.' },
  { taxonomy: '1.4-certificates', code: '1.4', groups: ['Certificates'], ordered: false,
    caveat: 'CRL is a published list you download; OCSP is a live query about one '
      + 'certificate. Same job, opposite mechanism.' },
  { taxonomy: '2.1-threat-actors', code: '2.1', groups: ['Threat actors'], ordered: false,
    caveat: 'Shadow IT is on this list. It is the one "actor" with no malicious intent, '
      + 'and it is easy to forget precisely because it does not feel like an attacker.' },
  { taxonomy: '2.1-motivations', code: '2.1', groups: ['Motivations'], ordered: false,
    caveat: 'Ethical is a motivation in CompTIA’s list. So is War. Both get dropped by '
      + 'people reproducing this from real-world intuition.' },
  { taxonomy: '2.2-social-engineering', code: '2.2',
    groups: ['Human vectors/social engineering'], ordered: false,
    caveat: 'Pretexting is the invented story; impersonation is claiming to be a specific '
      + 'person; brand impersonation is claiming to be a company. Typosquatting is the '
      + 'only one that is a domain name rather than a conversation.' },
  { taxonomy: '2.4-malware', code: '2.4', groups: ['Malware attacks'], ordered: false,
    caveat: 'Bloatware is malware on this list. Worm spreads by itself, virus needs a host '
      + 'file, trojan needs you to run it, logic bomb waits for a condition.' },
  { taxonomy: '2.4-indicators', code: '2.4', groups: ['Indicators'], ordered: false,
    caveat: 'These are what you SEE, not what happened. "Impossible travel" and '
      + '"out-of-cycle logging" are the two most often reached for by description '
      + 'rather than by name.' },
  { taxonomy: '3.3-classifications', code: '3.3', groups: ['Data classifications'],
    ordered: false,
    caveat: 'Six labels, and Sensitive / Confidential / Restricted / Private all sound '
      + 'like the same thing in English. The exam still expects the exact word.' },
  { taxonomy: '4.6-access-controls', code: '4.6', groups: ['Access controls'], ordered: false,
    caveat: 'Role-based and rule-based both abbreviate to RBAC — the acronym list has both. '
      + 'Role is who you are; rule is a condition the system evaluates.' },
  { taxonomy: '4.8-ir-process', code: '4.8', groups: ['Process'], ordered: true,
    caveat: 'Order is examinable. Containment comes before eradication, and eradication '
      + 'before recovery — a question that asks "what next" is usually testing exactly '
      + 'that adjacency.' },
  { taxonomy: '5.2-risk-strategies', code: '5.2', groups: ['Risk management strategies'],
    ordered: false,
    caveat: 'Exemption and exception sit UNDER accept, not alongside it. Transfer is '
      + 'insurance or contract; avoid means not doing the activity at all.' },
  { taxonomy: '5.3-agreements', code: '5.3', groups: ['Agreement types'], ordered: false,
    caveat: 'MOA vs MOU vs MSA vs BPA is pure vocabulary and turns up every sitting. '
      + 'SOW/WO is the one that describes the actual work.' },
  { taxonomy: '5.5-pentest', code: '5.5', groups: ['Penetration testing'], ordered: false,
    caveat: 'Known / partially known / unknown environment replaced white / grey / black '
      + 'box. objectives.md nests passive and active under reconnaissance; the canonical '
      + 'eight counts reconnaissance once and not its two children.' },
];

function applyGraded(lists) {
  const byId = new Map(TAXONOMIES.map((t) => [t.id, t]));
  const out = [];
  const consumed = new Set();

  for (const list of lists) {
    const g = GRADED.find((x) => x.code === list.code && x.groups.includes(list.group));
    if (!g) { out.push(list); continue; }
    if (consumed.has(g.taxonomy)) continue;      // merged into the first match
    consumed.add(g.taxonomy);

    const tax = byId.get(g.taxonomy);
    out.push({
      ...list,
      id: g.taxonomy,
      group: tax.title,
      terms: tax.terms.map((term) => ({ term, gloss: null, sub: false })),
      taxonomy: g.taxonomy,
      ordered: g.ordered,
      caveat: g.caveat,
      graded: true,
    });
  }

  return out;
}

/* ------------------------------------------------------------------ */
/* assertions                                                           */
/* ------------------------------------------------------------------ */

// Only the lists whose length is itself a fact worth being sure of. A parse
// that silently drops a term would teach a short list, which is worse than
// no list at all.
const EXPECTED = {
  // the graded blank-paper taxonomies
  '1.1-categories': 4,
  '1.1-control-types': 6,
  '1.2-zt-control-plane': 5,
  '1.2-zt-data-plane': 3,
  '1.4-certificates': 8,
  '2.1-threat-actors': 6,
  '2.1-motivations': 10,
  '2.2-social-engineering': 10,
  '2.4-malware': 9,
  '2.4-indicators': 9,
  '3.3-classifications': 6,
  '4.6-access-controls': 7,
  '4.8-ir-process': 7,
  '5.2-risk-strategies': 6,
  '5.3-agreements': 7,
  '5.5-pentest': 8,
  // a spread of ungraded lists, to catch a parser regression anywhere in the file
  '1.3-business-processes-impacting-security-operation': 8,
  '2.5-hardening-techniques': 7,
  '3.4-backups': 7,
  '4.4-tools': 9,
  '5.2-business-impact-analysis': 4,
};

function assertLengths(lists) {
  const byId = new Map(lists.map((l) => [l.id, l]));
  const bad = [];
  for (const [id, n] of Object.entries(EXPECTED)) {
    const got = byId.get(id);
    if (!got) { bad.push(`${id}: list not found`); continue; }
    if (got.terms.length !== n) {
      bad.push(`${id}: parsed ${got.terms.length}, expected ${n} — ${JSON.stringify(got.terms.map((t) => t.term))}`);
    }
  }
  if (bad.length) throw new Error(`lists: bad parse\n  ${bad.join('\n  ')}`);
}

/* ------------------------------------------------------------------ */
/* build                                                                */
/* ------------------------------------------------------------------ */

let cache = null;

export function buildLists() {
  if (cache) return cache;
  const text = fs.readFileSync(OBJECTIVES_FILE, 'utf8');
  const lists = applyGraded(parseObjectiveLists(text));
  assertLengths(lists);

  const order = ['1.0', '2.0', '3.0', '4.0', '5.0'];
  lists.sort((a, b) => {
    const d = order.indexOf(a.domain) - order.indexOf(b.domain);
    return d || a.code.localeCompare(b.code);
  });

  cache = lists.map((l) => ({
    ordered: false, caveat: null, graded: false, taxonomy: null, ...l,
    count: l.terms.length,
    verbatim: /memorize verbatim/i.test(l.note ?? ''),
  }));
  return cache;
}

export const SECTIONS = [
  { domain: '1.0', title: `1.0 ${DOMAIN_LABELS['1.0']}`, weight: '17%' },
  { domain: '2.0', title: `2.0 ${DOMAIN_LABELS['2.0']}`, weight: '40%' },
  { domain: '3.0', title: `3.0 ${DOMAIN_LABELS['3.0']}`, weight: '24%' },
  { domain: '4.0', title: `4.0 ${DOMAIN_LABELS['4.0']}`, weight: '19%' },
  { domain: 'sup', title: 'Framework detail', weight: null },
];

/* ------------------------------------------------------------------ */
/* what he has actually dropped                                         */
/* ------------------------------------------------------------------ */

/**
 * Terms he has failed to *produce*, counted, so the page can mark them.
 *
 * Three sources, all of which name a term rather than an option index: the
 * missed half of a blank-paper run, the missed cells of a PBQ, and a failed
 * confusion pair. Recall misses only — a wrong multiple-choice answer says he
 * did not recognise the term, not that he cannot produce it, and producing it
 * is what this page is for.
 *
 * Keyed with recallKey because the same term is spelled differently in
 * different places: a pair logs "transfer learning attack", the taxonomy says
 * "Transfer learning attacks".
 */
export function missedTerms() {
  const counts = new Map();
  const bump = (t) => {
    if (!t) return;
    const k = recallKey(t);
    if (k) counts.set(k, (counts.get(k) ?? 0) + 1);
  };
  for (const a of readAttempts()) {
    if (Array.isArray(a.missed_terms)) a.missed_terms.forEach(bump);
    if (a.mode === 'pairs' && a.is_correct === false) bump(a.correct_term);
  }
  return counts;
}

/**
 * The lists with each term annotated by how often it has been dropped.
 * Computed per request rather than cached with the lists, since it moves every
 * time he answers something.
 */
export function listsWithRecall() {
  const missed = missedTerms();
  return buildLists().map((l) => ({
    ...l,
    terms: l.terms.map((t) => ({ ...t, missed: missed.get(recallKey(t.term)) ?? 0 })),
  }));
}

/* ------------------------------------------------------------------ */
/* markdown handout                                                     */
/* ------------------------------------------------------------------ */

/** The same content as a printable page, for anyone who wants it as text. */
export function listsMarkdown() {
  const lists = buildLists();
  const out = [
    '# Security+ SY0-701 — every list worth writing out',
    '',
    '*Generated from content/objectives.md. Do not edit this file; edit the source.*',
    '',
  ];

  for (const s of SECTIONS) {
    const mine = lists.filter((l) => l.domain === s.domain);
    if (!mine.length) continue;
    out.push(`## ${s.title}${s.weight ? ` — ${s.weight}` : ''}`, '');
    for (const l of mine) {
      out.push(`### ${l.code === 'sup' ? '' : `${l.code} `}${l.group} (${l.count})`);
      if (l.note) out.push(`*${l.note}*`);
      out.push('');
      l.terms.forEach((t, i) => {
        const bullet = l.ordered ? `${i + 1}.` : '-';
        const pad = t.sub ? '  ' : '';
        out.push(`${pad}${bullet} ${t.term}${t.gloss ? ` — ${t.gloss}` : ''}`);
      });
      out.push('');
      if (l.caveat) out.push(`> ${l.caveat}`, '');
    }
  }
  return out.join('\n');
}
