# Agent instructions

This repo follows the everquint frontend standard. A full copy of the standard lives inside this
repo at `.claude/skills/eq-frontend-standards` — nothing needs to be installed or fetched.
The gates below and the files in `.claude/` (guard hooks, the two reviewer agents, the `/pre-pr`
gate) enforce the standard during day-to-day work. Read the standard's SKILL.md only when the
task is about the standard itself — judging a lint finding, migrating, or auditing the tooling.

- Gates: `npm run lint` (strict, type-aware — CI's gate), `npm run lint:fast` (the editor loop),
  `npm run typecheck`, `npm run format:check`, `npm run test:coverage`, `npm run coverage:diff`,
  `npm run build`.
- Before any PR: run `/pre-pr` if available; otherwise run the gates above in that order and stop
  at the first failure.
- The lint/format configs, CI workflows, and the standard's folder are protected files — change
  them only when the task is about them.
- Product knowledge: scoping a feature, assessing feasibility, or checking whether a capability
  already exists — read `docs/product/INDEX.md` first and follow its links; skip it for bug fixes
  and refactors inside existing behaviour. A PR that adds a user-facing capability adds its
  feature doc in `docs/features/` (format: `docs/features/README.md`); a PR that changes or
  removes one updates or deletes that doc — in the same PR.
- Standard version and pending migrations:
  `node .claude/skills/eq-frontend-standards/scripts/standard-check.mjs`.
