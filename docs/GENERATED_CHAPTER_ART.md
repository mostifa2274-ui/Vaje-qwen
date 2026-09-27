# Generated chapter artwork

All 40 story chapters use reviewed raster artwork in production.

## Visual canon

- Setting is contemporary Iran, with Tehran and other locations kept geographically coherent rather than rendered as a generic regional setting.
- Mina and other girls/women wear contemporary Iranian hijab with modest hair coverage. Clothing and scarf styles may vary naturally between scenes.
- Mina may appear with her mother and/or father. Family continuity is preferred; unrelated mixed boy/girl groups are avoided.
- Nino is a small yellow chicken with an orange beak and feet and one small white feather on the left wing.
- A chapter in which Nino is missing must not depict him physically unless the chapter-art policy explicitly permits a lookalike.
- No readable text or logos are baked into chapter artwork.
- Recurring faces, ages, family identity and major location cues remain consistent.

## Production rules

Artwork is materialized under `public/art/chapters/` as reviewed WebP or AVIF files at 640×336. The generated-art registry and chapter-art batch manifest are the production sources of truth.

The release gate requires:

- 40 approved chapter ids and 0 pending;
- exactly one reviewed raster for every chapter;
- valid WebP/AVIF containers and exact reviewed hashes;
- unique image hashes;
- chapter-specific Persian and English accessible descriptions;
- the mobile file-size budget;
- successful materialization before build.

There is no legacy vector-art production fallback. A missing generated asset is a release failure and the runtime only retains a minimal non-story placeholder as a last-resort defensive state.
