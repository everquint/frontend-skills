# 0010 — Single quotes, now by decision rather than inheritance

Date: 2026-08-05

## Context

`singleQuote: true` was the last formatter value carried forward from the old `@stylistic/quotes`
ESLint config with no recorded decision — the same class of inheritance as `printWidth: 200`
(ADR 0007) and `tabWidth: 4` (ADR 0009), just lower stakes. Prettier's own default is double
quotes; single quotes is one of the ecosystem's two mainstream conventions (Airbnb's guide and a
large fraction of published TS/React codebases use it), so unlike those two cases there is no
"industry default we deviate from without noticing" — both values are normal.

## Decision

**Keep `singleQuote: true`.** Flipping it would rewrite the string literals of every adopted repo
for zero readability gain, and neither value is more correct. JSX attributes stay double-quoted
(`jsxSingleQuote: false`) and stylesheets stay double-quoted via the `.oxfmtrc.json` override —
both already decided in that file's comments.

## Consequences

- Every value in `.oxfmtrc.json` now has a recorded decision: width (0007), indent (0009), quotes
  (this ADR); semicolons, JSX quotes and the CSS override are documented inline in the config.
- Supersede only together with a whole-formatter rethink: a quote flip is a full-repo mechanical
  rewrite, so it should never happen on its own.
