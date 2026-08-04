---
"frontend-skills": patch
---

The release workflow now reads `${{ secrets.RELEASE_TOKEN || secrets.GITHUB_TOKEN }}`, so a repo whose org
disables "Allow GitHub Actions to create and approve pull requests" can release by adding a fine-grained
PAT rather than editing the workflow. `hygiene.md` §6 names both first-release failures — the
non-conventional `Version Packages` commit and the refused PR creation — with the fix for each; ADR 0006
records why a hand-rolled version phase was rejected.
