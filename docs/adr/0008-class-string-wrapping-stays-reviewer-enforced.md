# 0008 — Class-string wrapping stays reviewer-enforced: the wrap rule and the sorter fight

Date: 2026-08-05

## Context

`styling.md` §1 rules that a class string pushing its line past `printWidth` is extracted to a named
constant or `cn()` groups, reviewer-enforced. The obvious question — can oxlint or oxfmt enforce it
mechanically? — was spiked with fixtures on oxlint 1.77.0, oxfmt 0.62.0 and
`eslint-plugin-better-tailwindcss` 3.x.

## What was measured

1. **`no-restricted-syntax` does not exist in oxlint 1.77.0.** A config naming it fails to parse:
   `Rule 'no-restricted-syntax' not found in plugin 'eslint'`. The flag-a-long-`className`-literal
   route has no vehicle.
2. **`better-tailwindcss/enforce-consistent-line-wrapping` loads through `jsPlugins` and works in
   isolation.** It flags and autofixes a 300-char `className` into a wrapped multiline string, and
   with its `indent` option matched to oxfmt's `tabWidth: 4`, repeated `--fix` + `oxfmt` cycles
   converge: zero lint errors, clean `--check`.
3. **It oscillates against the standard's config.** `sortTailwindcss` — which the standard enables —
   rejoins a wrapped multiline class string into ONE line, unconditionally: a wrapped string whose
   joined length is 210 characters was rejoined straight past `printWidth: 120`. The wrap rule then
   fires again. `lint:fix` (`oxfmt && oxlint --fix`) would commit wrapped strings that
   `format:check` rejects — permanent churn, two tools owning one property.
4. **The sorter never merges separate `cn()` arguments.** Only single string literals are rejoined.
   The human fix the ruling prescribes is therefore stable under the whole pipeline.

## What the ecosystem does (surveyed 2026-08-05)

The same gap is open upstream of every stack. Prettier's own tailwind plugin sorts and does not
wrap; users have asked for wrapping in at least five open tailwindlabs discussions (#4411, #7763,
#9662, #10309, #17770, #19235) and a Prettier core issue (#10663 — JSX `className` does not wrap
the way HTML `class` does), none shipped. The community answers are exactly two:

- **`prettier-plugin-classnames`** — wraps class strings at `printWidth`, composed WITH the sorter
  plugin through Prettier's plugin chain. Prettier-only: oxfmt has no plugin system, so this route
  does not exist for this stack.
- **`eslint-plugin-readable-tailwind` / `better-tailwindcss`** — the linter-side wrap, which is the
  rule measured above and the one that fights oxfmt's sorter.

The dominant manual convention across style guides is the one this standard already prescribes:
split into `cn()`/`clsx` argument groups, `cva` when the groups are variants.

## Decision

The ruling stays **reviewer-enforced**, now deliberately: no mechanical wrapping rule ships, because
the only working candidate fights the formatter the standard already owns. Finding 4 is why the
prescribed fix is `cn()` groups rather than a wrapped literal — it is the one shape both tools leave
alone.

Rejected alternative, recorded for the future: move BOTH sorting and wrapping to
`better-tailwindcss` (`enforce-consistent-class-order` + `enforce-consistent-line-wrapping`) and
disable `sortTailwindcss`. Coherent, but it moves class sorting from the 0.7s Rust path onto the
alpha JS-plugin bridge, takes sorting out of the editor's format-on-save, and re-architects
formatter/linter ownership for one rule. Not worth it at current cost.

## Consequences

- A past-width class string is caught in review, with `styling.md` §1 as the citation.
- Supersede this when any of: oxlint implements `no-restricted-syntax` (a flag-only rule becomes
  possible with no autofix to fight the sorter); oxfmt's sorter learns to preserve or produce
  wrapping; or the bridge cost drops enough that moving sorting to the plugin is cheap.
