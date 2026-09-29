# PRODUCT.md — Ghesse

## Product
Ghesse is a Persian-first progressive web app that teaches and helps learners retain 899 A1 English words through a 40-chapter continuous story.

## Primary user
A Persian-speaking beginner learning English on mobile or tablet, often in short focused sessions.

## Core outcome
The learner should understand, recall, hear, and use the vocabulary well enough to read the story with minimal support and retain the words over time.

## Required chapter flow
1. Teach every new word directly. Show the English form, Persian meaning, IPA, example and translation. Pronounce the word automatically.
2. Written translation test. Every chapter word must be answered correctly; missed words re-enter the same queue.
3. Listening test. Every chapter word must be recognized from audio; missed words re-enter the same queue.
4. The story remains locked until both tests reach 100% coverage.
5. Read the chapter with optional Persian translation and per-sentence audio.
6. Complete 10 comprehension questions based on the chapter. Immediate feedback is shown; only missed questions return for correction. Chapter completion unlocks after all 10 have been corrected, while analytics retain the honest first-pass score.
7. Consolidate the book: its end-of-book test opens only when every word of the book has been recalled without help (in Smart Review or a test) after a genuinely delayed interval on a later learner-local day. A date change by itself is not enough: at least eight real hours must also have elapsed, so no word crosses into the next book on one day's evidence. Smart Review brings these words first; when only words taught today remain, the learner is told to come back tomorrow and can practise in the Leitner box meanwhile.
8. After each book, pass the bounded cumulative end-of-book test. It gates the next book (after book 8, the final exam) and has four parts, each needing 90% with one slip always forgiven (a 5-question part passes with 4 right, a 12-question part with 11): typed Persian translation, listening recognition, fresh reading comprehension and fresh listening comprehension. Vocabulary sampling grows only from 24 questions after book 1 to 52 after book 8 (24, 28, 32, 36, 40, 44, 48, 52); every studied book remains represented and the newest book receives double weight. Reading/listening passages grow from one per skill in books 1–2 to four per skill in books 7–8. Missed vocabulary enters independent remediation, and progression stays blocked until those words are recalled outside the exam.
9. Continue into spaced review and gated cumulative exams: midpoint = 56 word questions plus 2 reading + 2 listening texts, 90% overall / 88% productive; final = 88 word questions plus 4 reading + 4 listening texts, 95% overall / 92% productive. Comprehension uses the same overall threshold. Policy constants live in `src/data/learningPolicy.json`.

Explore mode (Settings, off by default) opens every chapter, word lesson and test for looking around. It changes only what can be opened: anything the learner has not reached on the path above runs as a preview that records nothing, so switching it off restores the path exactly.

## Product principles
- The task leads; decoration never competes with learning.
- Do not ask beginners to guess a word before teaching it. The only exception is an explicit learner-chosen prove-known diagnostic: it tests every chapter word by productive English recall and audio meaning recognition, requires 100% first-try coverage, returns to teaching on the first miss, and never grants durable mastery.
- 100% preparation gates mean coverage, not mastery. Durable mastery requires later spaced retrieval.
- Reading should feel like reading, not like reviewing flashcards.
- Once preparation is passed, story text should not visually mark new words.
- Audio is a first-class learning channel and must be consistent across word teaching, examples and story narration. Pronunciation rehearsal is optional record–listen–compare practice: microphone access is user-initiated, recordings stay ephemeral and local, and the product must not invent an opaque accent score.
- Active production beyond isolated recall is optional during acquisition: learners create a new sentence, compare it with a model, and may shadow the model sentence. Free production is not automatically grammar-scored or counted as mastery until such scoring is validated.
- Persian is the interface language; English content keeps clear LTR typography.
- Mobile and tablet are primary. Touch targets must remain comfortable and core functionality must work offline where possible.
- Progress must be explainable. Learners should always know what is required to unlock the next stage.
- Word-level mastery labels must also be explainable: the glossary may show the actual independent-retrieval evidence and the next missing observable requirement, but never expose a decorative score or imply certainty beyond recorded evidence.
- Smart Review is the canonical adaptive scheduler. The Leitner box is optional free practice and never competes with, replaces or supplies mastery evidence for Smart Review.
- Smart Review may reorder only a small local window of the scheduler-selected queue to avoid adjacent same-headword/topic cards; it must preserve the selected set and keep the highest-priority first card fixed.
- Motivation rewards effort, never implies mastery. A daily goal counts graded answers (the Settings goal, 10–25), a day streak counts days that met it, and reaching the goal earns one brief, dismissible note that waits until tests and story reading are over. Scores and gates stay the only evidence of learning.
- Stories fit an Iranian family audience: Mina is always with a parent or relative outside home, adults speak to strangers, schools and pools are for girls or boys, Friday is the day off, and there is no alcohol, dancing, dating or pork anywhere in the course (`validate-editorial.mjs` guards the words).

## Non-goals
- Gamification that distracts from reading, or points, levels and leaderboards that stand in for learning evidence.
- Decorative scoring that implies mastery after one successful session.
- Dense dashboards that obscure the next learning action.
- Making the story linguistically harder merely to sound literary.

## Evidence policy
- Internal mastery labels and in-app exam scores are not substitutes for external delayed-transfer evidence.
- The learner-facing completion badge must be described as an **in-app/course evidence** badge, never as proof of real-world mastery or empirical validation.
- Real-world validation status is explicit in `research/status.json`. Until study evidence is attached, product language must say research-informed rather than empirically validated.
- Learner research export is opt-in, de-identified and local-only until the learner explicitly shares the downloaded file.

## Home information architecture
- **Today / امروز** is the default surface: the engine-selected next action, today's effort, and Smart Review.
- **Journey / مسیر** contains books, chapters, exams, progress evidence and certification.
- **Library / کتابخانه** contains reference and optional tools: glossary, free Leitner practice, settings and backup.
- A learner should not have to choose between memory systems. Smart Review remains canonical; Library tools never compete with the recommended next action.

## Release constraints
- All 899 assigned vocabulary introductions must remain covered.
- Sentence/audio provenance safeguards must remain intact.
- CONTENT_PROVENANCE.md records the unresolved provenance of the current vocabulary. Deployment no longer enforces a content-rights gate.
