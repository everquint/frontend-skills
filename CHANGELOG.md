# frontend-skills

## 1.2.2

### Patch Changes

- [#14](https://github.com/everquint/frontend-skills/pull/14) [`d21d43a`](https://github.com/everquint/frontend-skills/commit/d21d43a7afaed25b05601a4a75f6f595c92874eb) Thanks [@gokulsgr](https://github.com/gokulsgr)! - Two findings from the first repo to complete the v1.2.0 migration:

  - **The existing-repo procedure never installed `.claude/`** — greenfield repos got the settings,
    the guard and lint-fix hooks, both reviewer agents and `pre-pr` from `init-greenfield.mjs`;
    migrated repos got nothing and were told nothing, so the repos most exposed to agent edits ran
    without `guard-protected-files.sh`. The procedure gains an explicit install step (with the
    `chmod 755` stated — a hook without the executable bit looks wired and never runs), `hygiene.md`
    gains the commands, and `standard-check.mjs` now asserts all six files plus the hooks' executable
    bit in both `--check` and `--record`, so a repo without the guard no longer records or reports as
    compliant.
  - **A wide `printWidth` deflates `max-lines`** — packing code at 200 columns lowered line counts,
    so files over the 500-line budget dipped under it at 200 and returned at 120. §1 now states the
    coupling (never widen the formatter to pass the size budget) and the 1.2.0 migration entry warns
    that `max-lines` findings surfacing from the rewrap are pre-existing debt, not reformat damage.

## 1.2.1

### Patch Changes

- [#12](https://github.com/everquint/frontend-skills/pull/12) [`506bb4b`](https://github.com/everquint/frontend-skills/commit/506bb4bcdd75eea4c43579cc277fffee2b75b7d8) Thanks [@gokulsgr](https://github.com/gokulsgr)! - ADR citations inside shipped skill files are now full GitHub URLs. `docs/adr/` does not ship with
  an installed skill, so `docs/adr/0007`-style references dangled for every consumer — found by the
  first migrated repo. The README's Updating section also documents the mid-release window: between a
  feature merge and its "Version Packages" PR, `main` carries new skill text with the previous
  version constant, so a copy installed from that window reports "up to date" at the old version;
  re-run `npx skills update -g` after the version PR lands.

## 1.2.0

### Minor Changes

- [#10](https://github.com/everquint/frontend-skills/pull/10) [`bf55062`](https://github.com/everquint/frontend-skills/commit/bf55062741ba6bc9fb668acd5c6e73ba742426eb) Thanks [@gokulsgr](https://github.com/gokulsgr)! - `printWidth` moves from 200 to 120, and the change is a decision this time (`docs/adr/0007`), not a
  ceiling carried forward. The 200 was the old `max-len` limit kept for migration continuity — but
  `max-len` only flagged long lines, while oxfmt actively joins short ones, so adopting the standard
  rewrote hand-wrapped code up to 200 and produced lines unreadable in a side-by-side diff. 120 is the
  top of the common industry band (Prettier 80, Airbnb/rustfmt/kernel 100, common React/TS overrides
  100–120), chosen over 100 because the standard's 4-space indent burns columns faster than the
  2-space indent most narrower guides assume.

  Adopting repos: set `printWidth: 120` in `.oxfmtrc.json` and `max_line_length = 120` in
  `.editorconfig`, re-run `npm run format`, commit the rewrap as its own mechanical commit listed in
  `.git-blame-ignore-revs` — the 1.2.0 migration entry names the steps. The past-width case no
  mechanical check reaches at any width — a Tailwind class string longer than the line — now has a
  stated convention: extract to a named module-level constant or `cva` map (`references/styling.md`
  §1).

### Patch Changes

- [#9](https://github.com/everquint/frontend-skills/pull/9) [`d62ce60`](https://github.com/everquint/frontend-skills/commit/d62ce60d0364940d6b75b50b8aba638c75a3f877) Thanks [@gokulsgr](https://github.com/gokulsgr)! - The starter ships `.vscode/extensions.json` and `.vscode/settings.json`, with `.gitignore` rules
  that commit exactly those two and ignore the rest of `.vscode/*`. extensions.json recommends
  `oxc.oxc-vscode` and `editorconfig.editorconfig` (Cursor does not read `.editorconfig` without it)
  and marks the three Prettier extensions unwanted for the workspace — all three format to double
  quotes at printWidth 80, against `.oxfmtrc.json`'s single quotes at 200, so a save under Prettier
  fails `format:check` on every file. settings.json is what actually routes ts/tsx saves to oxfmt:
  per-language `editor.defaultFormatter` blocks with `formatOnSave`, per-language because a
  workspace-level default loses to a user-level `[language]` block. Pointing the editor's oxc language
  server at the strict config (`oxc.configPath` / `oxc.typeAware`) stays a commented per-machine
  opt-in, since type-aware analysis per keystroke is a cost judgement by repo size, not repo policy.

- [#10](https://github.com/everquint/frontend-skills/pull/10) [`369bf4e`](https://github.com/everquint/frontend-skills/commit/369bf4ed12300b917fabe005f90eb9a9d45a3d6f) Thanks [@gokulsgr](https://github.com/gokulsgr)! - `measure-rules.mjs` now treats a `tsconfig-error` diagnostic as fatal (exit 2) instead of one
  finding among many. oxlint-tsgolint rejects a whole project over a tsconfig it cannot load —
  `baseUrl`, removed in TypeScript 6.0, is the common cause — and then silently skips all three
  type-aware rules, so `typescript/no-floating-promises` measured zero on the first migrated repo
  while 48 real unhandled-promise sites existed, and the script listed a correctness rule in the
  "zero violations — enable for free" set. A false zero on a correctness rule is the one output the
  script must never print, so it now refuses to report counts at all until the tsconfig loads.

- [#7](https://github.com/everquint/frontend-skills/pull/7) [`15a7afa`](https://github.com/everquint/frontend-skills/commit/15a7afabb1bcb0baffd121aea387eb1d20ae88fe) Thanks [@gokulsgr](https://github.com/gokulsgr)! - Two greenfield-adoption defects, both found by the first consumer repo:

  - `starter/vitest.config.ts` failed `tsc -b` on every fresh adoption (TS2349) — narrowing on
    `typeof viteConfig === 'function'` leaves a union of vite's three function-config signatures,
    which TypeScript cannot call. The call now passes through a parameter typed as the widest of the
    three (`UserConfigFn`), a sound widening rather than a cast. Repos migrated on 1.1.1 already
    copied the broken file; the 1.1.2 migration step in `standard-check.mjs` says to re-pull it.
  - `init-greenfield.mjs --vendor-skills` treated an existing but **empty** `.claude/skills/<name>/`
    directory as already vendored, reporting success while vendoring nothing — after which CI's
    structure gate resolved the husk first and died on `MODULE_NOT_FOUND`. Vendored is now a statement
    about content (`SKILL.md`, plus `scripts/check-structure.mjs` for the standard itself), and the
    copy fills husks and partial copies without overwriting any existing file.

- [#8](https://github.com/everquint/frontend-skills/pull/8) [`f0b80c9`](https://github.com/everquint/frontend-skills/commit/f0b80c99d46bb299d188ffdf7dd7781b5bd6142c) Thanks [@gokulsgr](https://github.com/gokulsgr)! - The remaining three defects from the first consumer repo's adoption report:

  - `starter/src/test/setup.ts` now registers `afterEach(cleanup)`. With `test.globals` off —
    deliberate in this standard — @testing-library/react cannot auto-register its teardown, so a
    second `render()` in one file left the first tree mounted and every `getByRole` threw
    "found multiple elements", reading as a broken assertion rather than a missing teardown.
  - `format`, `format:check`, `lint:fix` and both `lint-staged` commands now exclude
    `.claude/skills/**` and `.agents/**`. oxfmt honours `.gitignore` but the vendored skills are
    deliberately committed, so the first commit reformatted all vendored files — after which the
    vendored copy still passed the vendor sentinel while no longer being byte-identical to the
    standard the version marker records. The vendored tree is now read, never written, matching the
    lint gate's existing treatment.
  - `init-greenfield.mjs` now verifies a pre-existing `tsconfig.app.json` / `tsconfig.node.json`
    sets `strict`, `noUncheckedIndexedAccess` and `noImplicitOverride` to `true` (exit 2 with the fix
    named, like the lint-config gate). A kept leaf config without `strict` passed every gate while
    `undefined` flowed through the app unchecked. The ratchet path is respected: with
    `noUncheckedIndexedAccess` live in `tsconfig.strict.json`, its absence from a leaf is the
    documented migration, not a gap.

  The 1.1.2 migration steps cover repos that adopted on 1.1.1, including restoring an
  already-reformatted vendored tree.

## 1.1.1

### Patch Changes

- [#5](https://github.com/everquint/frontend-skills/pull/5) [`1e88b6e`](https://github.com/everquint/frontend-skills/commit/1e88b6ea88f23e64f11fb396eae5dd5b71c6f500) Thanks [@gokulsgr](https://github.com/gokulsgr)! - The release workflow now reads `${{ secrets.RELEASE_TOKEN || secrets.GITHUB_TOKEN }}`, so a repo whose org
  disables "Allow GitHub Actions to create and approve pull requests" can release by adding a fine-grained
  PAT rather than editing the workflow. `hygiene.md` §6 names both first-release failures — the
  non-conventional `Version Packages` commit and the refused PR creation — with the fix for each; ADR 0006
  records why a hand-rolled version phase was rejected.

## 1.1.0

### Minor Changes

- [#2](https://github.com/everquint/frontend-skills/pull/2) [`1badb0f`](https://github.com/everquint/frontend-skills/commit/1badb0fc406b52cfd7e393eee0db1384587f1aa0) Thanks [@gokulsgr](https://github.com/gokulsgr)! - `eq-frontend-workflow` now requires two lookups and a measurement before the first edit: search the
  registry before hand-rolling, read a library's docs at the pinned version (via a docs-retrieval tool
  such as Context7 when one is mounted, otherwise the installed package's own types), and probe the
  runtime rather than reasoning about it. Detail in `references/looking-it-up.md`; the changesets
  rationale moved to `references/release-tooling.md` to stay inside the SKILL.md budget.

  Starter: `tsconfig.node.json` now includes `vitest.config.ts` and `playwright.config.ts`, so a type
  error in the coverage gate's own config fails `tsc -b` instead of passing silently.

- [#2](https://github.com/everquint/frontend-skills/pull/2) [`60d60ee`](https://github.com/everquint/frontend-skills/commit/60d60ee49dadfaad137efb9ced8fd9a8e67fd28c) Thanks [@gokulsgr](https://github.com/gokulsgr)! - Close three enforcement gaps in the starter: the structure checker now has a CI caller (and fails
  rather than skips when the skill is not vendored), `vitest.config.ts` ships with an `autoUpdate`
  coverage ratchet wired to `test:coverage`, and a `branch-name` job gates `<type>/<ticket>-<slug>` on
  pull requests.

  Consumers on the starter: `scripts.lint` gains `--ignore-pattern .claude/skills`, because oxlint does
  not inherit `ignorePatterns` through `extends` and a vendored copy of the skill otherwise reports 124
  `no-console` errors against its own scripts.

- [#2](https://github.com/everquint/frontend-skills/pull/2) [`ce24054`](https://github.com/everquint/frontend-skills/commit/ce240545a840432f75b16c1677d0213fc27f2d19) Thanks [@gokulsgr](https://github.com/gokulsgr)! - Add `eq-create-issue` and `eq-take-issue` — writing a Linear issue both a PM and a dev can
  read, and turning one into an approved approach before any code is written.

## 1.0.0

### Major Changes

- [`92ea722`](https://github.com/everquint/frontend-skills/commit/92ea72205c00792db0b77a7f798588da74faf85c) Thanks [@gokulsgr](https://github.com/gokulsgr)! - Initial release: three skills — `frontend-standards`, `frontend-workflow`, `frontend-quality-bar` — plus `profile-repo`, `measure-rules` and `standard-check` scripts.

  Consumers migrating to v1.0.0 must run the steps listed in `standard-check.mjs`'s migration table, then record the version with `--record`.
