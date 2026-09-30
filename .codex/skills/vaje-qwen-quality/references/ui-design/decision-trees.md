# UI decision trees

Use these as heuristics, not mandatory component choices. Current product IA and tested behavior come first.

## Navigation

How many genuinely primary destinations?

- 1 hub + secondary tools → hub/home + library/secondary destination
- 2–5 stable primary destinations → compact direct navigation may work
- many/deep destinations → hierarchical navigation and/or search
- focused learning session → avoid exposing global navigation that competes with the task

Do not add a hamburger menu as the sole primary navigation just because it saves space.

## Modality

Is this the learner's main task?

- multi-step primary task → full route/view
- short destructive/overwrite confirmation → dialog
- context-related secondary task → sheet/panel if the current architecture supports it accessibly
- sparse utility → separate route/library entry

Do not put a complex preparation/test flow inside a modal.

## Lists vs cards

- homogeneous scannable items → list/rows
- rich independent object with media/actions → card
- dense comparable desktop data → table if semantics fit
- mixed page sections → sections, not a stack of nested cards

## Feedback strategy

- low-risk reversible local action → immediate local feedback; persistence failure must still surface
- action requiring durable state → pending until persistence outcome is known or optimistic only if rollback is safe
- destructive/import/reset → explicit confirmation + pending/result

## Loading

- layout known → layout-matched skeleton or stable placeholder
- tiny cached transition → avoid flashing a spinner
- long indeterminate work → clear progress state and safe cancellation only if the operation supports it
- lazy route → preserve shell and show a route-specific fallback, never a blank page

## Primary action

- one known next step → make it dominant
- optional branches → secondary treatment
- read-only state → do not invent a fake CTA
- locked state → explain the actual prerequisite and next available action
