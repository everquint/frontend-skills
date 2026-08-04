---
"frontend-skills": patch
---

`measure-rules.mjs` now treats a `tsconfig-error` diagnostic as fatal (exit 2) instead of one
finding among many. oxlint-tsgolint rejects a whole project over a tsconfig it cannot load —
`baseUrl`, removed in TypeScript 6.0, is the common cause — and then silently skips all three
type-aware rules, so `typescript/no-floating-promises` measured zero on the first migrated repo
while 48 real unhandled-promise sites existed, and the script listed a correctness rule in the
"zero violations — enable for free" set. A false zero on a correctness rule is the one output the
script must never print, so it now refuses to report counts at all until the tsconfig loads.
