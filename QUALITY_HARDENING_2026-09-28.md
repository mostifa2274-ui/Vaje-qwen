# September 28 hardening

Records the audit of main `4f8c9aeda0b0107e322d6b9141486b2605a22848`, merged in PR #116 as `1692d05c8a27af21c37ea8e4aefc786306f2c276`, and the follow-up artwork, offline QA and production-verification changes.

- Book gates sample 24/28/32/36/40/44/48/52 vocabulary items, with every studied book represented and greater weight for the newest book. Reading/listening passages remain required. Missed vocabulary still needs independent remediation before progression.
- Chapter preparation still requires 100% written and listening coverage. Book sections require 80%; midpoint requires 88% overall and 85% productive; final requires 92% overall and 90% productive. Durable mastery criteria are unchanged.
- Runtime gate constants, product documentation and policy checks now share `learningPolicy.json`. Old oversized book-test drafts are rejected.
- The provenance record is bound to the exact vocabulary bytes. Its unresolved rights status remains truthful and is not a deployment blocker.
- React and course data have separate cacheable chunks. The application entry falls from about 701 KB to 83 KB minified; **total initial JavaScript remains about 200 KB gzip** because course data is still eager. This change does not implement lazy book packs.
- WebKit gets a focused critical-flow CI lane. Offline QA stops a private server and checks an uncached illustration, a lazy route and a full reload. An HTTP client without a service worker must fail against that stopped server. This avoids Playwright's documented WebKit offline-emulation defect: https://github.com/microsoft/playwright/issues/42775.
- Browser progress fixtures are installed before React starts and survive reloads. They no longer race the initial persistence effect or depend on `window.name`.
- Production smoke starts after a successful main CI run or Cloudflare build check, verifies current main, exact release JSON and the service-worker revision, and uses a short propagation window instead of waiting throughout a build.

## Artwork reconciliation

All 40 current English stories and illustrations were inspected for their focal scene. Four images were corrected with the built-in image generator, using the existing images as identity/style references. Their approved source bytes are retained in Git history; 36 images are byte-for-byte unchanged.

| Chapter | Correction |
| --- | --- |
| b2c3 | Mother shows Nino's photograph to the football players while Mina stays beside her. |
| b3c2 | Mother accompanies the search; Aria is Mina's younger brother and carries his flashlight. |
| b4c5 | Dawn at the bakery with Dad and the baker; the lookalike has yellow feet and no white patch. |
| b8c3 | The doctor is a woman, matching the text; uncle, nurse and clinic setting are preserved. |

The descriptions were updated to match, including the newspaper call in b5c3. Each corrected asset is 640×336 and below 80,000 bytes. `chapterArtReview.json` records the reviewer as an assistant, not a human, and binds the current chapter, image and metadata hashes. A subsequent story/image/description change requires another review. Close-up compositions do not imply that off-frame family members are absent; this review does not claim frame-by-frame illustration of every sentence.

## Verification and remaining scope

Local production gates: 200 unit tests, TypeScript, lint, content/audio integrity, 40 artwork assets and current semantic-review fingerprints. Targeted Chromium checks cover offline navigation/reload and backup import. Full Chromium phone/tablet and focused WebKit coverage run in CI before merge. Production status must be read from the merged commit's Cloudflare check and live release marker; this document is not deployment evidence.

The audit's larger product proposals—progressive book downloads, broad flow/reducer extraction, optional device sync, opt-in learner studies and external redistribution evidence—are not implemented by this hardening PR. They require separate changes or external evidence; none is represented as completed here.
