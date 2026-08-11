---
'frontend-skills': minor
---

Coverage enforcement changes shape. The gate is now **diff coverage** — `diff-cover` on the lines a
branch adds, at 90% — and the global floors become a backstop against wholesale regression rather than
the thing that fails a PR.

The old mechanism was Vitest's `thresholds.autoUpdate`, a ratchet that rewrote the floors to whatever
coverage currently was. The arithmetic makes that a trap: with the floor equal to achieved coverage, a
change adding N lines passes only while its uncovered lines stay under N × (1 − coverage), so a repo at
99.7% silently demands ~100% of all new code while its config claims 99.5%. Measured on a real
consumer repo — a change adding 19 lines with one uncovered defensive branch, 94.7% of its own lines,
was rejected on lines, statements and branches at once. The same change passes the new gate. Worse in
the other direction: on a large repo the same lag becomes a large absolute allowance, so hundreds of
uncovered lines can land without moving the percentage. The gate's grip loosened as a repo grew.

90% comes from Google's guidance, which puts per-commit coverage at "99% reasonable, 90% a good lower
threshold" while treating project-wide targets above 90% as diminishing returns. SonarQube's built-in gate uses 80%
on new code and recommends no overall-code condition at all; Chromium's per-CL check defaults to 70%.

**`diff-cover` rather than a script of our own, and that is the more important change.** The first
implementation was 391 lines of local code with 39 tests. A review found four ways it reported green on
untested code: renames excluded by `--diff-filter`, paths git quotes or tab-pads, a working directory
that is not the repository root, and a coverage report older than the code. `diff-cover` produced
identical numbers — 19 lines, 1 missing, 94.7% — from one command, so the script was deleted before it
ever shipped. Codecov's hosted `patch` status is the other standard option, declined only because it
means sending a private repo's coverage to a third party. The rule this leaves behind is written into
the README: buy the mechanism, keep the policy.

Also here: `references/mutation-testing.md`, because coverage cannot tell whether a test asserts
anything and an agent writing tests to satisfy a gate produces assertion-free tests at a rate no human
would. Incremental per PR, full run weekly, read as a list rather than a score. And
`docs/bespoke-code-audit.md`, which records the other places this repo writes code for a solved
problem — `unicorn/filename-case` already does what a 592-line structure script does, and is not even
enabled.

Migration 2.13.0. Consumers remove `autoUpdate` and the ratchet script, freeze their floors, add `lcov`
to the coverage reporters, and add the diff-coverage CI step.
