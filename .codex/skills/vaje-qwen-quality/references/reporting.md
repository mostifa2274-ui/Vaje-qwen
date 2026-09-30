# Reporting and progress

## Progress updates

For long work, report only meaningful deltas:
- current state established
- root cause found
- implementation completed
- specific gate passed/failed
- merge/deploy/production revision verified
- genuine blocker encountered

Do not repeatedly say "continue" or restate the same plan.

## Final handoff

State, in compact form:

- **Changed** — concrete behavior/files
- **Verified** — named checks and their outcomes
- **Delivery** — PR/main/deployment state and revision if applicable
- **External gates** — only those genuinely pending
- **Remaining** — actionable unresolved work only

If no code change was needed because current main already contains the fix, say so and cite the evidence inspected instead of creating churn.

## Claim discipline

Avoid absolute phrases such as "perfect", "bug free", "best ever", or "fully validated".

Prefer bounded statements:
- all current automated release gates passed
- tested critical flows passed on the stated browser/device matrix
- exact production revision was verified
- no remaining issue was found in the inspected scope
- learner-study/native-review/accessibility evidence remains pending
