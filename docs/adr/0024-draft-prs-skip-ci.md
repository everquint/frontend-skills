# 0024 — draft PRs skip CI, and runner minutes are budgeted

Date: 2026-09-24

## Context

A consumer org ran out of GitHub Actions minutes. It uses GitHub-hosted runners only, so minutes
are the bill and there is a cap. Measured there, PR CI cost about 30 minutes per push. Four causes,
all from the starter workflow as it shipped:

- **Each job bills a whole minute, rounded up.** Four jobs bill at least four minutes per run, and
  the two that install and build bill far more.
- **Draft PRs ran the full pipeline.** `eq-frontend-workflow` told authors to open a draft early,
  and said that draft CI surfaces environment-only failures early. It also meant every push to an
  unfinished branch paid full price for a result nobody acted on.
- **Agents push often.** An agent that pushes after each small fix multiplies the per-push cost.
- **Cancelled runs are still billed.** `cancel-in-progress` saved the rest of a superseded run, not
  the minutes it had already used.

Nothing capped a hung job either: the default `timeout-minutes` is 360.

Two cheaper-looking fixes were rejected. **Merging jobs** saves the per-job round-up, but the
strict-typecheck ratchet is a separate job so that migration debt cannot mask the real gates, or be
masked by them. **Affected-only test runs** break the diff-coverage gate (`hygiene.md`
§6): diff-cover needs the unfiltered coverage report, and a filtered one makes a changed line read
as uncovered.

## Decision

The starter workflow, using only standard GitHub Actions features — no new script, no dependency:

1. **Drafts run nothing.** Every job's `if` requires a push, or a PR that is not a draft.
   `ready_for_review` joins the `pull_request` triggers, so marking a PR ready is its first run.
2. **Superseded PR runs are cancelled; default-branch runs are not.** The concurrency group keys
   on the PR number, and `cancel-in-progress` is true only for `pull_request` events, so every
   commit on `main` keeps a result.
3. **Every job has `timeout-minutes`**: `verify` 20, `typecheck-strict-ratchet` 15, `commitlint`
   and `branch-name` 5.

The workflow skill changes to match: open the draft early for visibility, run the local gate, mark
ready once when the work is done, then batch fixes into one push. `hygiene.md` §6 gains "Spending
runner minutes", which also asks any new job or shard to justify its billed minutes.

## Consequences

- Minor version. `standard-check.mjs` names the migration: re-pull the triggers, concurrency,
  timeouts and draft conditions from the starter.
- **Environment-only failures now surface at ready, not at first push.** That was the one benefit
  draft CI had. The local gate catches everything except a CI-only difference, and those are rare
  enough that paying for them on every draft push was the wrong trade.
- **Required checks show as skipped on a draft.** GitHub reports a job skipped by its `if` as
  success, so a draft can look green. It cannot merge while it is a draft, and `ready_for_review`
  starts the real run on the same commit, so the skipped result never gates a merge.
- A PR converted back to draft stops running CI until it is marked ready again. That is intended.
- Authors and agents must batch pushes after ready. That is a habit, not a gate; nothing enforces
  it. If minute burn returns, the next step is a measured one — per-job minutes from
  `gh run view --json jobs` — not a guess.
