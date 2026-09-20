# واژه · Vajeh 1.2

Persian-first RTL PWA for mastering 899 essential A1 English words with spaced repetition, daily sessions, listening, spelling, repair practice, progress tracking, local-first persistence, and offline-capable app shell.

## Production status

The hardened GitHub deployment reconstructs the verified Vajeh 1.2.0 source from checksum-validated bootstrap parts before linting, testing, or building.

GitHub CI currently verifies:

- bootstrap part and archive SHA-256 integrity
- ESLint / React Hooks checks
- 23 engine and regression tests
- full-deck unique-answer invariants
- strict TypeScript compilation
- Vite production build
- PWA service-worker generation

The compact Git deployment deliberately excludes the ~20 MB MP3 pronunciation pack. Pronunciation tries bundled audio first and automatically falls back to the browser/device English speech engine when the MP3 is unavailable.

The full hardened archive retains the original audio/font assets.

## Local build

Node.js 22+ is recommended.

```bash
node bootstrap/restore.mjs
npm install --ignore-scripts --legacy-peer-deps --no-audit --no-fund
npm run check
npm run build
```

The output directory is `dist/`.

## Cloudflare Workers Builds

This repository includes `wrangler.jsonc` for static assets with SPA fallback.

Use these settings in Cloudflare Workers Builds:

- Git repository: `mostifa2274-ui/Vaje-qwen`
- Production branch: `main`
- Root directory: `/`
- Build variable: `SKIP_DEPENDENCY_INSTALL=1`
- Build command: `npm run cloudflare:build`
- Deploy command: `npx wrangler@4.135.0 deploy`

The explicit skip/install sequence is important because source files are reconstructed from the verified bootstrap payload before npm resolves the complete project.

## Main scripts

```bash
npm run check
npm run build
npm run cloudflare:build
npm run deploy
```

## Learning-engine hardening in 1.2

- explicit learning/relearning states so wrong or assisted first encounters cannot disappear
- same-session relearning without double-penalizing SRS state
- backlog chunking and fresh-word gating
- capped mature review intervals
- unique visible MCQ answers across the full 899-word deck
- learner favorites separated from SRS state
- daily-plan progress separated from repair/topic/custom practice
- answer persistence before feedback animation
- Persian/Arabic search normalization
- Android/browser Back behavior
- validated backup export/import
- storage failure reporting
- improved accessibility, contrast and safe-area behavior
- offline/PWA hardening
- audio playback race handling and Web Speech fallback
- stricter CI and release verification

## Content provenance

Application-code deployment is separate from content redistribution rights. Public/commercial redistribution of the bundled vocabulary/audio selection should remain fail-closed until the rights evidence described in the release provenance documentation is retained.
