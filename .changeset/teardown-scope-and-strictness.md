---
"frontend-skills": patch
---

The remaining three defects from the first consumer repo's adoption report:

- `starter/src/test/setup.ts` now registers `afterEach(cleanup)`. With `test.globals` off —
  deliberate in this standard — @testing-library/react cannot auto-register its teardown, so a
  second `render()` in one file left the first tree mounted and every `getByRole` threw
  "found multiple elements", reading as a broken assertion rather than a missing teardown.
- `format`, `format:check`, `lint:fix` and both `lint-staged` commands now exclude
  `.claude/skills/**` and `.agents/**`. oxfmt honours `.gitignore` but the vendored skills are
  deliberately committed, so the first commit reformatted all vendored files — after which the
  vendored copy still passed the vendor sentinel while no longer being byte-identical to the
  standard the version marker records. The vendored tree is now read, never written, matching the
  lint gate's existing treatment.
- `init-greenfield.mjs` now verifies a pre-existing `tsconfig.app.json` / `tsconfig.node.json`
  sets `strict`, `noUncheckedIndexedAccess` and `noImplicitOverride` to `true` (exit 2 with the fix
  named, like the lint-config gate). A kept leaf config without `strict` passed every gate while
  `undefined` flowed through the app unchecked. The ratchet path is respected: with
  `noUncheckedIndexedAccess` live in `tsconfig.strict.json`, its absence from a leaf is the
  documented migration, not a gap.

The 1.1.2 migration steps cover repos that adopted on 1.1.1, including restoring an
already-reformatted vendored tree.
