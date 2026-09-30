# Visual system, tokens and governance

## Inspect before inventing

Start by reading current:
- CSS variables / Tailwind theme / token files
- shared components
- representative screens
- any current brand/design documentation

Reuse current semantic tokens. Do not hard-code a new palette simply because an imported design reference prefers it.

## Semantic tokens

Prefer roles over raw values:
- background / surface / elevated surface
- text primary / secondary / disabled
- primary action / secondary action
- success / warning / error / informational
- border subtle / strong
- focus ring
- spacing scale
- type roles
- radius scale
- shadow/elevation
- motion duration/easing

A component should usually depend on semantic role tokens, not specific hex values.

## Governance

Before adding a token:
1. search for an existing equivalent role
2. verify the new role recurs or expresses a real semantic distinction
3. give it a durable semantic name
4. document where it is used
5. avoid near-duplicate values that fragment the system

Before deleting/renaming:
- trace usages
- migrate atomically
- test dark/high-contrast variants if supported
- inspect screenshots at target breakpoints

## Hierarchy

A strong screen has:
- a clear page/step purpose
- one dominant primary action
- secondary actions visibly subordinate
- grouped related information
- enough negative space to show structure
- restrained emphasis

Avoid:
- multiple equally loud CTAs
- a card around every block
- decorative containers without information value
- badges for ordinary states
- excessive shadows/gradients
- inconsistent radii
- arbitrary spacing
- tiny secondary text that becomes inaccessible
- redesign-by-color-change only

## Theming

If dark mode exists:
- derive it from semantic roles
- do not simply invert colors
- check contrast and illustrations
- preserve brand/learning-state meanings
- test native form controls, focus, disabled states, and browser UI integration

Do not add dark mode merely to satisfy a generic design checklist if the product has no requirement for it.

## Vaje-qwen-specific rule

At integration time, `src/index.css` defined a sage/cream/ink/crimson sketchbook visual language. Treat current repository CSS as truth and this sentence only as provenance.
