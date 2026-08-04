# Structure — layout, naming, and placement

`references/correctness-rules.md` closes by excluding file layout, naming, and where helpers live,
on the grounds that a repo which decides them differently is not broken. That exclusion is about
the **entry criterion for that file** — every rule there names a mechanical failure, and these do
not. It is not a licence to decide them per repo. Structure is decided once, here, and enforced
here. Where a rule below does have a failure scenario (§7), it gets one.

Run `scripts/check-structure.mjs` from the root of the repo being audited. It reports the
mechanical subset; the closing section says exactly which rules that is. It exits **0** clean, **1**
violations found, and **2** the scan could not be trusted — a bad argument, an unreadable directory,
or zero source files examined.

Exit 2 exists because a gate whose failure modes are indistinguishable from success is worse than no
gate: a wrong `--dir`, one naming a file, an unknown flag, a `chmod 000` subtree, and a root holding
no `.ts/.tsx/.scss/.css` all used to print `0 violation(s) … clean`. Under `--json` a failure writes
`{"error": …}` to stdout, so a consumer's `JSON.parse` still succeeds.

## 1. Naming — filenames machine-enforced, identifiers reviewed

These do not vary by framework, bundler, or router. The checker reads filenames, so the two
identifier rows and the positive form of the test row are reviewer-enforced — see the closing table.

**This section owns *casing*, for filenames and identifiers alike.** Whether a name states its intent,
lies about the shape it holds, or draws a distinction that means nothing is `references/code-quality.md`
§2, which owns identifier *semantics*.

| Thing | Form |
|---|---|
| every file and every directory | `kebab-case` |
| component identifier | `PascalCase` |
| hook filename | `use-*.ts` / `use-*.tsx` |
| hook identifier | `useCamelCase` |
| test | `<name>.test.ts` / `<name>.test.tsx` |

Suffixed companion forms, for when a single companion file does not justify a folder:

`<name>.types.ts` · `<name>.constants.ts` · `<name>.utils.ts` · `<name>.styles.ts` ·
`<name>.props.ts` · `<name>.config.ts`

A leading `_` marks a preprocessor partial (`_mixins.scss`) and is not a casing violation.

**Tests are co-located beside the file under test.** No `__tests__/` directories, no `.spec.*`
suffix. A `__tests__/` folder separates a test from the file it describes, so renaming or deleting
the source leaves an orphan test that still passes — it exercises whatever the import resolved to
last, or nothing at all, and the suite stays green while the coverage is gone. Co-location makes the
test move or die with its subject in the same diff.

## 2. When a component earns a folder

A component gets its own folder with an `index.ts` barrel **the moment it owns any companion file**
— a stylesheet, subcomponents, hooks, types, or constants.

```
user-card/
    user-card.tsx        the component; exported Props interface, default export
    user-card.scss       theme styles, imported by the tsx
    index.ts             export { default } from './user-card';
    components/          subcomponents, same rules recursively
    hooks/               hooks used only by this component
```

With no companion files it stays a single flat `.tsx` beside its siblings. **Adding a stylesheet to
a flat component means promoting it to a folder in the same commit** — not later, because "later"
is how a directory ends up with forty loose files and no way to tell which `.scss` belongs to which
`.tsx`.

**Exception: CLI-generated directories stay flat and are never hand-written.** `npx shadcn@latest
add` writes to `src/components/ui/`, and the next `add` overwrites the file — a hand-edit there is
lost silently, and a barrel you add is deleted.

**Exception: a folder holding a bundler entry point needs no barrel.** `src/app/` containing
`app.tsx` beside `main.tsx` is an application root, not a component — nothing imports it by name, so
a barrel there re-exports into no consumer. The checker skips any folder with a `main.ts(x)`.

## 3. Placement — promotion, not prediction

**Do not promote a module to a broader location until it has a second consumer.**

| Consumers | Location |
|---|---|
| one | beside that consumer |
| two, same surface | that surface's shared folder |
| two surfaces | the cross-surface shared folder |
| CLI-generated primitives | `components/ui/`, via the CLI only |

Prediction fails in one direction only. A component placed in `src/components/` because it "will be
reused" is a coupling cost paid up front for a reuse that frequently never arrives: it is now
importable from everywhere, so its props grow to serve hypothetical callers, and its real single
caller can no longer be read without opening a second directory. Moving a module **out** of a shared
folder is the harder edit, because every import has to be checked to prove nobody else depends on
it; moving it **in** is one rename and a find-replace. So the cheap direction is the default.

The same rule applies to hooks, utilities, and types with no change.

## 4. Directory layout — framework-conditional

The **directory names** vary by framework. The rules in §1–§3 do not, and apply unchanged inside
whichever layout the repo has.

| Framework | Routes live in | Implication |
|---|---|---|
| Vite + React Router | `src/screens/` or `src/routes/`, wired in a route module | any directory nesting is free; a route folder owns its single-route components |
| Next.js app-router | `app/` | every file in a route segment is public URL surface, so a colocated non-route file needs a private folder (`_components/`) or a route group (`(marketing)/`) to stay unrouted |
| Next.js pages-router | `pages/` | `pages/` holds routes only; shared code lives outside it, since any file there becomes a route |
| Monorepo | `packages/*` or `apps/*` | each package is its own root and follows §1–§3 internally; cross-package sharing goes through a package's public entry point, never a deep relative import |

Verified against Vite + React Router and against a `src/`-rooted SPA layout. The Next.js and
monorepo rows are derived from those frameworks' documented routing conventions and have **not**
been exercised against a real repo by this skill's scripts.

`check-structure.mjs` auto-detects the source root: `src/` if present, else `app/` unless that is a
Next.js route root (`next.config.*`, or a `page`/`layout` file inside it), else the cwd. **Whichever
root wins hides everything outside it**, so every run names the top-level directories it did not scan
and says to re-run with `--dir .`. `--dir <path>` overrides it; in a monorepo run it once per package.

The Next.js carve-out matters because in the app-router `app/` holds routes while `components/`,
`hooks/` and `lib/` are its siblings. Measured on a stock `create-next-app` tree: `app/` as the root
walked two route files and reported 0 violations; the cwd reported 8, including a real `.card`
collision.

Skipped everywhere: `node_modules`, `.git`, `coverage`, build output (`dist`, `build`, `out`,
`.next`, `.output`, `.svelte-kit`, `.turbo`, `storybook-static`), `public`, `vendor`, agent dirs. A
class in a compiled or vendored stylesheet recurs as an unfixable §7 collision after every build.

**The Vite `react-ts` template starts with three violations.** Measured on a clean
`npm create vite@latest -- --template react-ts`: `lint`, typecheck and build all exit 0 after
`npm run lint:fix`, and `check-structure` exits 1 on these. `init-greenfield.mjs` does not fix them —
it never edits your source — so fix them by hand in the first commit:

| Violation | Fix |
|---|---|
| `src/App.tsx` is PascalCase (§1) | rename to `app.tsx`, update the import in `main.tsx` |
| `src/App.css` is PascalCase (§1) | rename to `app.css`, update the import in the component |
| `.counter` declared at column 0 in **both** `src/App.css` and `src/index.css` (§7) | delete the losing copy — the template ships this collision, so editing one file silently does nothing to the overlapping properties |

## 5. Where non-component code goes

| Kind | Feature-local | Shared |
|---|---|---|
| pure helpers | `<feature>/utils/` | `src/utils/` |
| types | `<feature>/types.ts` | `src/types/` |
| constants | `<feature>/constants.ts` | beside the module that owns them |

Two anti-patterns, stated as rules:

- **No global `src/constants/` directory.** A constant used by one module stays in that module. A
  global bucket collects unrelated values, so every consumer imports a file it mostly does not use
  and nothing can be deleted without reading every importer.
- **No barrel of unrelated functions.** One named module per concern — `safe-json-parse.ts`,
  `download-filename.ts` — not a `helpers.ts` that grows without limit. A `*-helpers.ts` past a
  couple of functions becomes a `utils/` folder of named modules.

**A `hooks/` folder contains only hooks** — `use-*` files, their co-located tests, and `index.ts`.
A pure helper that landed there goes to the feature's `utils/`, a type to `<feature>/types.ts`, a
constant to `<feature>/constants.ts`. A module that exports a hook but is not named `use-*` gets
renamed, not moved.

**A hook that owns companion files gets its own folder, named for the hook** — not a `hooks/`
folder. `table-layout/` holding `use-table-layout.ts`, `reconcile.ts`, `types.ts`, `index.ts` is the
shape. The folder is named for the hook, so it is not a `hooks/` folder and the rule above does not
reach inside it.

## 6. API and data-access placement

**No `fetch` and no HTTP-client call inline in a component or a screen.** Every request lives in a
module under a dedicated API directory, one module per backend resource, named after the resource in
`kebab-case`. The component calls that module, or the query hook the module exports.

Importing a client library for its type-only or utility exports — an error type, a cancellation
guard — is not a request and is fine. Reviewer-enforced: no linter detects an inline `fetch`.

## 7. Styles — the one with a failure scenario

In a repo with global CSS and no CSS Modules, **a top-level class selector declared in two
stylesheets does not "win" as a block.** Both declarations load, and the N copies merge
per-property by load order.

**Failure:** `.card-header` sets `padding: 16px; color: var(--fg)` in `card-header.scss` and
`padding: 8px` in a global `index.css` that loads later. A developer opens `card-header.scss`,
changes `padding` to `24px`, reloads, and nothing moves — the later declaration still wins on that
one property while `color` continues to come from the file they edited. The file's own declaration is
frequently the dead one, so the natural conclusion is that the build is stale or the class is
unused. This has produced real bugs.

Rules:

- **A top-level class selector is declared in exactly one file.** Hoist a shared declaration into a
  `*-shared.scss` at the nearest common ancestor and import it from each consumer; or rename the
  per-component classes so they cannot collide. Do not copy it.
- **A media query adds no specificity.** `@include below('lg') { .card { gap: 0; } }` is `(0,1,0)`,
  the same as `.card`. Hoisting a declaration onto a modifier — `.card.is-compact` at `(0,2,0)` —
  makes it outrank that breakpoint reset at every width, so **the mobile reset must be repeated on
  the modifier**. Measure the computed value before sizing the work.
- **A co-located stylesheet is named exactly after its component**: `user-card.tsx` →
  `user-card.scss`. Owning one promotes the component to a folder (§2).

**Which styling layer owns a given property** — the decision procedure this section presupposes — is `references/styling.md`.

## 8. File size

Line, complexity, and depth budgets are `SKILL.md` §1, which owns the numbers — do not restate them
here or in a repo-local doc.

## 9. Import direction — which layer may import which

§1–§8 decide where a module **lives**. Nothing above decides what it is allowed to **import**, and that
is the gap this closes. Dependencies point one way: application code imports shared code.

**A shared or publishable layer never imports an application global** — a Redux or Zustand store, an
app-scoped hook, a route or auth context, a router or analytics singleton, a feature-flag client bound to
the app's provider tree.

**Failure:** a component in the shared folder imports and calls `useAppSelector`. It type-checks, it
lints, and it works in the host app, because in the only tree ever exercised a provider sits above it. A
second surface then renders that component outside the provider — or the folder ships to npm — and the
first render throws `could not find react-redux context value`, taking the whole subtree down with it.
Nothing before that point signals the fault: the import was legal, and the only test that rendered the
component rendered it inside the host app.

The mechanism is a restricted-import rule scoped by path. oxlint has **no** `import/no-restricted-paths`
— checked against the complete 835-rule set of oxlint 1.77.0, printed with
`npx oxlint@1.77.0 -D all --print-config` and every plugin named in `plugins` (`--rules` prints nothing
in this version); the `import` plugin's 32 rules do not include it. Core `no-restricted-imports` does
exist, and an `overrides` block supplies the boundary it lacks:

```jsonc
"overrides": [
    {
        "files": ["src/shared/**", "packages/*/src/**"],
        "rules": { "no-restricted-imports": ["error", { "patterns": ["**/app/store", "**/app/contexts/*"] }] }
    }
]
```

Verified by execution on a fixture: a file under `src/shared/` importing `../app/store` reports
`eslint(no-restricted-imports)`, and the same import from a file under `src/app/` reports nothing. Two
patterns that both match one specifier report it twice, so keep the pattern list disjoint. The boundary
is machine-enforced once that block is in a repo's config; **the starter's `.oxlintrc.json` ships no
such block**, because the directory names are per-repo. Until a repo adds one, this rule is
reviewer-enforced.

## What the checker enforces, and what it does not

`scripts/check-structure.mjs` decides only what a filesystem walk can decide, and is built to
under-report: each rule states what it is blind to, and every exclusion is there because the loose
form produced a finding with no available fix.

| Rule | Mechanical |
|---|---|
| `kebab-case` files and directories (§1) | yes — segment-wise, so companion suffixes and `.d.ts` pass. Skips `__double__` directories and the internals of tool-owned dot-directories: `__snapshots__` is generated and `.husky/_` is not ours to rename |
| a `hooks/` folder contains only hooks (§5) | yes — immediate parent only, so a named hook folder is not caught. `use-*.test.*` and `use-*.d.ts` pass |
| a component folder has its `index.ts` barrel (§2) | yes — `index.tsx` counts as the barrel; `index.ts` stays the recommendation |
| no `__tests__/`, no `.spec.*` (§1) | yes — the `.spec.` half is gated on `.ts/.tsx/.js/.jsx`, so an OpenAPI `orders.spec.yaml` is not a test |
| a top-level class declared in one file (§7) | yes, with the limits below |

**Rule 5's exact reach.** A class counts only when its selector starts at column 0, is the whole
selector (`.foo {` or `.foo,`, not `.dark .foo`), and sits at brace depth 0. A leading UTF-8 BOM is
stripped first — it otherwise hid the file's first declaration, the one case the rule exists to catch
— along with `/* … */` spans, so a commented-out declaration is not an owner. A `.css` emitted beside
its own `.scss`/`.sass`/`.less` source is skipped as compiled output.

Blind spots, all reviewer concerns: an indented selector, a second class after a comma, and any
selector nested in another block — including one written unindented inside `@media` or `@layer`,
which the depth gate skips. A literal `/*` or a brace inside a quoted value shifts the parser's
comment and depth state for the rest of that file.

Reviewer-enforced, because no filesystem walk can decide them:

- **Placement (§3).** "One consumer or two" needs an import graph.
- **Component identifier casing, hook identifier casing (§1).** These are identifiers, not filenames.
- **A hook named without `use-` outside a `hooks/` folder (§1).** Rule 2 only inspects a file whose
  immediate parent is `hooks/`, so `src/app/my-hook.ts` passes every rule.
- **The positive form of the test rule (§1).** Rule 4 checks only the two prohibitions, so
  `foo.tests.ts` passes. Nothing verifies a test is named `<name>.test.ts`.
- **Directory layout (§4).** Which layout is correct depends on the framework, not on the tree.
- **Where a helper, type, or constant belongs (§5)**, and whether a `utils/` module is one concern —
  except the helper-landed-in-`hooks/` case, which rule 2 does catch.
- **No inline `fetch` (§6).**
- **The media-query specificity rule and the naming half of §7.**
- **File size (§8)** — oxlint's `max-lines` owns it.
- **Import direction (§9)** — a repo-local `no-restricted-imports` override owns it where one is
  configured; `check-structure.mjs` reads filenames and never opens a file's import list.

Rules 1 and 3 skip a CLI-generated `components/ui/`. Rule 5 does not: a class collision with a file
the CLI overwrites is worse, because the next `add` restores the losing declaration and the bug
returns with no diff to explain it.
