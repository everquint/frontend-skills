# Agent instructions

This repo follows the everquint frontend standard, vendored at
`.claude/skills/eq-frontend-standards` — that skill's SKILL.md holds the rules; `.claude/` holds
the repo policy (guard hooks, the two reviewer agents, the `/pre-pr` gate).

- Gates: `npm run lint` (strict, type-aware — CI's gate), `npm run lint:fast` (the editor loop),
  `npm run typecheck`, `npm run format:check`, `npm run test:coverage`, `npm run build`.
- Before any PR: run `/pre-pr`.
- The lint/format configs, CI workflows, and the vendored skill are protected files — the guard
  hook rejects unprompted writes. Change them only when the task is about them.
- Standard version and pending migrations:
  `node .claude/skills/eq-frontend-standards/scripts/standard-check.mjs`.
