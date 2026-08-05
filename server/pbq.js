// Performance-based questions.
//
// The real exam opens with 2–6 PBQs and gives 60 minutes for at most 60
// questions, so a PBQ that takes four minutes costs four multiple-choice
// answers. They are worth practising for the clock as much as for the content.
//
// Three shapes cover what CompTIA actually asks:
//   assign     every row gets one term from a shared pool  (match / configure)
//   select     choose exactly N from a pool, wrong picks cost a mark
//   order      put the steps into the objective-list sequence
//
// Grading is partial-credit per cell, which is how CompTIA scores them. The
// resulting fraction is logged as `score`; see gradePbq for why is_correct is
// deliberately left null.

import fs from 'node:fs';
import { PBQ_BANK_FILE } from './paths.js';
import { OBJECTIVE_TERMS, objectiveCode, domainOf } from './content.js';

const read = () => JSON.parse(fs.readFileSync(PBQ_BANK_FILE, 'utf8')).items;

/* ------------------------------------------------------------------ */
/* validation                                                          */
/* ------------------------------------------------------------------ */

/**
 * Every term used as a credited answer must be a real objective-list term.
 *
 * Same reasoning as the taxonomy assertions in content.js: a PBQ that quietly
 * credits a term CompTIA does not use would teach the wrong word, which is
 * precisely the failure this app exists to attack. Checked at load, so a typo
 * fails loudly instead of becoming a lesson.
 *
 * The vocabulary is every bullet in objectives.md, not just the sixteen
 * blank-paper taxonomies — SY0-701 has 610 examinable terms and a PBQ has every
 * right to credit one that no taxonomy happens to cover.
 */
const KNOWN = OBJECTIVE_TERMS;

/**
 * A quantitative PBQ credits a computed figure rather than a term - "8,000",
 * "0.1". Those are answers the objectives document cannot contain, so they are
 * matched by shape instead of by lookup.
 */
const isComputed = (term) => /^[^A-Za-z]*[0-9][0-9.,]*%?$/.test(String(term).trim());

const isKnown = (term) => KNOWN.has(String(term).toLowerCase().trim()) || isComputed(term);

function validate(items) {
  const problems = [];
  const seen = new Set();

  for (const it of items) {
    if (seen.has(it.id)) problems.push(`${it.id}: duplicate id`);
    seen.add(it.id);

    const credited = it.type === 'assign' ? it.cells.map((c) => c.answer)
      : it.type === 'select' ? it.answer
        : it.steps;

    for (const term of credited) {
      if (!isKnown(term)) problems.push(`${it.id}: "${term}" is not an objective-list term`);
    }

    if (it.type === 'assign') {
      for (const c of it.cells) {
        if (!it.pool.includes(c.answer)) problems.push(`${it.id}: answer "${c.answer}" not in pool`);
        if (!c.explanation) problems.push(`${it.id}: cell "${c.answer}" has no explanation`);
      }
    }
    if (it.type === 'select') {
      if (it.answer.length !== it.choose) {
        problems.push(`${it.id}: choose=${it.choose} but ${it.answer.length} answers`);
      }
      for (const opt of it.pool) {
        if (!it.explanations?.[opt]) problems.push(`${it.id}: option "${opt}" has no explanation`);
      }
      for (const a of it.answer) {
        if (!it.pool.includes(a)) problems.push(`${it.id}: answer "${a}" not in pool`);
      }
    }
    if (it.type === 'order' && !it.explanation) problems.push(`${it.id}: no explanation`);
    if (!['assign', 'select', 'order'].includes(it.type)) {
      problems.push(`${it.id}: unknown type "${it.type}"`);
    }
  }
  return problems;
}

let cache = null;

export function loadPbqBank() {
  if (cache) return cache;
  const items = read();
  const problems = validate(items);
  if (problems.length) {
    throw new Error(`pbq-bank.json is invalid:\n  ${problems.join('\n  ')}`);
  }
  cache = items.map((it) => ({
    ...it,
    code: objectiveCode(it.objective),
    domain: domainOf(it.objective),
    cellCount: it.type === 'assign' ? it.cells.length
      : it.type === 'select' ? it.choose : it.steps.length,
  }));
  return cache;
}

export const pbqById = (id) => loadPbqBank().find((p) => p.id === id) ?? null;

/* ------------------------------------------------------------------ */
/* presentation                                                        */
/* ------------------------------------------------------------------ */

const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

/** Strip every answer key before the question goes to the browser. */
export function toPbq(it) {
  const base = {
    id: it.id,
    type: it.type,
    objective: it.objective,
    code: it.code,
    domain: it.domain,
    title: it.title,
    brief: it.brief,
    instruction: it.instruction,
    minutes: it.minutes ?? 3,
    cellCount: it.cellCount,
  };
  if (it.type === 'assign') {
    return { ...base, pool: it.pool, cells: it.cells.map((c) => ({ prompt: c.prompt })) };
  }
  if (it.type === 'select') {
    return { ...base, pool: shuffle(it.pool), choose: it.choose };
  }
  // Presented scrambled; a shuffle that happens to be correct would be a
  // free mark, so keep drawing until it differs.
  let scrambled = shuffle(it.steps);
  for (let i = 0; i < 8 && scrambled.every((s, k) => s === it.steps[k]); i++) {
    scrambled = shuffle(it.steps);
  }
  return { ...base, steps: scrambled };
}

/* ------------------------------------------------------------------ */
/* grading                                                             */
/* ------------------------------------------------------------------ */

/**
 * Partial credit, as CompTIA scores PBQs.
 *
 * `is_correct` is returned as null unless the whole thing is right. A PBQ is
 * not one answer, and folding a 6-of-8 into a single false would understate it
 * while folding it into a single true would overstate it. The honest number is
 * `score`, and the report treats PBQs as their own scale — the same reasoning
 * that keeps free-recall pairs out of the multiple-choice projection.
 */
export function gradePbq(item, response) {
  const cells = [];

  if (item.type === 'assign') {
    item.cells.forEach((c, i) => {
      const chosen = response?.[i] ?? null;
      cells.push({
        prompt: c.prompt,
        chosen,
        answer: c.answer,
        ok: chosen === c.answer,
        explanation: c.explanation,
      });
    });
  } else if (item.type === 'select') {
    const picked = Array.isArray(response) ? [...new Set(response)] : [];
    const key = new Set(item.answer);
    for (const p of picked) {
      cells.push({
        prompt: p,
        chosen: p,
        answer: key.has(p) ? p : null,
        ok: key.has(p),
        explanation: item.explanations[p],
      });
    }
    // Credited options that were never picked are misses too, and their
    // explanation is the part worth reading.
    for (const a of item.answer) {
      if (!picked.includes(a)) {
        cells.push({
          prompt: a, chosen: null, answer: a, ok: false, missed: true,
          explanation: item.explanations[a],
        });
      }
    }
  } else {
    item.steps.forEach((s, i) => {
      const chosen = response?.[i] ?? null;
      cells.push({
        prompt: `Position ${i + 1}`,
        chosen,
        answer: s,
        ok: chosen === s,
        explanation: null,
      });
    });
  }

  // Wrong picks in a select cost a mark, which is why the numerator can go
  // negative before the floor.
  const right = cells.filter((c) => c.ok).length;
  const wrong = item.type === 'select'
    ? cells.filter((c) => !c.ok && !c.missed).length
    : 0;
  const denom = item.type === 'select' ? item.choose : cells.length;
  const score = Math.max(0, (right - wrong) / denom);

  return {
    score,
    right,
    total: denom,
    perfect: score === 1,
    cells,
    explanation: item.explanation ?? null,
  };
}
