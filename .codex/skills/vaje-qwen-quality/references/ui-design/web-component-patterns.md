# Web component patterns

Use existing project components first. These patterns are acceptance guidance, not a requirement to create new abstractions.

## Buttons

Primary:
- one dominant action per state
- clear enabled/disabled/pending behavior
- visible focus
- stable width/geometry during loading when possible

Secondary:
- visually subordinate
- should not compete with the main learning action

Icon-only:
- accessible name required
- target remains comfortably tappable

## Inputs

- persistent label
- purpose/type/autocomplete set appropriately
- error linked to the input
- Enter/keyboard behavior intentional
- RTL wrapper with LTR inner direction for English-answer fields when necessary
- preserve learner input after validation error unless policy intentionally clears it

## Choice/quiz controls

- entire option is tappable
- keyboard selectable
- selected state does not depend on color only
- scoring happens once
- disabled-after-submit semantics prevent accidental resubmission
- feedback does not shift options unpredictably

## Progress indicators

Show progress only when it helps orientation. Distinguish:
- session/task progress
- chapter/path progress
- durable mastery

Do not visually imply that completion percentage equals mastery percentage.

## Cards/list rows

Use a card only when the content is a distinct grouped object. For sequential navigation or settings, a simpler row/list often has better information density.

## Dialogs

Use for:
- destructive confirmations
- import/overwrite decisions
- permission/context that must be acknowledged

Trap focus correctly and restore it on close.

## Toasts

Use for transient confirmation, never as the only place for critical errors or instructions.
