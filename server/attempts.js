// data/attempts.jsonl is the source of truth. Append-only, one JSON object per
// line, never rewritten — corrections are new lines. SQLite is a rebuildable
// index over this file, so a database problem can never cost data.

import fs from 'node:fs';
import { ATTEMPTS_FILE, DATA_DIR } from './paths.js';

/** Field order from the data contract in CLAUDE.md. Always all present. */
export const CONTRACT_FIELDS = [
  'ts', 'session', 'item_id', 'mode', 'domain', 'objective',
  'chosen', 'correct', 'is_correct', 'ms_to_answer',
  'confidence', 'miss_type', 'rule_tag', 'note',
];

const MODES = new Set([
  'drill', 'pairs', 'blank', 'exam', 'weak', 'coverage', 'pbq', 'cram',
  'baseline', 'practice-test',
]);

/**
 * Normalise a partial record into a contract-shaped object: every contract
 * field present (null when not applicable), contract fields first, any
 * mode-specific extras appended after in stable order.
 */
let counter = 0;
const newId = () =>
  `a-${Date.now().toString(36)}-${(counter++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export function buildAttempt(partial = {}) {
  const rec = {};
  for (const f of CONTRACT_FIELDS) rec[f] = partial[f] ?? null;

  rec.ts = partial.ts ?? new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  rec.id = partial.id ?? newId();
  rec.mode = partial.mode ?? 'drill';
  if (!MODES.has(rec.mode)) throw new Error(`attempts: unknown mode "${rec.mode}"`);
  rec.note = partial.note ?? '';

  if (rec.is_correct !== null) rec.is_correct = Boolean(rec.is_correct);

  for (const [k, v] of Object.entries(partial)) {
    if (!(k in rec) && v !== undefined) rec[k] = v;
  }
  return rec;
}

/** Append one record durably. Returns the record as written. */
export function appendAttempt(partial) {
  const rec = buildAttempt(partial);
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const fd = fs.openSync(ATTEMPTS_FILE, 'a');
  try {
    fs.writeSync(fd, JSON.stringify(rec) + '\n');
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
  return rec;
}

/**
 * Read every attempt. A malformed line is skipped rather than thrown on — a
 * half-written line must never make the whole history unreadable.
 */
export function readAttempts() {
  if (!fs.existsSync(ATTEMPTS_FILE)) return [];
  const out = [];
  for (const line of fs.readFileSync(ATTEMPTS_FILE, 'utf8').split(/\r?\n/)) {
    const t = line.trim();
    if (!t) continue;
    try { out.push(JSON.parse(t)); } catch { /* skip corrupt line */ }
  }
  return out;
}

/**
 * The log is append-only, so a tagged answer is written as a second, complete
 * line carrying `supersedes: <id of the original>`. Everything that computes
 * progress reads through here so a superseded line is never double-counted.
 */
export function effectiveAttempts(all = readAttempts()) {
  const superseded = new Set(all.map((a) => a.supersedes).filter(Boolean));
  return all.filter((a) => !superseded.has(a.id));
}

export function findAttempt(id) {
  return readAttempts().find((a) => a.id === id) ?? null;
}

export function countAttempts() {
  return readAttempts().length;
}

export const hasBaseline = () => readAttempts().some((a) => a.mode === 'baseline');

/**
 * Answers made outside this app, which never drive the study projection.
 *
 * `baseline`      the two pre-study practice exams — the reference point, by
 *                 definition not a measure of study.
 * `practice-test` sittings on external practice tests, imported from saved
 *                 result pages. Excluded because every imported sitting is
 *                 partial (34, 24, 17 and 1 of 60 answered): he stopped where
 *                 he stopped, so which questions got answered is not random,
 *                 and an accuracy drawn from them is a self-selected sample.
 *                 They still count in the all-time view and in the per-domain
 *                 and per-objective breakdowns, where the bias is visible.
 */
export const EXTERNAL_MODES = new Set(['baseline', 'practice-test']);

/** Attempts that count toward accuracy: graded, and made inside the app. */
export const isStudy = (a) => !EXTERNAL_MODES.has(a.mode);
export const isGraded = (a) => a.is_correct === true || a.is_correct === false;
