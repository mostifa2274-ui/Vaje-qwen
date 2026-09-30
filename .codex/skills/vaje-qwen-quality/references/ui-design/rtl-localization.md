# Persian RTL, localization and mixed-script design

## Direction

Use semantic direction:
- page/container `dir="rtl"` for Persian-first regions
- isolate English lexical items/IPA/code/version strings as LTR where needed
- avoid global CSS hacks that reverse components unintentionally

Prefer:
- margin-inline / padding-inline
- inset-inline
- border-inline
- text-align: start/end

over physical left/right for directional layout.

## What should mirror

Usually mirror:
- back/forward arrows that express reading/navigation direction
- row order when it represents layout flow
- drawers/navigation position when product convention requires it

Usually do not mirror:
- media play icon
- universal check/cross
- device-specific shapes
- charts/maps unless semantics require it
- logos
- non-directional icons

## Mixed Persian + English

Test:
- English target words inside Persian sentences
- parentheses around English terms
- slash-separated pronunciations
- percentages/numbers
- punctuation adjacent to LTR spans
- filenames/build hashes
- inline buttons containing both languages

Use bidi isolation instead of inserting stray Unicode direction marks ad hoc.

## Text expansion

Do not size buttons to one Persian string. Test:
- longer Persian translation
- long English word
- two-line CTA/label where allowed
- browser zoom
- narrow phone width

## Numbers and formatting

Use intentional locale formatting. Do not blindly convert digits if a learning task depends on the original English/numeric form.

## Testing

At minimum, inspect:
- phone RTL
- tablet RTL
- keyboard focus order
- screen-reader label order
- long strings
- mixed-script strings
- error and empty states
