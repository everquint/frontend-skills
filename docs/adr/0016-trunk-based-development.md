# 0016 — trunk-based development over GitFlow

Date: 2026-08-06

## Context

The workflow skill prescribed branch naming, merge style, and worktree use, but never named the
branch *model* — which branches are allowed to exist and for how long. The gap surfaced twice in
one week, both measured in this repo:

- Two interactive agent sessions sharing one checkout let a commit land on the wrong branch with
  no error (the shared-HEAD hazard, now guarded by `branch-guard.sh`).
- A direct push to `main` (ed5b80e) bypassed every required status check, because GitHub's
  required checks gate PR merges only and `enforce_admins` was off — protection that was assumed,
  not verified.

Both failures are branch-model failures before they are tooling failures: the more agents commit
in parallel, the more the model must be explicit, short-lived, and machine-verifiable, because an
agent follows the written rule and a human's unwritten habit protects nothing.

The alternative with name recognition is GitFlow (Driessen, 2010): a permanent `develop` branch,
release branches per release, hotfix branches. Driessen's own 2020 note atop the original post
says it was designed for versioned, slow-release software and recommends "a much simpler workflow
(like GitHub flow)" for continuously delivered software — which is what every repo on this
standard is. Long-lived integration branches also multiply the surface agents can drift on:
every parallel session must pick the right base and the right merge target, and `develop` vs
`main` is a coin-flip an agent will eventually lose. Trunk-based development (a single long-lived
branch, short-lived feature branches, release branches only on demand) is the documented industry
counterpart, and it is the model agent-first tooling assumes: worktree-per-session fan-out only
composes when every worktree branches off the same trunk and merges straight back.

## Decision

Trunk-based development, for this repo and for every repo on the standard:

- **One long-lived branch: the default branch.** Every other branch is short-lived — branched off
  the default branch, merged back via a PR with the required checks, deleted on merge. No
  `develop`, no permanent release branch, no environment branches.
- **`release/<major>.x` exists only on a trigger**: a consumer needs a fix on a previous major
  while the default branch has moved to the next. It is cut from the old major's last tag,
  receives cherry-picks only — never features — and is deleted when that major's support ends.
  This repo has no such consumer today, so no release branch exists.
- **Branch protection must be verifiable, not assumed.** The protection state is whatever
  `gh api repos/<owner>/<repo>/branches/<default>/protection` returns; protection that cannot be
  queried is treated as absent. Required status checks gate PR merges and non-admin pushes; an
  **admin's** direct push bypasses them unless `enforce_admins` (or an equivalent ruleset) makes
  the rules apply to admins too. `enforce_admins` on is compatible with a single maintainer: with
  no approval requirement configured it locks nobody out of PR merges, it only closes the
  admin direct-push bypass measured above — this corrects `references/hygiene.md`'s earlier
  claim that it locks a solo maintainer out, updated alongside this ADR. Changes to a live
  repo's settings remain the owner's call.

## Consequences

- The workflow skill gains a Branch model section carrying these invariants; agents get one
  written answer for base branch, merge target, and branch lifetime.
- The hotfix case GitFlow solved with a permanent structure is handled on demand: a hotfix is an
  ordinary short-lived branch off the default branch, or a cherry-pick onto a `release/<major>.x`
  cut only when the trigger above is met.
- What GitFlow's `develop` provided — a place where features integrate before release — is
  provided by the required checks plus Changesets: integration happens on the default branch,
  and a release is a version PR, not a branch.
