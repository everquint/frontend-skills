# Token architecture — why the layers are shaped this way

`SKILL.md` §1 states the four layers. This file is the reasoning, the ramp design, the derived
scales, and the two structural variants (multi-brand, and token families beyond colour).

## 1. Why four layers and not two

Two layers — raw values and utilities — is the common shape, and it fails on the second brand and on
the first theme.

- **Without layer 2, a rebrand is a find-and-replace across the app.** `bg-primary-300` says which
  swatch, not which purpose. When the brand green becomes a brand blue, every occurrence has to be
  re-decided individually, because nothing recorded whether that element was primary *because* it
  was the brand or because it happened to look right.
- **Without layer 2, a theme is impossible.** A theme flips the mapping from purpose to value. If
  the component names the value, there is nothing left to flip; `bg-neutral-100` is white in both
  themes by construction.
- **Without layer 1, layer 2 is a wall of literals.** Twelve semantic tokens all holding the same
  brand hex means twelve places to edit, and the relationship between them — that they are the same
  decision — is unrecorded.
- **Without layer 4, the utilities do not exist.** In Tailwind v4 a custom property in `:root`
  generates no class. The alias is the generator, measured in
  `../eq-frontend-standards/references/styling.md` §5.4.

Each layer earns its place by removing one class of edit. The cost is one indirection per lookup,
paid once when reading the token file and never when writing a component.

## 2. Ramp design

**Four brand steps, eight neutral steps.**

The brand ramp feeds a small, fixed set of decisions: the brand fill, its hover, a tint background
for accents, and a darker shade for text on tinted surfaces. Four steps cover them:

| Step | Role |
|---|---|
| `--primary-100` | tint background — accent surfaces, selected rows, subtle badges |
| `--primary-200` | tint border, hover on the tint, and the dark-theme brand fill |
| `--primary-300` | **the brand.** Fills, links, focus ring, active states |
| `--primary-400` | pressed state, and text on a 100/200 tint |

A ten-step brand ramp is more swatches than there are decisions, and the surplus gets picked by eye.
That is the mechanism by which a design system drifts back into ad-hoc colour: the ramp stops being
a set of decisions and becomes a palette.

The neutral ramp is wider because it carries more distinct jobs — page background, card, hover,
border, strong border, secondary text, dark card, dark page — and each of those is a separate
decision that a theme flips independently. Eight steps, near-white to near-black:

| Steps | Light theme role | Dark theme role |
|---|---|---|
| 100–300 | page, card and hover surfaces | text and foreground |
| 400–500 | borders, dividers, disabled fills | borders, muted text |
| 600–800 | secondary and primary text | surfaces, page background |

The ramp is symmetric on purpose: the dark theme reads it from the other end, so a well-spaced light
ramp produces a well-spaced dark theme with no second ramp to maintain.

**Status hues are not on the ramps.** Red, amber, green and blue are fixed meanings, not brand
expressions, and a brand swap must not move them. They sit in layer 1 as their own primitives, in
pairs: the AA-on-white value, and a `-bright` value for dark surfaces.

## 3. Derived scales — one knob, whole set

**Radius.** One `--radius` base in layer 1; every step in layer 4 is a `calc()` multiple of it. The
whole app's corner language moves by editing one number, and no step can drift out of proportion
because no step holds its own value. `--radius-pill` (9999px) and `--radius-circle` (50%) are
geometry, not scale steps, and are literal.

**Shadow.** Six parametric inputs — colour, opacity, blur, spread, and the two offsets — composed in
layer 4 with `color-mix()` into the elevation set. Two properties follow from this:

- Tuning elevation is one edit. Raising `--shadow-opacity` deepens every level in proportion.
- **The dark theme retunes shadows by moving the opacity knob**, not by redeclaring six shadows. A
  shadow that reads as depth on white reads as dirt on near-black; the starter raises the opacity in
  `.dark` so the same geometry produces a shadow that still separates surfaces.

**Spacing.** `--spacing-value` sets Tailwind's spacing unit, so `p-4`, `gap-6` and every other step
derive from it. Changing it rescales the whole layout rhythm coherently — which is also why a raw
`p-[13px]` is a defect: it is the one value that does not move.

## 4. Beyond colour — the families a token system owns

Colour is the family people remember. The others fail the same way and are enforced identically:

| Family | Token | Failure when hardcoded |
|---|---|---|
| Radius | `--radius` + derived steps | `rounded-[7px]` beside an 8px scale — one corner permanently out of rhythm |
| Spacing | `--spacing-value` | `p-[13px]` beside eleven elements on 12px, and it propagates by copy-paste |
| Elevation | `--shadow-*` inputs | a hand-written `box-shadow` keeps its light-theme halo on a dark surface |
| Typography | `--font-*`, `--letter-spacing` | a font swap misses the one component that named the family |
| Stacking | `--z-raised`/`-sticky`/`-overlay`/`-toast` | `z-index: 9999` competitions between a modal, a toast and a sticky header |
| Motion | duration and easing tokens, when the app animates | a "reduce motion" setting cannot reach durations spread across components |

The stacking ladder is worth naming explicitly because it is the family most often left out. Four
rungs, widely spaced, and a component picks a rung rather than a number. The failure it prevents is
not visual drift — it is a modal rendering behind its own overlay, discovered in production.

## 5. Multi-brand and white-label

One build, several brands: layer 1 moves out of `:root` and into a per-brand attribute selector.
Layers 2, 3 and 4 do not change at all, which is the whole return on the layering.

```css
:root,
[data-brand="acme"] { /* layer-1 primitives for Acme */ }

[data-brand="globex"] { /* the same primitive NAMES, Globex's values */ }
```

Three constraints make it work:

- **Every brand block declares every primitive name.** A brand that omits one inherits the default
  brand's value silently, which is the same failure class as `dark-only-token`.
- **The default stays on `:root`.** An unrecognised or missing `data-brand` renders the default
  brand rather than an unstyled page.
- **Brand and theme are independent axes.** `[data-brand] .dark` composes; a per-brand dark block is
  a fourth combination to maintain and is not required, because layer 3 overrides semantic names
  that already resolve through the active brand's primitives.

The same shape serves a component-scoped theme — a panel that is always dark inside a light app.
Scope the layer-3 overrides to that container rather than reaching for `!important` per rule:
overriding the custom properties on the container makes every descendant follow, including the
components that never knew they were being themed.

## 6. Where the boundary sits

The token file owns values and their names. It does not own layout, component structure, or which
CSS layer expresses a given property — that is
`../eq-frontend-standards/references/styling.md` §1, and it is a separate decision procedure. A
token file that starts declaring `.card { padding: … }` has absorbed a component, and the next
person to need a different card padding will fork the class rather than edit the shared one.
