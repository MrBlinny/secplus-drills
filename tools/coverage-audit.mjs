// Term-by-term coverage audit.
//
// CLAUDE.md's rule: an objective is not covered because it has items. It is
// covered when each enumerated term in objectives.md is the CREDITED ANSWER of
// at least one item. Domain-level and objective-level counts hide the gap —
// on the SecAI+ repo the dashboard read "blueprint covered 100%" while twenty
// objective terms had never once been a credited answer.
//
//   node tools/coverage-audit.mjs           summary per objective
//   node tools/coverage-audit.mjs --gaps    every term still uncovered
//   node tools/coverage-audit.mjs --json    machine-readable, for the report
//
// Only the authored banks count. A harvested third-party item may happen to
// credit the right word, but its wording was not chosen to teach that term
// against its neighbours, so it does not discharge the obligation.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const OBJECTIVES = path.join(ROOT, 'content', 'objectives.md');
const BANKS = ['item-bank.json', 'item-bank-coverage.json']
  .map((f) => path.join(ROOT, 'data', f));

/* ------------------------------------------------------------------ */

/**
 * Terms that cannot reasonably be a credited answer on their own.
 *
 * CompTIA's bullet lists mix nameable concepts with bare adjectives that only
 * have meaning inside their parent — "Cost" and "Power" as architecture
 * considerations, "People" and "Technology" as things you capacity-plan for.
 * A question whose credited answer is "Cost" is not testing vocabulary, it is
 * testing nothing. Excluding them keeps the denominator honest rather than
 * parking a permanent unreachable remainder in the report.
 *
 * Keyed by `code::term` so a word excluded in one objective still counts in
 * another — "Encryption" is filler under 5.1 Standards and a real answer under
 * 1.4 and 2.5.
 */
const NOT_INDEPENDENTLY_EXAMINABLE = new Set([
  '3.1::Cost', '3.1::Power', '3.1::Compute', '3.1::Availability',
  '3.1::Responsiveness', '3.1::Scalability', '3.1::Ease of deployment',
  '3.1::Ease of recovery', '3.1::Resilience',
  '3.4::People', '3.4::Technology', '3.4::Infrastructure',
  '4.4::Systems', '4.4::Applications', '4.4::Infrastructure',
  '4.7::Complexity', '4.7::Cost',
  '5.1::Regulatory', '5.1::Legal', '5.1::Industry', '5.1::Local/regional',
  '5.1::National', '5.1::Global',
  '5.1::Password', '5.1::Access control', '5.1::Physical security', '5.1::Encryption',
  '5.4::Local/regional', '5.4::National', '5.4::Global',
  '5.4::Internal', '5.4::External',
  '5.2::Impact', '5.2::Probability',
  '2.2::Wireless', '2.2::Wired',
  '4.1::Establish', '4.1::Deploy', '4.1::Maintain',
  '4.1::Cellular', '4.1::Wi-Fi', '4.1::Bluetooth',
  '5.6::Initial', '5.6::Recurring', '5.6::Development', '5.6::Execution',
  '5.5::Assessment', '5.5::Examinations',
  '4.3::Prioritize',

  // Structural parents. CompTIA nests examples under a bullet that only names
  // the axis — "Level" over full-disk/partition/file, "Data states" over at
  // rest/in transit/in use, "Firewall types" over WAF/UTM/NGFW. A question
  // whose credited answer is "Data states" tests nothing; the children carry
  // the meaning and each of them is covered on its own.
  '1.2::Sensors', '1.4::Level', '1.4::Encryption', '1.4::Tools',
  '1.4::Obfuscation', '1.4::Certificates',
  '2.2::Vulnerable software', '2.3::Race conditions',
  '3.1::Cloud', '3.1::Network infrastructure',
  '3.2::Failure modes', '3.2::Device attribute', '3.2::Network appliances',
  '3.2::Port security', '3.2::Firewall types', '3.2::Tunneling',
  '3.3::Data states',
  '3.4::Site considerations',
  '4.1::Installation considerations', '4.1::Deployment models',
  '4.1::Connection methods',
  '4.3::Confirmation', '4.3::Application security', '4.3::Threat feed',
  '4.4::Alert response and remediation/validation',
  '4.6::Implementations', '4.6::Factors', '4.6::Password best practices',
  '5.2::Risk assessment', '5.4::Legal implications',
  '5.5::Reconnaissance',
]);

const norm = (s) => String(s ?? '')
  .toLowerCase()
  .replace(/\(([^)]+)\)/g, ' $1 ')      // keep the acronym as a separate token run
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

/** Loose singular, so "Certificate revocation lists" matches "…list". */
const stem = (s) => norm(s).replace(/\b(\w{4,})s\b/g, '$1');

function parseObjectives() {
  const lines = fs.readFileSync(OBJECTIVES, 'utf8').split(/\r?\n/);
  const objectives = [];
  let cur = null;
  for (const line of lines) {
    if (/^#\s+Acronym/i.test(line)) break;
    const h2 = line.match(/^##\s+(\d\.\d)\s+(.*)$/);
    if (h2) { cur = { code: h2[1], title: h2[2].trim(), terms: [] }; objectives.push(cur); continue; }
    if (/^#\s/.test(line)) { cur = null; continue; }
    if (!cur) continue;
    const b = line.match(/^\s*-\s+(.*)$/);
    if (!b) continue;
    const term = b[1].replace(/\*/g, '').trim();
    if (term) cur.terms.push(term);
  }
  return objectives;
}

function loadAuthored() {
  const out = [];
  for (const f of BANKS) {
    if (!fs.existsSync(f)) continue;
    for (const it of JSON.parse(fs.readFileSync(f, 'utf8')).items) out.push(it);
  }
  return out;
}

/* ------------------------------------------------------------------ */

const objectives = parseObjectives();
const items = loadAuthored();

// credited answers, grouped by the objective the item is tagged with
const creditedBy = new Map();
for (const it of items) {
  const code = String(it.objective ?? '').match(/^(\d\.\d)/)?.[1];
  if (!code) continue;
  const answer = it.options?.[it.answer];
  if (answer == null) continue;
  if (!creditedBy.has(code)) creditedBy.set(code, []);
  creditedBy.get(code).push(stem(answer));
}

const covers = (answers, term) => {
  const t = stem(term);
  if (!t) return false;
  return answers.some((a) => a === t
    // A credited answer may carry the acronym the objectives spell out, or
    // vice versa. Containment either way counts, but only on whole words.
    || ` ${a} `.includes(` ${t} `)
    || ` ${t} `.includes(` ${a} `));
};

const rows = [];
let totalTerms = 0;
let totalCovered = 0;
let totalExcluded = 0;

for (const o of objectives) {
  const answers = creditedBy.get(o.code) ?? [];
  const examinable = [];
  let excluded = 0;
  for (const term of o.terms) {
    if (NOT_INDEPENDENTLY_EXAMINABLE.has(`${o.code}::${term}`)) { excluded++; continue; }
    examinable.push(term);
  }
  const uncovered = examinable.filter((t) => !covers(answers, t));
  const covered = examinable.length - uncovered.length;

  totalTerms += examinable.length;
  totalCovered += covered;
  totalExcluded += excluded;

  rows.push({
    code: o.code,
    title: o.title,
    items: answers.length,
    terms: examinable.length,
    covered,
    excluded,
    uncovered,
  });
}

if (process.argv.includes('--json')) {
  console.log(JSON.stringify({
    generated: new Date().toISOString(),
    totals: { terms: totalTerms, covered: totalCovered, excluded: totalExcluded, items: items.length },
    objectives: rows,
  }, null, 1));
  process.exit(0);
}

const pct = (n, d) => (d ? `${Math.round((n / d) * 100)}%` : '—');

console.log(`authored items: ${items.length}`);
console.log(`examinable objective terms: ${totalTerms} `
  + `(${totalExcluded} excluded as not independently examinable)\n`);
console.log('code  items  terms  covered        objective');
console.log('----  -----  -----  -------------  ---------');
for (const r of rows) {
  const bar = `${String(r.covered).padStart(3)}/${String(r.terms).padEnd(3)} ${pct(r.covered, r.terms).padStart(4)}`;
  const flag = r.covered === r.terms ? ' ' : '!';
  console.log(`${flag}${r.code}  ${String(r.items).padStart(5)}  ${String(r.terms).padStart(5)}  ${bar}  ${r.title.slice(0, 52)}`);
}
console.log('\n' + '='.repeat(64));
console.log(`TOTAL  ${String(items.length).padStart(4)} items   `
  + `${totalCovered}/${totalTerms} terms credited  ${pct(totalCovered, totalTerms)}`);

if (process.argv.includes('--gaps')) {
  console.log('\nterms not yet the credited answer of any authored item:\n');
  for (const r of rows) {
    if (!r.uncovered.length) continue;
    console.log(`${r.code} (${r.uncovered.length})`);
    for (const t of r.uncovered) console.log(`    ${t}`);
  }
}
