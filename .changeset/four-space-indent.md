---
'frontend-skills': minor
---

Indent moves 2 → 4 by organizational ruling (ADR 0013, superseding ADR 0009): `tabWidth: 4` and
`indent_size = 4`, with YAML carved out at 2-space in both the formatter and .editorconfig (the
YAML ecosystem assumes 2). printWidth stays 120. All starter files reformatted at 4-space with the
real oxfmt. Migration 1.8.0 names the steps — the mechanical rewrap commit must be listed in
`.git-blame-ignore-revs`, and ESLint-branch repos adjust `@stylistic/indent` instead.
