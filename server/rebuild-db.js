// npm run rebuild-db — reconstruct the SQLite index from data/attempts.jsonl.
// The log is the source of truth; this can be run at any time without loss.

import { rebuild, dbCount, dbAvailable, dbUnavailableReason } from './db.js';
import { readAttempts } from './attempts.js';

if (!dbAvailable) {
  console.log('nothing to rebuild: better-sqlite3 is not installed, so there is no index.');
  console.log(`  (${dbUnavailableReason})`);
  console.log('  The app does not need it — data/attempts.jsonl is the source of truth.');
  console.log('  To add the index: npm install better-sqlite3');
  process.exit(0);
}

const lines = readAttempts().length;
const rows = rebuild();
console.log(`rebuilt index: ${lines} log lines -> ${rows} rows (db now holds ${dbCount()})`);
