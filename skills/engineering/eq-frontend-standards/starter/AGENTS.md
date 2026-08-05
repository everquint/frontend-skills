# Agent instructions

**This file is the entry point for EVERY agent in EVERY environment** — local Claude Code, cloud
sandboxes, CI runners, Cyrus, Claude Tag, Codex, anything that can read files. The standard is
fully vendored in this repo; nothing needs to be installed to follow or enforce it.

This repo follows the everquint frontend standard, vendored at
`.claude/skills/eq-frontend-standards` — **read that skill's SKILL.md before writing or reviewing
code**; its rules apply in full even where the hooks below cannot run. `.claude/` holds the repo
policy (guard hooks, the two reviewer agents, the `/pre-pr` gate) for hosts that load it.

- Gates: `npm run lint` (strict, type-aware — CI's gate), `npm run lint:fast` (the editor loop),
  `npm run typecheck`, `npm run format:check`, `npm run test:coverage`, `npm run build`.
- Before any PR: run `/pre-pr` where available; otherwise run the gates above in that order and
  stop at the first failure.
- The lint/format configs, CI workflows, and the vendored skill are protected files — change them
  only when the task is about them.
- Standard version and pending migrations:
  `node .claude/skills/eq-frontend-standards/scripts/standard-check.mjs`.
