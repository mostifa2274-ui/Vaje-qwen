# Best-in-class evidence program

Ghesse separates **technical release quality** from claims that require external or human evidence.

`npm run check` must stay green for every release. It also runs `validate:quality-program`, which verifies that every external-quality gate is explicit and that a gate cannot be marked complete without the required evidence structure.

`npm run best-in-class:status` prints the current evidence state without failing.

`npm run validate:best-in-class` is intentionally stricter: it fails until every gate is complete. It is not part of ordinary deployment because unresolved learner studies and human accessibility/editorial/art review must not prevent engineering work—and engineering work must not pretend those external requirements are finished. The content-rights gate was removed at the owner's request; that is not a clearance.

Current gate sources:

- delayed learner outcomes → `research/status.json`
- native lexical/editorial review → `quality/lexical-review.json`
- hands-on accessibility → `quality/accessibility-status.json`
- signature visual art direction → `quality/art-review-status.json`
- learning-policy calibration → `quality/calibration-status.json`

Never populate reviewer names, study results, device QA results, sign-offs unless those events actually occurred.
