# Three-repo standard review — 2026-08-05

The eq-frontend-standards skill (v1.5.0) was run once against three repos, each by a **fresh,
independent Claude session** with no context from the standard's development, then every claim was
re-verified by a fourth fresh session. Constraints held everywhere: no push, no staging, no
commits, no new branches, no stash. The verifier confirmed **24/24 claims** and byte-clean
worktrees in both read-only repos.

| Repo | Branch | Path taken | Verdict |
|---|---|---|---|
| tiof/my-app | master | Greenfield setup (files written, nothing committed) | **All gates green** — one known pending item needs a commit |
| inbox-ledger/app | feat/chat | Existing-repo measurement, read-only | Never migrated; **377 violations**, blocked findings below |
| tiof/fluentmind/app | v2.2 | Existing-repo measurement, read-only | Never migrated; **measurement blocked by `baseUrl`** |

---

## my-app (greenfield) — set up, verified green

| Gate | Result | Evidence (verified independently) |
|---|---|---|
| typecheck | ✅ | exit 0, `tsc -b --noEmit --force`, strict flags in both leaf tsconfigs |
| lint (strict, type-aware) | ✅ | exit 0, **226 rules loaded**, 0 diagnostics |
| format:check | ✅ | exit 0 over 31 files |
| test:coverage | ✅ | 2/2 tests; ratchet locked floors at 80/100/75/100 |
| build | ✅ | exit 0 |
| structure | ⚠ rules 1–5 clean | rule 6 pending: git index still holds `App.tsx`/`App.css` (PascalCase) |
| standard-check --record | ⏸ blocked by design | refuses a dirty worktree |

The earlier partial attempt had left a trap the initializer caught precisely: the repo's own
6-line Vite `.oxlintrc.json` was the base of the strict gate — green and enforcing nothing. The
session replaced it and both hollow tsconfigs with the starter's versions.

**Left for a human (each requires staging/committing, which the run was forbidden to do):**
1. `git mv src/App.css src/app.css && git mv src/App.tsx src/app.tsx` — the on-disk rename exists;
   git's index must follow or a fresh clone resurrects PascalCase and fails CI.
2. Commit the whole scaffold (including `.claude/`).
3. `standard-check --record`, then commit the marker.

## inbox-ledger/app (existing) — measured, not migrated

State: never migrated, **no CI at all** (`.github/` absent), one husky hook of three, no
lint-staged, no formatter (formatting lives inside ESLint via `@stylistic` — the exact coupling §1
forbids), no Node pinning, 1 test file across 334 source files, three overlapping client-state
libraries. **The lockfile is broken: `npm ci` fails**, so CI is impossible until it's repaired.
The repo's own ESLint measures itself nearly clean (3 rules) while the standard finds 377 —
the derived-from-the-repo config the standard's core rule exists to kill.

- `measure-rules` **refused**: `baseUrl` in both tsconfigs — every past type-aware result was a
  false zero. (Measured on a disposable scratch copy after removing it: **377 violations / 335
  files**, 194 rules at zero and free to promote; top: `no-floating-promises` 60,
  `no-unnecessary-type-assertion` 47, `complexity` 41, `prefer-tag-over-role` 36.)
- §3 ladder: strictly the >~300 ESLint-suppressions branch, but 26% over a stated judgement line
  with 74 findings being §2 must-fix promise rules and ~80 mechanical/autofixable — a maintainer
  could defensibly take the fix branch with one parked rule (`complexity`).
- Structure: 6 violations, all missing component barrels; naming/tests/casing clean.

**Migration order when taken up:** repair lockfile → delete `baseUrl` (both files) → re-measure →
fix §2 promise rules + autofixables, park the remainder under §3's contract → wire formatter,
hooks, CI, pinning → 6 barrels → `--record`.

## fluentmind/app (existing) — measured, not migrated

State: never migrated. ~2,000 source files, 3 Vite apps, workspaces; **no formatter at all**, no
commitlint, Node pinning inconsistent (`.nvmrc` 24 vs `engines >=22`, no `packageManager`), no
coverage threshold, no error reporter, 23 files over 500 raw lines. Its own ESLint and typecheck
are green (typecheck lacks the standard's `--force`).

- `measure-rules` **refused**: `baseUrl` in tsconfig.json — the §3 branch is *unknowable* until
  it's deleted and the measurement re-run. Given the repo's scale, the prior favors the
  ESLint-suppressions branch, but per the standard's own rule that is a guess, not a measurement.
- Structure (src): remarkably clean — **1 violation** in 2,343 files (`.blogs-content` declared in
  two stylesheets). Root scan adds noise the checker itself should filter (see feedback).

**First migration step:** delete `baseUrl`, re-measure, then decide the ladder branch on numbers.

---

## Verifier verdict

Fresh-session verification confirmed every claim above against the actual repos: my-app's five
green gates re-ran green (226 rules re-measured), both read-only repos have completely empty
`git status --porcelain`, no stash entries were created, and no commits, staging, branches, or
pushes happened anywhere. **All good, with the three my-app items intentionally left for a human.**

## Skill feedback from the fresh sessions (maintainer queue)

Consolidated, deduplicated, ranked:

1. **`measure-rules` is all-or-nothing over `baseUrl`** — right for type-aware rules, but it
   withholds all ~200 syntax-only counts too, so a read-only day-one audit ends with zero numbers
   (both existing repos hit this). Wanted: a `--syntax-only` (or auto-degraded) mode printing
   non-type-aware counts under a loud "type-aware NOT measured" banner.
2. **The measurement phase isn't self-contained for a read-only consumer** — the script demands
   three dev-deps installed in the audited repo; `--tooling <dir>` exists but SKILL.md never
   mentions it. Document it, or ship tooling beside the skill.
3. **`check-structure` rule 4 fights Playwright** — `e2e/*.spec.ts` is Playwright's default;
   the rename advice breaks discovery. (The standard's own starter uses `.test.ts` with a config
   that collects it, but the checker gives no such path to a repo mid-migration.)
4. **Rule 5 misfires on theme tokens** — `.dark` across a design-system tokens file and index.css
   is not a component-class collision; the "hoist into *-shared.scss" advice is wrong there.
   Allowlist theme-mode selectors or change the advice.
5. **Root scan walks gitignored directories** (`graphify-out/` flagged) — the checker should
   respect `.gitignore`.
6. **The §3 script verdict is flat near the boundary** — it prints "above ~300 — stay on ESLint"
   at 377 while SKILL.md insists the number is a judgement; hedge within a band.
7. **Coverage ratchet mutates config on a red run** — a zero-test `vitest run --coverage` exits 1
   yet autoUpdate still writes floors (including a vacuous `branches: 100`).
8. **init-greenfield's merge reports false conflicts** — byte-identical lint-staged entries listed
   as "resolve by hand", noise that trains people to skip the section carrying real conflicts.
9. **Doc drift**: SKILL.md says the initializer "exits 1 the first time"; it exits **2** for
   landed-but-unenforcing. `profile-repo` labels test-file density "coverage" and reports
   `formatter: unknown` when `@stylistic` is formatting inside the linter — it could name the
   anti-pattern.
10. **Sequencing note**: greenfield's `check-structure` step will always end with rule 6 pending
    until the first commit; one sentence in SKILL.md would pre-empt the confusion.

**What the sessions called out as working well:** the `baseUrl` refusal message ("names the
mechanism, the false-zero risk, and the exact fix"), the hollow-base diagnosis, the both-halves
`@/` alias check, `--record`'s dirty-worktree refusal, and rule 6 catching the case drift.
