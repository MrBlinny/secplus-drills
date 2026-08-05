# Security+ Tutor

A local study app for **CompTIA Security+ SY0-701**. Runs on your own machine locally.

1,069 practice questions, 138 confusion-pair drills, 12 performance-based questions, a 90-question exam simulator at true blueprint weights.
Built for my friends taking their exam soon.

---

## Getting started

**Windows — double-click `START.cmd`.** It checks for Node, installs dependencies the first time, starts the app and opens your browser.

**Everything else, or if you prefer a terminal:**

```bash
git clone https://github.com/<user>/secplus-tutor.git
cd secplus-tutor
npm install
npm start          # opens at http://127.0.0.1:5050
```

The only prerequisite is **Node.js 20 or newer** — [nodejs.org](https://nodejs.org/en/download), if uncertain just use the LTS installer.

If `npm install` complains about `better-sqlite3`, ignore it. It will run fine without it and tell you so at startup. Something something warnings aren't errors something.

<details>
<summary>Other commands</summary>

```bash
npm run report     # regenerate data/PROGRESS.md from your answer log
npm run coverage   # term-by-term coverage audit
npm run build-bank # rebuild the authored banks from tools/authored*/
npm run rebuild-db # rebuild the optional SQLite index from the answer log
```
</details>

## Modes

| | Mode | What it is |
|---|---|---|
| — | **Learn** | The written material, per objective: the verbatim objective list, the discriminators from the cram sheet, and every confusion pair for that code. Reachable from the nav, from the dashboard's weakest five, and from a link on **every reveal** — miss a question, read the section on it. The **Deep dives** group holds the reference tables the objectives only gesture at: ports and protocols, which algorithm is symmetric vs asymmetric vs a hash, the EAP and wireless families, what each log source can actually prove, and which named frameworks are law, contract or voluntary. |
| — | **Lists** | Every enumerable list in the syllabus in one place, for writing out by hand — derived from `objectives.md` at load, so it cannot drift from what the app grades. **Hide the terms** (`H`) turns each list into numbered ruled blanks, and it prints that way. |
| **B** | **Blank paper** | Pick a taxonomy, type everything you remember, get a recalled / missed / invented diff. Invented terms are checked against every *other* taxonomy, so writing "recovery" under control types tells you it belongs to the 4.8 incident response process instead. Highest-signal exercise here. |
| **D** | **Drill** | Bank questions by domain or objective. |
| **P** | **Confusion pairs** | Free recall against 138 cue → term pairs. Type the term, reveal, self-grade. The main weapon against reaching for the adjacent word. |
| **W** | **Weak areas** | Auto-selects your five weakest objectives, blending previously-missed with never-seen. |
| **Q** | **PBQ** | Performance-based questions: classify control types, sequence the incident response process, choose the right agreement, place the Zero Trust components, complete a quantitative risk assessment. Partial credit per cell, each with the discriminator that separates the credited term from the one usually reached for. |
| **E** | **Exam sim** | 90 questions at true blueprint weights (11 / 20 / 16 / 25 / 18), 90-minute timer to match the real exam, no feedback until submit, then full review. |

From the dashboard those letters jump straight to each mode.

<details>
<summary>Keyboard shortcuts</summary>

Drill and weak areas: `1`–`4` pick · `Enter` advances.
Pairs: type, `Enter` reveals, `Y` / `N` self-grades.
Blank paper: `1`–`6` pick a list, `Ctrl`+`Enter` submits.
Lists: `H` hides or shows the terms, `P` prints.
PBQ: `↑` `↓` move between rows · `1`–`9` (`0`+digit past 9) picks from the pool · `Space` toggles a selection · `Shift`+`↑`/`↓` reorders · `Ctrl`+`Enter` submits.
Exam: `1`–`4` answer · `N` / `P` or arrows navigate · `F` flags · grid jumps.
</details>

## How your statistics data is stored

Every answer appends to `data/attempts.jsonl` on your disk.

It is plain JSONL, so you can hand it to any LLM and ask it questions about what you are doing well and not well, what you should work on, your best options for moving forward etc.. `CLAUDE.md` in this repo is written to be used by an ai to help you diagnose your progress.

It is **append-only**. Corrections are new lines. The SQLite file is only an index over it and can be deleted or rebuilt at any time.

`.gitignore` excludes your answer log, review queue and progress report, so forking and pushing won't publish your study history.

## Coverage, and why it is measured this way

The audit's test is **not** "does this objective have questions". It is **is each enumerated term the credited answer of at least one authored item**.

```bash
npm run coverage                      # summary per objective
node tools/coverage-audit.mjs --gaps  # every term still uncovered
```

74 of the 684 parsed terms are excluded as *not independently examinable* — structural parents CompTIA nests examples under ("Data states", "Firewall types") and bare adjectives that only mean something inside their parent ("Cost", "Power", "People"). A question whose credited answer is "Data states" tests nothing. That exclusion list is explicit in `tools/coverage-audit.mjs` so that adding to it is a visible act rather than a quiet way to improve the number.

Only the **authored** banks count toward coverage. A harvested item may happen to credit the right word, but its wording was not chosen to teach that term against its neighbours.

## Where the questions come from

**Authored (618).** Written for this repo. Every distractor is an adjacent objective-list term or a true-but-broader real-world word; every explanation names the discriminator rather than restating the definition. Generated from `tools/authored*/` by a builder that refuses items with out-of-range answers, duplicate options, duplicate stems, unknown objective codes, or explanations too short to contain a discriminator.

**Harvested (451).** Community-written practice questions from two MIT-licensed GitHub repositories — [`iakhator/comptia-security-plus-701`](https://github.com/iakhator/comptia-security-plus-701) and [`cloudanimal/security-plus-prep`](https://github.com/cloudanimal/security-plus-prep). Kept in a separate file and labelled `practice` on reveal, because they are not the same kind of thing: the authored questions have distractors built from adjacent objective-list terms, these have whatever the original author wrote. Neither upstream documents where its questions came from — treat them as drill volume, not authority.

Their objective codes are **inferred, not given.** One source tags questions "Objective 3.5" and "Objective 3.6", which do not exist in SY0-701 — those are book chapter numbers. Rather than trust them, each question is scored against the literal bullet terms of every objective in `objectives.md`, weighting the credited answer highest and discounting terms several objectives share. 227 got a confident objective; the other 224 keep their domain and land in `x.x General`, still drillable by domain. A wrong objective is worse than none — it would misroute drill and corrupt the weakest-five ranking.

**Refused.** One harvested file of 100 questions ships with an empty answer key and is not imported; the elimination heuristic that appears to recover it gets AAA wrong, and a bank that teaches wrong answers is worse than a smaller bank.

**Braindump sites are not used at all, and pull requests containing them will be refused.** CompTIA's own objectives document states that candidates using unauthorised "real exam questions" material have their certifications **revoked** and are suspended from future testing. Not worth it. See `NOTICE.md`.

## Scoring

The headline is the blueprint-weighted projection — sum over domains of (weight × domain accuracy) — because raw accuracy misleads when domains are weighted 12 / 22 / 18 / 28 / 20. Domains with no answers are excluded and the weights renormalised, with the covered share reported. Below 20 graded answers the number is greyed and captioned as provisional rather than presented as a projection.

**There is no baseline line on the chart** unless you create one. If you sit a full practice exam cold, before studying, import it and set `BASELINE_WEIGHTED` in `server/content.js`. Until then the app omits the baseline rather than inventing a starting number.

CompTIA scores SY0-701 on a scale of 100–900 with a passing score of **750**. That is a scaled score, not a percentage — 750 does not mean 83% correct, and there is no published mapping from raw marks to it. Every percentage this app shows is raw or blueprint-weighted accuracy, never a predicted scaled score.

## Scheduler

SM-2-lite on a compressed ladder — 10 min → 6 h → 1 d → 2 d. A miss returns about four questions later in the same session, again next session, then a day later.

## Layout

```
CLAUDE.md              design premise, pedagogy, data contracts — read first
NOTICE.md              attribution and third-party content
content/
  objectives.md        official exam objectives + acronym list — the dictionary
  confusion-pairs.json 138 cue → correct term → trap → discriminator
  scenario-rules.json  9 reading heuristics for scenario questions
  curriculum.md        the cram sheet, one section per objective
  deep-dives.md        ports, crypto, wireless, log sources, frameworks — supplementary
data/
  item-bank.json       222 authored questions      (generated)
  item-bank-coverage.json  396 gap-closing questions (generated)
  item-bank-practice.json  451 harvested questions   (generated)
  pbq-bank.json        12 performance-based questions, 78 graded cells
  attempts.jsonl       append-only answer log — yours, gitignored
harvest/               raw third-party downloads, kept so the import is auditable
server/                express app + all logic
public/                plain HTML / CSS / ES modules, no build step
tools/
  authored/            source for item-bank.json — edit these, not the JSON
  authored-coverage/   source for item-bank-coverage.json
  build-bank.mjs       builds and validates both authored banks
  coverage-audit.mjs   term-by-term coverage audit
  import-harvest.mjs   normalises harvest/ into item-bank-practice.json
```

## Contributing

Questions are welcome, with two hard rules:

1. **Never hand-edit `data/item-bank*.json`.** They are generated. Add to `tools/authored/*.mjs` and run `npm run build-bank`, which validates and will refuse a broken item.
2. **Distractors must be adjacent objective-list terms**, and every explanation must name the *discriminator* — the binary test that separates the credited term from the one people reach for instead. I have found a question whose distractors are implausible does not help nearly as much as giving real reasonable answers.

## Licence

MIT — see `LICENSE`. Third-party content and attribution in `NOTICE.md`.

CompTIA and Security+ are trademarks of CompTIA, Inc. This project is not affiliated with or endorsed by CompTIA.
