# Tool routing

This skill should compose with available tools rather than duplicate them.

## Repository

Prefer a connected GitHub/repository tool for current state, PRs, checks, commits, and writes. If working from an attached/local checkout, use local files/shell instead.

Do not use generic web search as a substitute for private/current repository state when a repository connector is available.

## Current external facts

Use web research for changing standards, library behavior, learning research, browser/platform behavior, or authoritative documentation when those facts materially affect the decision.

## UI/design

For non-trivial UI creation or redesign, first load `references/ui-ux.md` and the relevant `references/ui-design/` playbooks. Then use the strongest installed UI/design workflow required by the environment. Vaje-qwen's current repository tokens, RTL behavior, learning-flow semantics, accessibility, progress safety, and regression criteria remain authoritative.

## Images

For new or edited story artwork, use the available image generation/editing workflow after loading current canon. Inspect output; generation success is not acceptance.

## Files

When the user supplies or references a project file not already in context, retrieve/read the actual file before reasoning about its contents.

## Tool absence

If a required action tool is unavailable, do all safe preparatory work that can be verified locally and report the exact blocked step. Never simulate a write/deploy.
