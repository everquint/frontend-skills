# Starter file rationale

The files under `starter/` ship into consumer repos and are read by app developers, so they carry
only a short header and the warnings that must be seen at edit time. The full reasoning — why each
value is what it is, and the measured failure modes behind the warnings — lives here, where the
standard's maintainers and reviewers read it. When a starter file's inline comment says "see
starter-rationale.md", this is the file.

Keep this file in sync with the starter: a section per file, updated in the same commit that
changes the file.

## .oxlintrc.json — the fast config

- oxlint's `correctness` category is the rough equivalent of eslint's `js.configs.recommended`
  plus the non-type-aware half of typescript-eslint's recommended set.
- `.agents` and `.claude/skills` are ignored because they hold installed agent skills, not source;
  linting them reports undefined globals against the skills' own Node scripts.
- eslint's `max-len` has NO oxlint equivalent. oxfmt's printWidth 120 is its only successor, and a
  formatter can only wrap — it cannot flag a single unbreakable token (a long URL, a base64
  literal) past column 120. That case is reviewer-only.
- `no-nested-ternary`: a nested ternary is the shape §1's render\* helper rule replaces.
  `no-unneeded-ternary` is deliberately absent — `a ? a : b` is rewritten by hand to `a ?? b`,
  which is a different value for `''`/`0`, so the rewrite is a judgement, not a fix.
- No function-length limit (`max-lines-per-function: off`): hooks, reducers and render\* helpers
  are legitimately long.
- `no-unused-vars`, `no-unused-expressions`, `no-array-constructor` are oxlint CORE rules (no
  prefix) that already arrive via `correctness`; pinned explicitly so a future category change
  cannot silently drop them.
- The 16 pinned rules (`no-case-declarations` … `typescript/no-unsafe-function-type`) were enabled
  by `js.configs.recommended` / `tseslint.configs.recommended` under ESLint, and oxlint has every
  one — but sorted into `suspicious`, `style` and `restriction` rather than `correctness`, so
  enabling only the `correctness` category silently drops all 16. `no-octal` was the 17th and is
  the ONE rule from those presets oxlint does not implement; TypeScript errors on legacy octal
  literals in modules, and review catches the rest.
- `react/button-has-type`: a `<button>` with no `type` defaults to `submit`; inside a form, a
  "Remove attachment" handler also submits — the page navigates and unsaved fields are lost. Not
  in `correctness`, so it must be named. See references/correctness-rules.md §18.
- `react/rules-of-hooks` + `react/exhaustive-deps`: oxlint's native Rust react-hooks holds exactly
  these two of the plugin's 29 rules, and they are the only hook coverage the fast loop has. The
  strict config switches them off and re-gates them through the real plugin, so a finding is never
  reported twice.
- `import/no-duplicates`: §6 duplication, the mechanical case — judgement-free, so it needs no
  reviewer. Its type-aware sibling `no-duplicate-type-constituents` is in the strict config.
- `import/no-cycle` (docs/adr/0012): the one import defect `tsc` does not catch — a cycle compiles
  and surfaces at runtime as an `undefined` binding dependent on load order. Not in any recommended
  preset (too slow under ESLint); oxlint's native version is cheap enough for the fast loop.
  Measured at zero violations on both adopted repos before enabling.
- a11y: the full recommended set of eslint-plugin-jsx-a11y — all 31 enabled rules exist in oxlint
  under the `jsx_a11y` prefix (underscore). The 3 that set ships off — `anchor-ambiguous-text`,
  `control-has-associated-label`, `label-has-for` — stay off here too.
- `react/react-in-jsx-scope: off`: React 17+ automatic JSX runtime. eslint's `react/prop-types`
  needed no replacement — prop types are TypeScript's job.
- Tests are exempt from `max-lines`: a long flat list of cases is the right shape.
- oxlint reads comments in `.json` config files — documented behaviour, not a hack.

## .oxlintrc.strict.json — the full gate

- WHY A SEPARATE FILE: oxlint has no CLI flag to disable JS plugins — `-A react-hooks-js` does not
  help (measured: 18.9s, and the plugin still counts in `number_of_rules`, because declaring
  `jsPlugins` at all pays the bridge cost). `extends` can add but never subtract, so the fast
  config must be the one WITHOUT `jsPlugins`, and the strict config extends it.
- The dev-loop speed win is roughly 30x and lives entirely in the base config; this full gate is
  within noise of the ESLint setup it replaced — nearly all of its time is the JS plugin bridge,
  not `--type-aware`. That is why the pre-commit hook runs `lint:fast` and CI runs `lint`. The
  measurement lives in references/hygiene.md — one copy, so the numbers cannot drift.
- `--type-aware` is mandatory: without it every `typescript/*` type-aware rule is skipped with
  exit 0, no warning, no diagnostic. CI asserts on `number_of_rules` from `-f json` so a dropped
  flag goes RED. Requires the `oxlint-tsgolint` devDependency.
- The `react-hooks-js` alias: both `react-hooks` and `react_hooks` are RESERVED alias names —
  oxlint ships a native Rust react-hooks plugin and rejects them to avoid ambiguity. The alias is
  part of the standard: every rule name and every suppression comment in a consuming repo uses
  `react-hooks-js/...`, never `react-hooks/...`.
- The native `react/rules-of-hooks` + `react/exhaustive-deps` pair is off here because the real
  plugin re-gates both; leaving them on reports every hook finding twice.
- All 20 gated rules of eslint-plugin-react-hooks v7 include the 18 React Compiler rules oxlint
  has no native equivalent for. The plugin's other 9 rules stay OFF on purpose — `config`, `fbt`,
  `gating`, `incompatible-library`, `invariant`, `rule-suppression`, `syntax`, `todo`,
  `unsupported-syntax` report React Compiler limitations rather than defects; `todo` fires on
  ordinary try/finally.
- The 23 type-aware rules are the COMPLETE type-aware half of typescript-eslint's
  `recommended-type-checked` preset (docs/adr/0011). The standard started with three because
  oxlint-tsgolint covered a small subset; it now implements 59 of 61, so the remaining 20 were
  measured (14 at zero violations on a real adopted repo) and enabled together. All 23 are pinned
  by name even though the `correctness` category auto-loads some under `--type-aware` — an
  upstream category re-sort must not silently drop a rule the standard claims.
- `no-misused-promises` sets `checksVoidReturn.attributes: false`: an async handler on a
  void-returning JSX attribute is the ecosystem's normal shape.
- The config-file override turns the whole type-aware set off for `*.config.*`: those files run in
  Node and are not part of the app's type-checked project, so the rules misreport — measured,
  `vite.config.ts` flags an unsafe-`any` spread that is really a missing type project. The list is
  spelled out because oxlint overrides cannot subtract by category; keep it in lockstep with the
  rules block.

## .oxfmtrc.json

- Replaces the @stylistic ESLint rules the standard used to format with: 4-space indent
  (docs/adr/0013, an organizational ruling superseding 0009; YAML overridden to 2-space, which the
  whole YAML ecosystem assumes), single quotes (docs/adr/0010), semicolons, printWidth 120 (docs/adr/0007).
- printWidth is a DECIDED value, not the old `max-len` ceiling carried forward: `max-len` only
  FLAGGED long lines; oxfmt actively JOINS short ones, so a wide printWidth rewrites hand-wrapped
  code up to the limit. A past-width Tailwind class string is extracted to a named constant
  (references/styling.md §1, docs/adr/0008).
- oxlint holds no formatting rules, so the linter and formatter cannot disagree.
- `jsxSingleQuote: false`: JSX attributes keep double quotes — what React code looks like
  everywhere, and what the old @stylistic config produced (its `quotes` rule never applied to JSX
  attribute strings).
- `sortImports.groups` is set explicitly: the default group order is not a contract, and import
  grouping silently rewrites every file in the repo when an upstream default changes.
  `internalPattern` includes `@/` so alias imports group as internal rather than `unknown`.
- `sortTailwindcss`: Tailwind v4 keeps its theme in CSS, so the sorter must be pointed at the
  stylesheet holding `@import 'tailwindcss'`. If the path does not resolve it sorts NOTHING and
  exits 0 — a silent no-op. CI asserts sorting is live with a canary. `functions` lists the
  helpers whose arguments hold class strings; without them, classes inside `cn(...)` stay unsorted
  while bare `className` sorts, which reads as the sorter being broken.
- The stylesheet override exists because `singleQuote` also applies to CSS/SCSS/Less, where it
  rewrites `url("…")` and `@import "…"` — legal, but not what any stylesheet in the ecosystem
  looks like.

## vitest.config.ts — coverage, and where the gate actually is

- **The gate is diff coverage, not these floors.** `eq-frontend-quality-bar` SKILL.md explains why a
  global percentage cannot answer a per-change question. Enforcement is `diff-cover`, which fails a
  branch whose ADDED lines fall below 90%. The floors here are a backstop against wholesale regression
  only.
- **`coverage.thresholds.autoUpdate` is deliberately absent.** It rewrote the floors to whatever
  coverage happened to be, and a floor equal to achieved coverage silently demands ~100% of all new
  code — measured on a consumer repo, a change with one uncovered defensive branch out of 19 added
  lines was rejected on three metrics at once. It also rewrote them on a FAILED run, and rewrote them
  in the CI runner whose working tree is discarded.
- Floors start at 0 in a new repo, because there is nothing to protect yet and diff coverage guards new
  code from the first commit. Set them ONCE, to achieved rounded down minus 1, when a real suite
  exists; after that they move only when a human edits them.
- The `.ts` extension on `./vite.config.ts` is required: Vite's `configLoader: 'native'` warns on
  an extensionless relative import of a TS config and will not resolve it.
- VITEST LOADS THIS FILE INSTEAD OF vite.config.ts — it does not merge the two. `resolve.alias`
  and the Tailwind plugin must be merged in explicitly or every `@/…` import in every test breaks
  while typecheck, lint and build stay green (those three read tsconfig `paths` and the vite
  config directly).
- `callConfigFn`: narrowing on `typeof === 'function'` leaves a union of vite's THREE function
  config types, which TS cannot call (TS2349 — surfaces only once the file is inside a tsconfig
  `include`). `UserConfigFn` is the widest, so passing through a parameter of that type is a sound
  widening, NOT a cast — a cast would also suppress a genuinely wrong config shape. A Promise
  export still reaches `mergeConfig` and throws loudly.
- `coverage.include` must see the whole codebase: scoped to a slice it reports a flattering number.
  It is also the diff gate's exclusion list — a changed file absent from the report is skipped there —
  so narrowing it quietly removes files from the gate as well. Widen when source moves out of `src/`;
  never narrow to raise the percentage.
- `src/test/**` is excluded as test harness: counting it inflates the number with lines no
  production path runs.
- THE COVERAGE RUN MUST BE UNFILTERED, and that is now a correctness requirement rather than a
  preference. Coverage reports every file in `include`, including files no test imported, so a
  filtered run (`-t`, a path argument, `--changed`) marks whole modules uncovered and the diff gate
  then fails an innocent branch. This is also why the gate cannot be driven from `vitest related`.
- Reporters: `text-summary` is what a human reads in the job log; `json-summary` feeds a badge; and
  **`lcov` is required** — it writes `coverage/lcov.info`, which `diff-cover` reads. Without it the
  step fails on a missing file rather than passing silently.

## src/test/setup.ts

- The `/vitest` entry point matters: `@testing-library/jest-dom` on its own extends Jest's
  `expect`; importing that form under Vitest registers nothing and throws no error, so
  `toBeInTheDocument()` is undefined and the failure reads as a broken test.
- `afterEach(cleanup)`: @testing-library/react auto-unmounts only via a global `afterEach`, which
  it finds only when `test.globals` is true. This standard leaves globals off so tests import from
  'vitest' explicitly, so the hook is registered here. Without it a second `render()` in one file
  leaves the first tree mounted and `getByRole` throws "found multiple elements".
- MSW's server is NOT started in the starter: its handlers are repo-specific.

## tsconfig.json / tsconfig.app.json / tsconfig.node.json

- The root is solution-style: `files: []` + `references`, compiles nothing. A referenced project
  does not inherit the solution config's `compilerOptions`, so a checking flag set there is
  committed, visible in review, passes CI, and checks NOTHING. Measured: `noUncheckedIndexedAccess`
  in the root reported no error on an out-of-bounds read; the same flag in `tsconfig.app.json`
  reported TS18048. The `@/*` path alias is equally inert at the root. Verify with
  `tsc -p <leaf> --showConfig`, never by reading a file. See references/typescript-config.md.
- The leaf configs carry the SAME three checking flags; a flag added to one and not the other is
  silent drift (init-greenfield.mjs gates on this).
- `strict: true` is written explicitly because the default is version-dependent and has already
  changed once: measured false on TS 5.9.3 and true on 6.0.3. Relying on the default means a pin
  to TS 5.x or a hoisted older `typescript` turns strictness off with no error and a green
  pipeline.
- `noUncheckedIndexedAccess`: catches array/record reads that can be `undefined` — the last
  remaining path by which `undefined` reaches runtime with the compiler's approval. A gate from
  commit one in greenfield; an existing repo measures ~906 errors / 193 files, which is why
  `tsconfig.strict.json` exists as the migration artifact. Fix with a guard, `?.`, or a
  destructured default — never `as`, which reproduces the hole.
- `noImplicitOverride`: an error boundary declaring `componentDidCath` (one transposed letter) is
  a valid new method React never calls — the boundary renders its fallback but never reports.
  Measured cost on an existing repo: 4 errors / 2 files.
- `paths` (`@/*`) lives in the leaves for the same reason the flags do, and must stay in step with
  `resolve.alias` in vite.config.ts: tsc and Vite resolve independently, so an alias in only one
  type-checks and fails to bundle, or vice versa.
- tsconfig.node.json is deliberately NOT unified with the app config: Node loads config files
  directly, and widening the app config to `types: ["node"]` would let `process.env` and `Buffer`
  type-check in browser code, where both are undefined. Its `include` lists every build-time
  config — a gate config in no project is read by no `tsc -b`, so a type error there surfaces as a
  confusing runtime failure instead of a build error.

## tsconfig.strict.json — the migration artifact

- For an EXISTING repo adopting the standard; not a second gate. Exactly one of the two spellings
  of `noUncheckedIndexedAccess` is live in any repo: greenfield has it in `tsconfig.app.json` and
  this file is a 0-error no-op (delete nothing); a migrating repo removes it from the app config,
  leaves it here, and drives the count down under the `typecheck-strict-ratchet` CI job. At 0 the
  flag moves into the app config and this file, its baseline and the job are deleted together.
- It IS a leaf config (inherits `include` through `extends`), deliberately absent from the root's
  `references` so `tsc -b` never picks it up; run explicitly with `tsc -p tsconfig.strict.json
  --noEmit`.
- Its own `tsBuildInfoFile`: sharing the app config's would let a ratchet run and a `typecheck`
  run invalidate each other's cache under a different flag set.

## .vscode/settings.json and extensions.json

- Both committed on purpose: `.gitignore` ignores `.vscode/*` EXCEPT these two.
- Per-LANGUAGE formatter blocks, not a workspace-level `editor.defaultFormatter`: a user-level
  `[typescript]` block outranks a workspace-level default, so a Prettier user's personal config
  would win and their saves would emit double quotes at printWidth 80, failing `format:check` on
  every file. A workspace `[language]` block is the highest-precedence spelling available.
- `formatOnSave` lives INSIDE the blocks: at the top level it would fire on json/css/md, where the
  user's default formatter (often Prettier) takes the file. Those types are formatted at commit by
  lint-staged.
- `files.associations` maps `.oxlintrc*.json`/`.oxfmtrc.json` to JSONC: their comments are
  documented oxc behaviour, and VS Code's strict-JSON validation otherwise flags every one.
- `oxc.configPath` is deliberately NOT set: the LSP reads the fast config, so type-aware and
  react-hooks-js findings surface at `npm run lint` and CI, not per keystroke. Pointing the editor
  at the strict config costs type-aware analysis on every edit — a per-machine judgement by repo
  size, not repo policy. Opt in with `"oxc.configPath": ".oxlintrc.strict.json", "oxc.typeAware":
  true`.
- extensions.json only recommends (the editor prompts, never installs).
  `editorconfig.editorconfig` is listed because Cursor does not read `.editorconfig` without it —
  the editor would emit its own indent before oxfmt ever sees the file. The three Prettier
  extensions are `unwantedRecommendations` because all three format to Prettier's defaults (double
  quotes, width 80), contradicting `.oxfmtrc.json`; the marking stops the prompt re-adding them
  for this workspace while they stay active in other repos. settings.json is what actually takes
  ts/tsx away from them.

## playwright.config.ts

- Every value is `eq-frontend-quality-bar` references/e2e.md §2's; the reasoning lives there.
- `baseURL` and `webServer` are the two values a real app revisits. `webServer` runs the
  PRODUCTION BUILD, never the dev server: a dev server resolves modules differently, skips
  minification and production env substitution, so a build-only failure escapes the suite.
- Specs are `<journey>.test.ts`: Playwright's default testMatch collects `.test.ts`, so the
  repo-wide `.spec.*` ban costs no config.
- `workers` pinned in CI: the default scales to core count, and an oversubscribed 2-core runner
  produces timeouts that read as product flakiness. `forbidOnly` in CI: a `test.only` otherwise
  silently reduces the suite to one green spec. Retries in CI only: a local retry hides a flake
  from the person who just wrote it. `testIdAttribute` set explicitly: defaulted, half a team
  writes `data-test-id` and gets silent misses.

## commitlint.config.mjs

- Named `.mjs` because the file uses `export default` and commitlint loads a `.js` config as
  CommonJS unless package.json declares `"type": "module"`.

## docs/product/ and docs/features/ — the product knowledge templates

- Split by question, not by tool: `docs/features/` answers "does this exist / what does it do"
  (the directory is the index — no inventory table to rot, no generator to run, docs/adr/0015),
  `constraints.md` answers "is this feasible", `current-focus.md` answers "does this fit now".
  INDEX.md exists purely as the router, so an agent loads only the file its task routes to.
- The templates ship as placeholders (`<capability>`, `<constraint>`) rather than examples: an
  example entry survives seeding and reads as a real capability to the next agent. Placeholders
  carry angle brackets on purpose — check-structure.mjs rule 7's path regex excludes them, so an
  unseeded template reports nothing.
- `NOT SUPPORTED:` is a named line format in constraints.md because deliberate absence is the one
  fact no codebase states; the format makes it greppable and its omission visible in review.
- current-focus.md carries a visible `Updated:` stamp instead of a freshness gate: priorities
  churn on a planning cadence no script knows, so the reader judges staleness — every other
  freshness property is machine-enforced (SKILL.md §8, references/product-knowledge.md).
- .claude/commands/doc-lint.md is a prompt, not a script, on purpose: stale CLAIMS need judgement
  against the code; the mechanical subset (cited paths exist) already runs in CI as rule 7.
- Full design and evidence: docs/adr/0014 and 0015 in the standard repo.
