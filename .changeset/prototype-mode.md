---
"frontend-skills": minor
---

Adds `eq-frontend-prototype`, prototype mode: a bounded exemption from the standard for work that answers
one question and is then thrown away.

A prototype, POC or demo answers one question and is then deleted or graduated, and the full gate
set never reaches its payoff there. `eq-frontend-prototype` is the only sanctioned way to run with fewer
gates: an entry test (one question, an expiry date, no external dependents, no production data), a
reduced gate set that keeps typecheck, base lint and the formatter, and a written graduation
procedure back to the full standard.

`init-prototype.mjs` lands a subset of the existing standards starter, read from the sibling skill
at run time, so no config or dependency version is duplicated. `standard-check.mjs` now reads the
`eqPrototype` marker in `package.json`: prototype mode reports as a deliberate exemption rather than
as an unmigrated repo, `--check` fails once the expiry passes or if a repo carries both markers, and
`--record` refuses while the prototype marker is still present.

`graduate-check.mjs` sizes the graduation backlog before anyone commits to it — code size, typecheck
state, lint backlog against the full standard, structure findings — and says whether the procedure
fits one reviewed PR or needs the existing-repo measure-and-ratchet path. It measures nothing itself:
the counts come from the standards skill's own `measure-rules.mjs` and `check-structure.mjs`.

Rationale, including why this is a mode rather than a second lightweight standard:
`docs/adr/0021-prototype-mode-as-a-bounded-exemption.md`.
