# Why Changesets, and not the alternatives

The decision the `SKILL.md` Release section states, with the reasoning behind it.

## Changesets vs semantic-release

| | Changesets | semantic-release |
|---|---|---|
| Source of the bump | Human decision, per PR, reviewable | Inferred from commit messages |
| Assumption | Commits are for humans | Commits are fully machine-parseable |
| Monorepos | First-class, multi-package bumps in one file | No native concept |
| Failure mode | Missing changeset — caught by a CI check | A mistyped commit type silently ships a wrong version |

`feat:` versus `fix:` is a judgement about **consumer impact**, and it is routinely wrong at commit time.
A branch that starts as a `fix:` and grows a new option is a `minor`, but the commit that introduced the
option was authored before that was visible. A curated changeset per PR moves the judgement to the point
where the whole change can be seen, and puts it in a reviewable file rather than in a commit subject
nobody re-reads.

The failure-mode row is the deciding one, and it is the same principle as everything else in this
standard: **semantic-release's failure is silent and green.** A typo'd type publishes a wrong version
with a passing pipeline. A missing changeset is a red CI check with an obvious fix.

## The two settings that decide whether any of this works

Both were verified by running the release job, not by reading the docs.

- **`privatePackages: { version: true, tag: true }`.** The default is `tag: false`, which makes
  `changeset tag` tag nothing while reporting success — the release job goes green and produces no tag
  at all. On a private (unpublished) package this is the entire visible output of a release, so the
  default silently turns the whole job into a no-op.
- **A `version` script that also fixes up anything derived from the version.** `changeset version`
  rewrites `package.json` and `CHANGELOG.md` and nothing else. Any other file that records the version —
  a constant a validator asserts against, a doc header — must be updated in the same step, or the
  Version PR lands red.

## The release job's own commit must satisfy commitlint

`changesets/action` defaults both its commit message and its PR title to **`Version Packages`**, which
has no conventional-commit type. This standard installs husky, and the release job runs `npm ci`, which
runs `prepare: husky` — so the `commit-msg` hook is live in the runner and rejects the action's own
commit with `subject may not be empty` / `type may not be empty`. The job fails at `git commit`, having
already rewritten `package.json` and `CHANGELOG.md`.

Set both inputs to a conventional message:

```yaml
commit: 'chore: version packages'
title: 'chore: version packages'
```

**Override the message rather than disabling the hook.** `HUSKY=0` would get the commit made, but the
version commit lands on the default branch where the commitlint CI job reads it, so the same rejection
arrives one step later — and a repo that suppresses its own hooks in CI has lost the guarantee that
every commit in history is parseable.

The failure has one property worth noting: it appears **only on the first release with changesets
pending.** A release with none pending skips the version phase entirely and never makes a commit, so a
repo can release successfully several times before hitting this.

## The version PR needs a token the default one cannot replace

`changesets/action` opens the version PR itself, which requires the repository or organisation setting
**"Allow GitHub Actions to create and approve pull requests."** It is commonly enforced org-wide, so an
individual repo often cannot turn it on. With it off, the default `GITHUB_TOKEN` gets all the way through
versioning, committing and pushing the branch, and then fails on the very last call:

```
HttpError: GitHub Actions is not permitted to create or approve pull requests.
```

Two fixes, in order of preference:

1. **Enable the setting**, if you have access to it.
2. **A fine-grained PAT as `RELEASE_TOKEN`** — scoped to the single repo, permissions `contents: write`
   and `pull-requests: write` only, with an expiry set. Pass it as the action's `GITHUB_TOKEN`.

The PAT fixes a second problem worth having fixed: **a PR opened with the default `GITHUB_TOKEN` triggers
no downstream workflows.** So even where PR creation is permitted, the version PR arrives with no CI on a
diff that rewrites `package.json` and `CHANGELOG.md`. A PAT-created PR runs the normal checks.

Its cost is an expiry date. When the PAT lapses the version path fails at PR creation — a visible red
rather than a silent skip, which is the acceptable failure mode, but **record the expiry where a human
will read it.**

### Rejected: hand-rolling the version phase

Splitting the two phases by hand — a shell step that runs `changeset version`, commits, force-pushes
`changeset-release/<branch>` and prints the compare URL for a human to open — works with no secret at
all. It was built and rejected, because it fails the standard's own **adopt-don't-rebuild** rule almost
verbatim: thirty lines of shell shadowing a maintained action is custom tooling, and every piece of
custom tooling is maintenance inherited forever while the ecosystem outlives it. A PAT is the ordinary
escape hatch; a reimplementation is not.

## Don't hand-write what the job generates

`CHANGELOG.md` is a build output. A hand-written entry disagrees with the changesets that actually
shipped, so the file stops being derivable from them, and the next `changeset version` either overwrites
the edit or conflicts with it. Delete a changeset only when its content is already in a released
`CHANGELOG.md` — otherwise the next release re-bumps for work that already shipped, which produces a
duplicate changelog entry and a version nobody expected.
