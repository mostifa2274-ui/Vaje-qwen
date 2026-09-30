# Perceived performance

Performance is both runtime behavior and user perception.

## Loading strategy

Prefer:
- preserve existing layout geometry
- show useful shell/navigation early
- lazy-load noncritical routes/assets
- reserve image dimensions
- avoid full-screen spinners for local/short operations
- use skeletons only when they accurately predict final structure

A skeleton that looks nothing like the resulting content creates more instability than it solves.

## Learning flow

Never let performance techniques change scoring semantics:
- don't pre-reveal answer content
- don't lose an answer while a lazy chunk loads
- don't unlock before state is actually persisted
- do not hide save failure behind an optimistic success state

## Images/audio

- use current asset formats/manifests
- lazy-load outside the immediate learning need
- prefetch upcoming media only when it has measurable benefit and respects data usage
- supply graceful fallback for failed story art when the chapter remains usable
- audio failure must not be mistaken for a wrong listening answer

## Interaction responsiveness

Investigate:
- main-thread work
- oversized initial JS
- unnecessary rerenders
- large synchronous storage operations
- asset decode/layout shifts

Measure before introducing complex optimization machinery.
