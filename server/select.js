// Item selection for drill, weak-areas and exam-sim.

import { loadItemBank, DOMAIN_WEIGHTS, EXAM_QUESTIONS, objectiveCode } from './content.js';
import { effectiveAttempts as readAttempts, isGraded, isStudy } from './attempts.js';
import { due as dueEntries } from './scheduler.js';
import { weakestObjectives } from './stats.js';

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Per-item history from the attempt log. */
function itemHistory() {
  const map = new Map();
  for (const a of readAttempts()) {
    if (!a.item_id || !isGraded(a)) continue;
    const h = map.get(a.item_id) ?? { seen: 0, wrong: 0, lastTs: '' };
    h.seen++;
    if (!a.is_correct) h.wrong++;
    if (a.ts > h.lastTs) h.lastTs = a.ts;
    map.set(a.item_id, h);
  }
  return map;
}

const matches = (item, { objective, code, domain }) => {
  if (objective && item.objective !== objective) return false;
  if (code && item.code !== code) return false;
  if (domain && item.domain !== domain) return false;
  return true;
};

/**
 * Drill selection, in priority tiers:
 *   1. due for review   2. never seen   3. previously missed   4. everything else
 * Shuffled within each tier so the order is not memorisable.
 */
export function pickDrill({
  objective = null, code = null, domain = null, limit = 20, includeOffSyllabus = false,
} = {}) {
  // Items whose credited answer uses no objective-list vocabulary are out by
  // default everywhere, not just in the exam sim. 71 of them came in with one
  // third-party practice exam, and drilling them trains wording the real exam
  // does not credit — the opposite of what this bank is for.
  const bank = loadItemBank().filter((i) => includeOffSyllabus || !i.off_syllabus);
  const pool = bank.filter((i) => matches(i, { objective, code, domain }));
  const hist = itemHistory();
  const dueIds = new Set(dueEntries({ kind: 'item' }).map((e) => e.id));

  const tier = (i) => {
    if (dueIds.has(i.id)) return 0;
    if (!hist.has(i.id)) return 1;
    if (hist.get(i.id).wrong > 0) return 2;
    return 3;
  };

  const tiers = [[], [], [], []];
  for (const i of pool) tiers[tier(i)].push(i);
  return tiers.flatMap(shuffle).slice(0, limit);
}

/**
 * Cover everything: the sweep that answers "have I actually seen all of this".
 *
 * Ordered strictly by how unproven an item is, then spread across objectives so
 * a long run does not spend its first forty questions inside 4.6:
 *   1. never answered right (missed every time)   2. never seen   3. proven once
 * Third-party practice items are excluded — the point of this run is coverage of
 * the authored material, whose wording matches the objectives document.
 */
export function pickCoverage({ limit = 90 } = {}) {
  const bank = loadItemBank().filter((i) => i.origin === 'authored' && !i.off_syllabus);
  const hist = itemHistory();

  const tier = (i) => {
    const h = hist.get(i.id);
    if (!h) return 1;                      // never seen
    if (h.wrong > 0 && h.seen === h.wrong) return 0;  // never once right
    if (h.wrong > 0) return 2;             // missed at least once, later right
    return 3;                              // clean
  };

  const tiers = [[], [], [], []];
  for (const i of bank) tiers[tier(i)].push(i);

  // Round-robin across objectives inside each tier, so the set stays varied.
  const spread = (items) => {
    const byObj = new Map();
    for (const i of shuffle(items)) {
      if (!byObj.has(i.objective)) byObj.set(i.objective, []);
      byObj.get(i.objective).push(i);
    }
    const lists = [...byObj.values()];
    const out = [];
    for (let n = 0; out.length < items.length; n++) {
      for (const l of lists) if (l[n]) out.push(l[n]);
    }
    return out;
  };

  const ordered = tiers.flatMap(spread);
  return {
    items: ordered.slice(0, limit),
    remaining: Math.max(0, ordered.length - limit),
    unproven: tiers[0].length + tiers[1].length,
    total: bank.length,
  };
}

/**
 * Weak areas: the five weakest objectives, blending items already missed with
 * unseen ones (~60/40) so it is not pure repetition of the same questions.
 */
export function pickWeak({ limit = 20 } = {}) {
  const study = readAttempts().filter(isStudy);
  const weak = weakestObjectives(study, 5);
  const targets = new Set(weak.map((w) => w.objective));
  if (!targets.size) return { items: pickDrill({ limit }), objectives: [] };

  const bank = loadItemBank().filter((i) => targets.has(i.objective) && !i.off_syllabus);
  const hist = itemHistory();

  const missed = shuffle(bank.filter((i) => (hist.get(i.id)?.wrong ?? 0) > 0));
  const unseen = shuffle(bank.filter((i) => !hist.has(i.id)));
  const rest = shuffle(bank.filter((i) => hist.has(i.id) && (hist.get(i.id)?.wrong ?? 0) === 0));

  const wantMissed = Math.round(limit * 0.6);
  const out = [
    ...missed.slice(0, wantMissed),
    ...unseen.slice(0, limit - Math.min(missed.length, wantMissed)),
  ];
  for (const i of rest) {
    if (out.length >= limit) break;
    out.push(i);
  }
  return { items: shuffle(out).slice(0, limit), objectives: weak };
}

/**
 * Blueprint quotas by largest-remainder, so the parts always sum to `count`.
 * At 90: 12/22/18/28/20 -> 11/20/16/25/18.
 */
export function blueprintQuota(count = EXAM_QUESTIONS) {
  const entries = Object.entries(DOMAIN_WEIGHTS)
    .map(([domain, weight]) => {
      // Round the exact share before splitting it: 90 * 0.18 is 16.199999...
      // in binary floating point, and comparing those raw remainders lets
      // representation noise decide the allocation instead of the blueprint.
      const exact = Math.round(count * weight * 1e6) / 1e6;
      return { domain, weight, floor: Math.floor(exact), rem: exact - Math.floor(exact) };
    });
  let left = count - entries.reduce((s, e) => s + e.floor, 0);
  // Ties on the remainder go to the heavier domain — 28% outranks 22%.
  entries.sort((a, b) => (b.rem - a.rem) || (b.weight - a.weight));
  for (const e of entries) {
    if (left <= 0) break;
    e.floor++;
    left--;
  }
  return Object.fromEntries(
    entries.sort((a, b) => a.domain.localeCompare(b.domain)).map((e) => [e.domain, e.floor]),
  );
}

/**
 * Exam sim draw. Reports any domain the bank cannot fill rather than silently
 * padding from elsewhere — a sim that quietly misweights is worse than one
 * that admits the shortfall.
 */
export function buildExam({ count = EXAM_QUESTIONS, includeOffSyllabus = false, freshHours = 12 } = {}) {
  const quota = blueprintQuota(count);
  // Items whose credited answer uses no objective-list vocabulary are excluded
  // by default. The sim exists to produce a calibrated blueprint-weighted
  // score, and a question that credits an invented term measures something the
  // real exam does not test. They stay available in drill and weak areas,
  // where the value is the scenario reasoning rather than the word.
  const all = loadItemBank();
  const bank = includeOffSyllabus ? all : all.filter((i) => !i.off_syllabus);

  // Anything answered in the last `freshHours` is stale as a measurement: a
  // question seen an hour ago tests recall of that session, not of the
  // material. This is also what stops a second sim from redrawing the first
  // one's questions — submitting a sim logs its items, so the window covers
  // them automatically.
  const cutoff = freshHours > 0
    ? new Date(Date.now() - freshHours * 3600_000).toISOString()
    : null;
  const recent = new Set(
    cutoff
      ? readAttempts().filter((a) => a.item_id && a.ts >= cutoff).map((a) => a.item_id)
      : [],
  );

  const items = [];
  const shortfall = {};
  let reused = 0;

  for (const [domain, want] of Object.entries(quota)) {
    const inDomain = bank.filter((i) => i.domain === domain);
    const fresh = shuffle(inDomain.filter((i) => !recent.has(i.id)));
    const take = fresh.slice(0, want);

    // Blueprint integrity outranks freshness: if a domain cannot be filled from
    // fresh items, top it up from recently-seen ones rather than returning a
    // short paper, which would misweight the whole score.
    if (take.length < want) {
      const topUp = shuffle(inDomain.filter((i) => recent.has(i.id))).slice(0, want - take.length);
      reused += topUp.length;
      take.push(...topUp);
    }
    items.push(...take);
    if (take.length < want) shortfall[domain] = want - take.length;
  }

  return {
    items: shuffle(items), quota, shortfall, count: items.length,
    excludedOffSyllabus: includeOffSyllabus ? 0 : all.length - bank.length,
    reusedRecent: reused,
    freshHours,
  };
}

/** Strip the answer key before sending questions to the browser. */
export const toQuestion = (i) => ({
  id: i.id,
  objective: i.objective,
  code: i.code ?? objectiveCode(i.objective),
  domain: i.domain,
  stem: i.stem,
  options: i.options,
  difficulty: i.difficulty ?? null,
  unverified: i.unverified === true,
  // Provenance travels with the question so the reveal can say plainly that an
  // item is a third-party practice question with an inferred objective, rather
  // than presenting it with the same authority as the authored bank.
  origin: i.origin ?? 'authored',
  exam: i.exam ?? null,
  objective_inferred: i.objective_inferred === true,
  off_syllabus: i.off_syllabus === true,
});
