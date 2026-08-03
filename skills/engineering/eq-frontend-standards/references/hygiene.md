# Repo hygiene — hooks, CI, and pinning

The concrete wiring behind `SKILL.md` §4. Copy-pasteable; adjust only the script names.

## 1. The principle

**Every local hook has a CI counterpart.** A hook is a courtesy to the author — `--no-verify` bypasses
it and CI never learns it was skipped. A hook with no CI equivalent is decoration; a repo with hooks
and no CI has no gate at all.

| | Local (fast, bypassable) | CI (authoritative) |
|---|---|---|
| staged lint | `pre-commit` → `lint-staged` | `npm run lint` (whole repo) |
| types | `pre-push` → `tsc -b --force` | `npm run typecheck` |
| commit message | `commit-msg` → `commitlint` | `wagoid/commitlint-github-action` |
| tests, build | — (too slow to gate a commit) | `npm test`, `npm run build` |

Local hooks shorten the feedback loop. Branch protection requiring the CI job is the gate.

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

The scripts they call, in `package.json`: `"prepare": "husky"`, `"typecheck": "tsc -b --force"`,
`"lint": "eslint ."`, `"lint:fix": "eslint . --fix"`. `commitlint.config.js` is one line —
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

In `package.json`: `"lint-staged": { "*.{ts,tsx,js,jsx}": "eslint --fix" }`. Two flags to never use:

| Flag | Why not |
|---|---|
| `--fail-on-changes` | fails the commit whenever a task rewrote a file — the normal case when `eslint --fix` is the task, so the hook fires on successful runs and teams respond by disabling it. No data-loss path; the objection is that it makes the gate useless. |
| `--no-stash` | removes the backup stash, the only thing that restores your work when a task corrupts the working tree mid-run. **This is the data-loss flag**: with it there is nothing to recover from. |

If a run is interrupted, recover from `git stash list`; lint-staged leaves its backup stash behind on
failure.

## 6. CI workflow

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
      - run: npm test
      - run: npm run build

  commit-messages:
    runs-on: ubuntu-latest
    if: github.event_name == 'pull_request'
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: wagoid/commitlint-github-action@v6
```

- Step order is cheapest-first: types fail in seconds, build takes minutes.
- `npm ci` not `npm install` — `ci` fails on a lockfile that disagrees with `package.json` instead of
  quietly rewriting it.
- `fetch-depth: 0` on the commitlint job; it needs history to find the PR's commit range.
- `cancel-in-progress` kills superseded runs; without it a branch pushed three times runs three
  pipelines and the first two results are noise.
- Mark `verify` required in branch protection. A workflow that is not required is a report, not a gate.

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

Without it the editor inserts 2 spaces while the lint rule demands 4, so the linter fights the author
on the first keystroke and every file arrives with a reformat diff. It mirrors the lint config exactly.

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

`indent_size` matches `@stylistic/indent: 4`, `quote_type` matches `quotes: single`, `max_line_length`
matches `max-len: 200`. YAML overrides to 2 because most YAML tooling assumes it; Markdown keeps
trailing whitespace because two trailing spaces is a hard line break.

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

**Renovate over Dependabot when an org has many repos.** Dependabot config is per-repo, so a policy
change means editing every repository. Renovate reads one shared preset — `renovate.json` is
`{ "extends": ["local>your-org/renovate-config"] }` — so grouping, schedule, and automerge rules change
in a single PR.

**Secrets are never committed** — no `.env`, no real values in `*.example`, no tokens in CI YAML (use
repository or org secrets). Validate environment variables with a `zod` schema at startup and throw on
failure. A missing variable then fails at boot naming the variable, instead of surfacing as `undefined`
in a URL, a request to `https://undefined/api`, and a 404 nobody can trace.

## 10. What must never be gitignored

**The directory holding shared agent skills, rules, and hook config** — `.claude/`, `.cursor/`, or the
equivalent. Ignoring it is the most common way a standard silently becomes one developer's local
setup: it works for the author, every teammate gets an empty clone with no hooks and no skills, and the
repo looks compliant while nothing is enforced. Commit skills, rules, agent definitions, hook scripts,
and the shared settings file; ignore only genuinely personal files:

```gitignore
.claude/settings.local.json
.claude/*.local.*
```

Same for `.husky/` — commit it, or `prepare` installs nothing on a fresh clone and the hooks exist only
where they were written.

## Installing these skills changes what your linter sees

`npx skills add` writes the skill folders into the repo — `.agents/skills/` and `.claude/skills/`
— and those folders contain the skills' own Node scripts. A flat-config `ignores` list that does not
exclude them will lint those scripts as if they were your source.

Measured on a real repo: installing produced **90 spurious `no-undef` errors** against the skills'
`.mjs` files, taking a repo from 2 lint errors to 92 and making it look as though enabling new rules
had broken the build. Add both paths to the ignores list before running any measurement:

```js
{ ignores: ['node_modules', 'dist', '.agents', '.claude'] }
```

Then decide the `.gitignore` question deliberately. **Do not blanket-ignore `.claude`** — that is
where committed, shared agent config lives, and ignoring all of it means a teammate gets nothing on
clone and the standard silently applies to one machine only. Ignore the installed skill folders and
personal overrides; commit the rest:

```gitignore
.agents/
.claude/skills/
.claude/settings.local.json
skills-lock.json
```
