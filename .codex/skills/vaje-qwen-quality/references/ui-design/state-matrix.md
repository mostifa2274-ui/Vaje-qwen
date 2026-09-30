# State matrix

For each screen, document only applicable states.

| State | Typical trigger | UI obligation |
|---|---|---|
| Initial/loading | lazy route or data/media preparation | stable geometry, understandable progress |
| Empty | no content/progress exists | explain why + one meaningful action if available |
| Ready | normal content | clear primary task |
| Submitting/saving | answer/progress mutation | prevent duplicate submission and preserve input |
| Success | accepted action | unambiguous result + next step |
| Error | recoverable failure | what failed, whether progress saved, recovery |
| Offline | network unavailable | honest limitation + cached functionality |
| Disabled/locked | prerequisite unmet | reason + next valid action |
| Permission denied | mic/storage/etc. denied | non-blaming explanation + fallback |
| Stale/conflict | concurrent tab/state conflict | protect newer progress; explain recovery |
| Missing media | art/audio unavailable | preserve usable flow where possible |

## Control-level states

As applicable:
- default
- hover for pointer devices
- focus-visible
- active/pressed
- selected
- disabled
- loading
- error
- success

## Edge-case matrix

Check:
- 320px-class narrow width
- tablet portrait/landscape
- 200% zoom / large text
- very long Persian
- very long English/unbroken lexical item
- mixed RTL/LTR punctuation
- no image / failed audio
- reduced motion
- keyboard-only path
- screen-reader naming/announcements

Do not mark states "covered" because CSS classes exist; verify rendered behavior.
