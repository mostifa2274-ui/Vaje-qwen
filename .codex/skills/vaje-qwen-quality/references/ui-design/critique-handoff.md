# Design critique and handoff

## Critique order

Review a screen/flow in this order:
1. user/learner goal
2. task hierarchy
3. state completeness
4. learning-flow correctness
5. RTL/mixed-script behavior
6. accessibility
7. responsive/adaptive behavior
8. interaction feedback
9. visual-system consistency
10. perceived performance
11. polish

This order prevents aesthetic critique from hiding functional problems.

## Finding severity

- **Blocker** — cannot complete critical flow, progress/data risk, severe accessibility barrier
- **Major** — substantial confusion, invalid assessment behavior, repeated friction
- **Minor** — localized consistency/usability issue
- **Suggestion** — optional polish

For each finding:
- observation
- evidence
- learner impact
- recommendation
- acceptance criterion

## Implementation handoff

For a substantial UI change record:
- purpose
- affected routes/states
- current tokens/components reused
- new token/component only if necessary
- mobile/tablet/desktop behavior
- RTL/LTR handling
- states
- interactions/motion/reduced-motion
- accessibility behavior
- microcopy
- offline/error behavior
- tests
- screenshots/visual comparison when available

## Vaje-qwen design acceptance

A redesign fails even if it looks better when it:
- obscures the next learning action
- changes progression semantics unintentionally
- makes optional practice look required
- conflates completion with mastery
- breaks Persian RTL/mixed-script behavior
- regresses phone/tablet layouts
- loses keyboard/focus/screen-reader functionality
- introduces new persistence/navigation bugs
