---
"frontend-skills": patch
---

format-changelog.mjs is now idempotent across releases, not only across re-runs: `changeset version` prepends its new version heading directly under the H1, which pushed the previous run's preamble inside that version's body — the parser retained it there, duplicating the preamble between entries once per release (three copies by 2.3.0). The parser now strips the script's own preamble lines wherever they appear; this repo's CHANGELOG.md is regenerated clean in the same change.
