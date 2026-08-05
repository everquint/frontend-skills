---
'frontend-skills': minor
---

The Claude Code plugin now actually installs its skills. Plugin discovery only walks
`skills/<name>/SKILL.md` one level deep, and this repo nests skills under category folders, so a
manifest without an explicit `skills` array contributed nothing — `/plugin install` succeeded and
reported zero skills, with no error anywhere. `.claude-plugin/plugin.json` now lists all five skill
paths, and `validate-skills.mjs` asserts that list is exhaustive in both directions, so a skill
added to a category folder and not to the manifest fails CI instead of silently reaching no plugin
user.

Install identifiers renamed for legibility: the marketplace is now `everquint` and the plugin
`frontend-skills`, making the command `/plugin install frontend-skills@everquint` (previously
`frontend-standards@frontend-standards`). Existing installs must
`/plugin marketplace remove frontend-standards` and re-add, because the marketplace name is the key
under which it is registered locally. The README now explains that the first argument is a GitHub
`owner/repo` while the second is `<plugin>@<marketplace>` from the manifests, which is why the order
looks inverted; a new check asserts the two manifests cannot disagree on the plugin name.

`plugin.json`'s version — a third copy alongside `package.json` and `standard-check.mjs`'s embedded
constant — had drifted to `1.0.0` against a `2.1.0` package, because `changeset version` does not
touch it. `sync-standard-version.mjs` now bumps it at release time and the validator asserts it.
