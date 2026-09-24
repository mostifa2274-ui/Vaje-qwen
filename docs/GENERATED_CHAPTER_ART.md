# Generated chapter artwork

Generated story art is introduced incrementally. A chapter is switched from the
existing vector scene only after its raster illustration has passed visual
review and the production asset check.

## Visual canon

- Setting is contemporary Tehran, Iran — not a generic “Arab world” setting.
- Tehran geography should stay coherent; the Alborz Mountains and Milad Tower
  are used only where the view makes sense.
- Mina and other girls/women wear contemporary Iranian hijab with hair coverage
  kept modest. Clothing and scarf styles may vary naturally between scenes.
- Mina may appear with her mother and/or father. Family participation is
  encouraged; unrelated mixed boy/girl groups are avoided.
- Nino is a small yellow chicken with an orange beak and feet and one small
  white feather on the left wing.
- No readable text is baked into chapter artwork.
- Recurring faces, ages and family identity should remain consistent.

## Production rules

Artwork is stored under `public/art/chapters/` as responsive WebP. The
`GENERATED_CHAPTER_ART` manifest is the source of truth for chapters that use
generated art. Unlisted chapters continue to render the existing SVG scenes.

The validation gate checks file presence, WebP container signature, exact
reviewed hashes and a per-image mobile size budget.
