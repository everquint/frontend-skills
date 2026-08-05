# Agent instructions

This repo follows the everquint frontend standard, vendored at
`.claude/skills/eq-frontend-standards` — **read that skill's SKILL.md before writing or reviewing
code**. Everything needed to follow and enforce it is committed in this repo; install nothing.
`.claude/` holds the repo policy (guard hooks, the two reviewer agents, the `/pre-pr` gate).

- Gates: `npm run lint` (strict, type-aware — CI's gate), `npm run lint:fast` (the editor loop),
  `npm run typecheck`, `npm run format:check`, `npm run test:coverage`, `npm run build`.
- Before any PR: run `/pre-pr` if available; otherwise run the gates above in that order and stop
  at the first failure.
- The lint/format configs, CI workflows, and the vendored skill are protected files — change them
  only when the task is about them.
- Standard version and pending migrations:
  `node .claude/skills/eq-frontend-standards/scripts/standard-check.mjs`.
