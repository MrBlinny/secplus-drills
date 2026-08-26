# Attribution and third-party content

## CompTIA

**CompTIA** and **Security+** are trademarks of CompTIA, Inc. This project is not affiliated with, endorsed by, or sponsored by CompTIA.

`content/objectives.md` is a transcription of CompTIA's freely published **Security+ SY0-701 Exam Objectives v5.0**, included because the app cannot function without it — it is the term list the coverage audit, the lists page and the blank-paper grader all check against. CompTIA publishes that document publicly and without charge for candidate use. All rights in it remain CompTIA's.

CompTIA's PDF itself is **not** redistributed here. Download it from [CompTIA's certification page](https://www.comptia.org/en-us/certifications/security/) if you want to verify the transcription; the repo's `.gitignore` expects it at `content/SY0-701-objectives-official.pdf`.

**No exam content is included here.** Every question in this repository is either written for it or drawn from the openly licensed community sources below. Nothing came from a live exam, and nothing came from a braindump site.

> CompTIA's own objectives document states that candidates found using unauthorised third-party "real exam questions" material have their certifications **revoked** and are barred from future testing. Please do not add such content to this repository. Pull requests containing it will be refused.

## Harvested question banks

Both are MIT-licensed and are used under that licence. Their raw downloads are kept in `harvest/` so the import is auditable, and the normalised output lives in `data/item-bank-practice.json`.

| Source | Licence | Used |
|---|---|---|
| [iakhator/comptia-security-plus-701](https://github.com/iakhator/comptia-security-plus-701) | MIT | 300 questions |
| [cloudanimal/security-plus-prep](https://github.com/cloudanimal/security-plus-prep) | MIT | 151 questions |

**Two caveats, stated plainly:**

1. **Neither upstream documents where its questions originally came from.** They are community-written practice material of unverified provenance. This app labels them `practice` on reveal, keeps them in a separate file from the authored bank, and excludes them from the coverage audit for that reason. Treat them as drill volume, not as authority.

2. **Their objective tags are not used.** One source tags questions "Objective 3.5" and "Objective 3.6", which do not exist in SY0-701 — those are book chapter numbers. Every objective code on a harvested question is *inferred* by `tools/import-harvest.mjs` scoring the question against the literal bullet terms in `content/objectives.md`. 227 got a confident objective; the remaining 224 could only be placed to a domain and carry `x.x General`.

One file from the first source, `harvest/iak-finalExam.json` (100 questions), ships with an **empty answer key** and is deliberately not imported. See `CLAUDE.md` for the reasoning.

## A course pack that was offered and mostly refused

A shared drive of SY0-701 class material was reviewed for import in August 2026. Recording what happened to it, because "we looked and said no" is only useful if it is written down.

**Refused — roughly 505 multiple-choice questions.** Every file in its `Practice Exams/Multiple Choice/` folder is a scrape of **ExamTopics**: the questions carry that site's `Question #N Topic N` numbering, and the 200-question file still has a live hyperlink back to `examtopics.com/exams/comptia/sy0-701/view/N/` on each item. That is exactly the category CompTIA revokes certifications over. Not imported, not committed, not kept.

**Also not redistributed.** The pack's CompTIA lesson PowerPoints and its commercial "Last Minute Guide" acronym PDF are somebody's copyrighted work and are not this repo's to publish.

**Taken instead — nothing, in the end.** The cram decks that came out of that review are built from sources this repo already had the right to use: the acronym deck is parsed from `content/objectives.md`, which is CompTIA's own freely published list, and the port deck is IANA port assignments with usage notes written here. The pack prompted the feature; none of it is in the feature.

## Software dependencies

| Package | Licence |
|---|---|
| [express](https://github.com/expressjs/express) | MIT |
| [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) | MIT (optional dependency) |

## Authored content

Everything in `tools/authored/`, `tools/authored-coverage/`, `content/confusion-pairs.json`, `content/scenario-rules.json`, `content/curriculum.md`, `content/deep-dives.md` and `data/pbq-bank.json` was written for this repository and is covered by the MIT licence in `LICENSE`.
