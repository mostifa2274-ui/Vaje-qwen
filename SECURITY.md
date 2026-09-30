# Security Policy

## Supported version

The production `main` branch and the currently deployed Ghesse 5.x release are supported. Older preview branches and historical artifacts are not security-maintained.

## Reporting a vulnerability

Please use GitHub's **Report a vulnerability** / private vulnerability reporting flow for this repository when it is available. Do not publish exploit details, learner data, tokens, or credentials in a public issue.

A useful report includes:

- affected route, component or workflow;
- reproduction steps;
- expected vs. observed behavior;
- security or privacy impact;
- browser/OS when relevant;
- a minimal proof of concept that does not expose third-party data.

## Security boundaries

Ghesse is designed as a local-first static/PWA learning app:

- learner progress is kept in browser storage unless the learner explicitly exports it;
- optional pronunciation recordings remain ephemeral local blobs and are not uploaded by the app;
- optional active-use free text is not persisted to learner progress or sent to a Ghesse backend;
- the de-identified research export leaves the device only after an explicit download/share action;
- production releases are tied to an exact Git commit and verified by release/service-worker markers.

These boundaries are release contracts and should be treated as security-sensitive behavior.

## Dependency and code scanning

The repository uses weekly Dependabot checks for npm and GitHub Actions dependencies and CodeQL analysis for JavaScript/TypeScript. Security tooling supplements, but does not replace, review of privacy and learning-evidence boundaries.
