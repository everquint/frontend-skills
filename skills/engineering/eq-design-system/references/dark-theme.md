# Dark theme — wiring, exceptions, and verification

`SKILL.md` §6 states the rules. This is how the theme is switched, which tokens need a real
exception rather than a ramp flip, and how the result is checked.

## 1. Class, not media query

`.dark` on the document element, with `@custom-variant dark (&:is(.dark *))` so the `dark:` utility
variant follows the class.

`prefers-color-scheme` alone cannot be overridden by an in-app toggle, and an app with a toggle that
loses to the OS setting is worse than an app with no toggle. The OS preference is still honoured — as
the **initial** value of the setting, not as the mechanism.

Three states, not two: `light`, `dark`, and `system`. `system` is the default, reads
`prefers-color-scheme`, and follows it live via a `change` listener on the media query. An app that
only stores `light`/`dark` silently freezes whatever the OS said the first time it loaded.

## 2. First paint

The class must be on `<html>` **before** first paint. Applying it in a mount effect means the page
paints light, then flips — a flash that is most visible to exactly the users who chose dark.

A blocking inline script in `<head>`, ahead of the stylesheet, is the mechanism: read the stored
preference, resolve `system` against the media query, set the class. It runs before the body exists,
so it must touch only `document.documentElement`. Server-rendered apps that mismatch here produce a
hydration warning, which is the correct signal — the fix is the inline script, not suppressing the
warning.

`next-themes` implements exactly this pattern; a hand-rolled toggle needs the same three parts
(stored preference, blocking resolution, live `change` listener) or it has one of the failures above.

## 3. `color-scheme` is not optional

Both blocks declare it — `light` in `:root`, `dark` in `.dark`. It is what tells the browser to paint
the surfaces the page does not own: form control internals, the default scrollbar, the canvas behind
a short page, and the address bar on mobile. Omitting it produces the characteristic half-themed
result — dark content in a white-bordered viewport with white select dropdowns.

## 4. Which tokens need a real exception

Most of layer 3 is the neutral ramp read from the other end. These are the tokens where that is not
enough, and each one carries its reason on the line in the starter:

| Token group | Why the flip is not enough |
|---|---|
| **Brand fill** | The 300 brand step is tuned for contrast against white. On near-black it loses contrast in the other direction; the dark theme takes the 200 step and inverts the foreground with it |
| **Status hues** | An AA-on-white red (`#d92d20`) is unreadable on near-black. The dark theme takes the `-bright` primitives, which is why they exist as separate layer-1 names |
| **Subtle status fills** | A light tint (`#fdecea`) is a near-white block on a dark card. The dark theme composes a low-percentage `color-mix` of the bright hue against transparent instead |
| **Shadows** | Depth on white reads as dirt on near-black. Raise `--shadow-opacity`; removing shadows entirely loses the layering that separates a popover from the surface under it |
| **Borders** | The light theme separates surfaces with a darker line, the dark theme with a *lighter* one. The ramp flip handles this — the exception is a border that was carrying the separation on its own and now needs a raised surface instead |
| **Images and illustrations** | No token reaches raster content. A logo with baked-in white, a screenshot, or a chart image needs a second asset swapped by the theme, or a container that keeps a light surface under it |

**A dark override is the same colour re-toned, not a different colour.** An override that changes hue
is a second design, and it will drift from the first. `check-tokens.mjs` cannot see this; a reviewer
can.

## 5. Contrast, in both themes

**This is machine-checked now.** `scripts/check-tokens.mjs` derives every pair from the token file and
computes the WCAG ratio in both themes — 4.5:1 for text, 3:1 for `--input` and `--ring` under WCAG
1.4.11 — and fails on anything under its floor. Run it after any layer-1 or `.dark` edit; a colour
change that looks fine in light mode is exactly the change that breaks the dark pair.

The checker reads `oklch()` and hex directly, so it needs no browser and no build. What it cannot
evaluate — a `color-mix()` in a paired slot — it reports rather than skips.

The pairs that fail most often, and are worth looking at first when it does fail:

- `--muted-foreground` on `--muted`. It is the token most often picked by eye for "quieter", and
  quieter is exactly what pushes it under 4.5:1.
- `--primary-foreground` on `--primary`, after a rebrand. A brand swap changes the surface and leaves
  the foreground, and a mid-tone brand fails against both white and black text.
- Status foregrounds on their dark-theme hues, which are lighter — the light-theme white foreground
  is wrong there, which is why the starter inverts them to the near-black neutral.
- The focus ring against **both** the surface it sits on and the fill it surrounds.

What the token checker **cannot** see: contrast of text over an image or gradient, a colour applied
by a component outside the token system, and any pairing the design uses that the derivation does not
predict — `--foreground` on `--accent`, say. Those stay with an axe pass over the primary flows, run
once per theme (`../eq-frontend-quality-bar/SKILL.md` §4). A pass in one theme certifies nothing about
the other, and neither tool judges whether a passing colour is *legible* at the size it is used.

## 6. Verification checklist

Before calling a dark theme done:

1. `node scripts/check-tokens.mjs src` exits 0 — no `dark-only-token`, no `derived-literal`, and no
   `contrast` finding in either theme.
2. Every screen renders in both themes with no white block and no black block that was not designed.
   The unconverted-literal failure looks like a rendering glitch, not like a missing token.
3. Toggle mid-session on a screen with an open popover, dropdown and modal. Portalled content
   rendered outside the element carrying `.dark` themes wrong, and only mid-session toggling shows
   it.
4. Reload on each of the three settings, and change the OS setting while `system` is active.
5. Form controls, native scrollbars and the canvas behind a short page — the `color-scheme` set.
6. Text over any image, gradient or video — the one contrast case the checker structurally cannot
   reach, and the one dark mode breaks most often.
