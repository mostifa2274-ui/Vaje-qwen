# DESIGN.md — Ghesse

## Visual direction
A Persian-first literary learning product with a **Luxury Midnight** visual system: deep ink/navy surfaces, warm ivory typography, cinematic reviewed chapter art and restrained metallic-gold emphasis.

The reference mood is elegant Iranian night-time storytelling, not generic “Middle Eastern luxury.” Gold is a functional accent, not decoration on every edge. The interface remains calm, modern and task-oriented; the learning engine and content hierarchy stay more important than ornament.

The app is not neobrutalist and not faux-3D. Avoid hard zero-blur offset shadows, repeated heavy outlines, excessive glow, ornamental clutter, or turning every group into a card.

## Modes
- Preparation, exams, review, settings: **Operate**. Familiar controls, stable hierarchy, low visual friction.
- Story chapters: **Read**. Typography and prose rhythm take priority over component chrome.

## Color
- Deep midnight shell/background: `--paper` / `--lux-bg`
- Raised ink surface: `--cream-soft` / `--lux-surface`
- Warm ivory foreground: `--ink` / `--lux-ivory`
- Muted cool-gray secondary text: `--ink-soft`
- Gold: primary action, current state, focus and progress emphasis
- Green/red are reserved for semantic success/error feedback and must never be replaced by gold

One dark canvas lives on `.app-main` across every route, capped at 60rem; page content keeps its existing reading measure. Inactive UI stays neutral. Use luminous gold sparingly enough that the primary action remains obvious.

## Depth and borders
- Default structural border: 1px using translucent gold-neutral `--line-soft` or `--line-medium`
- Depth uses soft dark elevation through `--shadow-soft` / `--shadow-control`; no plastic bevels
- A major panel may use one subtle gold hairline highlight, never a full glowing frame
- Never add hard offset shadows
- Use proximity and spacing before adding another container
- One task may have one primary bounded surface; secondary information should normally use spacing or separators, not another card
- Never nest a decorative card inside another card

## Distilled hierarchy
- Home has one dominant next action, one compact three-value progress summary and one direct review row. Detailed skill analytics belong in review/results, not on the journey map.
- Long explanations and assessment policy are progressive disclosure, not permanently visible callouts.
- Book artwork appears on the journey map only once that book is reachable; locked future books remain compact milestones so the current path stays visually dominant.
- Settings is one continuous separated list, not a stack of independent cards.
- Success, warning and error containers are reserved for real state/feedback. Ordinary guidance remains plain text.

## Typography
- Persian UI: resilient Persian-capable system sans stack
- English story/headwords: Georgia/Times-style serif as content, not as UI-label typography
- Story body target: roughly 65–75 characters per line
- Minimum mobile body text: 16px for primary reading/input content
- Avoid eyebrow/kicker labels above headings

## Interaction
- Touch targets: at least 44×44px
- Motion: 150–250ms and only for state change or feedback
- Every interactive control needs visible focus
- Do not rely on hover
- RTL navigation arrows must follow RTL direction: back points right

## Preparation screen
- One focus surface at a time
- Progress rail shows Teach → Written → Listening → Story
- Word, Persian meaning and example dominate the teach phase
- Teaching keeps the word card as the only interactive focus. The reviewed chapter scene may appear behind it as a darkened, non-interactive atmospheric backdrop; it must never contain UI text or compete with the learning task
- Automatic pronunciation is expected; replay is secondary
- Wrong answers explain the correction and return later in the same test
- Advancing to a new item scrolls the focus surface back into view

## Reader
- The story is visually primary
- No new-word highlighting after preparation is complete
- Paragraphs are separated mainly by whitespace, not boxes
- Sentence audio and translation controls are compact but touch-safe
- Per-word tap-to-gloss remains available without underlining every learned word
- Tablet layout may use more width, but story measure remains controlled
- Comprehension remains a focused one-question-at-a-time sequence

## Illustration
- The production visual system is the 40 reviewed raster scenes registered in `src/art/generatedChapterArt.ts` and materialized into `public/art/chapters/` during the build. The chapter-art validator must remain 40 approved / 0 pending.
- Story chapters use those reviewed scenes directly. Preparation and graded word-test screens may reuse the same reviewed scene as a heavily darkened background layer while the real HTML task surface stays foregrounded. Book overview cards reuse one reviewed scene per book; legacy inline/vector banners are not a production fallback.
- Nino is always a small yellow chicken with an orange beak and feet and one small white feather on the left wing. Never depict him as the former cat concept, a duck, an adult hen, or an unmarked generic chick.
- Mina keeps the same face and age impression while her contemporary Iranian modest clothing may vary by chapter. Girls and women are never shown without hijab; public/outdoor scenes keep hair exposure minimal. Mina's red book and the crimson bird remain recurring visual anchors.
- No readable text or logos inside illustrations. Each chapter image has a Persian accessible description.
- Production artwork is 640×336 (40:21). Preserve that full aspect ratio in book overviews and story covers; never crop faces or story-critical objects to fit a shallow banner.
- The reviewed chapter-art set is precached by the production service worker so visual continuity survives offline use.

## Distilled interface rules
- One dominant task per screen. Status, policy, and diagnostics stay secondary and use progressive disclosure.
- The journey home uses one next-action surface, one three-item progress summary, one review row, then the book path. Do not rebuild a dashboard above the books.
- Book cards and task chrome use one neutral surface. Per-book color does not tint headers or task containers; reviewed artwork carries visual variation.
- Future/locked books remain visible for orientation as compact milestone rows; their artwork, chapter rows and exam details appear only when the book becomes reachable.
- Reachable books show named chapter rows with a number and explicit status, including readable locked chapters.
- Dictionary entries use stable English, Persian and status columns; meaning length must not shift the English word.
- Secondary buttons are flat; reserve strong contrast for the primary action. Avoid adding control shadows back to ordinary buttons.
- Long explanations belong in `<details>` or result/review screens, not above an active learning task.
- Settings shows common switches immediately; narration tuning and privacy explanation stay collapsed until requested.
- Reuse `.compact-summary` for at most three high-signal metrics. Do not add grids of decorative metrics to task screens.
- Dense filter sets (five or more choices) use one compact select rather than a horizontal strip of competing buttons.

## Responsive behavior
- Phone: single-column, thumb-friendly controls
- Tablet portrait/landscape: wider shell and richer use of horizontal space, while story prose keeps a readable measure
- Desktop: do not stretch prose across the viewport
- Respect safe-area insets and `viewport-fit=cover`

## Accessibility
- Visible focus rings
- Dynamic feedback uses live/status semantics
- Correct/wrong states use text and structure, not color alone
- Reduced-motion preference must disable nonessential animation
- No core action may depend on an emoji or icon without an accessible label
