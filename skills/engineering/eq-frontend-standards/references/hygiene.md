# Repo hygiene — hooks, CI, and pinning

The concrete wiring behind `SKILL.md` §4. Copy-pasteable; adjust only the script names.

## 1. The principle

**Every local hook has a CI counterpart.** A hook is a courtesy to the author — `--no-verify` bypasses
it and CI never learns it was skipped. A hook with no CI equivalent is decoration; a repo with hooks
and no CI has no gate at all.

| | Local (fast, bypassable) | CI (authoritative) |
|---|---|---|
| staged lint | `pre-commit` → `lint-staged` → `oxfmt` + `oxlint --fix` on staged files | `npm run lint` — the strict config, `--type-aware`, whole repo |
| whole-repo lint, local | `npm run lint:fast` — the base config, native rules only | same job, `npm run lint` |
| types | `pre-push` → `tsc -b --noEmit --force` | `npm run typecheck` |
| commit message | `commit-msg` → `commitlint` | `wagoid/commitlint-github-action` |
| tests, build | — (too slow to gate a commit) | `npm test`, `npm run build` |
| release | — (a release is a merge event, not a local one) | `.github/workflows/release.yml` → `changesets/action` — bumps versions, regenerates `CHANGELOG.md`, tags |

**The release row inverts the principle above and is CI-only by construction.** A release reads the merged state of the default branch to write the version, `CHANGELOG.md` and the tag; a local hook cannot observe that state, so a local counterpart would tag one developer's checkout and push a version nobody merged.

Local hooks shorten the feedback loop. Branch protection requiring the CI job is the gate.

**The two lint rows are the same rule set at two speeds, and the split is deliberate.** Measured on a
2,185-file repo: the base config, native Rust rules only, runs in **0.70–0.82s**; the strict config with
`jsPlugins` and `--type-aware` takes **18.6s**. An 18-second pre-commit hook gets answered with
`--no-verify` and then the hook enforces nothing, so the commit path runs the fast half and CI runs the
whole thing. Nothing is dropped — only deferred to the gate that cannot be bypassed.

## 2. husky v9

```bash
npm i -D husky lint-staged
npm pkg set scripts.prepare="husky"
npx husky init
```

Hooks are plain executable files in `.husky/` — no shebang boilerplate, no `husky.sh` source line. v9
removed `husky-init`, the `husky install` command, and the `package.json` `"husky"` config key, so any
tutorial mentioning `.husky/_/husky.sh`, `npx husky add`, or `"hooks": { "pre-commit": ... }` in
`package.json` is dead documentation for v8 or earlier.

## 3. Hook bodies

```bash
# .husky/pre-commit
npx lint-staged

# .husky/commit-msg
npx commitlint --edit "$1"

# .husky/pre-push
npm run typecheck
```

The scripts they call, in `package.json`: `"prepare": "husky"`, `"typecheck": "tsc -b --noEmit --force"`,
`"lint": "oxlint -c .oxlintrc.strict.json --type-aware --ignore-pattern .claude/skills"`,
`"lint:fast": "oxlint"`, `"lint:fix": "oxfmt && oxlint --fix"`, `"format": "oxfmt"`,
`"format:check": "oxfmt --check"`. The `--ignore-pattern` is not decoration: oxlint does not inherit
`ignorePatterns` through `extends`, so the strict config lints the vendored skills the base config
excludes — see §6.
`commitlint.config.js` is one line —
`export default { extends: ['@commitlint/config-conventional'] };`

## 4. Why `tsc -b --force`

`tsc -b` caches results in `.tsbuildinfo` and skips projects it believes unchanged. That cache goes
stale in both directions:

| Stale outcome | What the developer sees |
|---|---|
| Phantom errors | errors for code that no longer exists — after a branch switch, a rebase, or a `node_modules` reinstall |
| False pass | a real type error skipped because the project timestamp looks current |

Phantom errors are the worse case, because the fix a developer reaches for is `--no-verify`. A gate that
fires falsely gets bypassed, and once bypassing is habit the gate is gone — including for the false-pass
case that actually matters. `--force` costs seconds and buys a hook people trust. Delete any committed
`.tsbuildinfo` and gitignore it.

## 5. lint-staged

In `package.json`:

```json
"lint-staged": {
    "*.{ts,tsx,js,jsx,mjs,cjs}": ["oxfmt", "oxlint --fix"],
    "*.{css,scss,json,jsonc,md,yml,yaml}": ["oxfmt"]
}
```

The formatter runs before the linter, because `oxlint --fix` rewrites code and oxfmt owns the final
layout. The second glob exists because oxfmt formats stylesheets, JSON, Markdown and YAML while oxlint
reads none of them — those file types are formatted on commit and never linted.

Two flags to never use:

| Flag | Why not |
|---|---|
| `--fail-on-changes` | fails the commit whenever a task rewrote a file — the normal case when `oxfmt` and `oxlint --fix` are the tasks, so the hook fires on successful runs and teams respond by disabling it. No data-loss path; the objection is that it makes the gate useless. |
| `--no-stash` | removes the backup stash, the only thing that restores your work when a task corrupts the working tree mid-run. **This is the data-loss flag**: with it there is nothing to recover from. |

If a run is interrupted, recover from `git stash list`; lint-staged leaves its backup stash behind on
failure.

**The `json` glob reaches `package-lock.json`, and that is safe — oxfmt ignores lockfiles by name.**
Worth stating because the obvious reading is that it is not: a formatter rewriting a lockfile on every
commit would fight `npm install`, which rewrites it back, and `format:check` would then whipsaw in CI.
Measured on oxfmt 0.62.0 with this config: `oxfmt --check package-lock.json` reports *"All matched
files may have been excluded by ignore rules"*, and **the same bytes copied to `control.json` report
format issues** — so the exclusion is by filename, not content. `yarn.lock` and `pnpm-lock.yaml` are
excluded too. Prettier ships no such default, so a repo swapping formatters must add the ignore by hand.

`oxfmt --check` exit codes, measured: **1** on a misformatted file, **0** when clean, and **2** when the
glob matched nothing. That last one matters — a `format:check` whose paths resolve to nothing fails
rather than reporting success.

## 6. CI workflows

`.github/workflows/ci.yml`

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

concurrency:
  group: ci-${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version-file: .nvmrc
          cache: npm

      - run: npm ci

      - run: npm run typecheck
      - run: npm run lint
      - run: npm run test:coverage
      - run: npm run build
      - run: node "$EQ_STANDARD/scripts/check-structure.mjs" --dir .

  commit-messages:
    runs-on: ubuntu-latest
    if: github.event_name == 'pull_request'
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: wagoid/commitlint-github-action@v6

  branch-name:
    runs-on: ubuntu-latest
    if: github.event_name == 'pull_request'
    # ...asserts github.head_ref against one documented BRANCH_NAME_PATTERN
```

The shape only. `starter/.github/workflows/ci.yml` is the file that ships, and it is longer than this
because three of its steps assert that the tool they run is enforcing anything at all — the rule count
oxlint loaded, that oxfmt's Tailwind sorter resolved its stylesheet, and that a `tsc` that could not
run is never read as zero errors. Read it there; the reasoning is in its comments.

- Step order is cheapest-first: types fail in seconds, build takes minutes.
- `npm ci` not `npm install` — `ci` fails on a lockfile that disagrees with `package.json` instead of
  quietly rewriting it.
- `fetch-depth: 0` on the commitlint job; it needs history to find the PR's commit range.
- `cancel-in-progress` kills superseded runs; without it a branch pushed three times runs three
  pipelines and the first two results are noise.
- Mark `verify` required in branch protection. A workflow that is not required is a report, not a gate.

### Branch protection, and the approval requirement that has to wait

Name the **job** as a required status check — the job name, not the workflow name — and turn on
**strict** (branches must be up to date before merging), so a check that passed against stale `main`
cannot merge. Leave `required_linear_history` **off**: it forbids merge commits, and this standard
merges rather than squashes.

**Do not require a pull-request approval while the repo has one maintainer.** GitHub does not count an
author's approval of their own PR, so the requirement makes every PR unmergeable without an
admin override — and a rule whose normal operation is bypassing it trains exactly the `--no-verify`
reflex the rest of this document exists to prevent. It is a real gap, not a good state: a single
maintainer's work reaches `main` unreviewed by another human. **Turn the approval requirement on as
soon as a second maintainer exists**, and treat that as the condition rather than a preference.

For the same reason `enforce_admins` starts off. Turn it on together with the approval requirement;
before then it locks the only maintainer out of their own default branch.

### The three gates that had machinery and no caller

Each of these was documented, shipped a mechanism, and was invoked by nothing.

**Coverage runs `test:coverage`, never `test`.** `npm test` is `vitest run`, which measures no
coverage at all, so a job running it leaves the coverage row of the §1 table unenforced while looking
tested. `test:coverage` is `vitest run --coverage`, and the floors live in `starter/vitest.config.ts`
under `thresholds.autoUpdate: true` — `autoUpdate` rewrites the config file, so it needs that file to
exist and throws without one. Measured on a scaffolded consumer repo: a full run at 42.85% lines
rewrote the floors from `0` to the measured numbers and exited 0; adding one untested module dropped
lines to 30% and the same command exited 1 without lowering the recorded floor; a filtered run
(`vitest run --coverage <one file>`) also exited 1 and left the floors untouched, which is why only
the unfiltered command belongs in CI. `coverage.include` covers all of `src/`, because a config scoped
to one directory locks in a flattering number for a slice and never moves when untested code lands
outside it.

CI prints a `::notice::` when `autoUpdate` raised the floors, since the runner's working tree is
discarded — the gain is only locked in once `vitest.config.ts` is committed. It is a notice and not a
failure: a PR must not be blocked for having improved coverage.

**The structure gate requires the standard vendored into the repo.** `scripts/check-structure.mjs`
ships with the skill, not with the consumer repo, so the step resolves three locations in the same
order as `.claude/commands/pre-pr.md` step 0 — `.claude/skills/`, `$HOME/.claude/skills/`,
`$HOME/.agents/skills/` — and **fails, loudly, when none resolves**, naming the command that fixes
it. On a runner only the first can exist; nothing installs into a runner's home directory. A step that
skipped when the script was absent would report green while enforcing none of the naming, hooks-folder,
barrel, test-placement or style-collision rules, which is the exact anti-pattern the rest of this file
is built against.

Vendoring rather than `npx skills add everquint/frontend-skills -g --all` inside CI, which does run
non-interactively: that installs whatever `main` currently holds, so CI would enforce a different
version of the standard than the repo recorded in `.eq-frontend-skills.json`, with nobody able to see
the disagreement. Where it lands and whether it lands as a symlink or a copy are also decided by that
CLI's flags and its agent auto-detection, so a third-party release could turn the gate off.

Two consequences of vendoring, both measured on `oxlint 1.77.0` and `oxfmt 0.62.0`, and both already
handled in what ships:

- **`ignorePatterns` is not inherited through `extends`.** `.oxlintrc.json` ignores `.claude/skills`;
  `.oxlintrc.strict.json` extends it and does not, so `npm run lint` — the strict config — reported
  124 `no-console` errors against the vendored skills' own Node scripts. `scripts.lint` therefore
  passes `--ignore-pattern .claude/skills`. Verified: exit 0, `number_of_rules` still 214, and a
  planted `console.log` under `src/` is still reported.
- **oxfmt formats the vendored Markdown.** It honours `.gitignore`, and `.claude/skills` is
  deliberately committed rather than ignored, so `format:check` fails on a fresh vendor until
  `npm run format` has run once over it. Run it and commit in the same commit as the vendoring; a
  later skill update reruns the pair.

**`e2e/` is scanned because `--dir .` is passed.** Autodetection picks `src/`, which puts `e2e/` in the
script's own "not scanned" list — and the `.spec.*` ban applies at every level, E2E included. Measured:
with the default root an `e2e/sign-in.spec.ts` reports 0 violations; with `--dir .` it reports the
rename. `node_modules`, `dist`, `coverage`, `public` and `.claude` are skipped by the script, so the
wider root costs nothing.

**A fresh Vite `react-ts` scaffold fails the structure gate on two counts**, both real: `App.tsx` and
`App.css` are PascalCase (rule 1), and `.counter` is declared at column 0 in both `src/app.css` and
`src/index.css` (rule 5) — two declarations that merge by load order, so editing one does nothing.
Rename the files and delete the dead declaration in the setup commit, alongside the `npm run lint:fix`
that `init-greenfield.mjs` already asks for.

**A fresh scaffold's first CI run goes red at the coverage step, and that is the intended state.**
`vitest run` exits **1** on a repo with no test files — measured on vitest 4.1.10: bare `vitest run`
exits 1 with `No test files found, exiting with code 1`, and both `--pass-with-no-tests` and
`--passWithNoTests` exit 0. The Vite `react-ts` scaffold ships zero tests, so `npm run test:coverage`
fails until the first test exists.

**The escape hatch is deliberately not taken on the unit path.** `passWithNoTests` would make the
coverage gate green on a repo with no tests — a check that reports success while asserting nothing,
which is the single failure mode this workflow is built against. A React repo with zero unit tests
should not have a green pipeline, so writing the first test is setup-commit work exactly like the two
structure failures above.

This is why the unit and E2E paths differ, and the asymmetry is the decision rather than an
inconsistency: E2E ships **no CI job at all**, so nothing there reports green — `--pass-with-no-tests`
only keeps the local script usable before the first journey exists. The unit path ships a live gate, so
it must be able to fail.

**No E2E job ships, and that is a recorded decision rather than an oversight.** `playwright.config.ts`
and `e2e/` ship so the first spec has somewhere to land, but both `test:e2e` scripts pass
`--pass-with-no-tests` — so a CI job wired to them on a repo with zero specs is a green check that
asserts nothing, while its `webServer` pays for a full production build on every PR. The job arrives
with the first spec, and it runs `test:e2e:smoke`: the smoke set gates a PR, the full set runs on merge
to the default branch. Until then `test:e2e:smoke` has no caller, which is stated here so it is not
mistaken for a gate.

**Branch naming is asserted from `github.head_ref`.** It was the one rule in the standard with neither
a mechanism nor a recorded decision to leave it unenforced; commitlint next door gates the commit
messages and nothing gated the branch. `head_ref` is the PR's source branch, and it is the only
correct source: `actions/checkout` on a `pull_request` leaves a detached HEAD at the merge commit, so
`git rev-parse --abbrev-ref HEAD` prints `HEAD` and `github.ref` is `refs/pull/<n>/merge`. The job is
gated `if: github.event_name == 'pull_request'` because a push carries no `head_ref`.

The whole pattern lives in one `env: BRANCH_NAME_PATTERN`, so a repo on a different tracker edits one
line instead of workflow logic — `AB-1420` is this standard's example, not a universal shape. The type
set is character-for-character the commit types in `eq-frontend-workflow`; a different set there and
the branch prefix stops matching the commit prefix. The failure message names the expected shape, the
pattern in force, and the rename commands, because a gate whose message does not say how to comply
gets bypassed instead of satisfied.

`head_ref` is read through `env:` and never interpolated into the `run:` body. A branch name is
attacker-controlled text on a fork PR and `${{ … }}` inside `run:` is textual substitution, so a
crafted name would execute. Verified: `feat/AB-1420-a;rm -rf x` exits 1 and creates nothing.

| Branch | Result |
|---|---|
| `feat/AB-1420-inline-citations` | pass |
| `chore/AB-1601-bump-vite` | pass |
| `fix/AB-1533-stale-composer-focus` | pass |
| `main` | fail — no type, no ticket |
| `feature/AB-1-x` | fail — `feature` is not a commit type |
| `feat/inline-citations` | fail — no ticket |
| `feat/AB-1420-Inline-Citations` | fail — slug is not kebab-case |
| `feat/AB-1420` | fail — no slug |
| empty `head_ref` | fail — the name is unknown, so nothing was checked |

### `.github/workflows/release.yml`

The release row of the §1 table. Three pieces ship in the starter and `init-greenfield.mjs` lands all
three: `.changeset/config.json`, the `changeset` / `version` / `release` scripts, and this workflow.

**Read this before your first release, because two failures are waiting there and both were hit for
real.** Neither appears on an ordinary push: the release job only versions when a changeset is pending,
so a repo can run this workflow green several times and still meet both on the day it first releases.

| The failure | What you see | Fix |
|---|---|---|
| The action's commit is not conventional | `Version Packages` → `✖ type may not be empty`, `husky - commit-msg script failed`, job fails at `git commit` **after** rewriting `package.json` and `CHANGELOG.md` | Already fixed in the shipped workflow: `commit:` and `title:` are both `chore: version packages`. Do not remove them. |
| Actions may not create PRs | `HttpError: GitHub Actions is not permitted to create or approve pull requests` — **the version PR is never created, and the job fails at the very last step, after having already committed and pushed `changeset-release/<branch>`** | Enable "Allow GitHub Actions to create and approve pull requests", **or** add a `RELEASE_TOKEN` secret (fine-grained PAT, this repo only, `contents: write` + `pull-requests: write`, with an expiry) |

The second one is the one that will cost a consumer an afternoon, because the job's own log looks like it
worked right up to the final line, and the pushed branch is sitting there correct. That setting is
frequently enforced **org-wide**, in which case the repo cannot turn it on and the PAT is the only route.
The shipped workflow already reads `${{ secrets.RELEASE_TOKEN || secrets.GITHUB_TOKEN }}`, so adding the
secret is the whole fix and no workflow edit is needed.

**If you hit it before adding the secret, you have not lost the release.** The version branch is already
pushed and correct — open that PR by hand and merge it, and the tag phase runs normally. `eq-frontend-workflow`'s
`references/release-tooling.md` has the full account, including why hand-rolling the version phase to
avoid the token was rejected.

```json
// .changeset/config.json
{
    "$schema": "https://unpkg.com/@changesets/config@3.1.4/schema.json",
    "changelog": "@changesets/cli/changelog",
    "commit": false,
    "access": "restricted",
    "baseBranch": "main",
    "privatePackages": {
        "version": true,
        "tag": true
    }
}
```

```json
// package.json
"scripts": {
    "changeset": "changeset",
    "version": "changeset version",
    "release": "changeset tag"
},
"devDependencies": { "@changesets/cli": "^2.31.1" }
```

```yaml
name: Release

on:
  push:
    branches: [main]

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: false

permissions:
  contents: write
  pull-requests: write

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: actions/setup-node@v4
        with:
          node-version-file: .nvmrc
          cache: npm

      - run: npm ci

      - name: Assert private-package tagging is enabled
        run: |
          set -euo pipefail
          node -e '
            const config = require("./.changeset/config.json");
            if (config.privatePackages?.tag !== true) {
              console.error(`privatePackages.tag is ${JSON.stringify(config.privatePackages?.tag)}, not true`);
              process.exit(1);
            }
          ' || {
            echo "::error::.changeset/config.json does not set privatePackages.tag to true. This repo is private, so \`changeset tag\` would filter it out, tag nothing, and exit 0 — a green release that released nothing."
            exit 1
          }
          echo "privatePackages.tag is true, so a version bump produces a tag."

      - uses: changesets/action@v1.9.0
        with:
          version: npm run version
          publish: npm run release
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

- **There is no npm publish step, and `privatePackages.tag: true` is what makes the job do anything.**
  A consumer repo is a private application: a release here is a version bump, a regenerated
  `CHANGELOG.md`, and a `v<version>` tag. Changesets defaults a private package to
  `{ version: true, tag: false }`, and with `tag: false` `changeset tag` filters the package out,
  creates no tag, prints nothing and exits 0 — so `changesets/action`, which decides what to push by
  parsing `New tag:` out of that command's stdout, pushes nothing either. Measured on a scaffolded
  consumer repo: with `tag: true`, `npm run release` prints `New tag: v0.1.0` and `git tag` lists it;
  with the key removed, the same command prints nothing, `git tag` is empty, and both runs exit 0.
  That is why the assert step exists and why `init-greenfield.mjs` exits 2 on a pre-existing
  changesets config that leaves the key unset.
- Two phases, and an ordinary push releases nothing. With changesets pending the action opens or
  updates the "Version Packages" PR carrying the bump and the changelog entry; with none pending —
  the state a merge of that PR produces — `publish` runs and tags the new version.
- `fetch-depth: 0` is required: `changeset tag` decides what to tag by reading the tags that already
  exist, and a shallow clone has none to compare against.
- `cancel-in-progress: false`, the opposite of `ci.yml`. Cancelling a run between `changeset version`
  and `changeset tag` leaves a bumped version with no tag, which the next run cannot detect.
- `baseBranch` must name the branch `on: push:` gates in both workflows. Changesets diffs against it
  to find changed packages.
- The default changelog generator needs no configuration. Swap it for
  `["@changesets/changelog-github", { "repo": "your-org/your-repo" }]` — and add that package — to get
  entries that link back to their PR and author.
- `scripts.version` and `scripts.release` are the workflow's two inputs, so whatever sits under those
  names is what a merge to the default branch executes. `init-greenfield.mjs` exits 2 rather than let
  a repo's own `release` script — `npm publish`, a deploy — be run by the workflow it just installed.

### `CHANGELOG.md` is a build output, and the starter ships no copy of it

The file appears at the **first release**, written by `changeset version`. A new repo has no releases,
so there is nothing to put in one; a hand-written placeholder would be the first version of a file
whose whole contract is that it is generated. What the standard requires of a new repo is the
mechanism — `.changeset/config.json`, the three scripts, and `release.yml` — plus the rule that the
generated file is never hand-edited. An edit to `CHANGELOG.md` is overwritten by the next
`changeset version`; the text belongs in a `.changeset/*.md` file, which is where the generator reads
it from.

Authoring one, per change that users can observe:

```bash
npx changeset            # writes .changeset/<name>.md — commit it with the change
```

## 7. Node pinning

Four declarations must agree; when they drift, CI passes and a developer's machine does not.

| Where | Value | Read by |
|---|---|---|
| `.nvmrc` | `24` | `nvm use`, `fnm`, CI's `node-version-file` |
| `engines.node` | `">=24 <25"` | `npm ci` (warn; `error` with `engine-strict=true` in `.npmrc`) |
| `packageManager` | `"npm@11.5.1"` | Corepack — pins the package manager, not just Node |
| CI | `node-version-file: .nvmrc` | never a hardcoded `node-version:` |

**`packageManager` must name the npm version the pinned Node line actually bundles.** Node 24 ships
npm 11.x (24.0.0 → 11.3.0, 24.7.0 → 11.5.1); npm 10.9.0 is Node 22.11.0's. Pinning `.nvmrc` to 24 and
`packageManager` to an npm 10 release makes Corepack install a package manager Node never shipped with
— the exact drift this section exists to prevent. Read the bundled version off the release notes for
the Node line, not off whatever the author's machine happened to have.

**`engines` must not admit a version the test suite cannot run on.** A permissive floor is a bug, not
flexibility: an older Node satisfying `>=20` can crash the test runner at startup on a missing
`node:util` export, producing a failure unrelated to the code under test. Set the floor to the lowest
version the suite is verified on, and make CI use that exact version via `.nvmrc`.

## 8. `.editorconfig`

Without it the editor inserts 2 spaces while the formatter emits 4, so every file arrives with a
reformat diff that hides the real change. It mirrors `.oxfmtrc.json` exactly.

```ini
root = true

[*]
charset = utf-8
end_of_line = lf
indent_style = space
indent_size = 4
insert_final_newline = true
trim_trailing_whitespace = true
max_line_length = 200
quote_type = single

[*.{yml,yaml}]
indent_size = 2

[*.md]
trim_trailing_whitespace = false
```

`indent_size` matches oxfmt's `tabWidth: 4`, `quote_type` matches `singleQuote: true`, and
`max_line_length` matches `printWidth: 200`. That last pair is the one to read carefully: `printWidth`
is a wrap target, not a bound, so oxfmt will emit a line past 200 columns when there is nothing in it to
break, and the editor guide is then stricter than the formatter. No lint rule backs it — `max-len` has
no oxlint equivalent and the standard dropped it. YAML overrides to 2 because most YAML tooling assumes
it; Markdown keeps trailing whitespace because two trailing spaces is a hard line break.

## 9. Files every repo needs

| File | Why it exists |
|---|---|
| `.editorconfig` | editor agrees with the linter before the first save |
| `.nvmrc` | one Node version for humans and CI |
| `.gitattributes` | `* text=auto eol=lf` stops CRLF diffs from Windows clones; mark lockfiles `-diff linguist-generated` |
| `CODEOWNERS` | review requests route automatically; a directory with no owner gets no review |
| `.github/pull_request_template.md` | forces a "how this was verified" line, so an unverified claim is visible |
| `renovate.json` | dependency updates from a shared org preset |
| `.env.example` | every variable the app reads, with dummy values |
| `.claude/` | the shared agent config — settings, hooks, reviewer agents, commands, vendored skills |
| `vitest.config.ts` | the coverage ratchet has nowhere to write its floors without a real config file |
| `playwright.config.ts` | `testDir`, `forbidOnly` in CI, and a `webServer` on the production build |
| `e2e/` | the one directory E2E specs live in; ships with a `.gitkeep` so the path exists on day one |

**`.claude/` is repo policy, and it is committed.** The tree ships in `starter/.claude/` and
`init-greenfield.mjs` lands it — settings, two hooks, the `code-reviewer` and `conventions-reviewer`
agents that make the two-review gate runnable, and `commands/pre-pr.md`. Read those files for what
each does. Two things a hand-copy forgets: `.claude/hooks/*` is chmod `0o755`, because a hook that
is not executable does not run and reports nothing; and `--vendor-skills` copies the skills into
`.claude/skills/` as **real files**, so the version in `.eq-frontend-skills.json` describes something
a clone actually has.

**Renovate over Dependabot when an org has many repos.** Dependabot config is per-repo, so a policy
change means editing every repository. Renovate reads one shared preset — `renovate.json` is
`{ "extends": ["local>your-org/renovate-config"] }` — so grouping, schedule and automerge rules change in one PR.

**Secrets are never committed** — no `.env`, no real values in `*.example`, no tokens in CI YAML (use
repository or org secrets). Validate environment variables with a `zod` schema at startup and throw on
failure, so a missing variable fails at boot naming the variable instead of surfacing as `undefined` in
a URL, a request to `https://undefined/api`, and a 404 nobody can trace.

## 10. What must never be gitignored

**The directory holding shared agent skills, rules, and hook config** — `.claude/`, `.cursor/`, or the
equivalent. Ignoring it is the most common way a standard silently becomes one developer's local setup:
it works for the author, every teammate gets an empty clone with no hooks and no skills, and the repo
looks compliant while nothing is enforced. Commit **all of it**, skills included; ignore only personal files:

```gitignore
.claude/settings.local.json
.claude/*.local.*
.agents
skills-lock.json
```

The rest of `starter/.gitignore.fragment` is test-run output — `coverage`, `test-results`,
`playwright-report`, `blob-report`, `playwright/.cache`, `oxlint-report.json` — which is the opposite
case and must be ignored. oxfmt honours `.gitignore` (measured: a gitignored `dist/` is never visited),
so an unignored generated report makes `format:check` fail on a machine-written file. A committed
`coverage/` is worse than noise: it is a floor nobody measured sitting next to the ratchet that reads it.

`.claude/skills` is **not** on that list, and its absence is the decision: skills are vendored as real
copied files by `init-greenfield.mjs --vendor-skills`, so the standard a clone gets is the one
`.eq-frontend-skills.json` records. **Never commit the symlink form.** `npx skills add` creates
`.claude/skills` as a symlink into `~/.agents/skills` — correct for a *personal* install. Git stores a
symlink as its target path, so committing it gives every teammate a link to a directory on one machine:
resolves for the author, dangling for everyone else. Vendor, or ignore; never commit the link. `.agents`
and `skills-lock.json` are that personal install's own artifacts and stay ignored.

Same for `.husky/` — commit it, or `prepare` installs nothing on a fresh clone and the hooks exist only
where they were written.

## Installing these skills changes what your linter sees

Skill folders — `.agents/skills/` from a personal install, `.claude/skills/` once vendored — hold the
skills' own Node scripts. An `ignorePatterns` list that does not exclude them lints those scripts as if
they were your source. Measured by running the starter's base config against a vendored copy of this
skill with those two entries deleted: **108 findings across 6 files** — 91 `no-console`, 15
`no-nested-ternary`, one `no-unused-vars`, one `prefer-const` — none of them about the repo's own code,
and every one of them looking like a rule the team just enabled breaking the build. With the entries
present the same run reports `No files found to lint`. Vendoring makes that permanent rather than local
to one machine, so these entries are mandatory, not a measurement-time workaround:

```json
"ignorePatterns": ["dist", "build", "coverage", ".agents", ".claude/skills"]
```

`.claude/skills` and not `.claude` — the rest of the tree is small, hand-written, and worth linting.
Lint-ignored and git-ignored point opposite ways here: `.claude/skills` is **excluded from linting
and committed to git** (§10). Missing that distinction is what produces the 108-finding jump.
