// SM-2-lite over both bank items and confusion-pair terms.
//
// Deliberately NOT textbook SM-2. The exam is ~72 hours out, so intervals are
// capped at 2 days and the ladder is compressed: a miss comes back inside the
// same session, again next session, then about a day later. Textbook intervals
// (6d, 15d, ...) would schedule reviews for after the exam.

import fs from 'node:fs';
import { QUEUE_FILE, DATA_DIR } from './paths.js';

const MIN = 1 / 1440;

/** Interval ladder in days. Index = rung. Hard cap 2 days. */
export const RUNGS = [10 * MIN, 0.25, 1, 2];

const DEFAULT_EASE = 2.5;
const MIN_EASE = 1.3;

const now = () => Date.now();
const iso = (ms) => new Date(ms).toISOString().replace(/\.\d{3}Z$/, 'Z');

function emptyQueue() {
  return { schema_version: 1, updated_at: iso(now()), entries: {} };
}

export function loadQueue() {
  if (!fs.existsSync(QUEUE_FILE)) return emptyQueue();
  try {
    const q = JSON.parse(fs.readFileSync(QUEUE_FILE, 'utf8'));
    if (!q || typeof q !== 'object' || !q.entries) return emptyQueue();
    return q;
  } catch {
    return emptyQueue();
  }
}

export function saveQueue(q) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  q.updated_at = iso(now());
  fs.writeFileSync(QUEUE_FILE, JSON.stringify(q, null, 1) + '\n');
  return q;
}

function newEntry(id, kind) {
  return {
    id,
    kind,
    due_at: iso(now()),
    interval_days: 0,
    ease: DEFAULT_EASE,
    lapses: 0,
    reps: 0,
    rung: -1,
    last_seen: null,
  };
}

/**
 * Record a review outcome and reschedule.
 *
 * A high-confidence miss counts as a double lapse — it is the most dangerous
 * kind of error, so it comes back soonest and its ease drops hardest.
 */
export function review(id, { kind = 'item', correct, confidence = null } = {}) {
  const q = loadQueue();
  const e = q.entries[id] ?? newEntry(id, kind);
  e.kind = kind;
  e.reps++;
  e.last_seen = iso(now());

  if (correct) {
    e.rung = Math.min(e.rung + 1, RUNGS.length - 1);
    e.ease = Math.min(3.0, e.ease + 0.05);
    e.interval_days = Math.min(2, RUNGS[e.rung] * (e.ease / DEFAULT_EASE));
  } else {
    const severe = confidence === 'high';
    e.rung = -1;                       // back to the bottom of the ladder
    e.lapses += severe ? 2 : 1;
    e.ease = Math.max(MIN_EASE, e.ease - (severe ? 0.4 : 0.2));
    e.interval_days = severe ? 5 * MIN : 10 * MIN;
    e.last_miss_confidence = confidence;
  }

  e.due_at = iso(now() + e.interval_days * 86400000);
  q.entries[id] = e;
  saveQueue(q);
  return e;
}

/** Entries due at or before `at`, most-lapsed first. */
export function due({ kind = null, at = now(), limit = null } = {}) {
  const q = loadQueue();
  let list = Object.values(q.entries)
    .filter((e) => (kind ? e.kind === kind : true))
    .filter((e) => Date.parse(e.due_at) <= at)
    .sort((a, b) =>
      Date.parse(a.due_at) - Date.parse(b.due_at) || b.lapses - a.lapses);
  if (limit) list = list.slice(0, limit);
  return list;
}

export function dueCounts(at = now()) {
  const q = Object.values(loadQueue().entries);
  const isDue = (e) => Date.parse(e.due_at) <= at;
  return {
    items: q.filter((e) => e.kind === 'item' && isDue(e)).length,
    pairs: q.filter((e) => e.kind === 'pair' && isDue(e)).length,
    cram: q.filter((e) => e.kind === 'cram' && isDue(e)).length,
    total: q.filter(isDue).length,
    tracked: q.length,
  };
}

export const getEntry = (id) => loadQueue().entries[id] ?? null;
