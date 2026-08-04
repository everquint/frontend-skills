---
"frontend-skills": minor
---

`printWidth` moves from 200 to 120, and the change is a decision this time (`docs/adr/0007`), not a
ceiling carried forward. The 200 was the old `max-len` limit kept for migration continuity — but
`max-len` only flagged long lines, while oxfmt actively joins short ones, so adopting the standard
rewrote hand-wrapped code up to 200 and produced lines unreadable in a side-by-side diff. 120 is the
top of the common industry band (Prettier 80, Airbnb/rustfmt/kernel 100, common React/TS overrides
100–120), chosen over 100 because the standard's 4-space indent burns columns faster than the
2-space indent most narrower guides assume.

Adopting repos: set `printWidth: 120` in `.oxfmtrc.json` and `max_line_length = 120` in
`.editorconfig`, re-run `npm run format`, commit the rewrap as its own mechanical commit listed in
`.git-blame-ignore-revs` — the 1.2.0 migration entry names the steps. The past-width case no
mechanical check reaches at any width — a Tailwind class string longer than the line — now has a
stated convention: extract to a named module-level constant or `cva` map (`references/styling.md`
§1).
