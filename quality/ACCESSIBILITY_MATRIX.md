# Human Accessibility Validation Matrix

Automated browser checks remain mandatory, but they are not a conformance claim.

Before closing the accessibility-human-QA gate, a human tester records pass/fail/evidence for complete core journeys on:

| Surface | Required check |
| --- | --- |
| Android | TalkBack: teach, written test, listening test, story, Smart Review, exam, settings |
| iPhone/iPad | VoiceOver: same core journeys |
| Desktop | Keyboard-only navigation and one mainstream screen reader |
| Zoom | 200% browser zoom with no lost controls or task-breaking horizontal scrolling |
| Text size | Large mobile accessibility text where supported |
| Motion | Reduced-motion preference |
| Contrast | System high/forced contrast where supported |
| Audio conflict | Screen-reader speech must not make course narration unusable |
| Microphone | permission denied, allowed, revoked and unsupported-browser paths |
| Offline | previously loaded core journey with assistive technology enabled |

Record device, OS, browser and screen-reader versions plus evidence or issue references. Do not mark this gate complete from screenshots or automated DOM checks alone.
