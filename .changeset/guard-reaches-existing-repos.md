---
"frontend-skills": patch
---

Two findings from the first repo to complete the v1.2.0 migration:

- **The existing-repo procedure never installed `.claude/`** — greenfield repos got the settings,
  the guard and lint-fix hooks, both reviewer agents and `pre-pr` from `init-greenfield.mjs`;
  migrated repos got nothing and were told nothing, so the repos most exposed to agent edits ran
  without `guard-protected-files.sh`. The procedure gains an explicit install step (with the
  `chmod 755` stated — a hook without the executable bit looks wired and never runs), `hygiene.md`
  gains the commands, and `standard-check.mjs` now asserts all six files plus the hooks' executable
  bit in both `--check` and `--record`, so a repo without the guard no longer records or reports as
  compliant.
- **A wide `printWidth` deflates `max-lines`** — packing code at 200 columns lowered line counts,
  so files over the 500-line budget dipped under it at 200 and returned at 120. §1 now states the
  coupling (never widen the formatter to pass the size budget) and the 1.2.0 migration entry warns
  that `max-lines` findings surfacing from the rewrap are pre-existing debt, not reformat damage.
