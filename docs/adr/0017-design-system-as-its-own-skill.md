# 0017 — the design token system as its own skill, not a section of the standards skill

Date: 2026-08-06

## Context

`eq-frontend-standards/references/styling.md` §5 already governs design tokens — no hardcoded colour,
no `var()` fallback literal, no single-theme value, semantic utility in markup and `var(--token)` in
a stylesheet, and spacing/radius/shadow treated as token sets. Those are **rules for using a token
from a component**, and they were the whole of the standard's token coverage.

Two things were missing, and both are the kind of thing every new repo redoes from scratch:

- **The token file itself.** Nothing in the standard said what the set contains, how it is layered,
  what the names are, or what to copy on day one. Each repo invented a structure, so the rules in §5
  applied to a different shape in every project and a token file could not be read across repos.
- **The procedures that change it.** Rebranding, adding dark mode, adding or renaming a token, and
  auditing an existing app were unwritten, and each is a sequence where the obvious order produces a
  half-converted app.

Folding both into the standards skill was the alternative considered. It fails on three counts:
`styling.md` is already the longest reference in the repo and this is a comparable volume again; the
audience differs (a boilerplate copied once per project, versus rules read on every review); and a
skill's description is what loads it, so "scaffold a theme file" and "judge whether a lint finding is
a real defect" want different trigger phrasings on different files.

## Decision

A sixth skill, `eq-design-system`, owning the token system as **boilerplate plus procedures**:

- **`starter/index.css`** — the four-layer file (brand primitives → semantic tokens → `.dark`
  overrides → `@theme` mapping), brand-neutral placeholders, shadcn/ui names verbatim. It lands at
  `src/index.css`, the path `eq-frontend-standards/starter/.oxfmtrc.json` already points its Tailwind
  class sorter at.
- **`scripts/check-tokens.mjs`** — six checks over the stylesheets and class strings oxlint never
  reads: colour literals outside the token file, `var()` literal fallbacks, dark-only tokens, themed
  tokens valued with a literal, `@theme` aliases pointing at nothing, and arbitrary values that
  restate a scale. Exit 2 on findings, matching `init-greenfield.mjs`.
- **Four references** — architecture and ramp design, adoption into an existing repo, dark theme, and
  the boundary with a component library.

**The split is by question, not by topic.** `eq-frontend-standards` answers "is this line of
component code correct?"; `eq-design-system` answers "what does the token file contain and how do I
change it?". Each names the other rather than restating it, and `styling.md` §5 was amended in the
same change to point at the new gate instead of claiming those rules have no script.

## Consequences

- Minor version. Existing repos gain a skill; no rule they were following changed. A repo already on
  the standard adopts the starter through `references/adoption.md` or keeps its own token file, since
  §5's rules never assumed a particular one.
- Two documents now discuss tokens, which is a drift surface. It is bounded the way the repo bounds
  its others: the boundary is stated in both files, each links rather than repeats, and
  `npm run validate` stats every referenced path.
- `check-tokens.mjs` is not wired into this repo's `npm run validate` — it audits a consuming app,
  not this one. Its own correctness is held by the fixtures it was built against, the same standing
  as the other starter scripts.
- Placeholder brand values ship in the starter. That is a deliberate hazard: the scaffold procedure
  says not to ship them, and a repo that does gets a generic blue rather than a broken build.
