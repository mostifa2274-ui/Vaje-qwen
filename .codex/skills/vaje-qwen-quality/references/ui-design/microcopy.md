# Microcopy and content design

UI copy should reduce uncertainty, not decorate the interface.

## Good UI copy

Prefer:
- concrete verbs
- short labels
- explicit recovery actions
- wording that matches the learner's current task
- Persian that sounds natural rather than translated from English UI idioms

Avoid:
- vague "Something went wrong" when a more useful cause/recovery is known
- blaming the learner for network/audio/storage failures
- marketing language inside tests
- jargon such as "hydrate", "persist", "cache", or "schema" in learner-facing copy
- multiple phrases for the same product concept

## Errors

An error should answer:
1. what happened?
2. did progress/answer save?
3. what can the learner do now?

Do not reveal secrets, stack traces, raw JSON, or internal IDs to ordinary users.

## Locked states

Explain the actual requirement:
- what remains
- why it matters when useful
- the single next action

Avoid generic "Locked" when the learner can act.

## Assessment feedback

Keep correctness feedback unambiguous. Do not use playful copy that obscures whether the answer was accepted.

## Localization

Do not concatenate translated fragments into grammatically unstable Persian sentences. Prefer complete localized strings with placeholders.
