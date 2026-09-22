# Ghesse vocabulary provenance boundary

The current private-development deck contains 899 A1 English→Persian entries imported from the user-provided `vazhebaaz-vocabulary-complete` package.

The source package states that the current selection retains provenance from an American Oxford 3000 A1-derived development selection. Public/commercial redistribution therefore remains **fail-closed** until one of these conditions is documented:

1. rights covering redistribution/use of the existing selection are established; or
2. the selection is independently reconstructed and validated against a source whose terms permit the intended release, with its required attribution/terms retained.

Changing a source label is not a rights migration. Technical readiness of the application does not override this release gate.

Runtime learner-facing fields imported here are stable `id`, English headword, Persian gloss, IPA, topic, English example, Persian example translation, part of speech, and CEFR level.

## Evidence-bound public release

Public release now requires **both**:

- the deployment acknowledgement `GHESSE_RIGHTS_CONFIRMED=1`; and
- a checked-in `provenance/release-rights.json` manifest with `status: "cleared"` whose `activeVocabularySha256` exactly matches the bytes of `src/data/vocabulary.json`.

The manifest must also state the clearance basis, retain source/license evidence, and record a clearance date. A stale evidence record cannot clear a modified vocabulary file, and the environment variable alone cannot bypass a blocked manifest.

The current manifest remains intentionally `blocked`.

## Independent reconstruction path

`provenance/open-vocab/README.md` documents a clean-room-style reconstruction workflow based on the official Tatoeba English CC0 sentence export. The accompanying `scripts/build-open-vocab-candidates.py` generates a frequency-ranked candidate pool directly from that corpus and intentionally does not read the legacy Ghesse vocabulary deck.

The candidate pool is not itself a release vocabulary or rights clearance. The English selection must be frozen independently before comparison with the legacy deck, and all redistributable runtime fields must then be independently authored or independently verified before the final vocabulary hash can be recorded as cleared evidence.
