# UI / UX / RTL / accessibility

This is the Vaje-qwen-specific UI entry point. For non-trivial interface work, also read only the relevant files under `references/ui-design/`.

## Source-of-truth rule

**Never impose a remembered visual theme over the current repository.**

Before substantial UI work, inspect the current design tokens/styles and representative screens. At integration time the repository used a sage/cream/ink/crimson sketchbook system in `src/index.css`; this is only a snapshot. Current repository tokens always win.

Do not reintroduce an older purple direction merely because it appears in past conversations or older skill versions.

## Product principle

Reduce the learner's decision burden:
- make the next meaningful learning action obvious
- keep optional tools available without competing with the core path
- preserve the learning state machine while improving presentation
- use fewer, stronger components rather than stacking decorative cards

## State completeness

Every meaningful interactive surface should consider the states that actually apply:
- default
- pressed/active
- focus-visible
- loading
- disabled
- success
- error
- empty
- offline
- permission denied
- missing/stale asset
- long text / large text
- reduced motion

Do not invent states that cannot occur; do not omit states that can.

## RTL and mixed scripts

- Persian prose: intentional RTL
- English words, phonetic notation, hashes, versions, code: intentional LTR/bidi isolation
- prefer logical `start/end` properties over hard-coded left/right
- test punctuation, parentheses, numerals, and inline English inside Persian
- test long text, browser zoom, and large text

For localization/RTL work read `references/ui-design/rtl-localization.md`.

## Responsive surfaces

Treat as first class:
- narrow phone
- large phone
- tablet portrait
- tablet landscape
- desktop

Do not turn tablet into a stretched phone or desktop into a widened mobile column by accident.

## Accessibility

Target current WCAG 2.2 AA expectations where applicable. Automated checks are necessary but do not replace a hands-on accessibility evidence gate if the repository tracks one.

For an accessibility task read `references/ui-design/accessibility.md`.

## UI quality gate

Before shipping a meaningful screen/component change, verify:

1. **States** — applicable loading/error/offline/disabled/success/conflict states exist.
2. **Hierarchy** — one clear next action or explicitly read-only.
3. **Semantics** — native HTML semantics and accessible names.
4. **Accessibility** — focus, contrast, keyboard, touch, zoom, reduced motion.
5. **Responsive** — no narrow-screen breakage; tablet is intentionally composed.
6. **PWA** — no blank offline/update transition and no progress loss.
7. **Tokens** — current semantic tokens, not a parallel ad-hoc visual system.
8. **Density** — hierarchy comes from spacing/type before nested containers.
9. **Copy** — locks/errors/recovery are understandable in natural Persian.
10. **Honesty** — completion, mastery, offline state, and persistence status are never misrepresented.

## Non-trivial redesign

When a specialized installed design workflow is available and the task calls for visual redesign, use it. Vaje-qwen constraints remain authoritative:
- current design tokens
- RTL/mixed-script behavior
- learning-flow semantics
- accessibility
- responsive behavior
- persistence/progress safety

After implementation, compare the rendered result at relevant viewports and run affected learning-flow/browser regression tests.

For critique/handoff read `references/ui-design/critique-handoff.md`.
