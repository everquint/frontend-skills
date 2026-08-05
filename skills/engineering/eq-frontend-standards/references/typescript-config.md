# TypeScript compiler configuration

`SKILL.md` §4 gates `tsc -b --noEmit --force` in a pre-push hook and in CI. That gate says nothing
about **what the compiler is configured to check**, and a compiler is only as strict as its flags: a
repo with `strict: false` passes every gate the standard defines while `undefined` flows through the
whole app unchecked. This file closes that hole by fixing the flag set.

The entry criterion matches `references/correctness-rules.md`: a flag earns a row only if you can write
down specific inputs or state producing wrong output, a crash, or lost data. A merely tidier flag is
excluded, with its reason stated.

Every claim here was measured, not recalled, against two sources: **the template** — a clean
`npm create vite@latest -- --template react-ts`, scaffolding Vite 8.2.0, React 19.2.8 and
`typescript ~6.0.2` (resolved 6.0.3) — and **a production repo**, a ~1,500-file React + Vite SPA on
TS 6.0.3 whose baseline `tsc -p tsconfig.app.json --noEmit` is **0 errors**. Every count below is the
delta one added flag produces against that clean baseline.

## The flag set

| Flag | Catches | Failure it prevents | In template |
|---|---|---|---|
| `strict` | the umbrella: null checks, implicit `any`, unsound function params, `unknown` catch | see §1 — the whole `strictNullChecks` class | **no** — and the default is version-dependent |
| `noUncheckedIndexedAccess` | `arr[0]` typed `T` instead of `T \| undefined` | empty-array read crashes on `.toUpperCase()` of `undefined` | no |
| `verbatimModuleSyntax` | type-only imports elided along with their module's side effects | a polyfill import silently removed from the bundle | yes |
| `moduleResolution: "bundler"` | resolution algorithm mismatched to Vite | `TS2307` on every `exports`-only dependency | yes |
| `erasableSyntaxOnly` | syntax Node's type-stripping cannot erase | `enum`/parameter property crashes under `node --experimental-strip-types` | yes |
| `noFallthroughCasesInSwitch` | a `case` with no `break`/`return` | a reducer runs two branches and writes the wrong state | yes |
| `noImplicitOverride` | a method that overrides a base member without `override` | a typo'd `componentDidCatch` stops catching, silently | no |
| `skipLibCheck` | *kept on* — see §8 | n/a; it suppresses unactionable vendor errors | yes |

Adopting this on a template-scaffolded repo costs **two additions** — `strict` and `noImplicitOverride`
— plus `noUncheckedIndexedAccess`, whose cost is measured in §2. The template already sets everything
else in the table, so there is no work to do.

## 1. `strict` — the default is version-dependent, so set it explicitly

`strict: true` implies the sub-flags that carry the failures: `strictNullChecks` (an optional value
used without a guard), `noImplicitAny` (an unannotated parameter typed `any`, which disables checking
inside the whole function body), `strictFunctionTypes` (a handler accepting a narrower type than its
call site passes), and `useUnknownInCatchVariables` (`catch (e)` typed `any`, so `e.message` compiles
and throws when the thrown value is a string).

**The template does not set it** — measured: absent from both leaf configs and from the effective
`tsc --showConfig` output. That is survivable only by accident of version:

| TypeScript | `--strict` default | Measured |
|---|---|---|
| 5.9.3 | `false` | implicit-`any` and null-deref probe compiled with **0 errors** |
| 6.0.3 | `true` | same probe reported `TS7006`, `TS18047`, `TS18046` |

TS 6 flipped the default. So a template-scaffolded repo is strict today and silently **not** strict
the moment it is pinned to TS 5.x — a downgrade, a monorepo hoisting an older `typescript`, or a CI
image with a stale lockfile. `strict: false` produces no error, no warning, and a green pipeline.

**Ruling: `strict: true` is written explicitly in `tsconfig.app.json` and `tsconfig.node.json`**, even
where the toolchain already defaults it on. The flag is one line; depending on a compiler default that
has changed once already is the risk.

## 2. `noUncheckedIndexedAccess` — measured before ruling

Without it, `arr[0]` is typed `T` while the value is `undefined` for any empty or short array, and
`record[key]` is typed `V` for a key that is absent. The compiler blesses the read.

**Failure:** `const first = rows[0]; return first.name;` on a list that renders before its fetch
resolves. `rows` is `[]`, `first` is `undefined`, and the render throws
`Cannot read properties of undefined (reading 'name')` — a blank screen, not a fallback. The same
shape on a lookup: `COLORS[status]` for a status the map gained after a backend deploy returns
`undefined`, which reaches `className` as the string `"undefined"`.

This is the highest-value flag outside `strict` — the one remaining path by which `undefined` reaches
runtime with the compiler's approval — and the most expensive. Measured on the production repo:

| Flag | Errors | Files | Dominant codes |
|---|---|---|---|
| `noUncheckedIndexedAccess` | **906** | **193** | `TS2532` (354), `TS2345` (231), `TS18048` (170), `TS2322` (126) |

906 errors across 193 files is not a single commit, and a rule set that lands hundreds of errors at
once is the rule set that gets switched back off — the same reasoning the starter lint config states
for a mature repo. **Ruling, split by repo age:**

- **New repos: required.** Zero cost at commit one, and every violation is caught as it is written.
- **Existing repos: a migration step, not a gate.** Enable it in a `tsconfig.strict.json` that extends
  the app config, run it in CI as a non-blocking job, and drive the count down directory by directory.
  It becomes a gate when the count reaches zero.

Do not treat the 906 as 906 bugs. Most are reads the surrounding code already proves safe, and the fix
is a guard, a `?.`, or destructuring with a default — **not an `as`**, which reproduces the exact hole
the flag exists to close (`correctness-rules.md` §12).

## 3. `verbatimModuleSyntax`

Without it, TypeScript decides which imports to erase by asking whether each binding was used as a
value. An import whose bindings are all types is deleted from the emitted JavaScript — **and the
module's side effects go with it.**

**Failure:** `import { Cfg } from './side-effects';` where that module both exports an interface and
registers a polyfill, a `zod` error map, or a `dayjs` plugin. Measured with `tsc` emit: the import
statement is **absent** from the output `.js` entirely, so the registration never runs. The type-check
passes, the build passes, and the failure is a runtime `TypeError` in whichever code path depended on
the polyfill — often only under a locale or browser the developer did not open.

With the flag on, the same code is a compile error — measured, `TS1484: 'Cfg' is a type and must be
imported using a type-only import` — forcing `import type { Cfg }` plus a separate bare
`import './side-effects';` that no elision pass touches. Import syntax then means what it says, which
is the property Vite's per-file transform depends on. The template sets it in both leaf configs.

## 4. `moduleResolution: "bundler"`

Vite resolves modules the way a bundler does: it reads the `exports` map in `package.json` and needs
no file extension on a relative import. `bundler` is the only value that models that.

**Failure:** with `moduleResolution: "node10"`, measured against the template's own dependencies,
`import { defineConfig } from 'vite'` reports `TS2307: Cannot find module 'vite' or its corresponding
type declarations`, while the identical import resolves cleanly under `bundler`. `node10` predates
`exports` maps and looks only for `main`, which modern packages — `vite` among them — no longer
publish. The result is a repo where the editor and `tsc` claim a working dependency does not exist,
which reads as a broken install and gets debugged by deleting `node_modules`.

`node10` is additionally deprecated as of TS 6 (`TS5107`) and stops functioning in TS 7. The template
sets `bundler` in `tsconfig.app.json`; `tsconfig.node.json` uses `module: "nodenext"`, correct for a
config file Node loads directly. Do not unify them.

## 5. `erasableSyntaxOnly`

Added in **TS 5.8** — measured: `TS5023: Unknown compiler option` on 5.7.3, and functioning on 5.8.3.
It rejects TypeScript syntax that cannot be erased by a type-stripping loader: parameter properties
(`constructor(private x: number)`), `enum`, namespaces with runtime output, and `declare` class fields.

**Failure:** a class using `constructor(private config: Cfg) {}` compiles under `tsc` and works in the
Vite bundle, then throws the moment the same file is executed by something that strips types instead
of compiling them — `node --experimental-strip-types` for a script or a test runner. `this.config` is
`undefined`, because the parameter property's implicit assignment was never emitted. Measured with the
flag on: `TS1294: This syntax is not allowed when 'erasableSyntaxOnly' is enabled`.

**Ruling: required.** The template already sets it in both configs, so this costs nothing.

## 6. `noImplicitOverride`

Requires the `override` keyword on any class member that replaces a base-class member.

**Failure:** an error boundary declares `componentDidCath(error, info)` — one transposed letter.
Without the flag it is a valid new method that React never calls, so the boundary renders its fallback
but never reports, and every error inside it disappears with no log and no trace. The typo survives
review because the method body is correct. With the flag, the correctly-spelled members carry
`override`, so the misspelled one stands out as the member that does not.

Measured cost: **4 errors across 2 files**, all `TS4114`, all on genuine `React.Component` subclasses.
A single commit. **Ruling: required** — the only added flag whose cost on existing code is negligible.

## 7. `noFallthroughCasesInSwitch`

**Failure:** a reducer `case 'reset':` sets `draft = null` and omits `return`, so control falls into
`case 'save':`, which persists the now-null draft. The user clicks Reset and the empty document is
written to the server — lost data, from a missing keyword. The template sets it. Keep it.

## 8. `skipLibCheck` — kept on, deliberately

`skipLibCheck: true` stops the compiler type-checking `.d.ts` files in dependencies. It hides real
type errors: a broken vendor declaration, and two incompatible versions of the same `@types` package
declaring conflicting globals.

Measured on the production repo with `--skipLibCheck false`: **2 errors, both inside `node_modules`,
0 in `src`** — a dangling type reference in one vendored `.d.ts`, and an interface in another that
incorrectly extends an upstream type. Neither is fixable in this repo, and both would fail the
pre-push hook and CI on every commit until upstream shipped a fix.

**Ruling: keep `skipLibCheck: true`**, as the template sets it. A gate must be actionable; one that
fails on code the developer cannot edit is bypassed with `--no-verify`, the outcome `SKILL.md` §4
already names for false failures.

## Excluded, with reasons

Padding the table would weaken it. Each of these was evaluated and rejected.

| Flag | Verdict | Reason |
|---|---|---|
| `exactOptionalPropertyTypes` | **excluded** | Measured: **661 errors across 335 files**, dominated by `TS2375` (442) and `TS2379` (161). The dominant shape is forwarding an optional prop that is `undefined` — `<Tag removable={props.removable} />` — which is correct at runtime, because React and `Object.assign` treat an absent key and an explicit `undefined` identically. So the volume is overwhelmingly not defects. Requiring it would trade 661 mechanical annotations for a distinction this codebase never depends on. |
| `noPropertyAccessFromIndexSignature` | **excluded** | Measured: **713 errors, every one `TS4111`**. It only forces `obj['foo']` in place of `obj.foo` on index-signature types. No failure scenario exists — both spellings read the same value and both are `undefined` when the key is absent. `noUncheckedIndexedAccess` (§2) is the flag that catches the actual bug in that access. |
| `noUnusedLocals`, `noUnusedParameters` | **already covered — redundant, not an addition** | The template sets both, and the starter lint config sets `no-unused-vars: "error"` independently. Two gates on one defect. Leave the template's values alone; do not present them as work the standard adds, and do not remove them either — the compiler catch is free. |
| `isolatedModules` | **no action needed** | Measured: already `true` in the template's effective config via `tsc --showConfig`, implied rather than written. Setting it explicitly changes nothing. |
| `allowJs` | **excluded — stays off** | Its default is already `false`. Turning it on admits untyped `.js` into the program, where every export is implicitly `any`, which silently disables checking at each import site. There is no failure it prevents; it only creates them. |

## Project references — the misconfiguration that fails silently

The template ships **three** configs, and this is where flag sets actually go wrong:

```
tsconfig.json           { "files": [], "references": [app, node] }   ← solution-style, checks nothing
tsconfig.app.json       "include": ["src"]                           ← your application code
tsconfig.node.json      "include": ["vite.config.ts"]                ← build-time config only
```

The root config compiles no files. Measured on the template: `noUncheckedIndexedAccess` placed in the
**root** `tsconfig.json`'s `compilerOptions`, then built with `tsc -b --force`, reported **no error**
on a `src` file that indexes an array — while the identical flag in `tsconfig.app.json` reported
`TS2532` on that same line. **A referenced project does not inherit the solution config's
`compilerOptions`.**

This is the most common real misconfiguration, and its signature is the worst possible one: the flag
is present in a file, visible in review, committed with a message saying it was enabled, and enforcing
nothing. Nothing warns. Rules:

- **Every checking flag goes in `tsconfig.app.json` and `tsconfig.node.json`, never only in the root.**
  The root holds `files` and `references`, and nothing else that has to reach a source file.
- **`paths` is not an exception — it belongs in the leaf too.** A path alias in a solution-style root
  is inert for the same reason a checking flag is: nothing compiles through that config. `@/lib/x`
  then fails to resolve while the root looks correctly configured.
- **A `paths` alias needs a matching bundler alias, and the reason is the test runner.** Measured on
  Vite 8.2.0: `paths` alone type-checks *and* builds, because Vite reads tsconfig `paths` natively.
  It is `vitest run` that fails — `Cannot find package '@/lib/greet'` — and `vite build` on 7.3.6.
  So the failure is not a broken artifact; it is **a green build with an unrunnable test suite**, and
  it appears the moment someone writes the first test that imports through the alias. Declare
  `resolve.alias` as well, and do not rely on a bundler version's tsconfig support.
- **`baseUrl` is not the way to enable `paths`.** TS 6 reports `TS5101`: deprecated, and it stops
  functioning in TS 7.0. `paths` resolves relative to the config file without it.
- **The two leaf configs carry the same checking flags.** `vite.config.ts` and any plugin code in
  `tsconfig.node.json` runs on the build machine; a null-deref there breaks the build for everyone.
- **Verify with `tsc --showConfig`, not by reading the file.** It prints the effective options after
  `extends` and defaults resolve, which is the only way to see a flag that a version default supplied
  (§1) or that an `extends` chain overrode.

### Why the gate is `tsc -b --force`

`SKILL.md` §4 owns this rule and its reasoning; the connection to this file is that the project
references above are why `tsc -b` is the command at all. `-b` builds a referenced graph, and its
`.tsbuildinfo` caches per-project results keyed on inputs — **a changed compiler flag is not reliably
part of that key**. So the run immediately after adding any flag on this page is exactly the run whose
cache is stale, and it can report a false pass on the very change being verified. `--force` is what
makes a flag addition observable in the gate meant to enforce it.

## What the compiler enforces, and what it does not

| Concern | Mechanical |
|---|---|
| a value used without a null/undefined guard | yes — `strict` → `strictNullChecks` |
| an unannotated parameter silently typed `any` | yes — `strict` → `noImplicitAny` |
| `catch (e)` treated as `any` | yes — `strict` → `useUnknownInCatchVariables` |
| an array or record read that can be `undefined` | yes — `noUncheckedIndexedAccess`, new repos only (§2) |
| a side-effect import erased with its types | yes — `verbatimModuleSyntax` |
| non-erasable syntax | yes — `erasableSyntaxOnly` |
| an unintended `switch` fallthrough | yes — `noFallthroughCasesInSwitch` |
| an override that does not override | yes — `noImplicitOverride` |
| unused locals and parameters | yes, twice — compiler and `no-unused-vars` |

Reviewer-enforced, because no compiler flag decides them:

- **Whether external data was parsed or cast.** `as T` is erased at build time and checks nothing, so
  a wrong annotation type-checks perfectly. `correctness-rules.md` §12 owns this rule and the `zod`
  boundary it requires; enabling every flag here does not make an `as` safe.
- **Whether a `noUncheckedIndexedAccess` error was fixed or suppressed.** A guard and an `as` both
  clear the error. Only one fixes the bug (§2).
- **Whether the two leaf configs' flag sets still agree.** A flag added to one and not the other is
  silent drift; a diff touching one is incomplete without the other.
- **The `types` array.** `types: ["vite/client"]` in the app config and `["node"]` in the node config
  keeps Node globals out of browser code. Widening the app config to include `node` lets `process.env`
  and `Buffer` type-check in code that ships to a browser, where both are `undefined` at runtime.
- **Which TypeScript version the repo is pinned to.** §1's table is the reason: the pin changes what
  the flag set means. `engines` and lockfile pinning are `references/hygiene.md`.

## No `baseUrl` — it silently disables type-aware linting

`baseUrl` in any tsconfig makes oxlint-tsgolint reject the project with no error: every type-aware
rule reports zero findings at exit 0, and the rules still count in `number_of_rules`, so even CI's
rule-count assertion stays green. Measured on a real migrated repo — all type-aware counts read
zero until `baseUrl` was deleted, then 174 genuine findings surfaced. Nothing in the standard needs
it: the `@/*` alias is `paths` alone, and bundler-mode resolution never consults `baseUrl`.
`standard-check` flags it as a policy gap and `measure-rules` refuses to measure over it.
