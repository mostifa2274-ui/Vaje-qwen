# Human run sheets

An agent can keep this file current. An agent cannot fill `completedRuns`, `reviewedWordIds`, `studyEvidence`, or any `signoff`.

Copy results into the JSON files named below. Date format is `YYYY-MM-DD`.

## Native editorial

Target file: `quality/lexical-review.json`  
Protocol: `quality/CONTENT_REVIEW_PROTOCOL.md`  
Scope: all 899 active ids at `activeVocabularySha256`.

For each batch:

| Word id | Sense | Gloss | POS | Example | Pass / revise | Initials |
|---|---|---|---|---|---|---|

After the last batch, set:

```
reviewerSignoff: { reviewer, role, scope, date, activeVocabularySha256 }
chapterAssessmentSignoff: { reviewer, role, scope, date, activeVocabularySha256 }
```

`reviewedWordIds` may grow only after those rows exist outside this repo or in a signed note. Empty array means pending.

## Accessibility

Target file: `quality/accessibility-status.json`  
Path each run: teach → written prep → listening prep → story → Smart Review → exam or book test → glossary → pronunciation → backup → map (Today / Journey / Library).

| Run id | Device / OS / browser / AT | Tester | Date | Result | Issues |
|---|---|---|---|---|---|
| android-talkback |  |  |  |  |  |
| ios-voiceover |  |  |  |  |  |
| desktop-keyboard-screenreader |  |  |  |  |  |
| zoom-200 |  |  |  |  |  |
| large-text |  |  |  |  |  |
| reduced-motion |  |  |  |  |  |
| forced-contrast |  |  |  |  |  |
| audio-screenreader-conflict |  |  |  |  |  |
| microphone-permission-matrix | deny / allow / revoke / pending / missing |  |  |  |  |
| offline-assistive-tech |  |  |  |  |  |

`completedRuns` is the list of run ids that actually finished. Do not copy the list from `requiredRuns` as a shortcut.

## Art direction

Target file: `quality/art-review-status.json`  
Bible: `quality/ART_BIBLE.md`

| Chapter id | Mina identity | Nino rule | Place continuity | Defects | Pass / revise |
|---|---|---|---|---|---|

Sign-off needs `reviewedChapterIds`, `reviewedManifestSha256` from `src/data/chapterArtBatch.json`, plus `{ reviewer, role, scope, date }`.

## Learner outcomes

Target file: `research/status.json`  
Protocol: `research/VALIDATION_PROTOCOL.md` (`ghesse-learning-outcomes-v1`)

Do not change status from `protocol-ready-not-run` until a dated cohort exists with:

- frozen app commit and vocabulary SHA
- baseline, immediate transfer, 7-day and 30-day held-out tests
- attrition
- artifacts under `research/evidence/` with SHA-256

## Policy calibration

Target file: `quality/calibration-status.json`

Add a `policyChanges` row only when a delayed-outcome study says a number should move. Do not retune FSRS weights from in-app grades alone.
