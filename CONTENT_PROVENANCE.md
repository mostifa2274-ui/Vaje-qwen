# Ghesse vocabulary provenance

The current deck contains 899 A1 English→Persian entries imported from the user-provided `vazhebaaz-vocabulary-complete` package. The source package reports that its English selection was derived from an American Oxford 3000 A1 development selection.

The repository does not contain documented public or commercial redistribution rights for that selection. Removing a deployment check does not establish those rights. The current record in `provenance/release-rights.json` remains `blocked` for this reason.

At the owner's request, the content-rights check has been removed from the build and deployment commands. The record remains available for a later rights review or independent replacement of the vocabulary. Do not change its status to `cleared` without evidence tied to the exact active content.

Runtime learner-facing fields are stable ID, English headword, Persian gloss, IPA, topic, English example, Persian example translation, part of speech, and CEFR level.

## Independent reconstruction path

`provenance/open-vocab/README.md` documents a reconstruction workflow using the official Tatoeba English CC0 sentence export. `scripts/build-open-vocab-candidates.py` creates a frequency-ranked candidate pool without reading the existing deck.

A candidate pool alone is not a finished replacement. The English selection must be frozen independently, and the Persian glosses, IPA, topics, examples, translations, parts of speech, CEFR assignments, and chapter mappings must be independently authored or verified before the record can be marked `cleared`.
