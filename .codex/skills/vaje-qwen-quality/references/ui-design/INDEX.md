# UI Designer integration

This directory is a curated Vaje-qwen adaptation of the user-supplied UI Designer skill.

The latest supplied version is directly relevant to Vaje-qwen because it targets **React + TypeScript + Vite PWAs**. Its reusable design expertise is incorporated here, but library-specific scaffolds never override the current repository architecture.

## Current-repository architecture rule

At integration time Vaje-qwen:
- used React + TypeScript + Vite
- used a custom typed hash router in `src/App.tsx`, not React Router
- used a custom stamped service worker in `public/sw.js`, not `vite-plugin-pwa`
- had explicit lazy route modules, release markers, CSP, offline caches, and browser smoke tests

These are only a snapshot. Re-read the current repository before architectural changes.

**Do not add React Router, Workbox, or vite-plugin-pwa merely because a generic UI scaffold uses them.** Only introduce an architectural dependency when the product task genuinely requires it and the migration is justified, tested, and safer than preserving the current system.

## Load only what the task needs

- hierarchy, tokens, theming, component consistency → `visual-system.md`
- pattern selection / nav / modality / lists / loading / CTAs → `decision-trees.md`
- accessibility review/implementation → `accessibility.md`
- RTL, localization, mixed Persian/English → `rtl-localization.md`
- states, motion, interaction feedback → `interaction-states.md`
- complete screen/control state coverage → `state-matrix.md`
- labels, instructions, errors, success copy → `microcopy.md`
- loading, skeletons, perceived responsiveness → `perceived-performance.md`
- platform/PWA expectations → `platform-pwa.md`
- React/Vite UI layering that preserves current architecture → `react-vite-architecture.md`
- reusable controls/patterns → `web-component-patterns.md`
- common failure patterns → `anti-patterns.md`
- critique, acceptance criteria, implementation handoff → `critique-handoff.md`

## Integration rule

General UI-design guidance never overrides:
1. current Vaje-qwen repository behavior and tokens
2. current routing/service-worker architecture unless migration is intentional
3. learning-state semantics
4. accessibility requirements
5. user progress safety
6. explicit current user instructions
