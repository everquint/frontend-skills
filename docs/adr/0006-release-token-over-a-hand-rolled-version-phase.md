# 0006 — A PAT for the release job, not a hand-rolled version phase

Date: 2026-08-04

## Context

`changesets/action` opens the version PR itself. That needs the setting **"Allow GitHub Actions to create
and approve pull requests"**, which is disabled for this organisation and is not ours to change — reading
the org-level value returns `403: must be an org admin`.

The failure is late and misleading. On the first release with changesets pending (run `30903247932`) the
action versioned, wrote `CHANGELOG.md`, committed `chore: version packages`, force-pushed
`changeset-release/main`, and only then failed:

```
HttpError: GitHub Actions is not permitted to create or approve pull requests.
```

Every visible artefact was correct. Only the `POST /pulls` was refused.

A separate bug was found first and fixed in the same area: the action's default commit message and PR
title are both `Version Packages`, which has no conventional-commit type, so the `commit-msg` hook this
standard installs rejected the action's own commit. That is unrelated to the token and stays fixed
regardless.

## Decision

**Use a fine-grained PAT as `RELEASE_TOKEN`** — scoped to the single repository, permissions
`contents: write` and `pull-requests: write` only, with an expiry — passed to the action as its
`GITHUB_TOKEN`, with `${{ secrets.RELEASE_TOKEN || secrets.GITHUB_TOKEN }}` so the tag-only path (which
opens no PR) still works without the secret.

**A hand-rolled version phase was built and rejected.** It replaced the action's version step with shell
that ran `changeset version`, committed, force-pushed `changeset-release/<branch>` and printed the compare
URL for a human to open. It worked and needed no secret. It was rejected because it fails this standard's
own adopt-don't-rebuild rule almost verbatim: custom tooling is a last resort, every piece of it is
maintenance inherited forever, and the ecosystem outlives any internal implementation. Thirty lines of
shell shadowing a maintained action is that clause with a file path on it.

The reversal is recorded rather than quietly dropped, for the reason this directory's `README.md` gives
for never deleting a superseded ADR — the record of a decision that was reversed is the most useful record
there is. The next person to meet this failure will reach for the same reimplementation.

## Consequences

- **A secret to rotate.** When the PAT expires the version path fails at PR creation — a visible red, not
  a silent skip, so the failure mode is acceptable. The expiry date must be recorded where a human reads
  it, not only in GitHub's UI.
- **A side benefit that is not incidental.** A PR opened with the default `GITHUB_TOKEN` triggers no
  downstream workflows, so the version PR would arrive with **no CI** on a diff that rewrites
  `package.json` and `CHANGELOG.md`. A PAT-created PR runs `validate` and `commitlint` normally. This
  argues for the PAT even in a repo where the org setting is enabled.
- **Consumers inherit the problem, so they inherit the documentation.** The starter ships this same
  `release.yml`; any consuming repo under the same org policy meets the identical failure on its first
  release. `eq-frontend-standards/references/hygiene.md` §6 names the failure shape and both fixes, and
  the shipped workflow already reads `RELEASE_TOKEN` with a fallback, so a consumer's fix is adding a
  secret rather than editing a workflow.
- **A release is never lost to this.** The version branch is pushed before the failure, so opening that PR
  by hand recovers the release — which is how v1.1.0 shipped.

> Status note (2026-08-05): the changesets/action step this ADR describes is currently
> COMMENTED OUT in .github/workflows/release.yml pending a RELEASE_TOKEN secret — releases run
> manually (AGENTS.md names the loop). The decision stands; the mechanism is dormant until the
> secret exists.
