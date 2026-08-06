---
"frontend-skills": minor
---

Branch names are now machine-enforced, closing a measured field failure: given a Linear issue, a session adopted Linear's suggested `<username>/<id>-<full-title>` branch name wholesale instead of the standard's `<type>/<ticket>-<short-slug>`. branch-guard now blocks `git commit` on a branch whose name is outside the format (types from the commit-type table; the tracker ID keeps its case; `CLAUDE_BRANCH_GUARD_ALLOW=1` remains the explicit override), the workflow skill's Branch naming section says outright that a tracker's suggested name is not the format, and migration 2.8.0 tells existing repos to re-copy the hook.
