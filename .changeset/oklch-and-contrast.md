---
'frontend-skills': minor
---

feat(design-system): OKLCH token values and a machine-checked contrast gate

The design-system starter now writes every layer-1 colour as `oklch(L C H)` with the source hex kept
in a trailing comment. This matches Tailwind v4's default palette and shadcn/ui's v4 themes, and it
makes ramps derivable by shifting lightness alone rather than picking four colours by eye. Every
converted value round-trips to its original hex exactly, so nothing changed appearance.

`check-tokens.mjs` gains a seventh check: WCAG contrast, computed for both themes. The pairs are
**derived from the token file rather than listed** — every `--x-foreground` against `--x`, page and
muted text against `--background` and `--card`, and `--input` and `--ring` at the 3:1 non-text floor.
A `-foreground` the derivation cannot pair is itself a finding, so adding a token cannot quietly
escape the audit. `--border` is exempt from 3:1 as a decorative separator.

The new check found three real defects in the starter shipped in 2.6.0 and this release fixes them:
`--input` was 1.20:1 against the page, and dark `--muted-foreground` was 3.62:1 on `--muted`.
`--neutral-500` is retuned to a true mid-grey, `--input` points at it in both themes, and dark muted
text moves to the 400 step.

Also adds a stated scope boundary: no DTCG/JSON token layer, and the trigger that would change that
— a second consumer such as a native app or Figma variable round-tripping. Reasoning for all three
in `docs/adr/0018-oklch-and-machine-checked-contrast.md`.
