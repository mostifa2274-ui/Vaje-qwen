# React + Vite UI architecture for Vaje-qwen

Use this as layering guidance, not a forced folder migration.

## Current architectural facts to verify

At integration time:
- `App.tsx` owned typed hash-view navigation and progression-aware route resolution
- route screens were lazy-loaded with `React.lazy` / `Suspense`
- page modules lived under `src/pages`
- learning logic lived under `src/engine`
- canonical course data lived under `src/data`
- the custom service worker lived under `public/sw.js`

Re-read current code; do not assume these remain unchanged.

## Dependency direction

A useful direction is:

`data/engine → domain behavior`
`components → reusable presentation`
`pages → compose components + domain behavior`
`App/shell → routing, top-level persistence, global system state`

Do not move progression rules into presentational components.

## Primitives

Shared primitives should:
- use semantic current tokens
- expose accessible native semantics
- keep prop surfaces small
- avoid importing page/domain state unless intentionally a domain component

## Route/page boundaries

Lazy-load substantial secondary screens when current bundle strategy benefits.

A route fallback must:
- preserve application shell
- be announced appropriately
- not reset learner progress
- avoid a blank screen

## Navigation

Preserve the current router unless a migration has a concrete product/maintenance benefit.

Any router migration must prove:
- all progression redirects remain correct
- history/back behavior remains correct
- deep links/bookmarks work
- focus management remains correct
- offline navigation still works
- service-worker/cache behavior remains correct
- E2E critical flows pass

## State ownership

Keep:
- durable learning state in the persistence/domain layer
- ephemeral view state local when practical
- derived state derived, not duplicated
- concurrency reconciliation centralized

Do not create a second progress source in UI state.

## Performance

Prefer:
- route/code splitting already supported by Vite
- stable keys
- profiling before memoization
- avoiding giant context/providers for frequently changing state
- measured asset/lazy-loading improvements

Do not add a framework abstraction solely because a generic scaffold uses it.
