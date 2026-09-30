# Engineering workflow

## Find the owning invariant

Before changing code, identify:
- observable failure
- owning state/data/component/engine
- expected invariant
- why existing tests/validators missed it

Prefer fixing the invariant over adding a special-case branch.

## Change discipline

- Reuse existing source-of-truth structures.
- Do not duplicate policy constants already represented in canonical data.
- Preserve stable IDs and saved-state semantics unless change is intentional.
- Avoid broad rewrites for local defects.
- Keep generated files generated; edit their source instead.
- Do not change unrelated formatting or dependencies without a reason.

## Regression coverage

Add the cheapest test that would have prevented recurrence:
- pure logic → unit test
- data/canon/policy → validator test
- persistence/migration → state compatibility test
- user journey/browser contract → E2E
- release/config mismatch → validator/workflow check

A user-facing critical-flow regression usually deserves both lower-level coverage and a focused E2E assertion.

## Dependency changes

Before adding a package:
- prove existing platform/code cannot reasonably solve the need
- prefer maintained, narrow dependencies
- pin according to current repository policy
- update lockfile
- check bundle/performance/security impact

## Review the diff

Before declaring implementation complete:
- inspect changed files
- check for accidental scope expansion
- remove debug/dead code
- verify error/fallback paths
- ensure tests assert behavior rather than implementation trivia
