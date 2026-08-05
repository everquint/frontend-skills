---
name: eq-frontend-standards
description: One canonical frontend TypeScript standard — lint rules, correctness gates, file budgets, structure, naming, git hooks, commit conventions, CI. Use when setting up or auditing quality tooling, migrating a repo to the standard, or judging whether a lint finding is a real defect.
---

# Frontend TypeScript Standard

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
first commit. Skip the measuring — `measure-rules.mjs` would only report zeroes.

```bash
node <skill>/scripts/init-greenfield.mjs [--dry-run]   # --dry-run prints the file plan first
# exits 2 the first time — landed but not yet enforcing (exit 1 means the run never started) — naming two edits vite.config.ts and a stylesheet need; re-run until 0
npm install && npm run format     # normalizes the scaffold's quotes, semicolons and indent
npm run lint && npm run typecheck && npm run build
node <skill>/scripts/check-structure.mjs    # the Vite template itself needs three fixes. Its rule 6 (git case drift) stays pending until the first commit — seeing it right after init is expected, not a failure
```

It never overwrites and never edits your source: existing files are skipped and `package.json` is merged
key-by-key. A `lint` script running a **different** linter moves to `lint:legacy` so the standard's own
`lint` owns the name CI invokes, and its config file is reported for you to delete.

**Do not use it on an existing repo.** Dropping the full config into a mature codebase produces
hundreds of errors at once, which is how a whole rule set gets switched back off. Measure instead:

## Procedure — existing repo

**Adopt the CURRENT target state — this skill and today's starter; the MIGRATIONS map is for repos already on a recorded version, never a fresh adopter's reading list.**
The scripts ship beside this skill, not in the audited repo, so `scripts/…` never resolves against that repo's cwd — invoke by absolute path from the install location, abbreviated below to `scripts/<name>.mjs`.

1. **Profile the stack** — `scripts/profile-repo.mjs`. Facts only, no judgement.
2. **Measure violations** — `scripts/measure-rules.mjs`. Per-rule counts, and the fix sequence.
   Scope it with `--dir` on large repos: measured 18s over 2,185 files with the JS plugin bridge on. For a read-only audit of a repo without the three dev-deps installed, point `--tooling <dir>` at any directory whose `node_modules` has them.
3. **Follow the ladder** (§3). Zero-violation rules to `error`; the rest branch on the total.
4. **Wire the gates** (§4). Every local hook gets a CI counterpart.
5. **Install the agent policy and vendor the standard** — copy `starter/.claude/` in whole (settings, the guard and lint-fix hooks, both reviewer agents, `pre-pr`) and `chmod 755` the hooks: without the executable bit a hook looks wired and never runs. Copy `starter/.git-blame-ignore-revs` and `starter/CLAUDE.md`, and merge `starter/AGENTS.md`'s pointer block into the repo's own agent instructions if it has any. Vendor the three skills into `.claude/skills/` (byte-identical copies): a CI runner or agent host — Cyrus, Claude Tag, a cloud sandbox — has no personal install, so a repo that does not carry the skill carries no standard there; `--check` asserts it. Greenfield gets all of this from `init-greenfield.mjs`; an existing repo must do it explicitly, and it is the repo most exposed to agent edits that needs `guard-protected-files.sh` most.
6. **Record exemptions** (§5). Read findings at source before exempting anything.
7. **Record the version** — `node scripts/standard-check.mjs --record`, then commit the marker. It refuses while step 5's files are missing.

Write the measured numbers into the repo — never into this skill: the skill holds the standard, each repo its own status.

## Staying current

`npx skills update` refreshes this skill's **text** only — no repo's lint config, hooks or CI move
with it, so a repo silently stops complying the moment the standard does. Each migrated repo records
its version in `.eq-frontend-skills.json`:

```bash
node <skill>/scripts/standard-check.mjs --check    # CI gate: exit 1 if behind or never migrated
node <skill>/scripts/standard-check.mjs --record   # after migrating
```

`--check` belongs in CI; a marker nobody reads is a comment. When behind, it prints the named migration
steps between the recorded version and the installed one — [copier](https://copier.readthedocs.io/en/stable/updating/)'s
design: answers stored beside the version, named migrations, no writing to a dirty worktree. Never hand-edit it.

## 1. Formatting and budgets — enforced

**oxfmt is the formatter** — 4-space indent, single quotes, semicolons, `printWidth: 120`. Both numbers are decided: [ADR 0007](https://github.com/everquint/frontend-skills/blob/main/docs/adr/0007-printwidth-120-over-the-inherited-200.md) (width), [ADR 0013](https://github.com/everquint/frontend-skills/blob/main/docs/adr/0013-four-space-indent-by-organizational-decision.md) (indent — an organizational ruling; YAML stays 2-space by override). oxlint holds
no formatting rules at all, so nothing in the lint gate can contradict it, and `format:check` gates it in CI.

| Rule | Value |
|---|---|
| `no-console` | error, `allow: ['error']` |
| `typescript/no-explicit-any` | error |
| `max-lines` | `500`, `skipBlankLines`, `skipComments` — **code** lines. Coupled to `printWidth`, the wrong way: wider lines pack more code per line and deflate the count, so never widen the formatter to bring a file under this budget — measured: files over budget at 120 sat under it at 200 |
| `max-depth` | `4` |
| `complexity` | `15` |
| `max-lines-per-function` | **off** — deliberate; hooks, reducers and `render*` helpers are legitimately long |
| `no-nested-ternary` | error |

Rule identifiers are oxlint's, not ESLint's (`typescript/x`, `jsx_a11y/x` with an underscore); the
mapping, the lost rules, and `max-lines` exemptions: `references/hygiene.md` §11.
`references/typescript-config.md` owns the compiler flags behind §4's `tsc -b --noEmit --force` gate.

## 2. Correctness — non-negotiable

True in every component-based frontend regardless of local habit. `references/correctness-rules.md` gives each rule with its
concrete failure scenario; `references/react-hooks-v7.md` gives the full 29-rule classification — **which rules are real, and
which report compiler limitations rather than defects in your code.** Read it before enabling anything from `eslint-plugin-react-hooks`: three of its rules produce large volumes of noise that are not bugs.

**Gated, but off by default — turn these on.** A repo that never enabled them reports zero violations
and has an unknown real count:

| Requirement | Rule | Why it is off |
|---|---|---|
| Every promise `await`ed, `.catch()`ed, or `void`ed | `typescript/no-floating-promises` | silently skipped unless oxlint runs with `--type-aware` |
| `useEffect` callbacks are never `async` | `react-hooks-js/exhaustive-deps` | on in most repos; `no-misused-promises` cannot substitute — see `references/correctness-rules.md` §4 |
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

The standard is fixed. The path to it is per-repo, because violation counts differ. oxlint has **no
suppressions file** ([oxc#10549](https://github.com/oxc-project/oxc/issues/10549)), so there is no
baseline to write. Measure with `scripts/measure-rules.mjs`, then take one branch:

- **Zero violations → `error` immediately.** Free, and prevents regression forever. Do this first.
- **Roughly 300 or fewer remaining → one-time AI-assisted fix**, landed as one reviewable PR. The
  number is a judgement, never a constant to look up: it stands in for a PR a human can actually
  review and land without merge conflicts, calibrated on two repos — 167 violations migrated cleanly,
  1,474–2,105 did not.
- **Clearly more than that → stay on ESLint + suppressions until #10549 lands.** Deliberate: a
  1,474-violation fix PR gets rubber-stamped, not reviewed, which is worse than debt recorded in a
  suppressions baseline. Reasoning: [ADR 0002](https://github.com/everquint/frontend-skills/blob/main/docs/adr/0002-ai-assisted-migration-instead-of-a-suppressions-baseline.md). The branch has its own procedure —
  `references/eslint-branch.md`: enable §2 in ESLint first, `--fix`, `--suppress-all`, protect the
  baseline, prune-ratchet. On this branch the suppressions file IS the sanctioned §2 debt record.

**Never stage a rule at `warn`.** A rule parked at `warn` can never be ratcheted and sits green forever.

**Parking a rule** — `off` inside a marked `PARKED` block — is allowed only inside the fix branch, for rules whose fixes are genuinely risky to batch. The contract: the block names the measured count and date, an ordered fix plan lives in a repo status doc, and `EXPECTED_OXLINT_RULES` moves to the enabled count — which must stay **above** every silent-failure shortfall or the assertion stops catching them. **§2 rules are never parked on the fix branch**: an unhandled rejection is the bug class the migration exists to close, so `no-floating-promises` and `no-misused-promises` sites are fixed in that migration pass itself. (On the suppressions branch their debt lives in the baseline — `references/eslint-branch.md` §2 — and prunes first.)

**Before measuring: no `baseUrl` in any tsconfig.** It makes the type-aware rules report false zeros at exit 0 while still counting as loaded — `references/typescript-config.md`. `measure-rules.mjs` degrades to syntax-only counts over it, bannering the gap.

## 4. Gates — enforced

**Every local hook has a CI counterpart.** Hooks are bypassable with `--no-verify`; CI is the real
gate. A hook with no CI equivalent is decoration.

| | Local | CI |
|---|---|---|
| staged lint, format | `pre-commit` → `lint-staged` (`oxfmt`, `oxlint --fix`) | `lint`, `format:check` |
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
  whenever a task rewrites a file, which is every run where `oxfmt` reformats something.

Node version must be pinned consistently across `.nvmrc`, `engines`, `packageManager`, and CI's
`node-version-file`. `engines` must not admit a version the test suite cannot run on.

## 5. Exemptions

Explicit, dated, argued — in the repo, not in this skill. An exemption needs a reason a cold reader
can check, and it exempts a **pattern**, never the code that uses it.

**Verify at source before exempting** — the known false-positive shapes, and the one real hazard
that resembles them: `references/react-hooks-v7.md`, "Known false-positive shapes".

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

## 8. Product knowledge — mandatory

`docs/features/` — one doc per shipped capability, written by the shipping agent from the ticket —
and `docs/product/` (constraints incl. the NOT SUPPORTED list, current focus) answer what code
cannot: a capability's absence and intent are invisible in code. **A PR that adds, changes, or
removes a capability writes, updates, or deletes its feature doc in that PR** — `/pre-pr` step 7
reports the gap, rule 7 fails stale cited paths, `/doc-lint` audits claims. Format, seeding: `references/product-knowledge.md`.
