// Loads the authored content and parses objectives.md into the canonical
// taxonomies that blank-paper mode diffs against.
//
// The taxonomies are the whole point of blank-paper mode, so every list is
// asserted against its expected length at startup. If someone edits
// objectives.md in a way the parser does not follow, the app refuses to boot
// rather than quietly grading against a truncated list.

import fs from 'node:fs';
import {
  OBJECTIVES_FILE, PAIRS_FILE, RULES_FILE,
  ITEM_BANK_FILE, COVERAGE_BANK_FILE, PRACTICE_BANK_FILE, HISTORY_FILE,
} from './paths.js';

export const DOMAIN_WEIGHTS = {
  '1.0': 0.12, '2.0': 0.22, '3.0': 0.18, '4.0': 0.28, '5.0': 0.20,
};

export const DOMAIN_LABELS = {
  '1.0': 'General Security Concepts',
  '2.0': 'Threats, Vulnerabilities, and Mitigations',
  '3.0': 'Security Architecture',
  '4.0': 'Security Operations',
  '5.0': 'Security Program Management and Oversight',
};

/**
 * Questions per domain in a 90-question exam sim, at blueprint weight.
 * 12/22/18/28/20 of 90 is 10.8 / 19.8 / 16.2 / 25.2 / 18.0; rounded to sum to
 * exactly 90.
 */
export const EXAM_QUOTAS = { '1.0': 11, '2.0': 20, '3.0': 16, '4.0': 25, '5.0': 18 };

/** Real exam length and clock, mirrored by the sim. */
export const EXAM_QUESTIONS = 90;
export const EXAM_MINUTES = 90;

/**
 * No pre-study baseline exists for this exam. The SecAI+ repo could draw a
 * reference line because two full practice exams had been sat cold before any
 * study began; nothing equivalent has been sat here. Null on purpose — the
 * dashboard omits the baseline rather than inventing one.
 */
export const BASELINE_WEIGHTED = null;

const readText = (f) => fs.readFileSync(f, 'utf8');
const readJson = (f) => JSON.parse(readText(f));

/* ------------------------------------------------------------------ */
/* markdown helpers                                                     */
/* ------------------------------------------------------------------ */

/**
 * Slice objectives.md down to a single `## <code>` section.
 *
 * Sec+ reuses bold headers across objectives — "Supply chain" is in both 2.2
 * and 2.3, "Testing" in both 3.4 and 4.8, "Penetration testing" in 4.3, 5.3
 * and 5.5. A whole-file search for a header would silently grab whichever came
 * first, so every lookup is scoped to its objective.
 */
function section(text, code) {
  const lines = text.split(/\r?\n/);
  const start = lines.findIndex((l) => new RegExp(`^##\\s+${code.replace('.', '\\.')}\\s`).test(l));
  if (start === -1) throw new Error(`content: objective ${code} not found in objectives.md`);
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((l) => /^#{1,2}\s/.test(l));
  return rest.slice(0, end === -1 ? rest.length : end).join('\n');
}

/**
 * Collect the bullet list that follows `marker`, as {text, depth} entries.
 * Stops at the first non-blank, non-bullet line (a new bold header or `---`).
 */
function bulletsAfter(text, marker) {
  const lines = text.split(/\r?\n/);
  const start = lines.findIndex((l) => l.trim().startsWith(marker));
  if (start === -1) throw new Error(`content: marker not found: ${marker}`);

  const out = [];
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === '') {
      const next = lines.slice(i + 1).find((l) => l.trim() !== '');
      if (!next || !/^\s*-\s+/.test(next)) break;
      continue;
    }
    const m = line.match(/^(\s*)-\s+(.+)$/);
    if (!m) break;
    out.push({ text: m[2].trim(), depth: Math.floor(m[1].length / 2) });
  }
  return out;
}

/** Strip markdown emphasis and any trailing em-dash annotation. */
const clean = (s) => s.replace(/\*\*/g, '').replace(/\s+—\s+.*$/, '').trim();

/**
 * The terms under one bold header of one objective.
 * `maxDepth: 0` keeps only top-level bullets, dropping the examples CompTIA
 * nests underneath — those illustrate a term rather than being terms to
 * reproduce on blank paper.
 */
function listIn(text, code, marker, { maxDepth = 9, exclude = [] } = {}) {
  const skip = new Set(exclude.map((s) => s.toLowerCase()));
  return bulletsAfter(section(text, code), marker)
    .filter((b) => b.depth <= maxDepth)
    .map((b) => clean(b.text))
    .filter((t) => t && !skip.has(t.toLowerCase()));
}

function expect(list, n, name) {
  if (list.length !== n) {
    throw new Error(
      `content: taxonomy "${name}" parsed ${list.length} items, expected ${n}. `
      + `Parsed: ${JSON.stringify(list)}`,
    );
  }
  return list;
}

/* ------------------------------------------------------------------ */
/* taxonomies                                                           */
/* ------------------------------------------------------------------ */

/**
 * The closed, enumerable lists worth reproducing from memory.
 *
 * Not every objective yields one. A taxonomy earns a place here when it is
 * finite, when CompTIA's own wording is the credited answer, and when the
 * members are confusable with each other — which is exactly the set multiple
 * choice lets you recognise and blank paper does not.
 *
 * `ordered` marks lists where the sequence is itself examinable.
 */
const TAXONOMY_SPEC = [
  { id: '1.1-categories', code: '1.1', header: '**Categories**', n: 4,
    title: 'The 4 control categories' },
  { id: '1.1-control-types', code: '1.1', header: '**Control types**', n: 6,
    title: 'The 6 control types' },
  { id: '1.2-zt-control-plane', code: '1.2', header: '**Zero Trust — Control Plane**', n: 5,
    title: 'Zero Trust — the Control Plane' },
  { id: '1.2-zt-data-plane', code: '1.2', header: '**Zero Trust — Data Plane**', n: 3,
    title: 'Zero Trust — the Data Plane' },
  { id: '1.4-certificates', code: '1.4', header: '**Certificates**', n: 8,
    title: 'The 8 certificate terms' },
  { id: '2.1-threat-actors', code: '2.1', header: '**Threat actors**', n: 6,
    title: 'The 6 threat actors' },
  { id: '2.1-motivations', code: '2.1', header: '**Motivations**', n: 10,
    title: 'The 10 motivations' },
  { id: '2.2-social-engineering', code: '2.2', header: '**Human vectors/social engineering**', n: 10,
    title: 'The 10 human vectors' },
  { id: '2.4-malware', code: '2.4', header: '**Malware attacks**', n: 9,
    title: 'The 9 malware types' },
  { id: '2.4-indicators', code: '2.4', header: '**Indicators**', n: 9,
    title: 'The 9 indicators of malicious activity' },
  { id: '3.3-classifications', code: '3.3', header: '**Data classifications**', n: 6,
    title: 'The 6 data classifications' },
  { id: '4.6-access-controls', code: '4.6', header: '**Access controls**', n: 7,
    title: 'The 7 access control schemes' },
  { id: '4.8-ir-process', code: '4.8', header: '**Process**', n: 7, ordered: true,
    title: 'The incident response process, in order' },
  { id: '5.2-risk-strategies', code: '5.2', header: '**Risk management strategies**', n: 6,
    title: 'The risk management strategies' },
  { id: '5.3-agreements', code: '5.3', header: '**Agreement types**', n: 7,
    title: 'The 7 agreement types' },
  { id: '5.5-pentest', code: '5.5', header: '**Penetration testing**', n: 8, maxDepth: 0,
    title: 'The 8 penetration testing terms' },
];

function buildTaxonomies() {
  const obj = readText(OBJECTIVES_FILE);
  return TAXONOMY_SPEC.map((s) => ({
    id: s.id,
    code: s.code,
    domain: `${s.code[0]}.0`,
    label: `${s.code} ${s.header.replace(/\*\*/g, '')}`,
    title: s.title,
    ordered: Boolean(s.ordered),
    terms: expect(
      listIn(obj, s.code, s.header, { maxDepth: s.maxDepth ?? 9 }),
      s.n, `${s.code} ${s.title}`,
    ),
    source: 'objectives.md',
  }));
}

/* ------------------------------------------------------------------ */
/* exports                                                              */
/* ------------------------------------------------------------------ */

export const TAXONOMIES = buildTaxonomies();
export const taxonomyById = (id) => TAXONOMIES.find((t) => t.id === id) ?? null;

/**
 * Every bullet term in objectives.md, lower-cased, for validating that authored
 * content credits CompTIA's vocabulary rather than its own.
 *
 * Each term is registered three ways because authored content legitimately
 * writes it in any of them: the full bullet ("Trusted Platform Module (TPM)"),
 * the phrase alone, and the parenthesised acronym.
 */
export const OBJECTIVE_TERMS = (() => {
  const terms = new Set();
  for (const line of readText(OBJECTIVES_FILE).split(/\r?\n/)) {
    if (/^#\s+Acronym/i.test(line)) break;
    const m = line.match(/^\s*-\s+(.*)$/);
    if (!m) continue;
    const term = clean(m[1]);
    if (!term) continue;
    terms.add(term.toLowerCase());
    const bare = term.replace(/\s*\([^)]*\)/g, '').replace(/\s+/g, ' ').trim();
    if (bare) terms.add(bare.toLowerCase());
    for (const inner of term.matchAll(/\(([^)]+)\)/g)) terms.add(inner[1].trim().toLowerCase());
  }
  return terms;
})();

export const RULES = readJson(RULES_FILE).rules;

export const PAIRS = readJson(PAIRS_FILE).pairs.map((p, i) => ({
  id: `PAIR-${String(i + 1).padStart(3, '0')}`,
  ...p,
  domain: domainOf(p.objective),
}));

/**
 * The authored bank plus, if it has been imported, the harvested third-party
 * bank. They are kept in separate files so the authored items — whose
 * distractors are adjacent objective-list terms and whose explanations name a
 * discriminator — are never edited by an import, and so a bad import can be
 * deleted in one step. `origin` lets the UI caveat a harvested item and lets
 * selection prefer authored ones where it matters.
 */
export function loadItemBank() {
  const decorate = (origin) => (it) => ({
    ...it,
    origin,
    code: objectiveCode(it.objective),
    domain: it.domain ?? domainOf(it.objective),
  });

  const authored = [
    ...readJson(ITEM_BANK_FILE).items,
    // Gap-closing bank: authored so every objective-list term is producible.
    // Same trust level as the main authored bank, kept separate so the coverage
    // audit that produced it stays auditable and the set stays deletable.
    ...(fs.existsSync(COVERAGE_BANK_FILE) ? readJson(COVERAGE_BANK_FILE).items : []),
  ].map(decorate('authored'));

  if (!fs.existsSync(PRACTICE_BANK_FILE)) return authored;

  const practice = readJson(PRACTICE_BANK_FILE).items.map(decorate('practice'));
  const seen = new Set(authored.map((it) => it.id));
  return [...authored, ...practice.filter((it) => !seen.has(it.id))];
}

export const loadHistory = () => (fs.existsSync(HISTORY_FILE) ? readJson(HISTORY_FILE).items : []);

/* ------------------------------------------------------------------ */
/* objective / domain normalisation                                     */
/* ------------------------------------------------------------------ */

/** "2.4 Given a scenario…" -> "2.4";  "3.x General" -> "3.x" */
export function objectiveCode(label) {
  if (!label) return null;
  const m = String(label).trim().match(/^(\d+\.(?:\d+|x))/i);
  return m ? m[1].toLowerCase() : null;
}

/** Accepts an objective label, a bare code, or a domain string. */
export function domainOf(value) {
  if (!value) return null;
  const m = String(value).trim().match(/^(\d)/);
  return m ? `${m[1]}.0` : null;
}

/** Every distinct objective label present in the bank, with counts. */
export function objectiveCatalog(items = loadItemBank()) {
  const map = new Map();
  for (const it of items) {
    const cur = map.get(it.objective) ?? {
      objective: it.objective, code: it.code, domain: it.domain, count: 0,
    };
    cur.count++;
    map.set(it.objective, cur);
  }
  return [...map.values()].sort((a, b) => a.objective.localeCompare(b.objective));
}
