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
7. After each book, pass the end-of-book test. It gates the next book (after book 8, the final exam) and has four parts, each needing 80%: typed Persian translation of 12 words and listening recognition of 12 other words, drawn from every book so far; a new reading text with 5 questions; and a new listening text with 5 questions. The listening text is audio only until the test ends, when both texts, their translations and every answer are shown for review. Both texts use only words taught up to that book, and retakes alternate to a second pair of texts.
8. Continue into spaced review and gated midpoint/final exams.

Explore mode (Settings, off by default) opens every chapter, word lesson and test for looking around. It changes only what can be opened: anything the learner has not reached on the path above runs as a preview that records nothing, so switching it off restores the path exactly.

## Product principles
- The task leads; decoration never competes with learning.
- Do not ask learners to guess a word before teaching it.
- 100% preparation gates mean coverage, not mastery. Durable mastery requires later spaced retrieval.
- Reading should feel like reading, not like reviewing flashcards.
- Once preparation is passed, story text should not visually mark new words.
- Audio is a first-class learning channel and must be consistent across word teaching, examples and story narration.
- Persian is the interface language; English content keeps clear LTR typography.
- Mobile and tablet are primary. Touch targets must remain comfortable and core functionality must work offline where possible.
- Progress must be explainable. Learners should always know what is required to unlock the next stage.

## Non-goals
- Gamification that distracts from reading.
- Decorative scoring that implies mastery after one successful session.
- Dense dashboards that obscure the next learning action.
- Making the story linguistically harder merely to sound literary.

## Release constraints
- All 899 assigned vocabulary introductions must remain covered.
- Sentence/audio provenance safeguards must remain intact.
- CONTENT_PROVENANCE.md records the unresolved provenance of the current vocabulary. Deployment no longer enforces a content-rights gate.
