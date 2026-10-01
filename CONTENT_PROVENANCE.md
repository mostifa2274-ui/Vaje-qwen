# Ghesse vocabulary provenance

The current deck contains 899 A1 English→Persian entries imported from the user-provided `vazhebaaz-vocabulary-complete` package. The source package reports that its English selection was derived from an American Oxford 3000 A1 development selection.

At the owner's request on 2026-10-01, the product no longer carries a content-rights status. `provenance/release-rights.json` and the `contentRights` best-in-class gate were removed. That removal is not a clearance, license, or claim that redistribution rights were documented.

Runtime learner-facing fields are stable ID, English headword, Persian gloss, IPA, topic, English example, Persian example translation, part of speech, and CEFR level.

## Independent reconstruction path

`provenance/open-vocab/README.md` documents a reconstruction workflow using the official Tatoeba English CC0 sentence export. `scripts/build-open-vocab-candidates.py` creates a frequency-ranked candidate pool without reading the existing deck.

A candidate pool alone is not a finished replacement. The English selection must be frozen independently, and the Persian glosses, IPA, topics, examples, translations, parts of speech, CEFR assignments, and chapter mappings must be independently authored or verified before a replacement deck is adopted.
