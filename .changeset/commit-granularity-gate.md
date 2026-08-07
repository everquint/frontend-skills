---
"frontend-skills": minor
---

/pre-pr gains step 8, commit granularity — field feedback: an agent session delivered a whole task as one big commit with one long description. The gate now reads `git log origin/HEAD..HEAD` and fails when a single commit mixes unrelated concerns (this standard merges with merge commits, so every commit is permanent history), when wip/typo noise commits should be squashed, or when the message is an unreadable inventory instead of the one change and why. Migration 2.10.0: re-pull pre-pr.md.
