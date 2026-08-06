---
'frontend-skills': minor
---

feat(design-system): add the eq-design-system skill

A sixth skill covering the design token system as reusable boilerplate. It ships the theme file a
project copies on day one — four layers (brand primitives, semantic tokens, dark overrides, Tailwind
mapping) with the shadcn/ui token names kept verbatim so generated components drop in unchanged — and
the procedures that change it: scaffolding, rebranding by editing one layer, adding dark mode, adding
or removing a token, and migrating an app that already has colours hardcoded in it.

It also adds `check-tokens.mjs`, an audit script that fails on hardcoded colours, `var()` fallback
literals, tokens declared in only one theme, `@theme` aliases pointing at nothing, and arbitrary
Tailwind values that restate a scale step. None of those are visible to oxlint, which reads no
stylesheet and does not inspect class strings.

`eq-frontend-standards` keeps the rules for using a token from a component; its `styling.md` §5 now
points at the new gate rather than stating those rules have no script behind them. Reasoning for the
split is in `docs/adr/0017-design-system-as-its-own-skill.md`.
