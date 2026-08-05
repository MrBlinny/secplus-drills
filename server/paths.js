import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

export const ROOT = path.resolve(here, '..');
export const CONTENT_DIR = path.join(ROOT, 'content');

// SECPLUS_DATA_DIR points the whole app at a different data directory. Used to
// exercise the answer-logging path without appending to the real attempt log,
// which is append-only and cannot be tidied up afterwards.
export const DATA_DIR = process.env.SECPLUS_DATA_DIR
  ? path.resolve(process.env.SECPLUS_DATA_DIR)
  : path.join(ROOT, 'data');
export const PUBLIC_DIR = path.join(ROOT, 'public');

export const ATTEMPTS_FILE = path.join(DATA_DIR, 'attempts.jsonl');
export const DB_FILE = path.join(DATA_DIR, 'tutor.db');
export const QUEUE_FILE = path.join(DATA_DIR, 'review-queue.json');
export const PROGRESS_FILE = path.join(DATA_DIR, 'PROGRESS.md');

export const OBJECTIVES_FILE = path.join(CONTENT_DIR, 'objectives.md');
export const CURRICULUM_FILE = path.join(CONTENT_DIR, 'curriculum.md');
export const DEEP_DIVES_FILE = path.join(CONTENT_DIR, 'deep-dives.md');
export const PAIRS_FILE = path.join(CONTENT_DIR, 'confusion-pairs.json');
export const RULES_FILE = path.join(CONTENT_DIR, 'scenario-rules.json');
export const ITEM_BANK_FILE = path.join(DATA_DIR, 'item-bank.json');
export const COVERAGE_BANK_FILE = path.join(DATA_DIR, 'item-bank-coverage.json');
export const PRACTICE_BANK_FILE = path.join(DATA_DIR, 'item-bank-practice.json');
export const PBQ_BANK_FILE = path.join(DATA_DIR, 'pbq-bank.json');
export const PRACTICE_SITTINGS_FILE = path.join(DATA_DIR, 'practice-sittings.json');
export const HISTORY_FILE = path.join(DATA_DIR, 'practice-history.json');
