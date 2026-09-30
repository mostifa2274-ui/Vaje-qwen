# Web/PWA platform guidance

## Mobile web / installed PWA

- respect safe-area insets when chrome reaches screen edges
- do not cover content with sticky headers/bottom controls
- keep critical touch targets comfortably large
- never require hover for a critical action
- test browser zoom/large text
- ensure landscape does not break primary learning flows
- install prompts must never block core learning

## Desktop / large screens

- increase information structure, not merely width
- keep prose at readable measure
- allow navigation density to adapt when it truly helps
- preserve clear reading order in RTL

## Forms

- visible labels
- native semantics first
- associate errors with controls
- intentional Enter/submit behavior
- preserve learner input after technical or validation failure unless learning policy explicitly requires clearing it

## Focus and keyboard

- visible focus
- logical order matching task order
- no keyboard trap
- dialogs restore focus
- skip/navigation semantics where useful

## PWA-specific UX

Vaje-qwen currently has a custom service worker and exact-release infrastructure. Preserve it unless deliberately migrating.

UI responsibilities include:
- boot/loading state that does not flash blank
- offline shell that explains limitations honestly
- update/reload behavior that never silently loses in-progress answers
- media/offline failures that are distinguishable from wrong answers
- safe-area and manifest/theme integration
- stable behavior while an older service worker still controls an open tab

## Architecture warning

Generic examples may mention `vite-plugin-pwa`, Workbox, or React Router. Do not add them by default. Current repository behavior and regression coverage determine architecture.
