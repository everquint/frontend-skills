---
"frontend-skills": minor
---

Vendored skill sets are now named for the project that owns them.

An unprefixed vendored copy has the same name as a personal install of the same skills, so a host
that reads both lists every skill twice — at two different versions of the standard, with no way to
tell which one answered. `init-greenfield.mjs --prefix cc` now vendors
`.claude/skills/eq-cc-frontend-standards` (and the workflow and quality-bar skills to match), and
records the prefix in `.claude/skills/.eq-vendor.json`. Vendoring requires an explicit `--prefix
<short>` or `--no-prefix`; the plain names remain fully supported.

`rename-vendor-prefix.mjs --to <short>` (or `--to ""`) changes it later, and is also the migration
path for a repo vendored before the manifest existed — with no manifest it adopts the directories it
finds rather than refusing. It it moves the directories
with `git mv` and rewrites each skill's frontmatter `name`, its sibling links and its prose mentions
of a sibling — a host loads a skill only when its `name` equals its directory, so those three move
together or not at all. Files outside `.claude/skills` that hardcode an old path are reported, never
edited.

`standard-check.mjs` reads the manifest, so a prefixed repo reports as vendored rather than as bare,
and the starter's CI, `pre-pr` and reviewer-agent resolvers now glob `.claude/skills/*frontend-standards`
so they survive any prefix.

Rationale, including why the copies can no longer be byte-identical:
`docs/adr/0022-vendored-skills-are-named-for-the-project.md`.
