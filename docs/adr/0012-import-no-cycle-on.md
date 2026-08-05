# 0012 — `import/no-cycle` on, in the fast config

Date: 2026-08-05

## Context

Circular imports are the one import defect nothing else in the gate catches: `tsc` compiles a cycle
without complaint, and the failure surfaces at runtime as an `undefined` binding whose value depends
on module load order — a bug class that is miserable to debug and trivial to prevent. The rule is
NOT in any recommended preset: under ESLint, `import/no-cycle` was notoriously slow (it walks the
import graph per file), so presets left it off and mature repos opted in. oxlint's native
implementation makes it cheap enough for the fast loop.

Measured before enabling: zero violations on both adopted repos (4 and 335 files), and the rule is
confirmed loaded via `number_of_rules` — the JSON assertion, not the exit code, since a mistyped
rule name on the CLI exits 0 silently (verified with a deliberate typo).

## Decision

**`import/no-cycle: error` in `.oxlintrc.json`** — the fast config, so the editor LSP and the
pre-commit hook see it, not just CI. Depth is unlimited (the default): a long cycle is still a
cycle.

## Consequences

- The standard now exceeds the recommended presets on imports, deliberately and cheaply.
- An adopting repo with existing cycles handles them like any other measured debt: fix or ratchet
  per the migration doctrine, never disable.
- If a legitimate type-only cycle ever appears (types flowing both ways between modules), the fix
  is extracting the shared types to a third module, not suppressing the rule.
