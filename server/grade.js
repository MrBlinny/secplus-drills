// Blank-paper diff: what the learner typed vs the canonical taxonomy.
//
// Matching is deliberately strict-ish. Reproducing CompTIA's exact vocabulary
// IS the exercise — Failure Mode A is reaching for the adjacent real-world
// word — so a near-miss should surface, not be quietly forgiven. What softens
// that is the diagnosis on unmatched terms: if you wrote a known trap, or a
// term that belongs to a different objective, the grader says so by name.

import { TAXONOMIES, PAIRS, taxonomyById } from './content.js';

/** Multi-word expansions applied token-wise before comparison. */
const ALIASES = new Map(Object.entries({
  dos: 'denial of service',
  ddos: 'distributed denial of service',
  ml: 'machine learning',
  llm: 'large language model',
  slm: 'small language model',
  nlp: 'natural language processing',
  rag: 'retrieval augmented generation',
  gan: 'generative adversarial network',
  ai: 'ai',
  genai: 'generative ai',
  mitm: 'man in the middle',
  pii: 'personally identifiable information',
  api: 'api',
}));

const STOPWORDS = new Set(['the', 'a', 'an', 'of', 'and', 'or', 'for', 'to', 'in', 'on']);

/** Tokens: lowercase, parentheticals dropped, aliases expanded, stopwords out. */
function tokenize(s) {
  return String(s)
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')          // "(DoS)" is an annotation, not a word
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .flatMap((t) => (ALIASES.get(t) ?? t).split(' '))
    .filter((t) => !STOPWORDS.has(t));
}

/** Tight key: alphanumeric run with no separators, so "plug-in" == "plugin". */
const key = (s) => tokenize(s).join('');

/**
 * Looser key, additionally singularising each token, for matching a term
 * against itself across two places that spell it differently — "transfer
 * learning attack" logged by a confusion pair vs "Transfer learning attacks"
 * in the taxonomy. Not used for grading, where a plural slip is worth showing.
 */
export const recallKey = (s) =>
  tokenize(s).map((t) => (t.length > 3 ? t.replace(/s$/, '') : t)).join('');

function bigrams(s) {
  const out = new Set();
  for (let i = 0; i < s.length - 1; i++) out.add(s.slice(i, i + 2));
  return out;
}

/** Sørensen–Dice on character bigrams. Tolerates plurals and small typos. */
function dice(a, b) {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const A = bigrams(a);
  const B = bigrams(b);
  if (!A.size || !B.size) return 0;
  let shared = 0;
  for (const g of A) if (B.has(g)) shared++;
  return (2 * shared) / (A.size + B.size);
}

const THRESHOLD = 0.82;

function bestMatch(input, candidates, { threshold = THRESHOLD } = {}) {
  const k = key(input);
  let best = null;
  for (const c of candidates) {
    const score = dice(k, key(c.text ?? c));
    if (score >= threshold && (!best || score > best.score)) {
      best = { candidate: c, score };
    }
  }
  return best;
}

/** Split a free-text brain-dump into candidate terms. */
export function splitEntries(text) {
  return String(text ?? '')
    .split(/[\n,;]+/)
    .map((s) => s.replace(/^\s*(?:[-*••]|\d+[.)])\s*/, '').trim())
    .filter(Boolean);
}

/* ------------------------------------------------------------------ */
/* trap / cross-objective diagnosis for unmatched terms                */
/* ------------------------------------------------------------------ */

const TRAPS = PAIRS.map((p) => ({ text: p.common_trap, correct: p.correct_term, objective: p.objective }));

function diagnose(input, taxonomy) {
  const trap = bestMatch(input, TRAPS);
  const trapTerm = trap && key(trap.candidate.correct) !== key(input)
    ? trap.candidate.correct : null;

  // A term that really is on another objective's list: say which, first. That
  // is the more useful fact than the trap relationship.
  for (const t of TAXONOMIES) {
    if (t.id === taxonomy.id) continue;
    if (!bestMatch(input, t.terms.map((text) => ({ text })))) continue;
    return {
      kind: 'wrong-taxonomy',
      note: `Real objective-list term, but it belongs to ${t.label}, not ${taxonomy.label}.`
        + (trapTerm ? ` It is also the common trap for "${trapTerm}".` : ''),
      belongs_to: t.label,
      ...(trapTerm ? { correct_term: trapTerm } : {}),
    };
  }

  if (trapTerm) {
    return {
      kind: 'trap',
      note: `Failure Mode A trap — the objective-list term is "${trapTerm}".`,
      correct_term: trapTerm,
    };
  }

  return { kind: 'unknown', note: 'Not on the objective list for this taxonomy.' };
}

/* ------------------------------------------------------------------ */
/* the diff                                                            */
/* ------------------------------------------------------------------ */

export function gradeBlankPaper(taxonomyId, text) {
  const taxonomy = taxonomyById(taxonomyId);
  if (!taxonomy) throw new Error(`grade: unknown taxonomy "${taxonomyId}"`);

  const entries = splitEntries(text);
  const canonical = taxonomy.terms.map((text, i) => ({ text, i }));
  const claimed = new Map();   // canonical index -> the input that matched it
  const recalled = [];
  const invented = [];
  const duplicates = [];

  for (const entry of entries) {
    const open = canonical.filter((c) => !claimed.has(c.i));
    const hit = bestMatch(entry, open);

    if (hit) {
      claimed.set(hit.candidate.i, entry);
      recalled.push({
        input: entry,
        term: hit.candidate.text,
        exact: key(entry) === key(hit.candidate.text),
        score: Math.round(hit.score * 100) / 100,
      });
      continue;
    }

    // Already-claimed term written twice: a duplicate, not an invention.
    const dupe = bestMatch(entry, canonical.filter((c) => claimed.has(c.i)));
    if (dupe) {
      duplicates.push({ input: entry, term: dupe.candidate.text });
      continue;
    }

    invented.push({ input: entry, ...diagnose(entry, taxonomy) });
  }

  const missed = canonical.filter((c) => !claimed.has(c.i)).map((c) => c.text);

  return {
    taxonomy: {
      id: taxonomy.id, label: taxonomy.label, title: taxonomy.title,
      code: taxonomy.code, domain: taxonomy.domain,
      source: taxonomy.source, supplementary: !!taxonomy.supplementary,
    },
    total: canonical.length,
    recalled,
    missed,
    invented,
    duplicates,
    score: canonical.length ? recalled.length / canonical.length : 0,
  };
}
