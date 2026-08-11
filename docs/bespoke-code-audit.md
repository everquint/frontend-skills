# Bespoke-code audit — 2026-08-11

Where this repo writes its own code for a problem something else already solves. Recorded after a
391-line diff-coverage gate was built, reviewed, found to have four false-green bugs, and then deleted
in favour of `diff-cover` — which returned identical numbers from one command.

**The rule this produced: buy the mechanism, keep the policy.** What belongs in a standard is the
decision — 90% of changed lines, kebab-case filenames, one class selector per file — not an
implementation of it. Before writing a script, check whether a lint rule, a hook package or a CLI
already does it, and prefer the duller tool someone else maintains.

Total bespoke code at the time of the audit: **3,687 lines**.

## Reinvents something that exists

### `scripts/check-structure.mjs` rule 1 — kebab-case filenames (592-line script)

oxlint already ships `unicorn/filename-case`, and it is **not enabled** in `.oxlintrc.json`. Verified
against a real consumer repo:

```
src/tmp-probe/BadName.tsx:1:1: error unicorn(filename-case): Filename should be in kebab-case
help: Rename the file to 'bad-name.tsx'
```

The rule is better than the script on every axis: per file, in the editor, with an autofix, no
filesystem walk. Rule 4 (no `__tests__/`, no `.spec.*`) is adjacent territory covered by
`eslint-plugin-check-file`.

Genuinely bespoke in that script, and worth keeping: rule 5 (a top-level class selector declared in
exactly one file), rule 6 (git index versus filesystem filename case), rule 7 (code paths cited in
`docs/features/` that no longer exist).

### `starter/.claude/hooks/branch-guard.sh` — branch-name validation (186 lines)

`validate-branch-name` does the naming half as a husky hook. The other half — recording the branch at
SessionStart and blocking a commit once the agent's shell has drifted to another branch — has no
equivalent anywhere, and is the part worth having.

### `starter/scripts/format-changelog.mjs` + test (464 lines)

`keep-a-changelog` is a maintained parser and formatter for exactly this format. Worse than missing
it: changesets has a sanctioned extension point — a custom changelog generator — and this instead
re-parses the generated file afterwards. Same shape as the diff-coverage mistake.

## Partially defensible

- **`scripts/init-greenfield.mjs` (913 lines).** Copying a template tree is `degit`'s job and
  interactive scaffolding is `plop`/`yeoman`, but most of these lines are detect-and-merge logic for
  an existing repo, which is domain-specific.
- **`scripts/standard-check.mjs` (436 lines).** Reimplements the shape `nx migrate` uses — migrations
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

## If this is ever actioned

Roughly 500-700 lines could be deleted, the changelog formatter being the largest single win. Each is
a separate change with its own migration, because each is vendored into consumer repos.
