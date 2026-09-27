# Chapter artwork batch pipeline

This release gate tracks all 40 chapter illustrations.

## Production rules

- One chapter = one single scene; no collage, grid, montage, or storyboard output.
- Production artwork is 640×336 and must remain safe for phone/tablet center crops.
- Contemporary Iranian setting and recurring character identity are mandatory.
- Girls and women use contemporary modest hijab.
- Chapters where Nino is missing must not depict him physically unless the manifest explicitly allows a lookalike.
- No readable text or logos are baked into the raster.
- No asset ships until it has passed visual review and has an exact registered hash.
- Exact duplicate raster files fail CI.
- Every approved image needs matching Persian and English accessible descriptions.

## Current production state

- Approved: **40**
- Pending: **0**
- Runtime vector fallback: **disabled**
- Production source: `src/art/generatedChapterArt.ts`
- Approval policy: `src/data/chapterArtBatch.json`
- Materialized assets: `public/art/chapters/`

Any future replacement is treated as a reviewed asset change: update the encoded source/evidence, register the new hash and description, pass the complete art validators, then pass the full application CI and exact-commit production smoke.
