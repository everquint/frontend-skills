# Bespoke-code audit — 2026-08-11, re-verified 2026-08-12

**Read the re-verification before acting on anything here.** The first pass asserted three
replacements. One was real and is now shipped (2.14.0); two do not survive being tried, and the
"500-700 lines could be deleted" estimate was wrong. Each finding below carries its verdict.


Where this repo writes its own code for a problem something else already solves. Recorded after a
391-line diff-coverage gate was built, reviewed, found to have four false-green bugs, and then deleted
in favour of `diff-cover` — which returned identical numbers from one command.

**The rule this produced: buy the mechanism, keep the policy.** What belongs in a standard is the
decision — 90% of changed lines, kebab-case filenames, one class selector per file — not an
implementation of it. Before writing a script, check whether a lint rule, a hook package or a CLI
already does it, and prefer the duller tool someone else maintains.

Total bespoke code at the time of the audit: **3,687 lines**.

## Real, and shipped in 2.14.0

### `unicorn/filename-case` was missing from the starter lint config

oxlint 1.77 ships the rule. The starter's `.oxlintrc.json` did not list the `unicorn` plugin at all,
so every repo scaffolded from the standard enforced kebab-case only through review and a filesystem
walk — never in the editor, never with a rename suggestion.

The first pass said the rule was "not enabled in `.oxlintrc.json`, verified against a real consumer
repo". Those are two different configs: the starter lacked the rule, the probe ran against
`thecleverclerk/client`, which has it. Client enabled a filename-case rule at `55d66d0` — as
`snakeCase`, the opposite convention — and switched it to `kebabCase` at `03359b9`, under a heading
reading "Repo-specific additions … tighten the standard". The gap was in the standard, and by
`03359b9` the consumer was ahead of it.

The first pass also called the rule "better than the script on every axis". It is not, though for
narrower reasons than stated: `unicorn/filename-case` ignores **directory** names, and oxlint never
opens `.css`/`.scss` at all, while `check-structure.mjs` scans `ts|tsx|scss|css` plus every
directory. Rule 1 stays.

Rule 4 (no `__tests__/`, no `.spec.*`) **does** have an equivalent — an earlier draft of this
document said otherwise and was wrong. oxlint loads ESLint plugins via `jsPlugins`, the same bridge
`.oxlintrc.strict.json` uses for `eslint-plugin-react-hooks`; `check-file` reports both
`filename-naming-convention` and `folder-naming-convention` with `node_modules/eslint` deleted. Not
adopted: `jsPlugins` is alpha and outside semver (ADR 0001). Revisit when it stabilises.

Cost, on 1,104 files: fast config 168 → 182 rules, zero new violations. The **CI gate gains one rule**
(226 → 227) — strict was already loading the other 13, so this closes a gap where `lint:fast`, the
editor and pre-commit enforced less than CI. Pass/fail matches rule 1 exactly: `use-thing.test.ts`,
`vite-env.d.ts`, `some-thing.types.ts`, `x2-y3.ts` pass; `BadName.tsx`, `bad_name.ts`, `badName.ts`
fail.

## Checked, and the replacement does not work

### `starter/scripts/format-changelog.mjs` + test (464 lines)

Called the largest single win. It is not a win at all — neither suggested replacement can do the job.

`keep-a-changelog@3.1.0` is a formatter for files **already** in Keep a Changelog form. The input
here is changesets' raw output, and it throws on it:

```
THREW: Parse error in the line 5: Syntax error in the release title
```

`## 1.1.0` with no date is not a release title it accepts. It parses the *formatted* file fine —
which is to say it can only run after the conversion this script exists to perform. There are two
independent incompatibilities, not one: give it a valid `## [1.1.0] - 2026-01-01` title and
changesets' `### Minor Changes` heading still throws
`Cannot read properties of undefined (reading '0')`.

The "sanctioned extension point" does not reach the structure either. In
`@changesets/apply-release-plan`, the entry is assembled as
``[`## ${release.newVersion}`, …generateChangesForVersionTypeMarkdown(…)]`` with
``` `### ${startCase(type)} Changes` ``` hardcoded one function above it. The `changelog` option
supplies `getReleaseLine` and `getDependencyReleaseLine` — the **bullet text** and nothing else. The
version heading, the date, `## [Unreleased]`, the `### Major/Minor/Patch Changes` → `Changed/Added/
Fixed` remap and the compare links are all outside what a custom generator can touch. Post-processing
the generated file is one of two seams; the other is `changelog: false` plus a programmatic
`applyReleasePlan`. Both mean owning code.

### `starter/.claude/hooks/branch-guard.sh` — branch-name validation (186 lines)

`validate-branch-name` exists, but the "naming half" of this hook is a single `grep -Eq` plus a five-line
error message explaining the format. Replacing one grep with a dependency and a config file, invoked
via `npx` inside a PreToolUse hook that runs before every Bash call, costs latency and a package to
save nothing. The part worth having — recording the branch at SessionStart and blocking a commit once
another session has moved HEAD underneath this one — still has no equivalent anywhere.

## Partially defensible

- **`scripts/init-greenfield.mjs` (913 lines).** Copying a template tree is `degit`'s job and
  interactive scaffolding is `plop`/`yeoman`, but most of these lines are detect-and-merge logic for
  an existing repo, which is domain-specific.
- **`scripts/standard-check.mjs` (445 lines).** Reimplements the shape `nx migrate` uses — migrations
  keyed by the version they ship in — and there is no drop-in library for it.

## No alternative exists; keep

`scripts/validate-claims.mjs`, `scripts/validate-skills.mjs`, `scripts/measure-rules.mjs`,
`scripts/profile-repo.mjs`, `starter/.claude/hooks/guard-protected-files.sh`, the oxlint rule-count
assertion in CI, and the oxfmt Tailwind-sorting canary.

These exist for one reason: the tools fail **silently**. oxlint drops 27 rules without a word when
`--type-aware` is missing; oxfmt's class sorter becomes a complete no-op when its stylesheet path does
not resolve, and still exits 0. Nothing off the shelf notices, so a local assertion is the only option.
That is the legitimate reason to write a script, and it is the test to apply to the next one.

## The other half of the picture

The repo mostly does buy rather than build: changesets, husky, commitlint, lint-staged, oxlint, oxfmt,
Playwright, Vitest, Dependabot, and now diff-cover. The pattern is not systemic — it appears where a
tool fails quietly and a script felt easier than checking whether a rule already existed.

## What the re-verification changes

The first pass estimated 500-700 deletable lines. The real number is **zero** — every proposed
deletion either has no working replacement or covers ground the replacement cannot reach. What the
audit produced instead is one missing lint rule, now in the standard.

That is not a failure of the exercise; it is the exercise working in both directions. "Buy the
mechanism" is a question to ask, not a conclusion to assume, and the answer here came from running
the replacement rather than reading its README. Two of the three findings looked equally obvious on
paper and dissolved on contact — the changelog one in a single `parser()` call.
