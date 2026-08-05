# 0011 — Gate the full recommended-type-checked set, not a three-rule subset

Date: 2026-08-05

## Context

The standard's type-aware gate held 3 rules: `typescript/no-floating-promises`,
`no-misused-promises` and `no-duplicate-type-constituents`. That subset was a tool ceiling, not a
decision — when the gate was built, oxlint's type-aware backend (`oxlint-tsgolint`) covered only a
small slice of typescript-eslint's type-aware rules, so the standard enabled the highest-value
three. The industry baseline for typed TS linting is typescript-eslint's `recommended-type-checked`
preset, whose type-aware half is 23 rules. tsgolint now implements 59 of the 61 type-aware rules it
targets, so the ceiling is gone.

Measured before enabling, on a real adopted repo (335 files, oxlint 1.77.0): all 20 missing rules
are recognized by the pinned toolchain; 14 report zero violations; the other 6 report 85 findings
that are that repo's migration debt (mostly `no-unsafe-assignment` and
`no-unnecessary-type-assertion`), handled by the standard's existing measure-and-ratchet adoption
path. Config files outside the type-checked project misreport (`vite.config.ts` flags an unsafe
`any` spread that is really a missing type project), so the existing config-file override widens to
the whole set.

## Decision

**`.oxlintrc.strict.json` pins all 23 type-aware rules of `recommended-type-checked` by name** —
pinned even though oxlint's `correctness` category auto-loads some of them, for the same reason the
base config pins category-covered rules: an upstream re-sort must not silently drop a rule the
standard claims. The `no-misused-promises` option (`checksVoidReturn.attributes: false`) is kept.

The measured rule count moves from 214 to 226 (20 new pins minus 9 already loaded via
`correctness`, plus `import/no-cycle` — ADR 0012), in both `EXPECTED_OXLINT_RULES` (starter
ci.yml) and `EXPECTED_RULES` (measure-rules.mjs), edited in the same commit as always.

## Consequences

- Greenfield repos get the full preset at `error` from the first commit — no change to the flow.
- Existing adopters see new findings on their next `npm run lint`; the migration entry names the
  step: measure, fix or ratchet, never blanket-suppress.
- Rules outside the preset (`strict-boolean-expressions`, `no-unnecessary-condition`, …) remain a
  separate, deliberate decision — this ADR adopts the industry baseline, not the maximum.
- Re-measure when oxlint or tsgolint is bumped: the auto-loaded `correctness` overlap can shift the
  asserted counts even with no config edit.
