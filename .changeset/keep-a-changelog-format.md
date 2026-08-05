---
"frontend-skills": minor
---

CHANGELOG.md now conforms to Keep a Changelog 1.1.0. A new starter script, `scripts/format-changelog.mjs`, runs after `changeset version` and canonically rebuilds the file: a preamble naming the format and SemVer, an `[Unreleased]` section with a compare link (pending entries live in `.changeset/`), `[X.Y.Z] - YYYY-MM-DD` headings dated from git tags, change-type sections (Major→Changed, Minor→Added, Patch→Fixed), and version link references. Idempotent, and derives the repo URL from the git remote, so the same script serves any adopted repo — migration 2.1.0 wires it in. The delivery workflow also now documents Conventional Commits' breaking-change marking (`!` and the `BREAKING CHANGE:` footer), the one gap against the spec; branch naming was audited against common practice and stands unchanged.
