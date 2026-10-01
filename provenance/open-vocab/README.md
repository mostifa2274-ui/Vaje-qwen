# Open vocabulary reconstruction

This directory is the reproducible migration path away from the legacy Oxford-derived development selection.

## Release status

The active deck has no documented redistribution clearance in this repository. Deployment does not use this record as a build gate. Nothing in this directory clears the content's provenance by itself.

## Independent reconstruction source

The preferred reconstruction input is Tatoeba's per-language English **CC0** sentence export:

- source index: https://downloads.tatoeba.org/exports/per_language/eng/
- file: `eng_sentences_CC0.tsv.bz2`
- license: CC0 1.0 for the sentences included in that export
- Tatoeba download documentation: https://tatoeba.org/en/downloads

The candidate generator records the SHA-256 of the exact compressed source snapshot used.

## Independence protocol

To avoid merely relabeling the current deck:

1. Generate a frequency-ranked English candidate pool from the CC0 corpus **without reading `src/data/vocabulary.json`**.
2. Freeze that candidate pool and its source SHA-256.
3. Select the release vocabulary using documented beginner-language criteria: frequency, concrete communicative usefulness, function-word coverage, basic semantic domains, and A1-appropriate morphology.
4. Freeze the selected English headword set before comparing it with the legacy 899-word development deck.
5. Independently author or independently verify every redistributable runtime field used by the new deck: Persian gloss, IPA, topic, example, Persian example translation, POS, and CEFR assignment.
6. Keep source and license evidence with the replacement deck. The product no longer has a content-rights status file.
7. Adopt the replacement only as a new deck with its own source and license notes. There is no content-rights status to flip.

When documenting a reconstructed deck, record the SHA-256 of the exact active vocabulary bytes.

## Candidate generation

Run:

```bash
python scripts/build-open-vocab-candidates.py \
  --input /path/to/eng_sentences_CC0.tsv.bz2 \
  --output provenance/open-vocab/tatoeba-cc0-candidates.json \
  --limit 5000
```

The generated file is a **candidate-frequency artifact**, not a final A1 list and not release evidence.
