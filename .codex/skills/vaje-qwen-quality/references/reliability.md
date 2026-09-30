# Persistence, offline and runtime reliability

Progress safety is release-critical.

## Persistence invariants

- never silently replace newer progress with older state
- migrations are forward-safe and deterministic
- unknown/corrupt IDs fail safely
- fallback storage cannot become a stale shadow copy that later wins incorrectly
- import is explicit and validated
- cross-tab merges preserve unrelated concurrent progress
- failed writes are visible/recoverable when possible

## Test matrix for storage changes

Cover:
- fresh install
- current schema reload
- each supported old schema migration
- partial/corrupt data
- primary storage failure
- fallback storage behavior
- stale primary vs newer fallback
- two-tab concurrent changes
- import cancel/confirm
- oversize/invalid backup
- reset/clear behavior

## PWA/offline

Verify:
- first online load
- subsequent offline shell
- lazy routes offline after expected caching
- versioned service-worker/cache behavior
- old cache invalidation
- refresh/navigation semantics
- failed network requests degrade gracefully

## Browser/runtime

Treat autoplay restrictions, media permission denial, WebKit differences, background tab behavior, and storage quota failures as explicit test cases when the affected feature depends on them.
