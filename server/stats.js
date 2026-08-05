// All progress maths. Consumed by both the dashboard API and the report
// generator so the two can never disagree.

import { effectiveAttempts, isGraded, isStudy, EXTERNAL_MODES } from './attempts.js';
import {
  DOMAIN_WEIGHTS, DOMAIN_LABELS, BASELINE_WEIGHTED,
  objectiveCatalog, loadItemBank,
} from './content.js';

const DOMAINS = Object.keys(DOMAIN_WEIGHTS);
const pct = (x) => Math.round(x * 1000) / 10;

/** Local YYYY-MM-DD, so "today" means the learner's today, not UTC's. */
function localDay(ts) {
  const d = new Date(ts);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/* ------------------------------------------------------------------ */
/* accuracy                                                            */
/* ------------------------------------------------------------------ */

export function domainAccuracy(attempts) {
  const out = {};
  for (const d of DOMAINS) {
    const rows = attempts.filter((a) => a.domain === d && isGraded(a));
    const correct = rows.filter((a) => a.is_correct).length;
    out[d] = {
      domain: d,
      label: DOMAIN_LABELS[d],
      weight: DOMAIN_WEIGHTS[d],
      n: rows.length,
      correct,
      accuracy: rows.length ? correct / rows.length : null,
    };
  }
  return out;
}

/**
 * Blueprint-weighted projection: sum over domains of (weight x accuracy).
 *
 * Domains with no attempts are excluded and the weights renormalised over the
 * domains actually covered, with `coverage` reported so the UI can say how much
 * of the blueprint the number rests on. Returns null when nothing is graded
 * rather than inventing a figure.
 */
export function weightedProjection(attempts) {
  const byDomain = domainAccuracy(attempts);
  let acc = 0;
  let coverage = 0;
  for (const d of DOMAINS) {
    const info = byDomain[d];
    if (info.accuracy === null) continue;
    acc += info.weight * info.accuracy;
    coverage += info.weight;
  }
  const graded = attempts.filter(isGraded);
  return {
    weighted: coverage > 0 ? pct(acc / coverage) : null,
    coverage: pct(coverage),
    raw: graded.length ? pct(graded.filter((a) => a.is_correct).length / graded.length) : null,
    n: graded.length,
    byDomain,
  };
}

/* ------------------------------------------------------------------ */
/* objectives                                                          */
/* ------------------------------------------------------------------ */

/**
 * Bare codes to the bank's own label. Confusion-pair attempts log `objective`
 * as "2.6" while item attempts log "2.6 Attacks", which would otherwise rank as
 * two competing objectives and let one real weakness take two of the five
 * slots.
 *
 * Only folded when the code is unambiguous in the bank. SY0-701 has exactly one
 * label per code so this resolves cleanly; a code that ever mapped to two labels
 * would be left alone rather than forced into one of them.
 */
function labelResolver() {
  const byCode = new Map();
  for (const o of objectiveCatalog()) {
    const list = byCode.get(o.code) ?? [];
    list.push(o.objective);
    byCode.set(o.code, list);
  }
  return (objective) => {
    if (/\s/.test(objective)) return objective;      // already a full label
    const list = byCode.get(objective.toLowerCase());
    return list && list.length === 1 ? list[0] : objective;
  };
}

export function objectiveAccuracy(attempts) {
  const resolve = labelResolver();
  const map = new Map();
  for (const a of attempts) {
    if (!a.objective || !isGraded(a)) continue;
    const objective = resolve(String(a.objective));
    const cur = map.get(objective)
      ?? { objective, domain: a.domain, n: 0, correct: 0 };
    cur.n++;
    if (a.is_correct) cur.correct++;
    map.set(objective, cur);
  }
  return [...map.values()].map((o) => ({ ...o, accuracy: o.correct / o.n }));
}

/**
 * Weakest objectives. Ranked by miss rate discounted for small samples
 * (n/(n+3)), so one miss out of one does not outrank ten out of twenty.
 *
 * Before enough study attempts exist, falls back to ranking the bank's
 * objectives by their domain's baseline accuracy — labelled as such, because
 * the practice history carries domain codes only, never objective codes.
 */
export function weakestObjectives(attempts, limit = 5) {
  const scored = objectiveAccuracy(attempts)
    .map((o) => ({
      ...o,
      leverage: (DOMAIN_WEIGHTS[o.domain] ?? 0) * (1 - o.accuracy) * (o.n / (o.n + 3)),
      basis: 'attempts',
    }))
    .sort((a, b) => b.leverage - a.leverage || a.accuracy - b.accuracy);

  if (scored.length >= limit) return scored.slice(0, limit);

  // Top up from the bank using domain-level baseline accuracy.
  const seen = new Set(scored.map((o) => o.objective));
  const byDomain = domainAccuracy(effectiveAttempts().filter((a) => EXTERNAL_MODES.has(a.mode)));
  const fallback = objectiveCatalog()
    .filter((o) => !seen.has(o.objective))
    .map((o) => {
      const acc = byDomain[o.domain]?.accuracy ?? null;
      return {
        objective: o.objective,
        domain: o.domain,
        n: 0,
        correct: 0,
        accuracy: acc,
        leverage: (DOMAIN_WEIGHTS[o.domain] ?? 0) * (1 - (acc ?? 0.5)),
        basis: 'baseline-domain',
      };
    })
    .sort((a, b) => b.leverage - a.leverage);

  return [...scored, ...fallback].slice(0, limit);
}

/* ------------------------------------------------------------------ */
/* miss types and calibration                                          */
/* ------------------------------------------------------------------ */

export function missTypes(attempts) {
  const total = { A: 0, B: 0, C: 0, untagged: 0 };
  const byDay = new Map();
  for (const a of attempts) {
    if (a.is_correct !== false) continue;
    const key = a.miss_type && 'ABC'.includes(a.miss_type) ? a.miss_type : 'untagged';
    total[key]++;
    const day = localDay(a.ts);
    const d = byDay.get(day) ?? { day, A: 0, B: 0, C: 0, untagged: 0 };
    d[key]++;
    byDay.set(day, d);
  }
  return { total, byDay: [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day)) };
}

/** The dangerous ones: rated high confidence and still wrong. */
export function highConfidenceMisses(attempts, limit = 25) {
  const bank = new Map(loadItemBank().map((i) => [i.id, i]));
  return attempts
    .filter((a) => a.is_correct === false && a.confidence === 'high')
    .sort((a, b) => b.ts.localeCompare(a.ts))
    .slice(0, limit)
    .map((a) => {
      const item = bank.get(a.item_id);
      return {
        ts: a.ts,
        item_id: a.item_id,
        mode: a.mode,
        objective: a.objective,
        domain: a.domain,
        miss_type: a.miss_type,
        rule_tag: a.rule_tag,
        stem: item?.stem ?? a.cue ?? null,
        chose: item && a.chosen !== null ? item.options[a.chosen] : (a.note || null),
        answer: item && a.correct !== null ? item.options[a.correct] : (a.correct_term ?? null),
      };
    });
}

export function ruleTagCounts(attempts) {
  const counts = new Map();
  for (const a of attempts) {
    if (a.is_correct === false && a.rule_tag) {
      counts.set(a.rule_tag, (counts.get(a.rule_tag) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([rule, n]) => ({ rule: Number(rule), n }))
    .sort((a, b) => b.n - a.n);
}

/* ------------------------------------------------------------------ */
/* activity                                                            */
/* ------------------------------------------------------------------ */

export function activity(attempts) {
  const days = new Set(attempts.map((a) => localDay(a.ts)));
  const today = localDay(Date.now());

  let streak = 0;
  const cursor = new Date();
  if (!days.has(today)) cursor.setDate(cursor.getDate() - 1); // yesterday still counts
  for (;;) {
    if (!days.has(localDay(cursor))) break;
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }

  // Blank-paper and PBQ rows are scored, not marked right or wrong, so they
  // carry is_correct: null. Counting them in the denominator of "x of y
  // correct" would report a scored 78% run as a wrong answer.
  const todays = attempts.filter((a) => localDay(a.ts) === today);
  const gradedToday = todays.filter(isGraded);

  return {
    today,
    answeredToday: todays.length,
    gradedToday: gradedToday.length,
    correctToday: gradedToday.filter((a) => a.is_correct === true).length,
    scoredToday: todays.length - gradedToday.length,
    streak,
    totalAnswered: attempts.length,
  };
}

/** Blank-paper runs, newest first. */
export function blankPaperRuns(attempts, limit = 20) {
  return attempts
    .filter((a) => a.mode === 'blank')
    .sort((a, b) => b.ts.localeCompare(a.ts))
    .slice(0, limit)
    .map((a) => ({
      ts: a.ts,
      taxonomy: a.taxonomy ?? a.item_id,
      score: a.score,
      recalled: a.recalled ?? null,
      missed: a.missed ?? null,
      invented: a.invented ?? null,
      total: a.total ?? null,
    }));
}

/* ------------------------------------------------------------------ */
/* the whole dashboard payload                                         */
/* ------------------------------------------------------------------ */

export function snapshot({ includeBaseline = false } = {}) {
  const all = effectiveAttempts();
  const study = all.filter(isStudy);
  const scope = includeBaseline ? all : study;

  const recent = study.filter(isGraded).slice(-50);

  return {
    baselineWeighted: BASELINE_WEIGHTED,
    includeBaseline,
    projection: weightedProjection(scope),
    allTime: weightedProjection(all),
    rolling50: recent.length ? weightedProjection(recent) : null,
    weakest: weakestObjectives(study),
    missTypes: missTypes(study),
    highConfidenceMisses: highConfidenceMisses(study),
    ruleTags: ruleTagCounts(study),
    activity: activity(study),
    blankPaper: blankPaperRuns(study),
    counts: {
      total: all.length,
      baseline: all.length - study.length,
      study: study.length,
      graded: study.filter(isGraded).length,
    },
  };
}
