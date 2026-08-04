---
"frontend-skills": minor
---

`eq-frontend-workflow` now requires two lookups and a measurement before the first edit: search the
registry before hand-rolling, read a library's docs at the pinned version (via a docs-retrieval tool
such as Context7 when one is mounted, otherwise the installed package's own types), and probe the
runtime rather than reasoning about it. Detail in `references/looking-it-up.md`; the changesets
rationale moved to `references/release-tooling.md` to stay inside the SKILL.md budget.

Starter: `tsconfig.node.json` now includes `vitest.config.ts` and `playwright.config.ts`, so a type
error in the coverage gate's own config fails `tsc -b` instead of passing silently.
