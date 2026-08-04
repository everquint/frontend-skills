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

## Don't hand-write what the job generates

`CHANGELOG.md` is a build output. A hand-written entry disagrees with the changesets that actually
shipped, so the file stops being derivable from them, and the next `changeset version` either overwrites
the edit or conflicts with it. Delete a changeset only when its content is already in a released
`CHANGELOG.md` — otherwise the next release re-bumps for work that already shipped, which produces a
duplicate changelog entry and a version nobody expected.
