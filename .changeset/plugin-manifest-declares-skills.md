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

Install identifiers renamed for legibility: the marketplace is now `frontend-skills` and the plugin `eq`,
making the command `/plugin install eq@frontend-skills` (previously
`frontend-standards@frontend-standards`). The plugin name is deliberately two characters because
Claude Code prefixes every plugin-supplied skill with it in the slash-command picker, which clips
long names from the left — `frontend-skills:eq-frontend-standards` hid the part that says which
skill it is, where `eq:eq-frontend-standards` does not. The marketplace takes the repository's name
rather than the organisation's, so the identifier does not say Everquint twice — `eq@frontend-skills`
reads as "the eq plugin, from frontend-skills", where `eq@everquint` was redundant. Existing installs must
`/plugin marketplace remove frontend-standards` and re-add, because the marketplace name is the key
under which it is registered locally. The README now explains that the first argument is a GitHub
`owner/repo` while the second is `<plugin>@<marketplace>` from the manifests, which is why the order
looks inverted; a new check asserts the two manifests cannot disagree on the plugin name.

`plugin.json`'s version — a third copy alongside `package.json` and `standard-check.mjs`'s embedded
constant — had drifted to `1.0.0` against a `2.1.0` package, because `changeset version` does not
touch it. `sync-standard-version.mjs` now bumps it at release time and the validator asserts it.
