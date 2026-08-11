---
'frontend-skills': patch
---

`scripts/format-changelog.mjs` now ships with tests, and this repo can run them. The script runs
unattended as the second half of `npm run version` and rewrites `CHANGELOG.md`, so a regression lands
inside the version PR — where the diff is machine-generated, large, and therefore skimmed. Its own
comments asserted invariants that nothing checked: idempotency, dating a version from its git tag
rather than from today, and not duplicating its preamble when `changeset version` prepends a new
heading above it (a real regression that reached three stacked copies before it was caught).

Thirteen cases cover those, plus the semver-to-change-type section mapping, newest-first ordering
where a string sort would put 1.9.0 above 1.10.0, compare-link generation, the no-remote fallback, the
date fallback's middle branch (a date already on the heading survives when no tag matches), and both
failure exits asserted on their message rather than just the exit code. The script is exercised as a
child process in a throwaway git repo — the way the release job runs it — with `GIT_CONFIG_GLOBAL`,
`GIT_CONFIG_SYSTEM` and `HOME` redirected, so a developer's global `commit.gpgsign` or `core.hooksPath`
cannot fail the suite on their machine only.

This repo gains vitest for that one purpose, with a deliberately narrow include glob
(`skills/**/starter/scripts/*.test.mjs`, see `vitest.config.mjs`): it executes the starter's release
script for real, so a test only consumers could run would fire downstream of the damage. `npm test` is
the command.

A repo that already vendors the standard picks the test up by copying the file; no config change is
needed, since `scripts/**/*.test.mjs` is already in the starter's vitest include glob.
