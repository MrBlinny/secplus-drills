// First-run import of the 120 pre-study practice-exam items as historical
// attempts, so the dashboard opens on a real starting point instead of zero.
//
// Marked mode:"baseline" + source:"pre-study-practice-exam" so every
// "recent progress" view can exclude them.

import { appendAttempt, readAttempts } from './attempts.js';
import { insertAttempt } from './db.js';
import { loadHistory } from './content.js';

/** Synthetic clock: these were taken before study began, exact times unknown. */
const BASELINE_EPOCH = Date.parse('2026-07-27T00:00:00Z');

export function seedBaseline({ force = false } = {}) {
  const existing = readAttempts();
  const seen = new Set(existing.filter((a) => a.mode === 'baseline').map((a) => a.item_id));

  const history = loadHistory();
  let written = 0;

  history.forEach((h, i) => {
    if (!force && seen.has(h.id)) return;
    const rec = appendAttempt({
      ts: new Date(BASELINE_EPOCH + i * 1000).toISOString().replace(/\.\d{3}Z$/, 'Z'),
      session: 'baseline',
      item_id: h.id,
      mode: 'baseline',
      domain: h.domain,
      objective: null,          // history carries domain only, no objective codes
      chosen: null,
      correct: null,
      is_correct: h.was_correct,
      ms_to_answer: null,
      confidence: null,
      miss_type: null,
      rule_tag: null,
      note: '',
      source: 'pre-study-practice-exam',
      source_exam: h.source_exam,
      correct_answer: h.correct_answer,
      learner_answer: h.learner_answer,
      ts_synthetic: true,
    });
    insertAttempt(rec);
    written++;
  });

  return { written, skipped: history.length - written, total: history.length };
}
