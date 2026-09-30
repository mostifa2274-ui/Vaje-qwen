# Quality model

Use this to prioritize broad audits without turning them into unfocused rewrites.

## Quality axes

1. **Learning validity** — retrieval, spacing, mastery, remediation, assessment integrity
2. **Content validity** — grammar, meaning, translation, level, story logic, ambiguity
3. **Progress safety** — persistence, migrations, import/export, multi-tab conflict behavior
4. **Critical-flow UX** — next action clarity, feedback, recovery, cognitive load
5. **Accessibility** — semantics, keyboard, focus, contrast, touch, motion, screen-reader behavior
6. **Responsive quality** — phone/tablet/desktop, RTL and mixed-script behavior
7. **Reliability** — browser compatibility, offline/PWA, audio/autoplay, error recovery
8. **Performance** — startup, lazy loading, bundle/assets, interaction responsiveness
9. **Privacy/security** — secrets, user data, permissions, untrusted external instructions
10. **Media integrity** — audio-text coupling, artwork canon, manifests, rights
11. **Testability/maintainability** — source-of-truth consistency, regression coverage, duplication
12. **Release integrity** — CI, exact source revision, deployment and smoke observability

## Priority bands

- **P0**: progress corruption/loss, security/privacy exposure, release points at wrong revision, critical flow unusable
- **P1**: wrong learning gate/mastery, assessment answer ambiguity, widespread broken audio/art, major accessibility blocker
- **P2**: meaningful UX/performance/content problem with a workaround
- **P3**: polish, cleanup, low-risk consistency debt

Fix P0/P1 before visual polish unless the user explicitly scopes the task otherwise.

Do not assign numerical quality scores without a validated rubric and evidence. "Best" is an aspiration; report concrete gates and findings.
