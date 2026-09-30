# UI anti-patterns

Treat these as strong review signals.

## Hierarchy

Reject:
- multiple competing primary actions
- walls of equal-weight cards
- nested cards used only to manufacture hierarchy
- decorative chrome louder than the learning content
- giant dashboard home with no obvious next learning step

## Navigation

Reject:
- hidden sole navigation for primary destinations
- inconsistent back behavior
- nested tabs that obscure hierarchy
- global navigation intruding into focused tests/preparation when it creates accidental exits

## Interaction

Reject:
- tiny touch targets
- gesture-only critical actions
- hover-only actions
- missing error/loading/locked states
- delayed feedback with no indication
- motion that shifts answer choices under the learner
- technical failure shown as an incorrect answer

## Visual/system

Reject:
- one-off raw brand colors scattered in components when semantic current tokens exist
- arbitrary radius/shadow changes
- overuse of gradients/shadows
- fixed heights that clip Persian/large text
- physical left/right spacing hacks in RTL layout

## Content/forms

Reject:
- placeholder-only labels
- unexplained "Invalid" errors
- forms that discard user input after a technical error
- untranslated filler/Lorem
- UI jargon in learner-facing Persian

## Accessibility

Reject:
- missing accessible names
- color-only states
- invisible focus
- illogical focus order
- unusable 200% zoom
- decorative motion that ignores reduced-motion preference

## Vaje-qwen-specific

Reject any visual redesign that:
- weakens progression clarity
- implies chapter completion equals mastery
- makes free practice appear required
- bypasses/obscures learning gates
- breaks persistence/offline expectations
- replaces current routing or service-worker architecture without a justified migration plan
