# 0013 — 4-space indent, by organizational decision

Date: 2026-08-05
Supersedes: [0009](0009-two-space-indent-over-the-inherited-four.md)

## Context

ADR 0009 (2026-08-05) moved the indent from the inherited 4 to 2, on the grounds that 2-space is
the dominant JS/TS convention, and closed with: "an indent value flips per-repo churn every time it
moves, so it should move at most once more, if ever." This is that once: the organization's
leadership has ruled for 4-space indentation across the codebase. An indent value is a coin-flip
readability convention with an org-wide consistency requirement — the kind of decision that
belongs to the organization, not to ecosystem majority, and the standard's job is to enforce the
decided value, not to re-litigate it.

## Decision

**`tabWidth: 4`**, with `.editorconfig`'s `indent_size` matching. `printWidth: 120` stands (ADR
0007) — at 4-space it earns its width even more, since deeper indentation burns more columns.

Two YAML carve-outs return (they were retired in 0009 when the global value matched): YAML
tooling and every ecosystem example assume 2-space, and 4-space YAML is nonstandard enough to trip
reviewers — so `.oxfmtrc.json` gets a `*.yml`/`*.yaml` override at `tabWidth: 2` and
`.editorconfig` a matching carve-out.

## Consequences

- **This is the third whole-repo rewrap in the standard's first week** (200→120 width, 4→2 indent,
  2→4 indent). Adopted repos re-run `npm run format` once more; the mechanical commit MUST be
  listed in `.git-blame-ignore-revs`. The churn cost was raised and accepted as the price of the
  org-wide ruling; the 1.8.0 migration entry names the steps.
- A fresh Vite scaffold's 2-space indent no longer matches; the greenfield first-run reformat
  grows back to quotes, semicolons AND indent.
- The value is stated in `.oxfmtrc.json`, `.editorconfig`, `SKILL.md` §1 and `hygiene.md` §8 —
  they move together or the docs contradict the config.
- ADR 0009 stands as the record of why 2 was chosen then; this ADR supersedes its decision, not
  its reasoning. Per 0009's own closing rule, the indent value should now be considered settled.
