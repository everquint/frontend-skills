---
name: frontend-workflow
description: The delivery workflow for a frontend TypeScript codebase — branching, commits, PRs, review, merge, release, and rollback. Load this when starting a feature or fix, choosing between a branch and a git worktree (including for parallel agents), naming a branch, writing a commit message, opening or filling in a pull request, running the pre-push gate, reviewing someone else's change, deciding whether a change is mergeable, cutting a release or writing a changeset, or reverting shipped work. It states the rule for each step and which rules are mechanically enforced versus reviewer-enforced.
---

# Frontend Delivery Workflow

## Branch vs worktree

Default to a **branch**. The working tree already has `node_modules`, editor state, and build caches warm.

A **git worktree** is a second checkout of the same repository on its own branch, in its own directory. It costs a dependency install: a fresh worktree has no `node_modules`, so a full install runs per worktree. On a large repo that is minutes of wall time and gigabytes of disk each. Some package managers and tools can link or share a store across checkouts; **assume a full reinstall unless it is verified for this repo**.

| Situation | Use | Why |
|---|---|---|
| One agent or one person, one task | Branch | No install cost, warm caches |
| Two or more agents working at once | Worktree per agent | Agents collide over a single dirty working tree — one stages or reverts the other's edits |
| Risky or disposable spike | Worktree | Delete the directory to discard everything, no branch surgery |
| Long-lived work needing frequent switching back to the default branch | Worktree | Avoids repeated rebuild of the primary checkout |
| Hotfix while a feature is mid-flight and uncommitted | Worktree | Do not stash; stash is invisible state that gets lost |
| Task is one file or a doc edit | Branch | Install cost dominates the task |

Claude Code subagents accept `isolation: "worktree"` natively — the agent gets its own worktree and it is cleaned up automatically if nothing changed. Use it for parallel agent fan-out, not for a single sequential task.

Remove a finished worktree with `git worktree remove <path>`. A stale worktree list is reported by `git worktree prune`.

## Branch naming

`<type>/<ticket>-<short-slug>`

- `type` is one of the commit types below.
- `ticket` is the tracker ID for the work. Every branch maps to exactly one ticket.
- `slug` is lowercase kebab-case, three words or fewer.

`feat/AB-1420-inline-citations`, `fix/AB-1533-stale-composer-focus`, `chore/AB-1601-bump-vite`

**Never commit to the default branch.** Create the branch before the first edit. Reviewer-enforced unless branch protection is configured on the remote — configure it.

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

- **One logical change per commit.** A commit that touches two unrelated concerns is two commits.
- **Never mix a refactor and a behaviour change in one commit.** A moved file plus a changed condition produces a diff where the condition is invisible, and reverting the bug reverts the refactor with it. Move first, change second, in separate commits.
- Scopes (`feat(composer): …`) are optional. If used, be consistent within a package.

### This project merges with merge commits, never squash

Consequences, both directions:

- History keeps **every individual commit**, so the local `commit-msg` hook genuinely protects the log. PR-title linting adds nothing and is not configured — the titles are not what lands.
- Commit granularity matters far more than under a squash workflow. Under squash a sloppy intermediate commit disappears at merge; here it is permanent and will be read during a future bisect. Clean up the branch before the gate: `git rebase -i` to squash "fix typo" and "wip" commits into the commit they belong to.

`@commitlint/config-conventional` ignores merge commits by default, so a `Merge branch …` message does not need to be conventional.

## When to open the PR

Push the branch and open a **draft PR after the first meaningful commit**, not at the end. Draft PRs run CI, which surfaces environment-only failures early, and they make in-flight work visible so two people do not build the same thing.

Mark **ready for review** only once the gate below passes locally and CI is green.

## The gate before pushing

Run in this order and **stop at the first failure**. A type error makes every later signal noise — lint output, test failures, and build errors downstream of a bad type are symptoms, not findings.

| # | Step | Run when |
|---|---|---|
| 1 | `typecheck` | Always |
| 2 | `lint` | Always |
| 3 | Tests for what changed | Always — the touched test files, not the whole suite |
| 4 | `build` | UI or behaviour changed, or build config changed |

**Never report "all green" for a step that did not run.** State which steps ran and what each returned. "Typecheck and lint pass; tests not run" is an acceptable report. "All green" when tests were skipped is not.

## PR body

Diff narration belongs here, never in code comments. Four sections, all required:

```md
## What changed and why
The behaviour before, the behaviour after, and the reason. Link the ticket.

## How it was verified
Real commands and real output. Paste it.

## Risk and rollback
What breaks if this is wrong, who notices first, and the revert command.

## Deliberately left out
Scope cut, follow-up tickets, known gaps.
```

**Paste real command output. Never claim a test passed without showing the run.** An unverifiable claim in a PR body is worse than an admitted gap, because it removes the reviewer's reason to check.

## Review

Every change gets **two reviews, run in parallel, both required**:

| Review | Looks for |
|---|---|
| Conventions | Placement, naming, file size, styling split, comment policy, structure rules |
| Correctness | Runtime bugs: state and effect loops, stale closures, hook-order and remount hazards, unvalidated external data, optimistic-update rollback, index remaps that drop or duplicate items, missing tests |

A conventions pass is **not** a bug hunt, and a bug hunt is not a conventions pass. Running one and calling the change reviewed leaves half the surface unread.

**Re-run both after any substantive rewrite.** A review of an earlier version is not a review of the current code.

Two bars every finding must clear:

1. **A concrete failure scenario** — specific inputs or state leading to wrong output, a crash, or data loss. "This is unconventional", "this could be cleaner", and "consider extracting" are not findings.
2. **Verified at source before publishing.** Re-read the cited `file:line`. Grep the repo before claiming anything is unused, dead, or never called. Say plainly which findings were not individually verified rather than implying uniform confidence.

Both bars are reviewer-enforced; no tool checks them.

## Merge requirements

Mergeable when all of these hold:

- CI green: typecheck, lint, tests, build.
- Both reviews complete, with every Critical and High either fixed or explicitly accepted in a PR comment.
- Branch up to date with the default branch (merge the default branch in, or rebase — either is fine before the merge commit).
- A changeset present if published behaviour changed.
- PR out of draft.

The PR author merges, after approval. Do not merge someone else's PR for them — they know what is still in flight.

**Never merge with a red gate.** **Never pass `--no-verify` to get past a failing hook.** If a hook or a CI step is genuinely wrong, fix the hook and say so in the PR; bypassing it silently converts a one-line fix into an unexplained production incident later.

## Release

Versioning uses **Changesets**. A PR that changes published behaviour includes a changeset file, human-authored, naming the packages and the bump level (`patch` / `minor` / `major`) with a one-line consumer-facing summary. Add it with the changesets CLI; the file lands in the PR and is reviewed like code.

Why changesets rather than semantic-release:

| | Changesets | semantic-release |
|---|---|---|
| Source of the bump | Human decision, per PR, reviewable | Inferred from commit messages |
| Assumption | Commits are for humans | Commits are fully machine-parseable |
| Monorepos | First-class, multi-package bumps in one file | No native concept |
| Failure mode | Missing changeset — caught by a CI check | A mistyped commit type silently ships a wrong version |

`feat:` versus `fix:` is a judgement about consumer impact, and it is routinely wrong at commit time on a branch that later grows. A curated changeset per PR moves that judgement to where the whole change is visible.

**Manual version bumps in a `chore: bump version` commit are an anti-pattern.** They race with the release tooling, produce versions with no changelog entry, and make the published version disagree with the tag. Version numbers are written by the release job, never by hand.

## Rollback

Every change must be revertible without archaeology.

- A single bad commit: `git revert <sha>`.
- A whole merged feature: `git revert -m 1 <merge-sha>` — reverts the entire branch as one unit against the first parent. **This is the stated advantage of merge commits over squash for risky work**: the feature has a single addressable node in history even though it kept all its individual commits.
- A bad release: revert the merge, let the release job publish the next patch. Do not unpublish or retag.

Name the revert command in the PR's Risk and rollback section before merging, not after the incident.
