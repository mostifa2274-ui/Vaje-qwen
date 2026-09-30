# Interaction, states and motion

## Immediate feedback

A control should acknowledge activation immediately. Long-running work then transitions into a distinct pending/loading state.

Avoid double-submit races by defining:
- disabled/pending behavior
- idempotent action handling where needed
- recovery after failure

## Functional motion

Motion should explain:
- navigation hierarchy
- state transition
- item insertion/removal
- success acknowledgement
- relationship between source and destination

Avoid motion that competes with reading/testing or causes answers/options to move under the learner.

Respect reduced-motion settings; essential meaning must remain without animation.

## Learning interactions

For answer submission:
- preserve the learner's entered/selected answer long enough to understand feedback
- distinguish content error from technical/audio/network error
- make correction path obvious
- avoid celebratory motion that delays the next learning action
- do not animate the correct answer in a way that leaks it before scoring

## Async states

Define as relevant:
- idle
- submitting
- success
- recoverable failure
- unrecoverable failure
- stale/offline
- disabled due to prerequisite
- disabled due to in-flight action

## Modality

Use modal/dialog patterns only for genuinely interruptive or confirmation tasks. Do not hide complex learning flows inside nested modals.

## Gestures

Do not require an undiscoverable gesture to complete a critical task. Provide a visible accessible control.
