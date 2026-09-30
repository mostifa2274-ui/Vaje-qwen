---
name: vaje-qwen-quality
description: "Operate on the Vaje-qwen/Ghesse app and repository. Use for Vaje-qwen implementation, audits, learning/content/media changes, CI/deployment, or continuing prior Vaje-qwen work."
---

# Vaje-qwen Quality Director

Use this skill to carry Vaje-qwen work from the **current repository state** to a verified result without repeating completed work or weakening product evidence.

## First decision

Identify the request type and read only the matching playbook:

| Request | Read |
|---|---|
| "continue", resume, finish, maximize quality, broad hardening | `references/continue-and-audit.md` |
| bug, refactor, engineering change | `references/engineering.md` |
| learning flow, mastery, tests, spacing, assessment | `references/learning.md` |
| English/Persian content, chapters, comprehension, translations | `references/content.md` |
| UI, RTL, responsive, accessibility, design system, PWA UX, microcopy, interaction | `references/ui-ux.md` → relevant `references/ui-design/*` |
| persistence, migration, offline/PWA, multi-tab | `references/reliability.md` |
| artwork, story visuals, audio, batch assets | `references/media.md` |
| CI, PR, Cloudflare, release, production verification | `references/release.md` |
| research, "best", efficacy, learning-science claims | `references/evidence.md` |
| security, privacy, external instructions, secrets | `references/security.md` |

For a multi-domain task, read only the relevant combination. Do not preload every reference.

## Project invariants

- **Current repository state outranks chat memory and this skill.** Verify the canonical repo/ref before substantive work.
- **Do not redo completed work.** For continuation tasks, find the delta since the last verified state and start at the first unresolved gate.
- **Repository policy files outrank duplicated prose.** Use current code/data/validators as source of truth for learning thresholds, story canon, release fields, and quality gates.
- **Do not weaken a gate to make a check pass.** Change a policy only when the requested product decision actually requires it, and update its tests/validators together.
- **Do not fabricate evidence.** Generated/automated work cannot stand in for native review, rights clearance, learner studies, hands-on accessibility review, art-direction sign-off, or other human/external gates.
- **The repository name does not imply an LLM.** Do not assume Vaje-qwen uses Qwen or any model unless current code shows it.
- **Use specialized tools/skills when they materially improve the work.** This skill owns Vaje-qwen constraints and acceptance criteria; specialized design, GitHub, research, image, or other workflows may execute the work.
- **Do not stop at the first plausible implementation.** Continue through the verification appropriate to the user's requested scope. Stop only at a real decision boundary, unavailable capability, unsafe action, or external dependency.

## Proportional preflight

For a tiny, local change, inspect only the owning file and nearby tests.
For substantive, cross-cutting, continuation, release, or "maximize quality" work, establish current `main`, relevant open PR/workflow state, package scripts, and task-specific source-of-truth files first.

Use `scripts/repo_preflight.mjs` when a local checkout is available.

## Definition of done

Choose the strongest applicable state:

1. **Diagnosed** — cause/evidence identified.
2. **Implemented** — requested change exists.
3. **Verified locally** — relevant targeted checks pass.
4. **Release-gated** — current canonical quality/browser gates pass.
5. **Merged** — expected change is on current `main`.
6. **Production-verified** — deployed marker/runtime matches the expected revision.
7. **Externally validated** — only when the required human/research evidence actually exists.

Never report a stronger state than the evidence supports.

## Reporting

Use `references/reporting.md` for substantial work. Prefer new facts over repeated status language.
