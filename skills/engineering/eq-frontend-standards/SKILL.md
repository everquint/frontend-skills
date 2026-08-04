---
name: eq-frontend-standards
description: Applies one canonical frontend TypeScript engineering standard to a repository — lint rules, correctness gates, file budgets, git hooks, commit conventions and CI. Use when setting up quality tooling in a React repo, auditing a repo against the standard, planning a migration to it, reviewing code for compliance, or deciding whether a lint finding is a real defect. Detects the repo's stack but never derives its standards from existing code.
---

# Frontend TypeScript Standard

One standard. Repos migrate to it once, then maintain it.

## The core rule

**Detect facts. Enforce standards. Never derive standards from what the repo already does.**

| Detect (facts — measure these) | Enforce (decided — do not negotiate) |
|---|---|
| framework, bundler, package manager | formatting, file budgets, complexity |
| test runner, router, state libraries | correctness rules (§2) |
| monorepo layout, which directories exist | git hooks, commit conventions, CI |
| **violation counts** — these set the migration path | naming, styling layers, test placement |

Deriving standards from existing code launders bad habits into policy. A repo with 16 index-key sites and
`no-array-index-key` disabled has a bug, not a convention. Detection tells you the *migration cost*, never the *target*.

## New repo? Skip the measuring

A greenfield repo has no debt: nothing to measure, nothing to baseline, every rule at `error` from the
first commit. `measure-rules.mjs` refuses to run anyway — the Vite template ships **no ESLint config**.

```bash
node <skill>/scripts/init-greenfield.mjs [--dry-run]   # --dry-run prints the file plan first
# exits 1 the first time, naming the two lines Tailwind needs in vite.config.ts and a
# stylesheet. Make those edits, re-run until it exits 0 — files are written either way.
npm install
npx eslint . --fix      # required: a 2-space/no-semicolon scaffold yields ~130 fixable errors
npm run lint && npm run typecheck && npm run build
node <skill>/scripts/check-structure.mjs    # the Vite template itself needs three fixes
```

It never overwrites and never edits your source: existing files are skipped and `package.json` is merged
key-by-key. One exception — a `lint` script running a **different** linter (`oxlint`, `biome`, `xo`) moves to
`lint:legacy` so `eslint .` owns the name CI invokes; leaving it would keep the standard unenforced on a green build.
Its config file is reported for you to delete. Measured on a clean scaffold: after `--fix`, lint, typecheck and build
exit 0, and `check-structure` exits 1 on three defects in the template — `references/structure.md` §4.

**Do not use it on an existing repo.** Dropping the full config into a mature codebase produces
hundreds of errors at once, which is how a whole rule set gets switched back off. Measure instead:

## Procedure — existing repo

The scripts ship beside this skill, not in the audited repo, so `scripts/…` never resolves against that repo's cwd. Invoke
by absolute path from the install location — usually `~/.claude/skills/eq-frontend-standards/scripts/` or `~/.agents/skills/…` — abbreviated below to `scripts/<name>.mjs`.

1. **Profile the stack** — `scripts/profile-repo.mjs`. Facts only, no judgement.
2. **Measure violations** — `scripts/measure-rules.mjs`. Per-rule counts against the standard.
   Run scoped (`--dir src/components`) on large repos; a full React Compiler pass over 1,500 files
   can exceed two minutes.
3. **Build the ladder** (§3). Rules at zero violations go straight to `error`. The rest go to
   `error` plus a suppressions baseline.
4. **Wire the gates** (§4). Every local hook gets a CI counterpart.
5. **Record exemptions** (§5). Read findings at source before exempting anything.
6. **Record the version** — `node scripts/standard-check.mjs --record`, then commit the marker.

Write the measured numbers into the repo — never into this skill. This skill holds the standard;
each repo holds its own status.

## Staying current

`npx skills update` refreshes this skill's **text** only — no repo's ESLint config, hooks or CI move
with it, so a repo silently stops complying the moment the standard does. Each migrated repo records
its version in `.eq-frontend-skills.json`:

```bash
node <skill>/scripts/standard-check.mjs --check    # CI gate: exit 1 if behind or never migrated
node <skill>/scripts/standard-check.mjs --record   # after migrating
```

`--check` belongs in CI; a marker nobody reads is a comment. When behind, it prints the named
migration steps between the recorded version and the installed one. The design is
[copier](https://copier.readthedocs.io/en/stable/updating/)'s: answers stored beside the version,
named migrations per version, and no writing to a dirty worktree. Never hand-edit the marker.

## 1. Formatting and budgets — enforced

| Rule | Value |
|---|---|
| `@stylistic/indent` | `4`, `SwitchCase: 1`, `flatTernaryExpressions: false` |
| `@stylistic/quotes` | `single`, `avoidEscape: true` |
| `@stylistic/semi` | `always` |
| `max-len` | `200` |
| `no-console` | error, `allow: ['error']` |
| `@typescript-eslint/no-explicit-any` | error |
| `max-lines` | `500`, `skipBlankLines`, `skipComments` — **code** lines |
| `max-depth` | `4` |
| `complexity` | `15` |
| `max-lines-per-function` | **off** — deliberate; hooks, reducers and `render*` helpers are legitimately long |
| `no-nested-ternary` | error |

No Prettier, no Biome. `@stylistic` rules are the formatter.

Exempt from `max-lines`: test files, and CLI-generated directories such as `src/components/ui/`
(`npx shadcn add` overwrites them). "Summed complexity per file" is a **review** guideline — no
linter implements it, so do not describe it as enforced.

## 2. Correctness — non-negotiable

True in every component-based frontend regardless of local habit. `references/correctness-rules.md` gives each rule with its
concrete failure scenario; `references/react-hooks-v7.md` gives the full 29-rule classification — **which rules are real, and
which report compiler limitations rather than defects in your code.** Read it before enabling anything from `eslint-plugin-react-hooks`: three of its rules produce large volumes of noise that are not bugs.

**Gated, but off by default — turn these on.** A repo that never enabled them reports zero violations
and has an unknown real count:

| Requirement | Rule | Why it is off |
|---|---|---|
| Every promise `await`ed, `.catch()`ed, or `void`ed | `@typescript-eslint/no-floating-promises` | needs type-aware linting (`parserOptions.projectService`) |
| `useEffect` callbacks are never `async` | `react-hooks/exhaustive-deps` | on in most repos; `no-misused-promises` cannot substitute — see `references/correctness-rules.md` §4 |
| No index keys in lists that reorder, filter, or poll | `react/no-array-index-key` | exists but is not in `react/recommended` |

**Genuinely reviewer-enforced** — no rule exists:

- External data — HTTP responses, `localStorage`, URL params, `postMessage`, tool output — parsed
  with `zod` at the boundary, TS type inferred from the schema. `as T` on a `fetch` result is a
  cast, not a check.
- Resources released on **every** path including early returns and errors: timers, listeners,
  `rAF`, `ResizeObserver`, object URLs, `AbortController`.
- Optimistic updates roll back on failure, and failure reaches the user — not only `console.error`.
- A server-state cache key includes every input the query depends on.

## 3. Migration ladder

The standard is fixed. The path to it is per-repo, because violation counts differ.

- **Zero violations → `error` immediately.** Free, and prevents regression forever. Do this first.
- **Everything else → `error` + `eslint-suppressions.json`.** New code complies; old code ratchets down.

**Suppressions are `error`-severity only. `warn` is never suppressible** — a rule parked at `warn`
can never be ratcheted and will sit green forever. Never stage at `warn`.

```bash
npx eslint . --fix && npx eslint . --suppress-all   # baseline the remainder
npx eslint . --prune-suppressions                   # later: drop what has been fixed
```

Granularity is file + rule + **count**: 2 suppressed violations in a file that grows to 5 reports all 5.

## 4. Gates — enforced

**Every local hook has a CI counterpart.** Hooks are bypassable with `--no-verify`; CI is the real
gate. A hook with no CI equivalent is decoration.

| | Local | CI |
|---|---|---|
| staged lint | `pre-commit` → `lint-staged` (`eslint --fix`) | `lint` |
| types | `pre-push` → `typecheck --force` | `typecheck` |
| commit message | `commit-msg` → `commitlint` | `wagoid/commitlint-github-action` |
| tests, build | — | `test`, `build` |

Details, including the exact hook bodies and CI workflow, are in `references/hygiene.md`. Two
constraints that cause real failures:

- **`tsc -b` must use `--force`.** Its `.tsbuildinfo` goes stale and produces phantom errors *and*
  false passes. A hook that emits false failures gets bypassed with `--no-verify`, so correctness
  beats the few seconds `--force` costs.
- **Never `lint-staged --no-stash`** — it drops the backup stash, so a task that corrupts the working
  tree leaves nothing to recover from. **Never `--fail-on-changes`** either: it fails the commit
  whenever a task rewrites a file, which is every run where `eslint --fix` fixes something.

Node version must be pinned consistently across `.nvmrc`, `engines`, `packageManager`, and CI's
`node-version-file`. `engines` must not admit a version the test suite cannot run on.

## 5. Exemptions

Explicit, dated, argued — in the repo, not in this skill. An exemption needs a reason a cold reader
can check, and it exempts a **pattern**, never the code that uses it.

**Verify at source before exempting.** Two known false-positive shapes: `static-components` fires on icon-by-variable
(`const Icon = iconFor(ext); <Icon />` — the component is a stable module-level import, only the selection varies), and
`hooks` fires on libraries that invoke a passed function as a hook. But do not assume a finding is a false positive because it
resembles one. Optional-chained hook calls — `slots?.useSidePanel?.()` — look like a library seam and are a **real** hazard: hook order breaks the moment the object is passed conditionally.

## 6. Conventions — enforced, but not by a linter

None of these is a runtime failure, so none belongs in `references/correctness-rules.md`. That does not make them optional. Each is enforced by the conventions review, and by `check-structure.mjs` where a filesystem walk can decide it:

- **Naming *casing*, component folders, placement, style-selector collisions** — `references/structure.md`, checked by `scripts/check-structure.mjs`; promotion needs a second consumer counted, so it stays reviewer-enforced.
- **Which duplication is a defect and which is not** — `references/duplication.md`, reviewer-enforced. `jscpd` is a lead to read, never a gate.
- **Which styling layer to reach for** — `references/styling.md`. The four-layer order, and why two layers on one property is the defect.
- **Comments, identifier *semantics*, and how much belongs in one file** — `references/code-quality.md`. Owns the summed-complexity budget and the per-helper complexity classes that §1's numbers do not decide.

**A branch that produces more than one element is a named local `render*` helper**, called as `{renderEmptyState()}` —
not an inline ternary or `&&` chain. Inline, the reader parses JSX and control flow at once, and the diff of a changed
condition is indistinguishable from a changed element; the name states the intent. A single-element
`cond ? <A /> : <B />` stays inline, and §1's `no-nested-ternary` gates only the worst shape. Mounting the helper as `<RenderEmptyState />` is a remount bug — `references/correctness-rules.md` §1.

## 7. Documentation rule

**Generate every measured claim, or delete it.** Hand-written status tables go stale silently:
auditing one mature repo produced four false claims in its own conventions doc, every one a
hand-typed number. Keep instruction files under 200 lines and put procedures in skills, not prose.
