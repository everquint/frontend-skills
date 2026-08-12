# 0019 — What stays hand-written

Date: 2026-08-12

Replaces `docs/bespoke-code-audit.md`, which is deleted. That document was a working audit; this is
the part of it worth keeping.

## Context

A 391-line diff-coverage gate was built here, reviewed, found to have four false-green bugs, and then
deleted in favour of `diff-cover` — which returned identical numbers from one command. That produced
the rule the README now states: **buy the mechanism, keep the policy.** What belongs in a standard is
the decision — 90% of changed lines, kebab-case filenames, one class selector per file — not an
implementation of it.

An audit then asked where else this repo writes its own code for a solved problem. It proposed three
replacements totalling an estimated 500-700 deletable lines. All three were tried.

## Decision

**One was real and shipped in 2.14.0.** oxlint's `unicorn/filename-case` was absent from the starter
config, so kebab-case was enforced only by review and a whole-repo scan.

**The other two do not work, and the estimate was zero.** These are recorded because both look
obviously right on paper and will otherwise be re-proposed:

- **`keep-a-changelog` cannot replace `starter/scripts/format-changelog.mjs`.** It formats files
  *already* in Keep a Changelog form. Fed changesets' output its `parser()` throws
  `Parse error in the line 5: Syntax error in the release title`, and giving it a valid dated title
  still throws on `### Minor Changes`. Two independent incompatibilities.
- **Changesets has no extension point for changelog structure.** `apply-release-plan` assembles the
  entry as ``[`## ${release.newVersion}`, …]`` with `` `### ${startCase(type)} Changes` `` hardcoded;
  `changelogFuncs` is referenced exactly twice, for `getReleaseLine` and `getDependencyReleaseLine` —
  bullet text only. The upstream request has been open since 2022. Setting `changelog: false` and
  driving `applyReleasePlan` directly is the only alternative seam, and it means owning more code,
  not less.
- **`validate-branch-name` would replace one `grep -Eq`** in `starter/.claude/hooks/branch-guard.sh`,
  invoked via `npx` before every Bash call. The part of that hook worth having — recording the branch
  at SessionStart and blocking a commit once another session has moved HEAD — has no equivalent.

**`check-structure.mjs` rule 1 stays** alongside the new lint rule. `unicorn/filename-case` ignores
directory names, oxlint never opens `.css`/`.scss`, and a repo still migrating on ESLint has neither.

**A script is justified when the tool fails silently.** That is the test for the next one, and it is
why `validate-claims.mjs`, `validate-skills.mjs`, `measure-rules.mjs`, `guard-protected-files.sh`, the
oxlint rule-count assertion and the oxfmt Tailwind canary all stay: oxlint drops 27 rules without a
word when `--type-aware` is missing, and oxfmt's class sorter becomes a no-op and still exits 0.

## Revisit

`eslint-plugin-check-file` covers rule 4 (`__tests__/`, `.spec.*`) and folder naming, and it loads
through oxlint's `jsPlugins` bridge with no ESLint present — verified. Not adopted only because
`jsPlugins` is alpha and outside semver (ADR 0001). Adopt when that stabilises.
