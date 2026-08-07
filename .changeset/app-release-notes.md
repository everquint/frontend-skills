---
"frontend-skills": minor
---

Apps now have a stated way to keep a changelog. v2.7.0 made changesets library-only but left apps with nothing; the standard now names the industry-normal alternative: tag each deploy and use GitHub's "Generate release notes", which lists every PR merged since the previous tag. The starter ships `.github/release.yml` to group those notes (Features / Fixes / Performance / Dependencies, then an unlabelled catch-all — order matters, GitHub files each PR under the first match); `skip-changelog` excludes a PR. init-greenfield now says which of the two changelog mechanisms to delete. Nothing to maintain by hand, no CHANGELOG merge conflicts. Libraries ignore the file — their CHANGELOG.md stays generated from changesets by the release job. Migration 2.11.0.
