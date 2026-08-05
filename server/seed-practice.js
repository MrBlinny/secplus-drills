// Import the answers recorded on the saved practice-test result pages as
// attempt rows, so the objective- and domain-level views include real answers
// on real exam-style questions instead of only the 120 pre-study rows.
//
// mode:"practice-test" keeps them out of the study projection — see
// EXTERNAL_MODES in attempts.js for why. They are otherwise ordinary attempts:
// graded, objective-tagged where the objective is known, and visible in every
// per-domain and per-objective breakdown.
//
// Idempotent on (item_id, exam sitting), so re-running never duplicates.

import fs from 'node:fs';
import { appendAttempt, readAttempts } from './attempts.js';
import { insertAttempt } from './db.js';
import { PRACTICE_SITTINGS_FILE } from './paths.js';

/**
 * Synthetic clock. The saved pages carry no timestamps, only that the sittings
 * happened after the baseline and before the pages were saved. One second per
 * question keeps them ordered within a sitting without implying real pacing.
 */
const SITTING_EPOCH = Date.parse('2026-07-31T09:00:00Z');
const SITTING_GAP_H = 3;
const ORDER = ['EASY1', 'MEDIUM1', 'HARD1', 'EASY2'];

export function seedPractice({ force = false } = {}) {
  if (!fs.existsSync(PRACTICE_SITTINGS_FILE)) {
    return { written: 0, skipped: 0, total: 0, missing: true };
  }
  const sittings = JSON.parse(fs.readFileSync(PRACTICE_SITTINGS_FILE, 'utf8'));

  // An item can legitimately be answered twice — Easy2 re-sits Easy1's
  // questions — so the identity of a row is the item within its sitting.
  const key = (exam, itemId) => `${exam}|${itemId}`;
  const seen = new Set(readAttempts()
    .filter((a) => a.mode === 'practice-test')
    .map((a) => key(a.source_exam, a.item_id)));

  let written = 0;
  const perSitting = new Map();

  for (const s of sittings) {
    if (!force && seen.has(key(s.exam, s.item_id))) continue;
    const n = perSitting.get(s.exam) ?? 0;
    perSitting.set(s.exam, n + 1);
    const slot = ORDER.indexOf(s.exam);
    const ts = SITTING_EPOCH
      + (slot < 0 ? 0 : slot) * SITTING_GAP_H * 3600_000
      + n * 1000;

    const rec = appendAttempt({
      ts: new Date(ts).toISOString().replace(/\.\d{3}Z$/, 'Z'),
      session: 'practice-import',
      item_id: s.item_id,
      mode: 'practice-test',
      domain: s.domain,
      objective: s.objective,
      chosen: s.chosen,
      correct: s.correct,
      is_correct: s.is_correct,
      ms_to_answer: null,
      confidence: null,          // the result page does not record confidence
      // Miss typing is the learner's judgement call, not something that can be
      // derived from the answer. Left null so it can be filled in by drilling
      // the item again rather than guessed here.
      miss_type: null,
      rule_tag: null,
      note: '',
      source: 'udemy-practice-test',
      source_exam: s.exam,
      exam_question: s.n,
      objective_inferred: true,
      ts_synthetic: true,
    });
    insertAttempt(rec);
    written++;
  }

  return { written, skipped: sittings.length - written, total: sittings.length };
}
