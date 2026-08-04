# frontend-skills

## 1.1.1

### Patch Changes

- [#5](https://github.com/everquint/frontend-skills/pull/5) [`1e88b6e`](https://github.com/everquint/frontend-skills/commit/1e88b6ea88f23e64f11fb396eae5dd5b71c6f500) Thanks [@gokulsgr](https://github.com/gokulsgr)! - The release workflow now reads `${{ secrets.RELEASE_TOKEN || secrets.GITHUB_TOKEN }}`, so a repo whose org
  disables "Allow GitHub Actions to create and approve pull requests" can release by adding a fine-grained
  PAT rather than editing the workflow. `hygiene.md` §6 names both first-release failures — the
  non-conventional `Version Packages` commit and the refused PR creation — with the fix for each; ADR 0006
  records why a hand-rolled version phase was rejected.

## 1.1.0

### Minor Changes

- [#2](https://github.com/everquint/frontend-skills/pull/2) [`1badb0f`](https://github.com/everquint/frontend-skills/commit/1badb0fc406b52cfd7e393eee0db1384587f1aa0) Thanks [@gokulsgr](https://github.com/gokulsgr)! - `eq-frontend-workflow` now requires two lookups and a measurement before the first edit: search the
  registry before hand-rolling, read a library's docs at the pinned version (via a docs-retrieval tool
  such as Context7 when one is mounted, otherwise the installed package's own types), and probe the
  runtime rather than reasoning about it. Detail in `references/looking-it-up.md`; the changesets
  rationale moved to `references/release-tooling.md` to stay inside the SKILL.md budget.

  Starter: `tsconfig.node.json` now includes `vitest.config.ts` and `playwright.config.ts`, so a type
  error in the coverage gate's own config fails `tsc -b` instead of passing silently.

- [#2](https://github.com/everquint/frontend-skills/pull/2) [`60d60ee`](https://github.com/everquint/frontend-skills/commit/60d60ee49dadfaad137efb9ced8fd9a8e67fd28c) Thanks [@gokulsgr](https://github.com/gokulsgr)! - Close three enforcement gaps in the starter: the structure checker now has a CI caller (and fails
  rather than skips when the skill is not vendored), `vitest.config.ts` ships with an `autoUpdate`
  coverage ratchet wired to `test:coverage`, and a `branch-name` job gates `<type>/<ticket>-<slug>` on
  pull requests.

  Consumers on the starter: `scripts.lint` gains `--ignore-pattern .claude/skills`, because oxlint does
  not inherit `ignorePatterns` through `extends` and a vendored copy of the skill otherwise reports 124
  `no-console` errors against its own scripts.

- [#2](https://github.com/everquint/frontend-skills/pull/2) [`ce24054`](https://github.com/everquint/frontend-skills/commit/ce240545a840432f75b16c1677d0213fc27f2d19) Thanks [@gokulsgr](https://github.com/gokulsgr)! - Add `eq-create-issue` and `eq-take-issue` — writing a Linear issue both a PM and a dev can
  read, and turning one into an approved approach before any code is written.

## 1.0.0

### Major Changes

- [`92ea722`](https://github.com/everquint/frontend-skills/commit/92ea72205c00792db0b77a7f798588da74faf85c) Thanks [@gokulsgr](https://github.com/gokulsgr)! - Initial release: three skills — `frontend-standards`, `frontend-workflow`, `frontend-quality-bar` — plus `profile-repo`, `measure-rules` and `standard-check` scripts.

  Consumers migrating to v1.0.0 must run the steps listed in `standard-check.mjs`'s migration table, then record the version with `--record`.
