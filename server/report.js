// npm run report — regenerate data/PROGRESS.md from data/attempts.jsonl.
//
// Written to be read in one pass by a human or an LLM: the headline first, the
// single highest-leverage action second, the supporting detail after. Never
// hand-edit the output; edit this generator instead.

import fs from 'node:fs';
import { PROGRESS_FILE } from './paths.js';
import { effectiveAttempts, isGraded, isStudy } from './attempts.js';
import {
  snapshot, weightedProjection, objectiveAccuracy, domainAccuracy,
} from './stats.js';
import {
  DOMAIN_WEIGHTS, DOMAIN_LABELS, BASELINE_WEIGHTED, TAXONOMIES, RULES, loadItemBank,
} from './content.js';
import { dueCounts, due, loadQueue } from './scheduler.js';

const pct = (v, d = 1) => (v === null || v === undefined ? '—' : `${Number(v).toFixed(d)}%`);
const pctOf = (f, d = 1) => (f === null || f === undefined ? '—' : `${(f * 100).toFixed(d)}%`);
const signed = (v) => (v === null ? '—' : `${v > 0 ? '+' : ''}${v.toFixed(1)}`);

/* ------------------------------------------------------------------ */
/* coverage                                                            */
/* ------------------------------------------------------------------ */

/**
 * Per-objective breakdown of how much of the authored bank has been proven.
 *
 * Proven means answered correctly at least once, ever — including in the
 * baseline. It is a coverage measure, not an accuracy measure: the question is
 * "has this been demonstrated", not "how often". Third-party practice items and
 * off-syllabus items are out, because proving those proves nothing about the
 * objectives document.
 */
export function coverage() {
  const bank = loadItemBank().filter((i) => i.origin === 'authored' && !i.off_syllabus);

  const right = new Set();
  const seen = new Set();
  for (const a of effectiveAttempts()) {
    if (!a.item_id || !isGraded(a)) continue;
    seen.add(a.item_id);
    if (a.is_correct) right.add(a.item_id);
  }

  const byObj = new Map();
  for (const i of bank) {
    const r = byObj.get(i.objective)
      ?? { objective: i.objective, total: 0, proven: 0, neverRight: 0, unseen: 0 };
    r.total++;
    if (right.has(i.id)) r.proven++;
    else if (seen.has(i.id)) r.neverRight++;
    else r.unseen++;
    byObj.set(i.objective, r);
  }

  const rows = [...byObj.values()].sort((a, b) => a.objective.localeCompare(b.objective));
  return {
    rows,
    total: bank.length,
    proven: rows.reduce((s, r) => s + r.proven, 0),
    neverRight: rows.reduce((s, r) => s + r.neverRight, 0),
    unseen: rows.reduce((s, r) => s + r.unseen, 0),
  };
}

/* ------------------------------------------------------------------ */
/* the recommendation                                                  */
/* ------------------------------------------------------------------ */

/**
 * Highest-leverage next action, in plain language.
 *
 * Leverage is blueprint-weighted point recovery — domain weight x miss rate,
 * discounted for small samples — not raw miss count, so it points at what
 * actually moves the score rather than at whatever has been drilled most.
 */
function recommendation(all, study) {
  const graded = study.filter(isGraded);

  if (graded.length < 10) {
    const worstBlank = blankScores(study).sort((a, b) => a.best - b.best)[0];
    if (worstBlank && worstBlank.best < 0.8) {
      return `Not enough study answers yet to rank objectives (${graded.length} logged). `
        + `The one signal that is already there: blank paper on **${worstBlank.label}** came out at `
        + `${pctOf(worstBlank.best, 0)}. Reproduce that list until it is complete, then start drilling — `
        + `Domain 4 is 28% of the exam and is the obvious place to spend time.`;
    }
    return `Not enough study answers yet to rank objectives (${graded.length} logged). `
      + `Start with blank paper on the 2.4 malware and indicator lists — 18 terms inside the 22% domain, `
      + `and the fastest way to find out which terms are actually missing. Then drill 4.5 and 4.6, `
      + `which sit inside the 28% domain.`;
  }

  const ranked = objectiveAccuracy(study)
    .map((o) => ({
      ...o,
      leverage: (DOMAIN_WEIGHTS[o.domain] ?? 0) * (1 - o.accuracy) * (o.n / (o.n + 3)),
    }))
    .sort((a, b) => b.leverage - a.leverage);

  const top = ranked[0];
  if (!top || top.leverage <= 0) {
    return `Nothing is standing out as weak in the logged answers — every objective with data is `
      + `at or near full marks. Widen coverage: run an exam sim for a blueprint-weighted read, `
      + `since a narrow drill history flatters the projection.`;
  }

  // Unproven items outrank a weak objective: an objective can only look strong
  // because the handful of its items that were served happened to be easy ones.
  const cov = coverage();
  const unproven = cov.neverRight + cov.unseen;

  return `Work on **${top.objective}** next. It is at ${pctOf(top.accuracy)} across ${top.n} logged `
    + `answer${top.n === 1 ? '' : 's'} in Domain ${top.domain} (${Math.round((DOMAIN_WEIGHTS[top.domain] ?? 0) * 100)}% `
    + `of the exam), which makes it the largest recoverable block of blueprint-weighted marks on the board. `
    + `Read the material for it, then drill that objective directly.`
    + (unproven
      ? ` Before that, though: **${unproven} of ${cov.total} authored items have not yet been `
        + `answered correctly even once.** Run Cover everything on the Drill page until that is zero — `
        + `an objective cannot be called known while items in it have never been served.`
      : ` Every authored item has been answered correctly at least once, so this is refinement, `
        + `not coverage.`);
}

function blankScores(study) {
  const byTax = new Map();
  for (const a of study) {
    if (a.mode !== 'blank') continue;
    const id = a.taxonomy ?? a.item_id;
    const tax = TAXONOMIES.find((t) => t.id === id);
    const cur = byTax.get(id) ?? {
      id, label: tax?.title ?? id, code: tax?.code ?? '', runs: 0, best: 0, last: 0, lastTs: '',
    };
    cur.runs++;
    cur.best = Math.max(cur.best, a.score ?? 0);
    if (a.ts > cur.lastTs) { cur.lastTs = a.ts; cur.last = a.score ?? 0; }
    byTax.set(id, cur);
  }
  return [...byTax.values()];
}

/* ------------------------------------------------------------------ */
/* the document                                                        */
/* ------------------------------------------------------------------ */

export function buildReport() {
  const all = effectiveAttempts();
  const study = all.filter(isStudy);
  const snap = snapshot({ includeBaseline: false });

  const studyProj = weightedProjection(study);
  const allProj = weightedProjection(all);
  const baseProj = weightedProjection(all.filter((a) => a.mode === 'baseline'));
  const L = [];

  const now = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  L.push('# PROGRESS — Security+ SY0-701');
  L.push('');
  L.push(`*Generated ${now} by \`npm run report\` from \`data/attempts.jsonl\`. Never hand-edit this file.*`);
  L.push('');

  /* ---- headline ---- */
  L.push('## Where things stand');
  L.push('');
  const delta = (studyProj.weighted === null || BASELINE_WEIGHTED === null)
    ? null : studyProj.weighted - BASELINE_WEIGHTED;
  L.push('| | |');
  L.push('|---|---|');
  const caveat = studyProj.weighted === null
    ? '— no study answers logged yet'
    : studyProj.n < 20 ? `— provisional, only ${studyProj.n} answer${studyProj.n === 1 ? '' : 's'}` : '';
  L.push(`| **Blueprint-weighted projection** (study answers only) | **${pct(studyProj.weighted)}** ${caveat} |`);
  L.push(`| Raw accuracy (study answers only) | ${pct(studyProj.raw)} |`);
  // No cold practice exam was sat before study on this cert, so there is no
  // baseline to move against. Reporting one anyway would invent a number.
  if (BASELINE_WEIGHTED !== null) {
    L.push(`| Pre-study baseline | ${pct(BASELINE_WEIGHTED)} |`);
    L.push(`| Movement vs baseline | ${delta === null ? '—' : `${signed(delta)} pts`} |`);
  }
  // This is *domain* coverage — whether all five domains have answers — and it
  // reads 100% as soon as one answer lands in each. On the SecAI+ repo it read
  // 100% while an objective had a single logged attempt, so it is labelled for
  // what it actually measures and the real number is carried next to it.
  const covNow = coverage();
  L.push(`| All five domains have answers | ${pct(studyProj.coverage, 0)} |`);
  L.push(`| **Authored items proven** (answered right at least once) | **${covNow.proven}/${covNow.total}**`
    + ` (${pctOf(covNow.proven / Math.max(1, covNow.total), 0)}) |`);
  L.push(`| All answers incl. baseline | ${pct(allProj.weighted)} weighted, ${pct(allProj.raw)} raw |`);
  const nBase = all.filter((a) => a.mode === 'baseline').length;
  const nPractice = all.filter((a) => a.mode === 'practice-test').length;
  L.push(`| Answers logged | ${study.length} study + ${nBase} baseline`
    + `${nPractice ? ` + ${nPractice} external practice-test` : ''} = ${all.length} |`);
  L.push('');
  if (studyProj.n > 0 && studyProj.n < 20) {
    L.push(`> The projection rests on ${studyProj.n} graded answer${studyProj.n === 1 ? '' : 's'}. `
      + `Treat it as noise until there are at least 20.`);
    L.push('');
  }

  // The baseline is 120 four-option questions. Free recall against a blank box
  // is a harder task, so a projection built mostly from confusion-pair answers
  // is not comparable to it, and the movement figure will read as a decline
  // that did not happen. Say so rather than let the number stand alone.
  const gradedStudy = study.filter(isGraded);
  const nPairs = gradedStudy.filter((a) => a.mode === 'pairs').length;
  if (gradedStudy.length && nPairs / gradedStudy.length > 0.4) {
    L.push(`> ${nPairs} of ${gradedStudy.length} study answers are free-recall confusion pairs, `
      + 'where the term has to be produced from nothing. The exam is multiple choice with '
      + 'four options. Recall accuracy runs lower than recognition accuracy on identical '
      + 'material, so the projection above understates where you would land on the exam. '
      + 'Drill and exam-sim answers are the comparable ones.');
    L.push('');
  }

  /* ---- the one thing ---- */
  L.push('## Do this next');
  L.push('');
  L.push(recommendation(all, study));
  L.push('');

  /* ---- domains ---- */
  L.push('## By domain');
  L.push('');
  L.push('| Domain | Weight | Study answers | Accuracy | Baseline | Movement |');
  L.push('|---|---|---|---|---|---|');
  const sd = domainAccuracy(study);
  const bd = domainAccuracy(all.filter((a) => a.mode === 'baseline'));
  for (const d of Object.keys(DOMAIN_WEIGHTS)) {
    const s = sd[d];
    const b = bd[d];
    const dd = s.accuracy !== null && b.accuracy !== null
      ? `${signed((s.accuracy - b.accuracy) * 100)} pts` : '—';
    L.push(`| ${d} ${DOMAIN_LABELS[d]} | ${Math.round(DOMAIN_WEIGHTS[d] * 100)}% | ${s.n ? `${s.correct}/${s.n}` : '0'} `
      + `| ${s.accuracy === null ? '—' : pctOf(s.accuracy)} | ${b.accuracy === null ? '—' : pctOf(b.accuracy)} | ${dd} |`);
  }
  L.push('');

  /* ---- external practice sittings ---- */
  const practice = all.filter((a) => a.mode === 'practice-test' && isGraded(a));
  if (practice.length) {
    L.push('## External practice tests');
    L.push('');
    L.push('Imported from saved result pages. Kept out of the projection above because every '
      + 'sitting was left part-finished, which makes the answered questions a self-selected '
      + 'sample rather than a random one.');
    L.push('');
    L.push('| Sitting | Answered | Correct | Accuracy |');
    L.push('|---|---|---|---|');
    const bySitting = new Map();
    for (const a of practice) {
      const k = a.source_exam ?? 'unknown';
      const cur = bySitting.get(k) ?? { n: 0, correct: 0 };
      cur.n++;
      if (a.is_correct) cur.correct++;
      bySitting.set(k, cur);
    }
    for (const [k, v] of [...bySitting.entries()].sort()) {
      L.push(`| ${k} | ${v.n} | ${v.correct} | ${pctOf(v.correct / v.n)} |`);
    }
    const tot = practice.filter((a) => a.is_correct).length;
    L.push(`| **All** | **${practice.length}** | **${tot}** | **${pctOf(tot / practice.length)}** |`);
    L.push('');
  }

  /* ---- objectives ---- */
  const objs = objectiveAccuracy(study).sort((a, b) => a.accuracy - b.accuracy || b.n - a.n);
  L.push('## By objective');
  L.push('');
  if (!objs.length) {
    L.push('_No objective-level answers yet. The 120 baseline rows carry domain codes only, '
      + 'so objective accuracy starts accumulating with your first drill._');
  } else {
    L.push('| Objective | Domain | Correct | Accuracy |');
    L.push('|---|---|---|---|');
    for (const o of objs) {
      L.push(`| ${o.objective} | ${o.domain} | ${o.correct}/${o.n} | ${pctOf(o.accuracy)} |`);
    }
  }
  L.push('');

  L.push('### Weakest five right now');
  L.push('');
  if (!snap.weakest.length) {
    L.push('_Not enough data._');
  } else {
    L.push('| Objective | Accuracy | Seen | Ranked from |');
    L.push('|---|---|---|---|');
    for (const w of snap.weakest) {
      L.push(`| ${w.objective} | ${w.accuracy === null ? '—' : pctOf(w.accuracy)} | ${w.n ? `${w.correct}/${w.n}` : '0'} `
        + `| ${w.basis === 'attempts' ? 'your answers' : 'baseline domain accuracy'} |`);
    }
  }
  L.push('');

  /* ---- coverage ----
   * Replaces the old miss-type, rule-tag and high-confidence sections. All
   * three depended on a self-classification captured at answer time, which is
   * no longer collected: the flow records only right or wrong. This section
   * answers the question that actually matters close to the exam — what have I
   * not yet proven I know?
   */
  L.push('## Coverage');
  L.push('');
  L.push('_An item is **proven** once it has been answered correctly at least once. '
    + 'Everything else has either never been seen or has never yet been got right._');
  L.push('');

  const cov = coverage();
  L.push(`**${cov.proven} of ${cov.total} authored items proven** `
    + `(${pctOf(cov.proven / Math.max(1, cov.total), 0)}) — `
    + `${cov.neverRight} answered but never right, ${cov.unseen} never seen.`);
  L.push('');
  L.push('| Objective | Proven | Never right | Unseen |');
  L.push('|---|---|---|---|');
  for (const o of cov.rows) {
    L.push(`| ${o.objective} | ${o.proven}/${o.total} | ${o.neverRight || ''} | ${o.unseen || ''} |`);
  }
  L.push('');
  if (cov.neverRight + cov.unseen > 0) {
    L.push(`Run **Cover everything** on the Drill page until this reads ${cov.total}/${cov.total}.`);
    L.push('');
  }

  /* ---- blank paper ---- */
  L.push('## Blank paper');
  L.push('');
  const bs = blankScores(study);
  if (!bs.length) {
    L.push('_No blank-paper runs yet. This is the highest-signal exercise in the app — start here._');
  } else {
    L.push('| List | Runs | Best | Most recent |');
    L.push('|---|---|---|---|');
    for (const b of bs.sort((a, z) => a.best - z.best)) {
      L.push(`| ${b.code} ${b.label} | ${b.runs} | ${pctOf(b.best, 0)} | ${pctOf(b.last, 0)} |`);
    }
    const never = TAXONOMIES.filter((t) => !bs.some((b) => b.id === t.id));
    if (never.length) {
      L.push('');
      L.push(`Never attempted: ${never.map((t) => `${t.code} ${t.title}`).join(' · ')}`);
    }
  }
  L.push('');

  /* ---- PBQs ---- */
  L.push('## Performance-based questions');
  L.push('');
  const pbqRuns = study.filter((a) => a.mode === 'pbq');
  if (!pbqRuns.length) {
    L.push('_No PBQ attempts yet. The real exam opens with performance-based questions and '
      + 'allows 90 minutes for at most 90 questions, so an unrehearsed PBQ costs multiple-choice '
      + 'marks as well as its own._');
  } else {
    const byId = new Map();
    for (const a of pbqRuns) {
      const cur = byId.get(a.item_id)
        ?? { id: a.item_id, objective: a.objective, runs: 0, best: 0, last: 0, lastTs: '', over: 0 };
      cur.runs++;
      cur.best = Math.max(cur.best, a.score ?? 0);
      if ((a.ts ?? '') > cur.lastTs) { cur.lastTs = a.ts; cur.last = a.score ?? 0; }
      byId.set(a.item_id, cur);
    }
    L.push('| PBQ | Objective | Runs | Best | Most recent |');
    L.push('|---|---|---|---|---|');
    for (const p of [...byId.values()].sort((a, z) => a.best - z.best)) {
      L.push(`| ${p.id} | ${p.objective} | ${p.runs} | ${pctOf(p.best, 0)} | ${pctOf(p.last, 0)} |`);
    }
    const mean = pbqRuns.reduce((s, a) => s + (a.score ?? 0), 0) / pbqRuns.length;
    L.push('');
    L.push(`Mean score across ${pbqRuns.length} run${pbqRuns.length === 1 ? '' : 's'}: `
      + `**${pctOf(mean, 0)}**. Scored on partial credit, so this is a separate scale from the `
      + 'multiple-choice figures above and is not folded into the projection.');

    // Which terms keep coming back wrong tells him what to drill, and it is the
    // one thing a per-PBQ score table cannot show.
    const missCount = new Map();
    for (const a of pbqRuns) {
      for (const t of a.missed_terms ?? []) missCount.set(t, (missCount.get(t) ?? 0) + 1);
    }
    const worst = [...missCount.entries()].sort((a, z) => z[1] - a[1]).slice(0, 8);
    if (worst.length) {
      L.push('');
      L.push(`Terms missed most in PBQ cells: ${worst.map(([t, n]) => `**${t}** (${n})`).join(' · ')}`);
    }
  }
  L.push('');

  /* ---- due ---- */
  const dc = dueCounts();
  L.push('## Due for review');
  L.push('');
  L.push(`${dc.total} due now (${dc.items} items, ${dc.pairs} confusion pairs) out of ${dc.tracked} tracked.`);
  L.push('');
  const dueList = due({ limit: 15 });
  if (dueList.length) {
    L.push('| ID | Kind | Lapses | Due |');
    L.push('|---|---|---|---|');
    for (const e of dueList) L.push(`| ${e.id} | ${e.kind} | ${e.lapses} | ${e.due_at} |`);
    L.push('');
  }
  const worst = Object.values(loadQueue().entries)
    .filter((e) => e.lapses >= 2)
    .sort((a, b) => b.lapses - a.lapses)
    .slice(0, 10);
  if (worst.length) {
    L.push(`Most-lapsed: ${worst.map((e) => `\`${e.id}\` (${e.lapses})`).join(', ')}`);
    L.push('');
  }

  /* ---- activity ---- */
  const act = snap.activity;
  L.push('## Activity');
  L.push('');
  L.push(`- Answered today: **${act.answeredToday}**`
    + (act.gradedToday ? ` — ${act.correctToday} of ${act.gradedToday} graded correct` : '')
    + (act.scoredToday ? `, plus ${act.scoredToday} scored run${act.scoredToday === 1 ? '' : 's'}`
      + ' (blank paper / PBQ, partial credit)' : ''));
  L.push(`- Session streak: **${act.streak} day${act.streak === 1 ? '' : 's'}**`);
  L.push(`- Total study answers logged: **${act.totalAnswered}**`);
  const sessions = [...new Set(study.map((a) => a.session))].filter(Boolean);
  L.push(`- Sessions: ${sessions.length ? sessions.join(', ') : 'none yet'}`);
  L.push('');

  L.push('---');
  L.push('');
  L.push('CompTIA scores SY0-701 on a 100–900 scale with a cut of 750. That is not a percentage: 750 does not mean 83% correct, and CompTIA publishes no mapping from raw marks to scaled score. Every percentage in this file is a raw-accuracy estimate, not a predicted scaled score, and none of them is an official cut score.');
  L.push('');

  return L.join('\n');
}

export function writeReport() {
  const md = buildReport();
  fs.writeFileSync(PROGRESS_FILE, md);
  return { file: PROGRESS_FILE, bytes: Buffer.byteLength(md) };
}

if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`) {
  const r = writeReport();
  console.log(`wrote ${r.file} (${r.bytes} bytes)`);
}
