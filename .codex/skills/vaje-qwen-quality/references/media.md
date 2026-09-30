# Artwork, audio and batch assets

Read current manifest/canon/source files before touching generated media.

## Idempotent batch rule

For a batch request:
1. enumerate expected assets from canonical data
2. classify each as approved, pending, invalid, missing, or stale
3. process only pending/invalid/missing/stale items
4. checkpoint results deterministically
5. never regenerate accepted assets merely because the user says "continue"
6. validate manifests and rendered integration after the batch

This is the anti-repeat rule for artwork/audio work.

## Artwork

Before generating/replacing chapter art, read the current story canon and visual bible.

At skill creation, long-lived themes included contemporary Tehran/Iran identity, recurring-character continuity, the current modesty/hijab canon, family continuity, and Nino as a small yellow chicken with the repository-defined distinguishing marker. These are **hints only**; current canon files win.

A visually attractive image that breaks chronology, character identity, Nino identity, location continuity, or cultural canon is invalid.

Generation is not approval. Do not fabricate human art-direction sign-off.

## Audio

Audio must correspond to the exact current prompt text.

When text changes:
- identify dependent audio through the repository's canonical hash/manifest mechanism
- regenerate only invalidated clips
- validate coverage and mapping
- preserve a graceful browser/system-voice fallback if current architecture uses one

Do not report a bulk audio job complete from a partial batch.

## Rights/provenance

Keep source/license/provenance records separate from aesthetic review. A technically valid asset is not automatically rights-cleared.
