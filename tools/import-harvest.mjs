// Normalise the harvested third-party question banks into the app's item
// schema, and give every one of them a CompTIA objective code.
//
// Sources live in harvest/ as they were downloaded, so the import stays
// auditable and can be re-run. Output is data/item-bank-practice.json, kept in
// a separate file from the authored bank because it is not the same kind of
// thing: authored items have distractors built from adjacent objective-list
// terms and explanations that name the discriminator, these have whatever the
// original author wrote.
//
// Objective codes are INFERRED, never trusted from the source. One harvested
// bank tags questions with "Objective 3.5" and "Objective 3.6", which do not
// exist in SY0-701 — those are book chapter numbers. Rather than curate a
// mapping that rots, each question is scored against the literal bullet terms
// of every objective in content/objectives.md, weighting the credited answer
// highest and discounting terms that several objectives share. Low-confidence
// matches keep the domain and lose the objective, because a wrong objective is
// worse than none: it would misroute drill and corrupt the weakest-five rank.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const OBJECTIVES = path.join(ROOT, 'content', 'objectives.md');
const HARVEST = path.join(ROOT, 'harvest');
const OUT = path.join(ROOT, 'data', 'item-bank-practice.json');

/* ------------------------------------------------------------------ */
/* candidate terms from objectives.md                                   */
/* ------------------------------------------------------------------ */

// Terms too generic to discriminate: they turn up in most questions of a
// domain regardless of objective, so counting them only adds noise.
const STOP = new Set([
  'security', 'data', 'system', 'systems', 'control', 'controls', 'access',
  'network', 'application', 'applications', 'process', 'processes', 'types',
  'type', 'tools', 'techniques', 'methods', 'management', 'monitoring',
  'testing', 'reporting', 'analysis', 'considerations', 'other', 'general',
  'encryption', 'hashing', 'segmentation', 'patching', 'recovery', 'internal',
  'external', 'physical', 'technical', 'operational', 'ownership', 'impact',
  'attacks', 'attack', 'threat', 'threats', 'risk', 'compliance', 'audit',
  'assessment', 'implementations', 'factors', 'level', 'levels', 'benefits',
  'activities', 'procedures', 'policies', 'standards', 'guidelines', 'grouping',
]);

/**
 * One bullet can carry several terms:
 *   "Industrial control systems (ICS)/supervisory control and data acquisition (SCADA)"
 *   "Work order (WO)/statement of work (SOW)"
 *   "Human- and non-human-readable"
 * Each becomes its own candidate, so a question about SCADA finds 3.1 rather
 * than falling through unassigned.
 */
function splitTerms(raw) {
  const out = [];
  const push = (t, sub) => {
    const term = t.trim().toLowerCase().replace(/\s+/g, ' ');
    if (term.length >= 3 && /[a-z]{3}/.test(term)) out.push({ term, sub });
  };
  const expand = (chunk, sub) => {
    // "Trusted Platform Module (TPM)" -> both the phrase and the acronym.
    const paren = chunk.match(/^(.*?)\s*\(([^)]+)\)\s*(.*)$/);
    if (paren) {
      push(paren[1], sub);
      push(paren[2], sub);
      if (paren[3]) push(paren[3].replace(/^[/\s]+/, ''), true);
      return;
    }
    push(chunk, sub);
  };

  const cleaned = raw.replace(/\*/g, '').replace(/\s*\((grouping)\)\s*/i, '');
  // A slash usually separates alternatives that are each a term in their own
  // right ("Provisioning/de-provisioning", "Agents/agentless"). Keep the whole
  // string too — sometimes the slash is part of the term ("IDS/IPS").
  expand(cleaned, false);
  if (cleaned.includes('/') && !/^[A-Z/]+$/.test(cleaned)) {
    for (const part of cleaned.split('/')) expand(part, true);
  }
  return out;
}

function parseObjectives() {
  const lines = fs.readFileSync(OBJECTIVES, 'utf8').split(/\r?\n/);
  const objectives = [];
  let cur = null;
  for (const line of lines) {
    // Everything from the acronym list on is reference material, not bullets.
    if (/^#\s+Acronym/i.test(line)) break;
    const h2 = line.match(/^##\s+(\d\.\d)\s+(.*)$/);
    if (h2) {
      cur = { code: h2[1], title: `${h2[1]} ${h2[2]}`, terms: [] };
      objectives.push(cur);
      continue;
    }
    if (/^#\s/.test(line)) { cur = null; continue; }
    if (!cur) continue;
    const bullet = line.match(/^\s*-\s+(.*)$/);
    const bold = line.match(/^\*\*(.+?)\*\*/);
    const raw = bullet ? bullet[1] : bold ? bold[1] : null;
    if (!raw) continue;
    for (const t of splitTerms(raw)) if (!STOP.has(t.term)) cur.terms.push(t);
  }

  // A term several objectives claim cannot tell them apart. "Encryption" is in
  // 1.4, 2.5, 3.3 and 5.1; "penetration testing" is in 4.3 and 5.3 and 5.5.
  // Weight each term by how few objectives own it rather than curating a list.
  const owners = new Map();
  for (const o of objectives) {
    for (const t of new Set(o.terms.map((x) => x.term))) {
      owners.set(t, (owners.get(t) ?? 0) + 1);
    }
  }
  for (const o of objectives) for (const t of o.terms) t.unique = 1 / owners.get(t.term);
  return objectives;
}

/* ------------------------------------------------------------------ */
/* matching                                                             */
/* ------------------------------------------------------------------ */

const norm = (s) => ` ${(s ?? '')
  .toLowerCase()
  .replace(/[‐-―]/g, '-')
  .replace(/[^a-z0-9]+/g, ' ')
  .trim()} `;

/** Whole-phrase match on a space-padded string, so "salt" never hits inside
 *  "assault" and "key exchange" must appear as a phrase. */
const has = (hay, term) => hay.includes(` ${term.replace(/[^a-z0-9]+/g, ' ').trim()} `);

// The credited answer is usually the objective-list term itself, so it
// dominates. The stem sets the scenario; the explanation is the weakest signal
// because good explanations name the terms they are ruling *out*.
const FIELD_WEIGHT = { answer: 10, stem: 3, explanation: 1 };

function score(item, objective) {
  const fields = {
    answer: norm(item.options?.[item.answer]),
    stem: norm(item.stem),
    explanation: norm(item.explanation),
  };
  let total = 0;
  const evidence = [];
  for (const { term, sub, unique } of objective.terms) {
    const specificity = 1 + Math.min(2, (term.split(/\s+/).length - 1) * 0.5);
    let best = 0;
    let where = null;
    for (const [field, weight] of Object.entries(FIELD_WEIGHT)) {
      if (has(fields[field], term) && weight > best) { best = weight; where = field; }
    }
    if (best) {
      total += best * specificity * unique * (sub ? 0.6 : 1);
      evidence.push(`${term} (${where})`);
    }
  }
  return { total, evidence };
}

function assign(item, objectives) {
  // A stated domain is a prior worth keeping: a bad match can then be wrong
  // within a domain but never across one. Items with no stated domain are
  // scored against all 28 objectives.
  const pool = item.domain
    ? objectives.filter((o) => o.code[0] === item.domain[0])
    : objectives;
  const ranked = pool
    .map((o) => ({ code: o.code, title: o.title, ...score(item, o) }))
    .sort((a, b) => b.total - a.total);

  const [top, second] = ranked;
  if (!top || top.total === 0) return { confidence: 'none', evidence: [] };
  const margin = top.total - (second?.total ?? 0);
  const confidence = top.total >= 10 && margin >= 5 ? 'high'
    : top.total >= 5 && margin >= 3 ? 'medium'
      : 'low';
  return { ...top, confidence, margin };
}

/* ------------------------------------------------------------------ */
/* source readers                                                       */
/* ------------------------------------------------------------------ */

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

/**
 * iakhator/comptia-security-plus-701 — 300 usable questions in ten files.
 * ch<N>_Test<A|B> are per-domain, so the filename gives a trustworthy domain
 * even though the in-file "Objective 3.6" tags are book chapters and are
 * discarded.
 *
 * finalExam.json is deliberately NOT imported. Its 100 questions ship with an
 * empty `correct` field — the answer key was never filled in. The explanations
 * label distractors by letter, so the key looks recoverable by elimination,
 * but tested against all 100 that heuristic resolves only 40 uniquely and gets
 * some of those wrong: it credits "Authentication, Auditing, Access Control"
 * as the expansion of AAA. A bank that teaches wrong answers is worse than a
 * smaller bank, so the file stays in harvest/ unread.
 */
const SKIP = new Set(['iak-finalExam.json']);

function readIakhator() {
  const out = [];
  const files = fs.readdirSync(HARVEST)
    .filter((f) => f.startsWith('iak-') && !SKIP.has(f)).sort();
  for (const file of files) {
    const m = file.match(/^iak-ch(\d)_Test([AB])\.json$/);
    const domain = m ? `${m[1]}.0` : null;
    const tag = m ? `ch${m[1]}${m[2]}` : 'x';
    const rows = JSON.parse(fs.readFileSync(path.join(HARVEST, file), 'utf8'));
    rows.forEach((q, i) => {
      const keys = LETTERS.filter((k) => q.options?.[k] != null);
      const answer = keys.indexOf(q.correct);
      if (answer < 0 || keys.length < 2) return;             // unusable row
      out.push({
        id: `HV-IAK-${tag}-${String(i + 1).padStart(3, '0')}`,
        stem: String(q.question ?? '').trim(),
        options: keys.map((k) => String(q.options[k]).trim()),
        answer,
        explanation: String(q.explanation ?? '').trim(),
        domain,
        source: 'iakhator/comptia-security-plus-701',
      });
    });
  }
  return out;
}

/**
 * cloudanimal/security-plus-prep (MIT) — 151 questions in one JS file that
 * assigns a window global. Read as text and pulled apart with a small
 * tolerant parser rather than eval'd.
 */
function readCloudanimal() {
  const file = path.join(HARVEST, 'cloudanimal-questions.js');
  if (!fs.existsSync(file)) return [];
  const text = fs.readFileSync(file, 'utf8');
  const out = [];
  const re = /\{id:(\d+),domain:(\d),q:"((?:[^"\\]|\\.)*)",options:\[((?:"(?:[^"\\]|\\.)*",?\s*)+)\],answer:(\d),explain:"((?:[^"\\]|\\.)*)"\}/g;
  const unescape = (s) => s.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
  let m;
  while ((m = re.exec(text)) !== null) {
    const options = [...m[4].matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((o) => unescape(o[1]));
    out.push({
      id: `HV-CA-${String(m[1]).padStart(3, '0')}`,
      stem: unescape(m[3]),
      options,
      answer: Number(m[5]),
      explanation: unescape(m[6]),
      domain: `${m[2]}.0`,
      source: 'cloudanimal/security-plus-prep (MIT)',
    });
  }
  return out;
}

/* ------------------------------------------------------------------ */

const objectives = parseObjectives();
console.log('objective term counts:');
for (const o of objectives) {
  console.log(`  ${o.code}  ${String(o.terms.length).padStart(3)} terms`);
}

const raw = [...readIakhator(), ...readCloudanimal()];
console.log(`\nread ${raw.length} questions from harvest/`);

// Drop exact-duplicate stems: the final exam repeats some chapter questions.
const seen = new Set();
const items = [];
const tally = {};
const byObjective = {};

for (const it of raw) {
  const key = norm(it.stem).slice(0, 120);
  if (seen.has(key)) continue;
  seen.add(key);

  const a = assign(it, objectives);
  const useful = a.confidence === 'high' || a.confidence === 'medium';
  tally[a.confidence] = (tally[a.confidence] ?? 0) + 1;

  const domain = it.domain ?? (a.code ? `${a.code[0]}.0` : null);
  const objective = useful ? a.title : (domain ? `${domain[0]}.x General` : null);
  if (!objective) continue;                     // nothing to route on at all

  byObjective[objective] = (byObjective[objective] ?? 0) + 1;
  items.push({
    id: it.id,
    objective,
    domain,
    stem: it.stem,
    options: it.options,
    answer: it.answer,
    explanation: it.explanation,
    source: it.source,
    objective_inferred: true,
    objective_confidence: a.confidence,
    objective_evidence: a.evidence.slice(0, 6),
  });
}

console.log('\nobjective confidence:', tally);
console.log(`\nkept ${items.length} items (${raw.length - items.length} dropped as duplicate or unroutable)`);
console.log('\nper objective:');
for (const [k, v] of Object.entries(byObjective).sort()) {
  console.log(`  ${k.padEnd(62)} ${v}`);
}

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, `${JSON.stringify({
  note: 'Third-party practice questions harvested from public repositories. '
    + 'Objective codes are INFERRED by tools/import-harvest.mjs, not tagged by the '
    + 'original authors. Regenerate with `npm run import-harvest`.',
  sources: [...new Set(raw.map((r) => r.source))],
  generated: new Date().toISOString(),
  items,
}, null, 1)}\n`);

console.log(`\nwrote ${path.relative(ROOT, OUT)}`);
