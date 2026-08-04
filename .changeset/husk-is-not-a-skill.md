---
"frontend-skills": patch
---

Two greenfield-adoption defects, both found by the first consumer repo:

- `starter/vitest.config.ts` failed `tsc -b` on every fresh adoption (TS2349) — narrowing on
  `typeof viteConfig === 'function'` leaves a union of vite's three function-config signatures,
  which TypeScript cannot call. The call now passes through a parameter typed as the widest of the
  three (`UserConfigFn`), a sound widening rather than a cast. Repos migrated on 1.1.1 already
  copied the broken file; the 1.1.2 migration step in `standard-check.mjs` says to re-pull it.
- `init-greenfield.mjs --vendor-skills` treated an existing but **empty** `.claude/skills/<name>/`
  directory as already vendored, reporting success while vendoring nothing — after which CI's
  structure gate resolved the husk first and died on `MODULE_NOT_FOUND`. Vendored is now a statement
  about content (`SKILL.md`, plus `scripts/check-structure.mjs` for the standard itself), and the
  copy fills husks and partial copies without overwriting any existing file.
