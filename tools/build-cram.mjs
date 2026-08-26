// Builds the two cram decks into content/cram-decks.json.
//
//   npm run build-cram
//
// Acronyms are parsed out of content/objectives.md - CompTIA's own published
// acronym table, already the authoritative copy in this repo. Nothing is
// transcribed from any third-party study guide.
//
// Ports come from tools/cram-ports.mjs. Both decks are FREE RECALL: the cue is
// shown, the term is typed, and the grader normalises before comparing so that
// "authentication, authorization and accounting" matches the table's
// "Authentication, Authorization, and Accounting". Auto-grading is honest here
// in a way it is not for scenario questions, because the answer is a fixed
// string rather than a judgement.
//
// Neither deck feeds the coverage audit. These are supplementary facts, in the
// sense CLAUDE.md uses the word: acronym expansions and port numbers are not
// enumerated objective terms and are never a credited answer on their own, but
// scenario questions assume you know them cold.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PORTS } from './cram-ports.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OBJECTIVES = path.join(ROOT, 'content', 'objectives.md');
const OUT = path.join(ROOT, 'content', 'cram-decks.json');

/* ------------------------------------------------------------------ */
/* acronyms                                                            */
/* ------------------------------------------------------------------ */

function acronymCards() {
  const text = fs.readFileSync(OBJECTIVES, 'utf8');
  const start = text.search(/^#+\s*Acronym list/mi);
  if (start === -1) throw new Error('no "# Acronym list" heading in content/objectives.md');

  const cards = [];
  const seen = new Set();

  for (const line of text.slice(start).split('\n')) {
    const m = /^\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*$/.exec(line);
    if (!m) continue;
    const [, acronym, spelled] = m;
    if (/^-+$/.test(acronym) || /^Acronym$/i.test(acronym)) continue;   // header + rule
    if (seen.has(acronym)) continue;
    seen.add(acronym);

    cards.push({
      id: `ACR-${acronym.replace(/[^A-Za-z0-9]+/g, '')}`,
      deck: 'acronyms',
      cue: acronym,
      answer: spelled,
      accept: acceptable(spelled),
      hint: `${spelled.split(/[\s,]+/).length} words`,
    });
  }
  return cards;
}

/**
 * Alternate spellings a typed answer may legitimately use. The exam wants the
 * expansion, not the punctuation, so the Oxford comma, "and", hyphens and the
 * British -isation ending all have to pass.
 */
function acceptable(spelled) {
  const out = new Set([spelled]);
  out.add(spelled.replace(/,/g, ''));
  out.add(spelled.replace(/,?\s+and\s+/gi, ' '));
  out.add(spelled.replace(/-/g, ' '));
  out.add(spelled.replace(/z/g, 's'));            // authorization -> authorisation
  out.add(spelled.replace(/\s*\(.*?\)\s*/g, ' ').trim());
  return [...out].filter((s) => s && s !== spelled);
}

/* ------------------------------------------------------------------ */
/* ports                                                               */
/* ------------------------------------------------------------------ */

const TRANSPORT_LABEL = { TCP: 'TCP', UDP: 'UDP', both: 'both TCP and UDP' };

function portCards() {
  const cards = [];

  for (const p of PORTS) {
    const slug = `${p.port}-${p.proto.replace(/[^A-Za-z0-9]+/g, '')}`;
    const enc = p.enc ? 'encrypted' : 'not encrypted';

    // proto -> port. The direction that actually gets asked.
    cards.push({
      id: `PORT-P-${slug}`,
      deck: 'ports',
      cue: `Which port does ${p.proto} use?`,
      answer: p.port,
      accept: portAliases(p.port),
      hint: `${TRANSPORT_LABEL[p.transport]}, ${enc}`,
      detail: p.use,
      secure: p.secure ?? null,
    });

    // port -> proto. Harder, and worth having: a question that shows a firewall
    // rule gives you the number and expects you to know what it opened.
    cards.push({
      id: `PORT-N-${slug}`,
      deck: 'ports',
      cue: `Port ${p.port} — what runs on it?`,
      answer: p.proto,
      accept: protoAliases(p.proto),
      hint: `${TRANSPORT_LABEL[p.transport]}, ${enc}`,
      detail: p.use,
      secure: p.secure ?? null,
    });
  }
  return cards;
}

const portAliases = (port) => [port.replace(/[-/]/g, ' '), ...port.split(/[-/]/)].filter((s) => s !== port);

function protoAliases(proto) {
  const out = new Set();
  out.add(proto.replace(/\s*\(.*?\)\s*/g, ' ').trim());   // "FTP (data)" -> "FTP"
  out.add(proto.replace(/[^A-Za-z0-9+ ]/g, ' ').replace(/\s+/g, ' ').trim());
  for (const part of proto.split(/\s*\/\s*/)) out.add(part.trim());  // "IKE / ISAKMP"
  return [...out].filter((s) => s && s !== proto);
}

/* ------------------------------------------------------------------ */

const acronyms = acronymCards();
const ports = portCards();

if (acronyms.length < 200) throw new Error(`only ${acronyms.length} acronyms parsed - the table format changed`);

const ids = new Set();
for (const c of [...acronyms, ...ports]) {
  if (ids.has(c.id)) throw new Error(`duplicate card id ${c.id}`);
  ids.add(c.id);
  if (!c.cue || !c.answer) throw new Error(`card ${c.id} is missing a cue or an answer`);
}

fs.writeFileSync(OUT, `${JSON.stringify({
  generated: new Date().toISOString(),
  source: 'built by tools/build-cram.mjs - do not hand-edit',
  decks: {
    acronyms: {
      label: 'Acronyms',
      blurb: "Every acronym on CompTIA's published SY0-701 list. Type the expansion.",
      cards: acronyms,
    },
    ports: {
      label: 'Ports and protocols',
      blurb: 'Both directions: protocol to port number, and port number to protocol.',
      cards: ports,
    },
  },
}, null, 2)}\n`);

console.log(`cram decks written to ${path.relative(ROOT, OUT)}`);
console.log(`  acronyms  ${acronyms.length} cards`);
console.log(`  ports     ${ports.length} cards (${PORTS.length} ports, both directions)`);
