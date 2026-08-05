# Agent instructions

This repo follows the everquint frontend standard, vendored at
`.claude/skills/eq-frontend-standards`. Everything needed to follow and enforce it is committed in
this repo; install nothing. `.claude/` holds the repo policy (guard hooks, the two reviewer
agents, the `/pre-pr` gate).

**Day one, the whole standard in five lines** — the vendored SKILL.md and its references are for
when a task routes you there, not an up-front read:

- Gates before any PR: `/pre-pr`, or `npm run lint && npm run typecheck && npm run test:coverage && npm run build`.
- kebab-case file names; tests co-located (`thing.test.ts` beside `thing.ts`); files ≤500 code lines.
- Never commit to the default branch; branch `<type>/<slug>`; Conventional Commits (the hook enforces both).
- A capability added or changed ships its doc in `docs/features/` in the same PR.
- Judging a lint finding, migrating, or auditing tooling — THEN read the vendored SKILL.md.

- Gates: `npm run lint` (strict, type-aware — CI's gate), `npm run lint:fast` (the editor loop),
  `npm run typecheck`, `npm run format:check`, `npm run test:coverage`, `npm run build`.
- Before any PR: run `/pre-pr` if available; otherwise run the gates above in that order and stop
  at the first failure.
- The lint/format configs, CI workflows, and the vendored skill are protected files — change them
  only when the task is about them.
- Product knowledge: scoping a feature, assessing feasibility, or checking whether a capability
  already exists — read `docs/product/INDEX.md` first and follow its links; skip it for bug fixes
  and refactors inside existing behaviour. A PR that adds a user-facing capability adds its
  feature doc in `docs/features/` (format: `docs/features/README.md`); a PR that changes or
  removes one updates or deletes that doc — in the same PR.
- Standard version and pending migrations:
  `node .claude/skills/eq-frontend-standards/scripts/standard-check.mjs`.
