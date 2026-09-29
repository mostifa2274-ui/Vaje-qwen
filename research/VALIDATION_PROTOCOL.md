# Ghesse learning-outcomes validation protocol

Protocol ID: **ghesse-learning-outcomes-v1**

Status: **protocol ready; learner study not yet run**.

This document defines the minimum evidence required before describing Ghesse as empirically validated. Product completion, app-store readiness, high test coverage, or a high final-exam score inside Ghesse are not substitutes for external delayed-learning evidence.

## Population

Recruit Persian-speaking learners whose English vocabulary is approximately beginner/A1. Record age band and prior English exposure outside the app in the study system, not inside Ghesse. Do not place names, emails, phone numbers or participant contact details in Ghesse progress or research-report files.

Use a staged pilot:

1. usability pilot: 8–12 learners;
2. learning pilot: target 40+ completing learners;
3. confirmatory run only after the protocol and thresholds are frozen.

The numbers above are planning targets, not claims of statistical power. A formal power analysis must be performed once the primary outcome and expected effect size are fixed.

## Pre-registration before the learning pilot

Freeze and timestamp:

- app commit and vocabulary-data hash;
- inclusion/exclusion criteria;
- primary and secondary outcomes;
- test forms and scoring;
- handling of missing follow-up data;
- analysis plan;
- stopping rule;
- any comparison condition.

Do not change the learning engine after seeing outcome data and then report the same cohort as confirmatory evidence.

## Measurements

### Baseline

Before instruction, measure a held-out sample of target vocabulary using:

- Persian → typed English recall;
- audio-only English → Persian meaning;
- an unseen short reading passage;
- an unseen short listening passage.

Baseline items must not reveal answers before the measurement is complete.

### Immediate transfer

After a book is completed, use **unseen** material not used in lessons, Smart Review, Leitner, chapter comprehension or book tests:

- productive word recall;
- listening recognition;
- spelling;
- sentence-level meaning in a new context;
- short reading transfer;
- short listening transfer.

### Delayed tests

Repeat parallel held-out forms at approximately:

- 7 days;
- 30 days.

The 30-day measurement is the main durability check. Do not replace a missed 30-day outcome with an in-app mastery label.

### Pronunciation pilot

Evaluate the optional record–listen–compare feature separately. Use human intelligibility judgments or a validated pronunciation instrument. Do not use a self-invented ASR/accent score as the ground truth.

## Primary metrics

Report at minimum:

- delayed typed-recall accuracy;
- delayed listening-recognition accuracy;
- unseen-context transfer accuracy;
- reading-comprehension accuracy;
- listening-comprehension accuracy;
- completion and follow-up retention rates.

Also report distributions, not only averages.

## Calibration questions

Use the exported de-identified Ghesse report to test whether these internal signals predict held-out delayed outcomes:

- first-attempt written and listening accuracy during initial chapter preparation (kept separate from the corrected 100% unlock score);
- FSRS stability and difficulty;
- retrieval latency;
- lapse count;
- skill-specific accuracy;
- strong/mastered labels;
- current interval;
- number and span of successful days.

Tune thresholds only on a development cohort. Lock them before confirmatory evaluation.

## Privacy

The Settings screen can export a research report that deliberately omits:

- identity/contact information;
- raw typed answers;
- exact timestamps and calendar-day strings;
- narrator/device choices;
- pronunciation recordings.

Sharing is an explicit participant action. The app performs no automatic research upload.

## Evidence status

Until a completed study is attached to this repository, the correct claim is:

> The learning engine is research-informed and internally tested; real-world learning outcomes have not yet been independently validated.

After a study, add its protocol ID, app commit, vocabulary hash, sample description, attrition, anonymized aggregate results and analysis artifact to this directory. Evidence registered in `research/status.json` must live under `research/evidence/` and include its SHA-256 so CI can verify that the claimed artifact actually exists and has not changed. Never rewrite the protocol retroactively.
