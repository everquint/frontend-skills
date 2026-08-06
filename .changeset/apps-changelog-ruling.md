---
"frontend-skills": minor
---

The release requirement is now scoped by consumer, matching industry practice: a library — code other repos install and upgrade — requires the full machinery (Changesets, semver, the generated CHANGELOG.md, the release job); an app — deployed to users, upgraded by nobody — may skip it all, with the merged PRs as its history and release notes living with its deploys. An app that opts in follows the library rules. hygiene.md notes that the three starter release pieces are removed together when an app opts out, so a half-installed release job cannot linger.
