---
'frontend-skills': minor
---

Codify the second migrated repo's learnings:

- **`baseUrl` silently zeroes type-aware linting** — oxlint-tsgolint rejects the project at exit 0
  while the rules still count as loaded, so even the CI rule-count assertion stays green.
  `measure-rules` now refuses to measure over it, `standard-check` flags it as a policy gap, and
  `references/typescript-config.md` documents the trap.
- **Parking contract** — SKILL.md §3 codifies the parked-rules shape (off + measured count + date +
  status doc + EXPECTED lowered to the enabled count, which must stay above every shortfall), and
  rules §2's promise rules unparkable.
- **`.git-blame-ignore-revs` ships in the starter** and `standard-check` asserts it exists.
- **`starter/AGENTS.md`** — a lean pointer so agents find the vendored standard, the gates, and the
  protected files; copied on greenfield init, merged by hand on migration.
- Migration entry `1.5.0` names the consumer steps.
