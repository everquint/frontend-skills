---
"frontend-skills": minor
---

Close three enforcement gaps in the starter: the structure checker now has a CI caller (and fails
rather than skips when the skill is not vendored), `vitest.config.ts` ships with an `autoUpdate`
coverage ratchet wired to `test:coverage`, and a `branch-name` job gates `<type>/<ticket>-<slug>` on
pull requests.

Consumers on the starter: `scripts.lint` gains `--ignore-pattern .claude/skills`, because oxlint does
not inherit `ignorePatterns` through `extends` and a vendored copy of the skill otherwise reports 124
`no-console` errors against its own scripts.
