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

## Release constraints
- All 899 assigned vocabulary introductions must remain covered.
- Sentence/audio provenance safeguards must remain intact.
- CONTENT_PROVENANCE.md records vocabulary provenance. The content-rights product gate and its blocked status were removed at the owner's request. That removal is not a redistribution clearance.
