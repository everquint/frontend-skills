---
"frontend-skills": patch
---

`init-greenfield.mjs` no longer reports a correctly vendored repo as unvendored. Its closing notice
about `ci.yml`'s structure gate looked for `.claude/skills/eq-frontend-standards` under the plain
name, so every repo vendored with `--prefix` was told the gate would fail and given the command it
had just run.
