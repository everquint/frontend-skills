# The ESLint + suppressions branch

The §3 ladder's >~300 path, written as a procedure. Derived from the first real migration to take
it (a 2,187-file repo measuring 3,159 violations). On this branch **ESLint stays the linter and
oxfmt is NOT adopted** — the repo keeps its current formatting until oxc#10549 lands or a decided
reformat commit happens. Everything else in the standard still applies.

## 1. Enable the standard's rules in ESLint before baselining

A repo on this branch is usually "lint-clean" only because §2 rules are off — the
zero-because-never-measured trap. In `eslint.config.js`, at `error`:
`@typescript-eslint/no-floating-promises`, `no-misused-promises`, `react-hooks/exhaustive-deps`,
`react/no-array-index-key`, `react/no-unstable-nested-components`, `react/no-children-prop`,
`complexity: 15`, `max-lines: 500`, `max-depth: 4` — plus every §1/§2 rule the config already has
at `warn`, bumped to `error` (§3: never stage a rule at warn; warn cannot be ratcheted).

## 2. Fix, then baseline

```bash
npx eslint . --fix              # autofixable findings first — review this diff separately
npx eslint . --suppress-all     # writes eslint-suppressions.json (ESLint 9.24+)
```

`eslint-suppressions.json` is the branch's ratchet, and it is a **one-way** ratchet: new
violations anywhere fail the gate immediately; fixed sites are removed with
`npx eslint . --prune-suppressions`. Hand-editing it or re-running `--suppress-all` to admit new
debt defeats the mechanism — protect the file in the guard hook alongside `eslint.config.js`.

**§2 debt on this branch lives in the baseline.** §3's "promise rules are fixed in the migration
pass" applies to the ≤~300 fix branch; here the counts are exactly why the branch exists, so the
suppressions file is the sanctioned record of that debt — and the promise rules are the first
entries to prune, ahead of style-adjacent ones.

## 3. What transfers unchanged, and what must be adapted

Unchanged: hooks + CI counterparts (§4 — commit-msg/commitlint, `pre-push` with
`tsc -b --noEmit --force`, mirror in CI), Node pinning, `.git-blame-ignore-revs`, vendoring, the
structure gate, the version marker, §5 exemptions, §6 conventions.

Adapt — the starter assumes the oxlint branch, and copying it verbatim puts **false claims** in
the repo (violating §7):

- **`.editorconfig`**: mirror the ACTIVE linter's formatting rules (e.g. `@stylistic/indent: 4`,
  `max-len: 200`), not hygiene §8's oxfmt values — an editorconfig fighting the active linter is
  the defect the file exists to prevent. State the branch reasoning in its header.
- **`starter/AGENTS.md` pointer block**: rewrite the gate list to the commands that exist
  (`lint`, `typecheck`, `test`, `build`); there is no `lint:fast`/`format:check` here.
- **`starter/.claude/` guard + `pre-pr`**: point them at `eslint.config.js` and
  `eslint-suppressions.json` instead of `.oxlintrc*`/`.oxfmtrc`.

## 4. Vendoring: add the ignore to whichever linter is active, BEFORE the first lint run

Hygiene §11 documents the oxlint `ignorePatterns`. On this branch the same problem hits ESLint:
the vendored skill's own Node scripts produce hundreds of findings (measured: 209 —
parserOptions.project failures plus no-undef). Add `.claude/skills/**` and `.agents/**` to
`globalIgnores` in `eslint.config.js` in the same commit that vendors.

## 5. Leaving the branch

When oxc#10549 ships (or the team decides a big-bang reformat), the exit is a migration like any
other: measure again, adopt the oxlint configs, translate the remaining suppressions into the
parked-rules contract, land the oxfmt reformat as its own mechanical commit listed in
`.git-blame-ignore-revs`. The oxlint-only debt (compiler rules, `no-unsafe-*`, `import/no-cycle`)
is measurable today via `measure-rules.mjs` — record the number in the repo's status doc so the
exit is sized before it starts.
