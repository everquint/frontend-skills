---
"frontend-skills": patch
---

commitlint no longer red-gates dependency-bot PRs. @commitlint/config-conventional caps body lines at 100 characters, and Dependabot/Renovate bodies are long release-notes URLs, so a repo with a required commit-message check could not merge any bot PR — measured on a consumer repo's first Dependabot run: 4 of 5 PRs failed on the body cap alone, with lint, tests and build all green. The starter config now turns off `body-max-line-length` — deliberately narrower than commitlint`s `ignores`, which would exempt a matched commit from every rule; body readability is judged in /pre-pr step 8 instead. A human pasting a stack trace or URL was hitting the same wall. Migration 2.10.1 re-pulls the config.
