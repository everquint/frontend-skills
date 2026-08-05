---
"frontend-skills": patch
---

The over-width class-string ruling stays reviewer-enforced, now by measurement rather than by
default (ADR 0008). Spiked both mechanical routes: oxlint 1.77.0 does not implement
`no-restricted-syntax`, so no flag-only rule exists; and the ecosystem's wrapping autofix
(`better-tailwindcss/enforce-consistent-line-wrapping`, loaded through `jsPlugins`) converges in
isolation but oscillates forever against `sortTailwindcss`, which rejoins a wrapped string past any
`printWidth`. The sorter never merges separate `cn()` arguments — which is why the prescribed fix is
the `cn()` split, the one shape the whole pipeline leaves alone. `styling.md` §1 now states this
with the supersede conditions.
