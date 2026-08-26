// Cram decks: acronyms and ports. Free recall with automatic grading.
//
// These are separate from the item banks on purpose. A cram card has one fixed
// string as its answer, so it can be graded by comparison rather than by
// judgement - which means the loop runs at a card every few seconds instead of
// every twenty. That is the whole point of the mode: high-volume fact recall
// the night before, not scenario reasoning.
//
// Nothing here feeds the coverage audit. Acronym expansions and port numbers
// are supplementary in the sense CLAUDE.md uses the word - never a credited
// answer on their own, but assumed by the questions that are.

import fs from 'node:fs';
import path from 'node:path';
import { CONTENT_DIR } from './paths.js';

const DECKS_FILE = path.join(CONTENT_DIR, 'cram-decks.json');

const load = () => JSON.parse(fs.readFileSync(DECKS_FILE, 'utf8'));

const raw = fs.existsSync(DECKS_FILE) ? load() : { decks: {} };

/** [{ id, label, blurb, count }] for the deck picker. */
export const DECKS = Object.entries(raw.decks).map(([id, d]) => ({
  id, label: d.label, blurb: d.blurb, count: d.cards.length,
}));

const CARDS = new Map();
for (const [deckId, d] of Object.entries(raw.decks)) {
  for (const c of d.cards) CARDS.set(c.id, { ...c, deck: deckId });
}

export const cardById = (id) => CARDS.get(id) ?? null;
export const deckCards = (deckId) => [...CARDS.values()].filter((c) => c.deck === deckId);
export const CRAM_COUNT = CARDS.size;

/**
 * Every answer that exists in each deck, normalised.
 *
 * This is what stops the typo tolerance from crediting a real wrong answer.
 * HTTP is one edit from HTTPS, LDAP from LDAPS, IMAP from IMAPS, POP3 from
 * POP3S - and that trailing S is the entire thing SY0-701 is testing. A string
 * that is somebody else's correct answer is never a slip of the finger, so it
 * is graded wrong however close it looks.
 */
const DECK_ANSWERS = new Map();
for (const c of CARDS.values()) {
  if (!DECK_ANSWERS.has(c.deck)) DECK_ANSWERS.set(c.deck, new Set());
  const set = DECK_ANSWERS.get(c.deck);
  for (const a of [c.answer, ...(c.accept ?? [])]) set.add(normalise(a));
}

/**
 * Normalise for comparison. Case, punctuation, articles and whitespace all go,
 * because none of them is what is being tested. "Authentication, Authorization,
 * and Accounting" and "authentication authorization accounting" are the same
 * knowledge and grading them differently would only teach typing.
 */
export function normalise(s) {
  return String(s ?? '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9+ ]+/g, ' ')
    .replace(/\b(the|a|an|of|for|to)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Grade a typed answer.
 *
 * `exact` when it matches the answer or a listed alternate. `close` when it is
 * one small edit away - a typo, not a wrong answer - which the UI offers to
 * accept rather than silently crediting. Everything else is wrong.
 */
export function grade(card, typed) {
  const t = normalise(typed);
  if (!t) return { verdict: 'blank' };

  const targets = [card.answer, ...(card.accept ?? [])].map(normalise);
  if (targets.includes(t)) return { verdict: 'exact' };

  // A different card's answer is a wrong answer, not a typo. See DECK_ANSWERS.
  if (DECK_ANSWERS.get(card.deck)?.has(t)) return { verdict: 'wrong' };

  for (const target of targets) {
    if (editDistance(t, target) <= Math.max(1, Math.floor(target.length / 12))) {
      return { verdict: 'close' };
    }
  }
  return { verdict: 'wrong' };
}

/** Levenshtein, capped - only ever asked about short strings. */
function editDistance(a, b) {
  if (Math.abs(a.length - b.length) > 6) return 99;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(
        prev[j] + 1,
        cur[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    prev = cur;
  }
  return prev[b.length];
}
