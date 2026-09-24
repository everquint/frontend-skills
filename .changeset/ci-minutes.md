---
"frontend-skills": minor
---

The starter CI workflow spends fewer GitHub Actions minutes. Draft PRs now run no CI: every job
skips a draft, and `ready_for_review` is a trigger, so marking the PR ready is its first run. A new
push cancels the PR's running pipeline, while a run on the default branch is left to finish. Every
job has `timeout-minutes`, instead of the 360-minute default.

Measured on a consumer org that ran out of minutes: PR CI cost about 30 minutes per push, because
each job bills a rounded-up minute, drafts ran the full pipeline and cancelled runs are still billed.
`eq-frontend-workflow` now says to open the draft early, run the local gate, mark it ready once, and
batch pushes after that. `hygiene.md` §6 gains "Spending runner minutes". The decision is ADR 0024,
and `standard-check.mjs` names the migration under 2.15.0.
