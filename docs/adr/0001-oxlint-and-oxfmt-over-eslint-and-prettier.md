# 0001 — oxlint + oxfmt over ESLint + Prettier

Date: 2026-08-04

## Context

The standard previously ran ESLint with `@stylistic` rules acting as the formatter, and no formatter
of its own. Every number below was measured on 2026-08-03 against two real repositories: **FluentMind**
(2,183 files linted, 2,211 `.ts/.tsx`, 193 stylesheets) and **inbox-ledger** (337 `.ts/.tsx`).

**Adoption**, read from npm weekly downloads: ESLint 155M, Prettier 128M, `eslint-config-prettier` 64M,
oxlint 14M, Biome 12M, oxfmt 10M, `@stylistic/eslint-plugin` 6.3M. Versions read from the registry:
ESLint 10.8.0, oxlint 1.77.0, oxfmt 0.62.0 (pre-1.0, beta), Biome 2.5.6.

**Coverage.** Of the 135 active rules in the old config, oxlint covers 111 natively, 18 through
`jsPlugins`, and 4 become the formatter's job. **Two have no equivalent**: `no-octal` (dead weight
under ESM and strict mode) and `no-useless-assignment` (a real dead-store detector, genuinely lost).
All 20 gated `react-hooks` rules produce byte-for-byte identical findings to ESLint.

**Speed**, FluentMind, 2,183 files, best of 3: oxlint native rules only (111) **0.17s**; with the 18
compiler rules loaded through `jsPlugins` **17.20s**; the ESLint equivalent **26.89s**. The headline
"50–100× faster" holds for the Rust rules alone — **on the full rule set the gain is ~1.5×**, because
the React Compiler rules are the same JavaScript in both tools. This is the most misunderstood part of
the decision and the reason the speed argument is not the deciding one.

**Formatting.** oxfmt passes 100% of Prettier's JS/TS conformance tests, and measured ~30× faster than
Prettier and 3× faster than Biome. Adopting it is a **mass reformat**: 70.1% of FluentMind's 2,211 and
78.9% of inbox-ledger's 337 `.ts/.tsx` files change. It is not tunable — every config variant tested
produced worse output. On the two real repos its output additionally violates four rules the starter
does not ship (`object-curly-newline`, `@stylistic/type-annotation-spacing`,
`react/jsx-one-expression-per-line`, `comma-spacing`), 5,409 errors in FluentMind. **On a greenfield
repo built from the starter it conflicts on `max-len` alone** — `printWidth` is a target, not a bound,
and it emitted a 201-character line.

**Upside beyond JS.** 140 of FluentMind's 193 stylesheets get formatted where nothing formats them
today, with **zero semantic change** — verified by compiling all 184 non-partial `.scss` before and
after and diffing the compressed output. Markdown, JSON, YAML and HTML come with it. Import sorting
reproduces `import/order` to within 10 of 2,211 files; the residual is an unconfigurable tie-break
(`-` 0x2D against `/` 0x2F). Tailwind class sorting reaches 58–71% of `.tsx` files and has no ESLint
equivalent in the standard.

## Decision

The standard runs **oxlint** as the linter and **oxfmt** as the formatter. `max-len` is dropped,
because `printWidth` is a target rather than a bound and the two rules cannot both hold.

Alternatives rejected:

- **ESLint + Prettier** — safest and most adopted, but the slowest measured, and it leaves `@stylistic`
  doing a formatter's job badly.
- **oxlint + Prettier** — strictly worse than oxlint + oxfmt: slower formatter, no stylesheet coverage,
  no Tailwind sorting, no compensating benefit.
- **Biome** — the same two rule gaps as oxlint, lower adoption than oxlint, and 3× slower than oxfmt.
  No axis on which it wins.
- **Status quo, `@stylistic` + ESLint** — 6.3M adoption, the weakest option measured, and it formats no
  stylesheet at all.

## Consequences

- oxfmt is **0.62.0, pre-1.0**, and `jsPlugins` is documented **alpha, "not subject to semver"**.
- The 0.x risk is bounded by Prettier conformance: a later switch to Prettier reformats nothing. That
  reversibility is the whole reason a pre-1.0 formatter is acceptable in a standard repos adopt once.
- **Single-vendor concentration.** Linter, formatter and increasingly the bundler come from one
  organisation, where ESLint and Prettier are independently governed. Accepted, not unnoticed.
- **Three silent-failure modes, all producing green output while enforcing nothing.** Omitting
  `--type-aware` skips 3 rules — **631 findings reported as zero** on FluentMind, with no warning.
  Tailwind sorting with unresolvable `node_modules` sorts 0 files and exits 0. A `lint` script left
  pointing at another linter passes while CI runs `npm run lint`. CI asserts what actually loaded; it
  does not trust the exit code.
- **Tailwind class reordering is unsafe when two classes in one string set the same property** — the
  winner is decided by CSS source order, not string order. Inherited from
  `prettier-plugin-tailwindcss`, and not measured here.
- `oxlint --rules` produces empty output in 1.77.0, so the active rule set cannot be dumped from the
  tool.
- Two rules are lost outright: `no-octal` and `no-useless-assignment`.

**Supersede this when** oxfmt's output diverges from Prettier's conformance suite, or when a `jsPlugins`
breaking change silently drops gated rules from a passing run. Either event removes the reversibility
that made a pre-1.0 dependency acceptable.
