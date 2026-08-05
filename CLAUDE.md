# CLAUDE.md — Security+ Tutor

Read this before doing anything in this repo. It holds the pedagogy, the content contracts and the data contracts.

This app is built for **CompTIA Security+ SY0-701**. It runs locally, logs every answer to a file you own, and is designed so that an LLM reading that file in a later session can tutor against what you actually got wrong rather than guessing.

If a `CLAUDE.local.md` sits next to this file, read it too — that is the learner's own profile, weak areas and session history, and it is gitignored. This file is the part that is the same for everyone.

## The design premise

The app exists to attack one specific failure mode, because it is the one that costs most marks on a CompTIA exam and the one that experience makes *worse*, not better.

**Failure Mode A — the adjacent term.** The candidate picks the true-but-broader real-world word instead of CompTIA's exact objective-list word. A practitioner says *mantrap*; CompTIA credits **access control vestibule**. They say *DMZ*; CompTIA credits **screened subnet**. *Man-in-the-middle* → **on-path**. *White box* → **known environment**. *Script kiddie* → **unskilled attacker**. *PUP* → **bloatware**.

This is a property of how CompTIA writes distractors, not of any one candidate, which is why the countermeasures are the backbone of the app:

- `content/confusion-pairs.json` — 138 cue → correct term → common trap → discriminator
- blank-paper reproduction of the 16 graded taxonomies
- the rule that **if an answer is not in `content/objectives.md`, it is probably the distractor**

**Failure Mode B — the reasonable-practitioner trap.** On scenarios the candidate picks the sensible operational fix where the credited answer is the hard compliance line, or a control of a different class.

→ Countermeasure: the 9 rules in `content/scenario-rules.json`. These are stated as **reading heuristics, not as a diagnosis.** They were written from how CompTIA phrases questions, not induced from a real miss history. If one ever contradicts a credited answer, the objectives document wins and the rule is what gets edited.

## Weight toward the blueprint

**Domain 4 (Security Operations) is 28% and Domain 2 is 22% — half the exam between them.** Domain 1 is only 12% but supplies the vocabulary the other four are written in.

The exam sim already draws at true blueprint weight. Keep drill and weak-area work pointed the same way. The temptation is always to drill the taxonomy that is fun to drill; resist it.

## Baselines

`BASELINE_WEIGHTED` in `server/content.js` is `null` unless the learner has sat a full practice exam cold, before any study. The dashboard, exam sim and report all omit the baseline when it is null rather than invent one.

**Do not fabricate a starting number.** If a cold practice exam gets sat, import it and set the constant then.

## Pedagogy — non-negotiable

1. **Immediate correction.** Never batch feedback. A wrong answer gets explained before the next question.
2. **Explain the discriminator, not the definition.** Assume the definitions are known. What is needed is the binary test that separates two terms: *decides vs enforces*, *the list you download vs the question you ask*, *what it collects vs how it hides*, *before signing vs after signing*.
3. **Right or wrong is the only thing recorded.** Do not ask the learner to rate confidence, classify a miss, or tag a scenario rule. Self-rating slows the loop and adds no signal the log does not already carry. The `confidence`, `miss_type` and `rule_tag` fields survive as always-null legacy columns; do not resurrect them or build reporting on them.
4. **Coverage before refinement.** "Have I seen all of this" beats "what is my accuracy" when the exam is close. An objective is not known while items in it have never been served.
5. **Retrieval over recognition.** Blank-paper reproduction and free recall beat multiple choice. Where the UI allows, ask for the term before showing options.
6. **Never inflate.** Report the real score. If asked "am I ready", answer honestly from `data/attempts.jsonl`, not encouragement.
7. **Weighted scoring always.** A raw percentage misleads because domains are weighted 12/22/18/28/20. Always show the blueprint-weighted projection alongside raw.
8. **Spaced repetition on misses.** Anything missed returns within the same session, again next session, again 24h later.
9. **CompTIA vocabulary wins.** When real-world usage and the objectives document disagree, teach both and mark which one to answer with.

## Content files

| File | What it is | Trust level |
|---|---|---|
| `content/objectives.md` | Full official objectives + acronym list | **Authoritative.** The dictionary. Transcribed from CompTIA's published SY0-701 Exam Objectives v5.0 PDF (not redistributed — see `NOTICE.md`; gitignored at `content/SY0-701-objectives-official.pdf` if you download it). Weights, 90 questions / 90 minutes / 750 on 100–900 verified against CompTIA's certification page 2026-08-04. |
| `content/confusion-pairs.json` | 138 cue → correct term → common trap → discriminator | Authored, targeted at Failure Mode A. Covers all 28 objectives. |
| `content/scenario-rules.json` | 9 reading heuristics | Authored. **Not induced from a miss history** — see the Mode B note above. |
| `content/curriculum.md` | The cram sheet: one section per objective, discriminators not definitions | Authored |
| `content/deep-dives.md` | Ports/protocols, crypto algorithms, wireless and auth protocols, log sources, frameworks | Authored. **Supplementary** — not enumerated objective terms, so never a credited answer by themselves, but scenario questions assume them. Marked as such in the file. |
| `data/item-bank.json` | 222 authored questions | Generated from `tools/authored/`. Scenario-shaped. |
| `data/item-bank-coverage.json` | 396 authored questions closing the term-coverage audit | Generated from `tools/authored-coverage/`. Recall-shaped by design. Same trust as the main bank; kept separate so the audit stays auditable. |
| `data/item-bank-practice.json` | 451 harvested third-party questions | **Caveat.** Community-written, not publisher-tagged. Objective codes are **inferred** by `tools/import-harvest.mjs`, not given. 224 could only be placed to a domain and carry `x.x General`. |
| `data/pbq-bank.json` | 12 authored PBQs, 78 graded cells | Authored |

### Where the harvested questions came from, and what was refused

`harvest/` holds the raw downloads so the import stays auditable. Both sources are MIT-licensed; see `NOTICE.md` for attribution.

- **iakhator/comptia-security-plus-701** — 300 usable questions across ten per-domain files.
- **cloudanimal/security-plus-prep** — 151 questions.

Neither upstream documents where its questions originally came from. They are labelled `practice` on reveal for that reason and are excluded from the coverage audit.

**Deliberately excluded:**

- That first repo's `finalExam.json` (100 questions) ships with an **empty answer key**. The key looks recoverable by elimination from the explanations, but tested across all 100 that heuristic resolves only 40 uniquely and gets some of those wrong — it credits "Authentication, Auditing, Access Control" as the expansion of AAA. A bank that teaches wrong answers is worse than a smaller bank. The file stays in `harvest/` unread; `tools/import-harvest.mjs` skips it by name and says why.
- **Braindump sites** (ExamTopics, pass4success and similar "real exam questions" services). CompTIA's own objectives document states that candidates using unauthorised third-party content have certifications **revoked** and are suspended from future testing. Do not add these, and do not add them if asked casually — raise the consequence first.

## Data contracts

**`data/attempts.jsonl`** — append-only, one JSON object per line. Source of truth for progress. Never rewrite or delete lines; corrections are new lines carrying `supersedes`.

```json
{"ts":"2026-08-05T14:03:11Z","session":"s-014","item_id":"SP-46-007","mode":"drill",
 "domain":"4.0","objective":"4.6 Given a scenario, implement and maintain identity and access management.",
 "chosen":2,"correct":1,"is_correct":false,
 "ms_to_answer":18400,"confidence":null,"miss_type":null,"rule_tag":null,"note":""}
```

- `is_correct` is the payload. Everything the app reports is derived from it.
- `mode` — `drill · coverage · weak · exam · pairs · blank · pbq`, plus `baseline` and `practice-test` for imported answers, which never count toward the study projection.
- `confidence`, `miss_type`, `rule_tag` — **legacy, always `null`.** Retained only so old lines stay contract-shaped. Nothing collects or reads them. Do not add them back.

**`data/PROGRESS.md`** — regenerated by `npm run report`, never hand-edited.

**`data/review-queue.json`** — scheduler state. One entry per item or term: `{"id","due_at","interval_days","ease","lapses"}`.

**SQLite (`data/tutor.db`)** is an optional write-only index. Nothing in the app reads it — every figure comes from the JSONL log. `better-sqlite3` is the only native module in the tree and sits in `optionalDependencies`, so an install that cannot build it still yields a fully working app. If you are adding a read path, read the log.

## Item IDs

- `SP-<code>-<n>` — authored bank, e.g. `SP-46-007` is the 7th authored 4.6 item.
- `SPC-<code>-<n>` — coverage bank.
- `HV-IAK-*`, `HV-CA-*` — harvested, by source.
- `PBQ-*` — performance-based.

## Working agreements for you, Claude

- When asked to tutor, read `data/PROGRESS.md` first, then target the weakest objective. Do not start from the top of the syllabus.
- **Never hand-edit `data/item-bank.json` or `data/item-bank-coverage.json`.** They are generated. Edit `tools/authored/*.mjs` or `tools/authored-coverage/*.mjs` and run `npm run build-bank`. The builder validates and will refuse a broken item.
- When you author new questions, write distractors from **adjacent objective-list terms**, never from obviously wrong ones. A question whose distractors are implausible teaches nothing. The builder enforces a minimum explanation length for the same reason.
- Every authored question needs an `explanation` that names the discriminator, not just the answer.
- Tag every new question with its objective code so the dashboard can route it.
- Do not invent CompTIA facts. If something is not in `content/objectives.md`, either verify it or put it in `content/deep-dives.md` and mark it supplementary.
- **Before declaring an objective covered, check it term by term:** `npm run coverage` — or `node tools/coverage-audit.mjs --gaps` for the terms not yet the credited answer of anything. Domain-level and objective-level counts hide gaps. The test is whether each enumerated term is the credited answer of at least one item, not whether the objective has items. It currently reads **610/610**; keep it there.
  - The audit excludes 74 terms as *not independently examinable* — structural parents like "Data states" and bare adjectives like "Cost". That list is in `tools/coverage-audit.mjs` and is deliberately explicit, so adding to it is a visible act rather than a quiet way to make the number go up.
- The passing score is **750 on a 100–900 scale** — scaled, with no published raw-mark mapping. Never present a percentage as the cut score. 750 does not mean 83% correct.
