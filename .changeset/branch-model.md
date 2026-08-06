---
"frontend-skills": minor
---

The delivery workflow now names its branch model: trunk-based development, recorded as ADR 0016. The workflow skill opens with a Branch model section — one long-lived default branch, every other branch short-lived and deleted on merge, no develop or environment branches, release/<major>.x cut only when a previous major needs a fix, and branch protection that is verified with `gh api .../branches/<default>/protection` rather than assumed. hygiene.md's branch-protection guidance is corrected: enforce_admins should be ON from day one even with a single maintainer — it does not lock anyone out of PR merges; it closes the admin direct-push bypass that was measured landing on a protected default branch past its required checks. (Live repo settings are not changed by this release; that stays the owner's call.)
