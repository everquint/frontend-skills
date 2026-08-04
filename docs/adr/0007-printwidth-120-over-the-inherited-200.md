# 0007 — printWidth 120, over the 200 inherited from `max-len`

Date: 2026-08-04

## Context

ADR 0001 made oxfmt the formatter and dropped `max-len`, and `printWidth: 200` kept the old rule's
ceiling. That number was migration continuity, never an ergonomics decision: the repos being
migrated carried `max-len: [2, 200]`, and 200 avoided asking anything new of them.

The first migrated repo's change request exposed the difference between the two mechanisms.
`max-len` only ever **flagged** lines longer than its limit; oxfmt actively **joins** lines shorter
than its target. Adopting the standard therefore did not preserve hand-wrapped code under a 200
ceiling — it rewrote it *up to* 200: a five-line wrapped import collapsed to one 109-character
line, and a conditional JSX branch collapsed to a single 197-character line. Both legal, neither
readable in a side-by-side diff on a laptop.

Measured on that repo (42,190 source lines, formatted at 200) as the one-time rewrap cost of each
candidate: 100 → 2,728 lines (6.5%), 120 → 1,521 (3.6%), 140 → 882 (2.1%), 160 → 486 (1.2%).

Industry reference points: Prettier defaults to 80 and discourages raising it; Google's JS style
and ESLint's `max-len` default to 80; Airbnb, rustfmt, Google Java and the Linux kernel use 100;
100–120 are the two common team overrides in TypeScript/React codebases. 200 is an outlier that in
practice means the formatter almost never wraps.

## Decision

**`printWidth: 120`**, with `.editorconfig`'s `max_line_length` matching. Top of the common
industry band rather than 100, because this standard's 4-space indent burns columns faster than
the 2-space indent most 80–100-column style guides assume, and nested JSX pays that cost worst.

Timing was part of the decision: with exactly one repo migrated and its reformat commit unpushed,
one repo reformats 1,521 lines once, in a mechanical commit listed in `.git-blame-ignore-revs`.
Every later adopter and every rebased branch would have multiplied that cost.

## Consequences

- Adopted repos re-run `npm run format` once and record the commit in `.git-blame-ignore-revs`;
  the 1.2.0 migration entry in `standard-check.mjs` names the steps.
- The value is stated in the starter's `.oxfmtrc.json` and `.editorconfig`, `SKILL.md` §1, and
  `references/hygiene.md` §8 — they move together or the docs contradict the config.
- Unbreakable single tokens are unchanged at any width: a formatter wraps, it cannot flag, and
  `max-len` has no oxlint equivalent. The dominant real case — a Tailwind class string longer than
  the line — now has a stated convention instead of bare "reviewer-only": extract to a named
  module-level constant or `cva` map (`references/styling.md` §1). Long URLs and base64 literals
  remain reviewer-only.

Supersede this if oxlint ships a `max-len` equivalent (a bound would then be enforceable above the
target) or if measured diff-readability practice moves the common band.
