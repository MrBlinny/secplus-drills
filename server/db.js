// SQLite index over data/attempts.jsonl.
//
// Deliberately a narrow interface (insert / all / rebuild) so the storage
// engine can be swapped without touching callers. The JSONL file is the source
// of truth; this database is always reconstructible from it via rebuild().
//
// OPTIONAL. better-sqlite3 is the only native module in the tree, so it is the
// only dependency that can fail to install on a machine without build tools.
// Nothing in the app ever reads from this index — every figure the dashboard
// and the report show is computed from the JSONL log by stats.js — so when the
// module is missing the whole module degrades to a no-op and the app runs
// unchanged. It is declared in optionalDependencies for the same reason.
//
// If you are adding a read path, do not add it here: read the log. This index
// exists for ad-hoc SQL against your own history, not for the app.

import fs from 'node:fs';
import { DB_FILE, DATA_DIR } from './paths.js';
import { readAttempts, CONTRACT_FIELDS } from './attempts.js';

let Database = null;
let reason = null;
try {
  ({ default: Database } = await import('better-sqlite3'));
} catch (err) {
  reason = err?.message ?? String(err);
}

/** False when better-sqlite3 is absent or failed to load its native binding. */
export const dbAvailable = Database !== null;
export const dbUnavailableReason = reason;

const COLUMNS = [
  ...CONTRACT_FIELDS,
  'source',   // "pre-study-practice-exam" on baseline rows
  'score',    // blank-paper recall fraction
  'extra',    // JSON blob of any remaining mode-specific fields
];

let db = null;

export function getDb() {
  if (!dbAvailable) return null;
  if (db) return db;
  fs.mkdirSync(DATA_DIR, { recursive: true });
  db = new Database(DB_FILE);
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS attempts (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      ts           TEXT    NOT NULL,
      session      TEXT,
      item_id      TEXT,
      mode         TEXT    NOT NULL,
      domain       TEXT,
      objective    TEXT,
      chosen       INTEGER,
      correct      INTEGER,
      is_correct   INTEGER,
      ms_to_answer INTEGER,
      confidence   TEXT,
      miss_type    TEXT,
      rule_tag     INTEGER,
      note         TEXT,
      source       TEXT,
      score        REAL,
      extra        TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_attempts_mode      ON attempts(mode);
    CREATE INDEX IF NOT EXISTS idx_attempts_objective ON attempts(objective);
    CREATE INDEX IF NOT EXISTS idx_attempts_domain    ON attempts(domain);
    CREATE INDEX IF NOT EXISTS idx_attempts_ts        ON attempts(ts);
    CREATE INDEX IF NOT EXISTS idx_attempts_item      ON attempts(item_id);
  `);
  return db;
}

function toRow(rec) {
  const row = {};
  const known = new Set(COLUMNS);
  for (const c of COLUMNS) row[c] = rec[c] ?? null;
  row.is_correct = rec.is_correct === null || rec.is_correct === undefined
    ? null : (rec.is_correct ? 1 : 0);

  const extra = {};
  for (const [k, v] of Object.entries(rec)) if (!known.has(k)) extra[k] = v;
  row.extra = Object.keys(extra).length ? JSON.stringify(extra) : null;
  return row;
}

const INSERT_SQL = `INSERT INTO attempts (${COLUMNS.join(', ')})
  VALUES (${COLUMNS.map((c) => `@${c}`).join(', ')})`;

export function insertAttempt(rec) {
  const d = getDb();
  if (!d) return null;              // log already written; the index is optional
  return d.prepare(INSERT_SQL).run(toRow(rec));
}

/** Drop and repopulate the whole index from the JSONL log. */
export function rebuild() {
  const d = getDb();
  if (!d) return null;
  d.exec('DELETE FROM attempts;');
  const stmt = d.prepare(INSERT_SQL);
  const rows = readAttempts();
  d.transaction((rs) => { for (const r of rs) stmt.run(toRow(r)); })(rows);
  d.exec('VACUUM;');
  return rows.length;
}

/** Row count, or null when there is no index. Null means "unknown", not zero. */
export const dbCount = () =>
  getDb()?.prepare('SELECT COUNT(*) AS n FROM attempts').get().n ?? null;

export const all = (sql, params = {}) => getDb()?.prepare(sql).all(params) ?? [];
