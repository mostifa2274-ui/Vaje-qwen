# Accessibility implementation and audit

Treat accessibility as part of component design, not a final polish pass.

## Perceivable

Check:
- text/background contrast for all states
- non-text contrast for controls/focus where required
- error/success is not color-only
- meaningful images have suitable alternatives where applicable
- decorative images are ignored by assistive tech
- zoom to 200% does not destroy the primary flow
- text can grow without clipping or overlap
- audio-dependent tasks provide the product-intended accessible alternative without leaking answers

## Operable

Check:
- full keyboard completion of web flows
- visible focus
- no focus traps
- sensible modal/dialog focus management
- touch targets are comfortably usable
- pointer gestures have accessible alternatives when needed
- reduced-motion preference is respected
- timed behavior is justified and recoverable

## Understandable

Check:
- labels are persistent and associated with controls
- errors identify both problem and recovery
- repeated navigation is consistent
- disabled state is understandable
- learning feedback distinguishes "incorrect answer" from technical failure
- instructions do not rely on visual position alone ("click the red button on the left")

## Robust

Prefer native HTML semantics:
- `button` for actions
- `a` for navigation
- real form controls
- correct headings/landmarks
- ARIA only when native semantics are insufficient

Dynamic state changes that matter should be announced appropriately without producing noisy live-region spam.

## RTL-specific accessibility

Verify:
- DOM/focus order follows the logical task order
- visual RTL mirroring does not create an opposite keyboard order
- mixed English/Persian labels are spoken/read intelligibly
- directional icons are mirrored only when their meaning is directional

## Evidence boundary

Automated tools can catch part of accessibility. They do not prove complete WCAG conformance or replace hands-on screen-reader/keyboard/zoom testing if the project tracks such a gate.
