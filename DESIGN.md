# DESIGN.md — Ghesse

## Visual direction
A calm Persian-first reading product with a warm sketchbook character. The identity may feel human and literary, but the interface itself is restrained and task-oriented.

The app is not neobrutalist. Avoid hard zero-blur offset shadows, repeated heavy black outlines, and turning every group into a card.

## Modes
- Preparation, exams, review, settings: **Operate**. Familiar controls, stable hierarchy, low visual friction.
- Story chapters: **Read**. Typography and prose rhythm take priority over component chrome.

## Color
- Cream reading surface: `--cream`
- Sage shell/background: `--paper`
- Soft ink: `--ink`
- Crimson: primary accent for current state and primary emphasis only
- Gold: limited supporting state color

Inactive UI should stay neutral. Do not use crimson as decoration.

## Depth and borders
- Default structural border: 1px using `--line-soft` or `--line-medium`
- Depth uses `--shadow-soft` / `--shadow-control`
- Never add hard offset shadows unless the entire visual world is intentionally redesigned around them
- Use proximity and spacing before adding another container

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
- No chapter illustration: teaching and both tests open directly on the word card
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
- Story chapters use those reviewed scenes directly; the preparation screen shows none, so the word card stays the only focus. Book overview cards reuse one reviewed scene per book; legacy inline/vector banners are not a production fallback.
- Nino is always a small yellow chicken with an orange beak and feet and one small white feather on the left wing. Never depict him as the former cat concept, a duck, an adult hen, or an unmarked generic chick.
- Mina keeps the same face and age impression while her contemporary Iranian modest clothing may vary by chapter. Girls and women are never shown without hijab; public/outdoor scenes keep hair exposure minimal. Mina's red book and the crimson bird remain recurring visual anchors.
- No readable text or logos inside illustrations. Each chapter image has a Persian accessible description.
- Production artwork is 640×336 (40:21). Keep the primary action safely inside the center crop so phone and tablet banners do not lose faces or story-critical objects.
- The reviewed chapter-art set is precached by the production service worker so visual continuity survives offline use.

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
