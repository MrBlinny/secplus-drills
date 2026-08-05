import express from 'express';
import fs from 'node:fs';
import { spawn } from 'node:child_process';

import { PUBLIC_DIR, CONTENT_DIR, ATTEMPTS_FILE } from './paths.js';
import {
  TAXONOMIES, RULES, PAIRS, DOMAIN_WEIGHTS, DOMAIN_LABELS,
  BASELINE_WEIGHTED, EXAM_QUESTIONS, EXAM_MINUTES,
  loadItemBank, objectiveCatalog, taxonomyById, objectiveCode,
} from './content.js';
import { appendAttempt, readAttempts, findAttempt, hasBaseline } from './attempts.js';
import { insertAttempt, getDb, dbCount, dbAvailable } from './db.js';
import { seedBaseline } from './seed.js';
import { seedPractice } from './seed-practice.js';
import { snapshot } from './stats.js';
import { review, dueCounts, due } from './scheduler.js';
import { gradeBlankPaper } from './grade.js';
import { pickDrill, pickWeak, pickCoverage, buildExam, toQuestion, blueprintQuota } from './select.js';
import { learnIndex, learnTopic } from './learn.js';
import { coverage } from './report.js';
import { listsWithRecall, listsMarkdown, SECTIONS } from './lists.js';
import { loadPbqBank, pbqById, toPbq, gradePbq } from './pbq.js';

const PORT = Number(process.env.PORT ?? 5050);
const app = express();
app.use(express.json({ limit: '1mb' }));

/* ------------------------------------------------------------------ */
/* startup: seed baseline, sync the index, pick a session id           */
/* ------------------------------------------------------------------ */

getDb();

// Only meaningful when data/practice-history.json exists — a cold pre-study
// sitting to use as the reference point. Silent when there is nothing to seed,
// which is the normal case for a fresh clone.
if (!hasBaseline()) {
  const r = seedBaseline();
  if (r.written) console.log(`  seeded ${r.written} baseline rows from practice-history.json`);
}

// Idempotent: only writes sittings not already in the log.
const practice = seedPractice();
if (practice.written) {
  console.log(`  seeded ${practice.written} practice-test answers from saved result pages`);
}

// Keep the SQLite index in step with the log (it is only ever a mirror).
// Skipped entirely when better-sqlite3 did not install: the index has no
// readers, so its absence costs nothing but ad-hoc SQL over your own history.
if (!dbAvailable) {
  console.log('  no SQLite index (better-sqlite3 not installed) — progress is read from the log, so nothing is lost');
} else if (dbCount() !== readAttempts().length) {
  const { rebuild } = await import('./db.js');
  console.log(`  rebuilding index (${dbCount()} rows -> ${rebuild()} rows)`);
}

/** One session per run of the app: s-001, s-002, ... */
const SESSION = (() => {
  const nums = readAttempts()
    .map((a) => /^s-(\d+)$/.exec(a.session ?? '')?.[1])
    .filter(Boolean)
    .map(Number);
  return `s-${String((nums.length ? Math.max(...nums) : 0) + 1).padStart(3, '0')}`;
})();

const bank = () => new Map(loadItemBank().map((i) => [i.id, i]));

/** Write to the log and the index together. */
function log(partial) {
  const rec = appendAttempt({ session: SESSION, ...partial });
  insertAttempt(rec);
  return rec;
}

const fail = (res, e) => res.status(400).json({ error: e.message ?? String(e) });

/* ------------------------------------------------------------------ */
/* content                                                             */
/* ------------------------------------------------------------------ */

app.get('/api/bootstrap', (_req, res) => {
  res.json({
    session: SESSION,
    baselineWeighted: BASELINE_WEIGHTED,
    domainWeights: DOMAIN_WEIGHTS,
    domainLabels: DOMAIN_LABELS,
    rules: RULES,
    objectives: objectiveCatalog(),
    taxonomies: TAXONOMIES.map((t) => ({
      id: t.id, label: t.label, title: t.title, code: t.code,
      domain: t.domain, count: t.terms.length,
      source: t.source, supplementary: !!t.supplementary,
    })),
    counts: { items: loadItemBank().length, pairs: PAIRS.length },
    examQuota: blueprintQuota(EXAM_QUESTIONS),
    examQuestions: EXAM_QUESTIONS,
    examMinutes: EXAM_MINUTES,
  });
});

/* ------------------------------------------------------------------ */
/* drill / weak / exam                                                 */
/* ------------------------------------------------------------------ */

app.get('/api/drill', (req, res) => {
  try {
    const { objective, code, domain } = req.query;
    const limit = Math.min(Number(req.query.limit ?? 20) || 20, 100);
    const items = pickDrill({
      objective: objective || null, code: code || null, domain: domain || null, limit,
    });
    res.json({ mode: 'drill', questions: items.map(toQuestion) });
  } catch (e) { fail(res, e); }
});

app.get('/api/coverage', (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit ?? 90) || 90, 250);
    const { items, remaining, unproven, total } = pickCoverage({ limit });
    res.json({
      mode: 'coverage', questions: items.map(toQuestion), remaining, unproven, total,
    });
  } catch (e) { fail(res, e); }
});

app.get('/api/weak', (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit ?? 20) || 20, 100);
    const { items, objectives } = pickWeak({ limit });
    res.json({ mode: 'weak', questions: items.map(toQuestion), objectives });
  } catch (e) { fail(res, e); }
});

app.get('/api/exam', (req, res) => {
  try {
    const count = Math.min(Number(req.query.count ?? EXAM_QUESTIONS) || EXAM_QUESTIONS, 150);
    const includeOffSyllabus = req.query.all === '1';
    // freshHours=0 turns the recency filter off entirely.
    const freshHours = req.query.freshHours === undefined ? 12 : Number(req.query.freshHours);
    const { items, quota, shortfall, excludedOffSyllabus, reusedRecent } =
      buildExam({ count, includeOffSyllabus, freshHours });
    res.json({
      mode: 'exam',
      questions: items.map(toQuestion),
      quota,
      shortfall,
      excludedOffSyllabus,
      reusedRecent,
      freshHours,
      minutes: EXAM_MINUTES,
    });
  } catch (e) { fail(res, e); }
});

/**
 * Grade one answer, log it immediately, and return the reveal.
 *
 * The line is written before the learner tags it, so an abandoned reveal is
 * still recorded. Tagging then appends a superseding line (see /api/tag).
 */
app.post('/api/answer', (req, res) => {
  try {
    const {
      item_id, chosen, mode = 'drill', confidence = null,
      ms_to_answer = null, miss_type = null, rule_tag = null, note = '',
      reveal = true,
    } = req.body ?? {};

    const item = bank().get(item_id);
    if (!item) throw new Error(`unknown item_id "${item_id}"`);

    const picked = chosen === null || chosen === undefined ? null : Number(chosen);
    const is_correct = picked === item.answer;

    const rec = log({
      item_id, mode,
      domain: item.domain, objective: item.objective,
      chosen: picked, correct: item.answer, is_correct,
      ms_to_answer: ms_to_answer === null ? null : Number(ms_to_answer),
      confidence, miss_type, rule_tag: rule_tag === null ? null : Number(rule_tag), note,
    });

    review(item_id, { kind: 'item', correct: is_correct, confidence });

    res.json({
      attempt_id: rec.id,
      is_correct,
      ...(reveal ? { correct: item.answer, explanation: item.explanation } : {}),
    });
  } catch (e) { fail(res, e); }
});

/**
 * Exam sim submit: grade and log the whole paper at once, then return the full
 * review. No feedback reaches the browser until this point.
 */
app.post('/api/exam-submit', (req, res) => {
  try {
    const { answers = [], elapsed_ms = null } = req.body ?? {};
    const items = bank();
    const exam_id = `X-${Date.now().toString(36)}`;
    const review_rows = [];

    for (const a of answers) {
      const item = items.get(a.item_id);
      if (!item) continue;
      const picked = a.chosen === null || a.chosen === undefined ? null : Number(a.chosen);
      const is_correct = picked === item.answer;

      const rec = log({
        item_id: item.id, mode: 'exam',
        domain: item.domain, objective: item.objective,
        chosen: picked, correct: item.answer, is_correct,
        ms_to_answer: a.ms_to_answer ?? null,
        confidence: null, miss_type: null, rule_tag: null, note: '',
        exam_id,
        flagged: a.flagged === true,
      });
      review(item.id, { kind: 'item', correct: is_correct, confidence: null });

      review_rows.push({
        attempt_id: rec.id,
        id: item.id, objective: item.objective, domain: item.domain,
        stem: item.stem, options: item.options,
        chosen: picked, correct: item.answer, is_correct,
        explanation: item.explanation,
        flagged: a.flagged === true,
      });
    }

    const graded = review_rows.length;
    const right = review_rows.filter((r) => r.is_correct).length;
    const byDomain = {};
    for (const r of review_rows) {
      const d = byDomain[r.domain] ?? (byDomain[r.domain] = { domain: r.domain, n: 0, correct: 0 });
      d.n++;
      if (r.is_correct) d.correct++;
    }
    let weighted = 0;
    let coverage = 0;
    for (const d of Object.values(byDomain)) {
      const w = DOMAIN_WEIGHTS[d.domain] ?? 0;
      weighted += w * (d.correct / d.n);
      coverage += w;
    }

    res.json({
      exam_id,
      elapsed_ms,
      total: graded,
      correct: right,
      raw: graded ? Math.round((right / graded) * 1000) / 10 : null,
      weighted: coverage ? Math.round((weighted / coverage) * 1000) / 10 : null,
      byDomain,
      review: review_rows,
    });
  } catch (e) { fail(res, e); }
});

/**
 * Attach the miss-type / rule tag after the reveal. Appends a complete
 * restatement carrying `supersedes`, per the append-only contract.
 */
app.post('/api/tag', (req, res) => {
  try {
    const { attempt_id, miss_type = null, rule_tag = null, note } = req.body ?? {};
    const prev = findAttempt(attempt_id);
    if (!prev) throw new Error(`unknown attempt_id "${attempt_id}"`);
    if (miss_type !== null && !'ABC'.includes(miss_type)) {
      throw new Error(`miss_type must be A, B, C or null`);
    }

    const { id, ...rest } = prev;
    const rec = log({
      ...rest,
      miss_type,
      rule_tag: rule_tag === null ? null : Number(rule_tag),
      note: note ?? prev.note ?? '',
      supersedes: attempt_id,
    });
    res.json({ ok: true, attempt_id: rec.id, supersedes: attempt_id });
  } catch (e) { fail(res, e); }
});

/* ------------------------------------------------------------------ */
/* confusion pairs                                                     */
/* ------------------------------------------------------------------ */

app.get('/api/pairs', (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit ?? 20) || 20, 100);
    const objective = req.query.objective || null;
    const domain = req.query.domain || null;

    const dueIds = new Set(due({ kind: 'pair' }).map((e) => e.id));
    const seen = new Set(readAttempts().filter((a) => a.mode === 'pairs').map((a) => a.item_id));

    const pool = PAIRS.filter((p) =>
      (!objective || p.objective === objective) && (!domain || p.domain === domain));

    const rank = (p) => (dueIds.has(p.id) ? 0 : seen.has(p.id) ? 2 : 1);
    const shuffled = [...pool].sort(() => Math.random() - 0.5).sort((a, b) => rank(a) - rank(b));

    res.json({
      mode: 'pairs',
      cards: shuffled.slice(0, limit).map((p) => ({
        id: p.id, objective: p.objective, domain: p.domain, cue: p.cue,
      })),
    });
  } catch (e) { fail(res, e); }
});

/** Self-graded free recall: reveal comes back with the answer for grading. */
app.post('/api/pair-answer', (req, res) => {
  try {
    const { id, typed = '', correct, ms_to_answer = null, confidence = null } = req.body ?? {};
    const pair = PAIRS.find((p) => p.id === id);
    if (!pair) throw new Error(`unknown pair "${id}"`);

    if (correct === undefined) {
      // reveal step: no grade yet, nothing logged
      return res.json({
        reveal: true,
        correct_term: pair.correct_term,
        common_trap: pair.common_trap,
        discriminator: pair.discriminator,
      });
    }

    const rec = log({
      item_id: id, mode: 'pairs',
      domain: pair.domain, objective: pair.objective,
      chosen: null, correct: null, is_correct: Boolean(correct),
      ms_to_answer: ms_to_answer === null ? null : Number(ms_to_answer),
      confidence,
      miss_type: correct ? null : 'A',   // a missed confusion pair is Mode A by construction
      rule_tag: null,
      note: String(typed ?? '').slice(0, 200),
      self_grade: Boolean(correct),
      correct_term: pair.correct_term,
      cue: pair.cue,
    });
    review(id, { kind: 'pair', correct: Boolean(correct), confidence });
    res.json({ ok: true, attempt_id: rec.id });
  } catch (e) { fail(res, e); }
});

/* ------------------------------------------------------------------ */
/* blank paper                                                         */
/* ------------------------------------------------------------------ */

app.get('/api/taxonomies', (_req, res) => {
  res.json(TAXONOMIES.map((t) => ({
    id: t.id, label: t.label, title: t.title, code: t.code, domain: t.domain,
    count: t.terms.length, source: t.source, supplementary: !!t.supplementary,
  })));
});

app.post('/api/blank', (req, res) => {
  try {
    const { taxonomy, text = '', ms_to_answer = null } = req.body ?? {};
    const tax = taxonomyById(taxonomy);
    if (!tax) throw new Error(`unknown taxonomy "${taxonomy}"`);

    const result = gradeBlankPaper(taxonomy, text);

    const rec = log({
      item_id: `BLANK-${tax.id}`,
      mode: 'blank',
      domain: tax.domain,
      objective: tax.label,
      chosen: null, correct: null,
      is_correct: null,               // scored, not right/wrong: excluded from accuracy
      ms_to_answer: ms_to_answer === null ? null : Number(ms_to_answer),
      confidence: null, miss_type: null, rule_tag: null,
      note: '',
      taxonomy: tax.id,
      score: Math.round(result.score * 1000) / 1000,
      recalled: result.recalled.length,
      missed: result.missed.length,
      invented: result.invented.length,
      total: result.total,
      missed_terms: result.missed,
      invented_terms: result.invented.map((i) => i.input),
    });

    res.json({ ...result, attempt_id: rec.id });
  } catch (e) { fail(res, e); }
});

/* ------------------------------------------------------------------ */
/* performance-based questions                                         */
/* ------------------------------------------------------------------ */

/** The set list, with how each has gone so far. */
app.get('/api/pbq', (_req, res) => {
  try {
    const attempts = readAttempts().filter((a) => a.mode === 'pbq');
    const history = new Map();
    for (const a of attempts) {
      const h = history.get(a.item_id) ?? { runs: 0, best: 0, last: null, lastTs: '' };
      h.runs++;
      h.best = Math.max(h.best, a.score ?? 0);
      if ((a.ts ?? '') > h.lastTs) { h.lastTs = a.ts; h.last = a.score ?? 0; }
      history.set(a.item_id, h);
    }
    res.json({
      items: loadPbqBank().map((p) => ({
        id: p.id,
        type: p.type,
        objective: p.objective,
        domain: p.domain,
        title: p.title,
        minutes: p.minutes ?? 3,
        cellCount: p.cellCount,
        history: history.get(p.id) ?? null,
      })),
    });
  } catch (e) { fail(res, e); }
});

app.get('/api/pbq/:id', (req, res) => {
  try {
    const it = pbqById(req.params.id);
    if (!it) throw new Error(`unknown PBQ "${req.params.id}"`);
    res.json(toPbq(it));
  } catch (e) { fail(res, e); }
});

app.post('/api/pbq-answer', (req, res) => {
  try {
    const { id, response, ms_to_answer = null } = req.body ?? {};
    const it = pbqById(id);
    if (!it) throw new Error(`unknown PBQ "${id}"`);

    const result = gradePbq(it, response);

    const rec = log({
      item_id: it.id,
      mode: 'pbq',
      domain: it.domain,
      objective: it.objective,
      chosen: null,
      correct: null,
      // Partial credit does not reduce to a boolean — see gradePbq.
      is_correct: null,
      ms_to_answer: ms_to_answer === null ? null : Number(ms_to_answer),
      confidence: null, miss_type: null, rule_tag: null,
      note: '',
      pbq_type: it.type,
      score: Math.round(result.score * 1000) / 1000,
      right: result.right,
      total: result.total,
      perfect: result.perfect,
      missed_terms: result.cells.filter((c) => !c.ok).map((c) => c.answer).filter(Boolean),
    });

    // A PBQ that was not perfect comes back like any other miss.
    review(it.id, { kind: 'item', correct: result.perfect, confidence: null });

    res.json({ ...result, attempt_id: rec.id });
  } catch (e) { fail(res, e); }
});

/* ------------------------------------------------------------------ */
/* learn                                                               */
/* ------------------------------------------------------------------ */

/** Table of contents: every objective, plus the general sections and rules. */
app.get('/api/learn', (_req, res) => {
  try {
    const idx = learnIndex();
    res.json({
      topics: idx.topics.map((t) => ({
        code: t.code, domain: t.domain, domainLabel: t.domainLabel,
        title: t.title, shortTitle: t.shortTitle,
        hasCurriculum: !!t.curriculumHtml, pairs: t.pairs.length,
      })),
      general: idx.general.map((g) => ({ id: g.id, title: g.title })),
      deepDives: idx.deepDives.map((r) => ({ id: r.id, title: r.title })),
      ruleCount: idx.rules.length,
    });
  } catch (e) { fail(res, e); }
});

app.get('/api/learn/general', (_req, res) => {
  try {
    const idx = learnIndex();
    res.json({ general: idx.general, deepDives: idx.deepDives, rules: idx.rules });
  } catch (e) { fail(res, e); }
});

/**
 * One objective's material. Accepts either a bare code ("2.6") or a full bank
 * label ("2.6 Attacks"), so a reveal can link straight through with whatever
 * it has to hand.
 */
app.get('/api/learn/:code', (req, res) => {
  try {
    const code = objectiveCode(req.params.code);
    const topic = learnTopic(code);
    if (!topic) throw new Error(`no learning material for "${req.params.code}"`);

    const items = loadItemBank().filter((i) => i.code === code);
    const history = readAttempts().filter((a) => a.objective && a.objective.startsWith(code));
    const graded = history.filter((a) => a.is_correct === true || a.is_correct === false);

    res.json({
      ...topic,
      bankItems: items.length,
      seen: graded.length,
      correct: graded.filter((a) => a.is_correct).length,
    });
  } catch (e) { fail(res, e); }
});

/* ------------------------------------------------------------------ */
/* lists — the write-it-out reference                                  */
/* ------------------------------------------------------------------ */

app.get('/api/lists', (_req, res) => {
  try {
    res.json({
      sections: SECTIONS,
      lists: listsWithRecall(),
      // Which codes have items behind them, so the page only offers "Drill"
      // where a drill would actually return questions.
      bankCodes: [...new Set(objectiveCatalog().map((o) => o.code))],
    });
  } catch (e) { fail(res, e); }
});

/** Same content as text, for printing or pasting somewhere else. */
app.get('/api/lists.md', (_req, res) => {
  try {
    res.type('text/plain; charset=utf-8').send(listsMarkdown());
  } catch (e) { fail(res, e); }
});

/* ------------------------------------------------------------------ */
/* dashboard                                                           */
/* ------------------------------------------------------------------ */

app.get('/api/dashboard', (req, res) => {
  try {
    const includeBaseline = req.query.includeBaseline === '1';
    const cov = coverage();
    res.json({
      ...snapshot({ includeBaseline }),
      due: dueCounts(),
      session: SESSION,
      // Coverage is deliberately not affected by the includeBaseline toggle:
      // an item answered correctly in the baseline is still proven.
      coverage: { ...cov, unproven: cov.neverRight + cov.unseen },
    });
  } catch (e) { fail(res, e); }
});

app.get('/api/due', (_req, res) => {
  try {
    const entries = due({ limit: 100 });
    const items = bank();
    const pairs = new Map(PAIRS.map((p) => [p.id, p]));
    res.json({
      counts: dueCounts(),
      entries: entries.map((e) => ({
        ...e,
        objective: items.get(e.id)?.objective ?? pairs.get(e.id)?.objective ?? null,
        label: items.get(e.id)?.stem?.slice(0, 90) ?? pairs.get(e.id)?.cue ?? e.id,
      })),
    });
  } catch (e) { fail(res, e); }
});

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    session: SESSION,
    attempts_lines: readAttempts().length,
    db_rows: dbCount(),
    attempts_file: ATTEMPTS_FILE,
  });
});

/* ------------------------------------------------------------------ */

app.use(express.static(PUBLIC_DIR, { extensions: ['html'] }));

// The authored study material, so study-plan.html and the raw markdown open in
// the app instead of only from disk.
app.use('/content', express.static(CONTENT_DIR));

/** Open the default browser. Best-effort: never take the server down with it. */
function openBrowser(url) {
  const cmd = process.platform === 'win32' ? ['cmd', ['/c', 'start', '""', url]]
    : process.platform === 'darwin' ? ['open', [url]]
    : ['xdg-open', [url]];
  try {
    const child = spawn(cmd[0], cmd[1], { detached: true, stdio: 'ignore' });
    // Without this, a missing launcher (xdg-open on a headless box, or cmd on
    // any non-Windows machine) emits an unhandled 'error' and kills the server.
    child.on('error', () => {});
    child.unref();
  } catch { /* the URL is printed above; opening it is a convenience */ }
}

const server = app.listen(PORT, '127.0.0.1', () => {
  const url = `http://127.0.0.1:${PORT}/`;
  console.log(`\n  Security+ Tutor  ->  ${url}`);
  console.log(`  session ${SESSION} | ${readAttempts().length} attempts logged | ${loadItemBank().length} items | ${PAIRS.length} pairs\n`);
  if (!process.env.NO_OPEN && fs.existsSync(PUBLIC_DIR)) openBrowser(url);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n  Port ${PORT} is already in use — the tutor is probably running already.`);
    console.error(`  Open http://127.0.0.1:${PORT}/ , or start on another port with:  PORT=5051 npm start\n`);
    process.exit(1);
  }
  throw err;
});
