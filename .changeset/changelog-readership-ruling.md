---
'frontend-skills': minor
---

Reverses the v2.11.0 ruling that an app keeps no `CHANGELOG.md`. The changelog mechanism is now
scoped by who reads the notes rather than by library-versus-app: any repo with discrete releases and
readers — a published library or an app with users — keeps Changesets and a generated `CHANGELOG.md`.

The v2.11.0 alternative was tagging each deploy and letting GitHub generate release notes. That
produces a list of PR titles, and a PR title describes code, so an app's users got a changelog that
never explained what they could now do. Keep a Changelog addresses any project that cuts releases
rather than registry consumers specifically, and the fragment-per-PR tools built around it —
release-please, towncrier — are used by applications as much as by libraries. Tag-plus-generated-notes survives as
the fallback for a repo whose notes nobody reads: an internal tool, a spike, a continuously-deployed
service.

Two things now enforce the quality of the fragment rather than just its presence. The Release section
requires the summary to be prose about behaviour — a few sentences someone outside the diff would
understand — and explicitly rejects the commit subject pasted in again. `/pre-pr` gains step 9, which
fails a user-facing diff that ships no changeset, and fails a fragment that is only a restated commit
title. The point of writing the fragment at PR time is that the person who built the feature is the
only one who can describe it cheaply; reconstructing it from `git log` at release time is what
produces changelogs nobody reads.

Apps adopting this need `privatePackages.tag: true` in `.changeset/config.json` — with it false,
`changeset tag` filters a private package out and exits 0 having tagged nothing.
