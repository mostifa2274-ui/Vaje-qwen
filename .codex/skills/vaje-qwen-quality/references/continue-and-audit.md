# Continue and broad-quality workflow

Use for "continue", "finish it", "maximize quality", "fix all issues", production hardening, or a broad audit.

## 1. Reconstruct state from evidence

Do not restart from old chat instructions.

Establish:
- canonical repository and current default branch
- current head SHA
- relevant open PRs/checks/workflows
- recent commits in the area being continued
- current package scripts/configuration
- any explicit checkpoint supplied by the user

If a prior checkpoint exists, compare it with current state. Treat current repository truth as authoritative when they differ.

## 2. Build a delta ledger

Classify work as:
- **already complete** — present on current `main` and verified
- **in flight** — open PR/run/job or incomplete batch
- **blocked** — external dependency, unavailable permission, human evidence
- **unresolved** — next actionable defect/gap

Do not make cosmetic commits just to show activity.

## 3. For "maximize quality", audit by risk

Scan only high-signal surfaces first:

1. learner progress loss/corruption
2. incorrect unlock/mastery semantics
3. ambiguous or invalid assessment/content
4. broken critical learning flow
5. accessibility barriers
6. offline/PWA/browser failures
7. security/privacy/rights problems
8. audio/art/content mismatches
9. performance regressions
10. maintainability debt that is actively causing defects

Use `quality-model.md` for priority.

## 4. Execute highest-value unresolved work

Prefer a root-cause fix with regression coverage over many superficial edits.

When several independent changes are safe, batch them coherently. When they interact with the same state machine, sequence them and verify between steps.

## 5. Continue until the requested stopping condition

Examples:
- "fix the issue" → implementation + relevant verification
- "make production ready" → canonical release gates, not just build
- "deploy" → merge/current-main + exact production verification if tool access allows it
- "best of the best" → automated quality can be maximized, but external evidence gates remain explicitly separate

Never claim an external gate is complete because no automated defect was found.
