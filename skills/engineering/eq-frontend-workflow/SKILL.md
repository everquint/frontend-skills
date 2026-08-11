---
name: eq-frontend-workflow
description: Delivery workflow — branch model, branch or worktree, commits, PRs, review, merge, release, rollback, and how to split work between a primary agent and subagents. Use when starting work, briefing a subagent, writing a commit message, opening a PR, running the pre-push gate, deciding whether a change is mergeable, or reverting.
---

# Frontend Delivery Workflow

## Branch model

Trunk-based — one long-lived branch, the default branch; the why and the two measured incidents
behind it: ADR 0016 in the `frontend-skills` repo. Every other branch is short-lived: branched off
the default branch, merged back via a PR with the required checks, deleted on merge. No `develop`,
no permanent release or environment branches — `release/<major>.x` exists only when a consumer
needs a fix on a previous major (cut from that major's last tag, cherry-picks only, deleted when
that major's support ends). **Never commit to the default branch; create the work branch before
the first edit.** Protection on the remote is verifiable, not assumed —
`gh api repos/<owner>/<repo>/branches/<default>/protection` is the protection state, unqueryable
means absent, and required checks bind an admin's direct pushes only with `enforce_admins` on (`../eq-frontend-standards/references/hygiene.md` §6).

## Branch vs worktree

Default to a **branch** — the working tree already has `node_modules`, editor state, and build caches warm. A **git worktree** is a second checkout of the same repository on its own branch, in its own directory. It costs a dependency install: a fresh worktree has no `node_modules` — **assume a full reinstall per worktree** (minutes and gigabytes on a large repo) unless a shared store is verified for this repo.

| Situation | Use | Why |
|---|---|---|
| One agent or one person, one task | Branch | No install cost, warm caches |
| Two or more agents or SESSIONS working at once | Worktree per agent/session | Shared HEAD — the silent-failure hazard below, not just a dirty-tree collision |
| Risky or disposable spike | Worktree | Delete the directory to discard everything, no branch surgery |
| Long-lived work needing frequent switching back to the default branch | Worktree | Avoids repeated rebuild of the primary checkout |
| Hotfix while a feature is mid-flight and uncommitted | Worktree | Do not stash; stash is invisible state that gets lost |

**Two interactive sessions in one checkout fail silently.** Branches do not isolate them: HEAD is
shared, so session B's `git checkout` retargets session A between reading its branch and
committing — the commit lands on B's branch with no error (measured: a fix-branch commit reached
main past its required checks). Worktree per interactive session, and re-check
`git branch --show-current` immediately before every commit regardless. A worktree isolates HEAD
and the working tree ONLY — `~/.claude/settings.json`, plugin registrations, and everything
outside the repo stay shared and clobberable.

Claude Code subagents accept `isolation: "worktree"` natively — the agent gets its own worktree and it is cleaned up automatically if nothing changed. Use it for parallel agent fan-out, not for a single sequential task. Remove a finished worktree with `git worktree remove <path>`; inspect with `git worktree list`.

## Execution model

The primary agent **orients, plans, decides the approach, and holds the thread**. Subagents execute. The primary agent is not the one making most of the edits.

| Rule | What it means |
|---|---|
| The brief is self-contained | A subagent starts with no context — nothing carries over. Name the files to touch, the intended change, the reference docs that apply *by filename* (`structure.md`, `styling.md`, `correctness-rules.md`), and the commands to run. A brief that omits the conventions produces work that fails review. |
| Parallel by default | Independent subagents run in parallel in a single message. Sequence only where one step's output is genuinely the next step's input. Each concurrent agent gets its own worktree — see the table above. |
| Model per task class, not per habit | Scaffolds, renames, mechanical test edits and doc updates go to a smaller model. Design-sensitive work, tricky runtime logic and reviews go to the strongest available. |
| No upward escalation from a subagent | A subagent must not call a stronger-model advisory tool. Doing so re-sends a large transcript to re-derive context the subagent was already briefed on: real cost, no new information. State the prohibition in the brief — a subagent that inherits such a tool reaches for it otherwise. |
| A subagent finishes, then reports | It runs the gate steps below for the files it touched and states what each returned. Its report is evidence, not a conclusion. |
| The working tree may hold work you did not author | `git stash` to get a clean build ends the session with a clean `git status` and someone else's work parked on no branch, invisible until a person thinks to run `git stash list` — where it also interleaves with lint-staged's backup stash (`../eq-frontend-standards/references/hygiene.md` §5). The starter's `.claude/settings.json` denies `Bash(git stash:*)` outright. |
| Destructive git verbs are never incidental to another task | `git checkout -- .`, `git restore <path>`, or reverting a hunk you did not recognise in order to get lint green destroys unstaged changes, and unstaged changes have **no reflog entry** — nothing recovers them. Run one only when the user named that revert. |

**Reviews belong to the top-level agent, never a subagent.** A subagent sees only its own slice, so its review is scoped wrong and duplicates what the orchestrator must run over the whole change anyway. The two-review gate in the Review section below runs once, by the agent that owns the full change, against its final state.

**The primary agent stays responsible for the result.** Read what a subagent returns, verify its claims against the actual diff, and never relay an unverified summary as fact.

The primary agent edits directly in exactly three cases: a one-line or trivially mechanical fix, documentation, and anything the user asks to be done inline.

## Before writing it: look it up

Three rules, all facts rather than judgement, so all looked up rather than assumed. **Does it
already exist** — search the registry and the org's repos before hand-rolling; justify any new
dependency in the PR body. **Does the API behave as you assume** — read its docs at the pinned
version, via a docs-retrieval tool such as Context7 when mounted, otherwise the installed
package's own `.d.ts` and `CHANGELOG`. **Can the runtime answer instead** — then measure; a probe
outranks any document. Precedence and the losses behind these rules: `references/looking-it-up.md`.

## Branch naming

`<type>/<ticket>-<short-slug>`

- `type` is one of the commit types below; `slug` is lowercase kebab-case, three words or fewer; `ticket` is the tracker ID for the work — every branch maps to exactly one ticket.

`feat/AB-1420-inline-citations`, `fix/AB-1533-stale-composer-focus`, `chore/AB-1601-bump-vite`

**A tracker's suggested branch name is not the format** — Linear hands agents `<username>/<id>-<full-title>` ready-made; rename to the format above before the first commit (branch-guard blocks commits on non-conforming names).

## Commits

Format: `<type>: <description>`, imperative mood, no trailing period. Enforced by **commitlint** in a `commit-msg` git hook with `@commitlint/config-conventional`.

| Type | For |
|---|---|
| `feat` | New user-visible behaviour |
| `fix` | Corrected behaviour |
| `refactor` | No behaviour change |
| `perf` | Faster or lighter, same behaviour |
| `docs` | Documentation only |
| `test` | Tests only |
| `build` | Build config, bundler, dependencies |
| `ci` | Pipeline config |
| `chore` | Everything else with no product effect |
| `style` | Formatting only, no code meaning changed |
| `revert` | Reverts a prior commit |

Rules:

- **A breaking change is marked**: `!` after the type (`feat!: …`) plus a `BREAKING CHANGE: <what breaks, what to do>` footer — the footer is what a reader greps for when an upgrade fails.
- **One logical change per commit.** A commit that touches two unrelated concerns is two commits.
- **Never mix a refactor and a behaviour change in one commit.** A moved file plus a changed condition produces a diff where the condition is invisible, and reverting the bug reverts the refactor with it. Move first, change second, in separate commits.
- Scopes (`feat(composer): …`) are optional. If used, be consistent within a package.

### Merge with merge commits, never squash

- History keeps **every individual commit**, so the local `commit-msg` hook genuinely protects the log. PR-title linting is redundant under this model — do not configure it, since the titles are not what lands.
- Commit granularity matters far more than under a squash workflow. Under squash a sloppy intermediate commit disappears at merge; here it is permanent and will be read during a future bisect. Clean up the branch before the gate: `git rebase -i` to squash "fix typo" and "wip" commits into the commit they belong to.
- commitlint ignores merge commits by default (core `defaultIgnores`), so a `Merge branch …` message does not need to be conventional.

## When to open the PR

Push the branch and open a **draft PR after the first meaningful commit**, not at the end. Draft PRs run CI, which surfaces environment-only failures early, and make in-flight work visible so two people do not build the same thing. Mark **ready for review** only once the gate below passes locally and CI is green.

## The gate before pushing

Run in this order and **stop at the first failure**. A type error makes every later signal noise — lint output, test failures, and build errors downstream of a bad type are symptoms, not findings.

| # | Step | Run when |
|---|---|---|
| 1 | `typecheck` | Always |
| 2 | `lint` | Always |
| 3 | Tests for what changed | Always — the touched test files, not the whole suite |
| 4 | `build` | UI or behaviour changed, or build config changed |

In a repo on the frontend standard, `/pre-pr` is the superset of this table — it adds the structure, standard-version and feature-doc gates — and is what to run when present.
**Never report "all green" for a step that did not run.** State which steps ran and what each returned. "Typecheck and lint pass; tests not run" is an acceptable report. "All green" when tests were skipped is not.

## PR body

Diff narration belongs here, never in code comments. Four sections, all required:

```md
## What changed and why       — behaviour before, behaviour after, the reason. Link the ticket.
## How it was verified        — real commands and real output. Paste it.
## Risk and rollback          — what breaks if this is wrong, who notices first, the revert command.
## Deliberately left out      — scope cut, follow-up tickets, known gaps.
```

**Paste real command output. Never claim a test passed without showing the run.** An unverifiable claim in a PR body is worse than an admitted gap, because it removes the reviewer's reason to check.

## Review

Every change gets **two reviews, run in parallel, both required**:

| Review | Looks for |
|---|---|
| Conventions | Placement and naming (`structure.md`), the styling layer order (`styling.md`), comments, identifier semantics and per-file budgets (`code-quality.md`), duplication (`duplication.md`) |
| Correctness | Runtime bugs: state and effect loops, stale closures, hook-order and remount hazards, unvalidated external data, optimistic-update rollback, index remaps that drop or duplicate items, missing tests |

A conventions pass is **not** a bug hunt, and a bug hunt is not a conventions pass. Running one and calling the change reviewed leaves half the surface unread.

**Re-run both after any substantive rewrite.** A review of an earlier version is not a review of the current code.

Two bars every finding must clear:

1. **A concrete failure scenario** — specific inputs or state leading to wrong output, a crash, or data loss. "This is unconventional", "this could be cleaner", and "consider extracting" are not findings.
2. **Verified at source before publishing.** Re-read the cited `file:line`. Grep the repo before claiming anything is unused, dead, or never called. State which findings were not individually verified rather than implying uniform confidence.

Both bars are reviewer-enforced; no tool checks them.

## Merge requirements

Mergeable when all of these hold:

- CI green: typecheck, lint, tests, build.
- Both reviews complete, with every Critical and High either fixed or explicitly accepted in a PR comment.
- Branch up to date with the default branch (merge the default branch in, or rebase — either is fine before the merge commit).
- A changeset present if user-visible behaviour changed (see Release below).
- PR out of draft.

The PR author merges, after approval. Do not merge someone else's PR for them — they know what is still in flight.

**Never merge with a red gate.** **Never pass `--no-verify` to get past a failing hook.** If a hook or a CI step is genuinely wrong, fix the hook and say so in the PR; bypassing it silently converts a one-line fix into an unexplained production incident later.

## Release

**Scoped by readership, not by library-versus-app.** Any repo with discrete releases and someone who reads them — a published library, or an app with users — requires everything below: Changesets, the generated `CHANGELOG.md`, the release job. Semver's *meaning* differs (a library's major is a consumer break; an app's is a judgement call about how large the release is) but the machinery is identical, and [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) is written for applications first. Only a repo whose notes nobody reads — an internal tool, a spike, a continuously-deployed service where the deploy log *is* the record — may skip it and rely on tagging plus GitHub's **Generate release notes** (grouped by `.github/release.yml`, in the starter). Choosing that path because writing notes is work is how a product arrives at launch with no changelog.

Versioning uses **Changesets**. A PR that changes user-visible behaviour includes a changeset file, human-authored, naming the packages and the bump level (`patch` / `minor` / `major`). Its summary is **prose about behaviour** — two or three sentences someone outside the diff would understand, saying what is now possible and why that matters — never the commit subject pasted in again. A changelog assembled from commit titles explains nothing, which is the whole reason the fragment is written at PR time by the person who built the thing, not reconstructed from `git log` at release time. Add it with the changesets CLI; the file lands in the PR and is reviewed like code.

Changesets rather than semantic-release because the bump is a human decision about consumer impact, reviewable per PR, rather than inferred from commit messages — and `feat:` versus `fix:` is routinely wrong at commit time on a branch that later grows. Full comparison: `references/release-tooling.md`.

**The release job owns the version and `CHANGELOG.md`.** It consumes the changesets,
bumps the versions, regenerates the changelog, and tags — none of that is done by hand, and
`CHANGELOG.md` is never hand-written or hand-edited. It lives in `.github/workflows/release.yml`;
`hygiene.md` §1 carries the gate row and §6 the wiring. Why hand-bumps and hand-edits fail, and
which half of this is machine-enforced: `references/release-tooling.md`, "CHANGELOG.md is a build output".

## Rollback

Every change must be revertible without archaeology.

- A single bad commit: `git revert <sha>`.
- A whole merged feature: `git revert -m 1 <merge-sha>` — reverts the entire branch as one unit against the first parent. **This is the stated advantage of merge commits over squash for risky work**: the feature has a single addressable node in history even though it kept all its individual commits.
- A bad release: revert the merge, let the release job publish the next patch. Do not unpublish or retag.

Name the revert command in the PR's Risk and rollback section before merging, not after the incident.
