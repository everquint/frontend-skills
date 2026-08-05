---
"frontend-skills": minor
---

Indent moves from 4-space to 2-space (`tabWidth: 2`, `indent_size = 2`) — ADR 0009. Like
printWidth's 200, the 4 was inherited from the old `@stylistic/indent` config rather than decided,
and 2-space is the dominant JS/TS convention (Prettier default, Airbnb, Google, every mainstream
scaffold). `printWidth: 120` is kept — ADR 0007's width conclusion stands even though its
4-space-burns-columns clause is superseded. The YAML tabWidth override and the `.editorconfig` YAML
carve-out are retired (the global 2 is what YAML tooling assumes), and a fresh Vite scaffold's
indent now matches from the first file. Adopting repos: one mechanical `npm run format` commit,
listed in `.git-blame-ignore-revs` — the 1.3.0 migration entry names the steps.
