# Git, CI, deployment and production verification

Always read current repository scripts/workflows/config before using command names or release fields.

## Change delivery

For substantive changes when repository tooling supports it:
- start from current main
- use a focused branch/PR
- explain problem, root cause, change, verification, risk
- inspect CI
- merge only after required checks pass
- re-check current main after merge

Do not force a stale branch across incompatible main changes.

## Verification ladder

Use only as much as the task needs while iterating, then the strongest required release gate:

1. targeted test/validator
2. affected unit suite
3. lint/type/build as applicable
4. canonical full project quality gate
5. required browser matrix
6. exact-main CI
7. deployment
8. exact-production smoke

Do not rerun expensive full gates after every tiny edit if targeted tests can iterate faster.

## Distinct states

Never collapse these:
- local build passed
- local quality gate passed
- PR CI passed
- merged to main
- deployment job succeeded
- production serves expected revision

## Production

If the current project uses a release marker/service-worker revision contract, verify the exact expected commit and runtime markers after deployment.

A reachable URL is insufficient.

If deployment credentials or integration are unavailable, report **deployment blocked/pending**, not production verified.

## External quality gates

A release can pass software CI while external/human evidence remains pending. Keep these statuses separate.
