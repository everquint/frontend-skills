---
name: eq-design-system
description: The design token system — a four-layer boilerplate (brand primitives → semantic tokens → theme overrides → framework mapping) that any project starts from, plus the rebrand, dark-theme and audit procedures. Use when scaffolding a new project's theme file, rebranding an existing one, adding dark mode, adding or renaming a token, or auditing a repo for hardcoded colours, radii and shadows.
---

# Design System

The token system is boilerplate: the same four layers, the same names, in every repo. Only layer 1
differs between brands. Start from `starter/index.css` and edit that layer.

This skill owns the **token system itself** — its shape, its names, and the procedures that change
it. Which layer of CSS owns a given *property*, and the rules for referencing a token from a
component, are `../eq-frontend-standards/references/styling.md` §1 and §5. Skills install flat as
siblings, which is why that path goes up one level.

## 1. The four layers

One file. Order matters, because each layer resolves through the one above it.

| Layer | Where | Holds | Edited when |
|---|---|---|---|
| **1 Brand primitives** | `:root`, top block | raw values — colour ramps, font stacks, `--radius` base, `--spacing-value`, parametric shadow inputs | rebranding, and only then |
| **2 Semantic tokens** | `:root`, below | what a value is *for* — `--background`, `--card`, `--primary`, `--muted-foreground`, `--border`, `--ring`. Every value is `var(--primitive)` | a new purpose appears |
| **3 Theme overrides** | `.dark` | the second declaration of a layer-2 name, plus the shadow knob. Never a new name | a token reads wrong on dark surfaces |
| **4 Framework mapping** | `@theme inline` | `--color-* → var(--semantic)`, radius steps, spacing unit, fonts, composed shadows | a layer-2 token needs a utility |

**A token without a layer-4 alias has no utility class.** `bg-surface-hover` with no
`--color-surface-hover` emits no rule at all — the class lands in the DOM and does nothing. That
measurement, and the `bg-(--surface-hover)` shorthand that works without an alias, are in
`../eq-frontend-standards/references/styling.md` §5.4.

Why these four and not two, how the ramps are shaped, and how the parametric radius and shadow sets
derive from single knobs: `references/token-architecture.md`.

## 2. Scaffolding a new project

1. Copy `starter/index.css` to `src/index.css`. That exact path is what
   `../eq-frontend-standards/starter/.oxfmtrc.json` points its Tailwind class sorter at — a
   different path means the sorter silently sorts nothing and still exits 0.
2. Replace layer 1 with the brand's values. Ask for the brand hex, the neutral ramp endpoints and
   the fonts if they are not supplied; do not invent a palette and do not ship the placeholders.
3. Wire the font families onto `--font-sans` / `--font-serif` / `--font-mono` in the framework layer
   (`next/font` variables on `<html>`, or an `@font-face` block). Layer 1 declares the stack; the
   framework supplies the family.
4. Append `starter/scrollbar.css` only when the app styles its own scrollbars. It declares no token
   of its own.
5. Run `node scripts/check-tokens.mjs`. Exit 0 before the first feature commit.

Adopting the system into a repo that already has colours in it is a different procedure, with a
different order of operations: `references/adoption.md`.

## 3. The naming contract

The names are fixed across projects so that a layer-2 mapping transfers unchanged from one repo to
the next, and so shadcn/ui components drop in without edits.

- **Brand ramp**: `--primary-100` … `--primary-400`. 100 is the lightest tint, 400 the darkest
  shade, **300 is the brand colour**. Four steps, not ten — a ramp wider than the number of
  decisions it feeds invites picking by appearance.
- **Neutral ramp**: `--neutral-100` … `--neutral-800`, near-white to near-black.
- **Semantic set**: the shadcn/ui names verbatim — `--background`, `--foreground`, `--card`,
  `--card-foreground`, `--popover`, `--popover-foreground`, `--primary`, `--primary-foreground`,
  `--secondary`, `--muted`, `--muted-foreground`, `--accent`, `--destructive`, `--border`,
  `--input`, `--ring`, `--chart-1`…`5`, `--sidebar-*`. **Renaming one breaks every generated
  primitive silently** — the component keeps its class, the class keeps its rule, and the rule
  resolves to nothing.
- **A `-foreground` token is the pair of the surface above it.** `--card-foreground` is what is
  legible on `--card`. Adding a surface without its foreground is half a token.
- The starter adds `--warning`, `--info`, `--surface-hover`, `--border-strong`, `-subtle` status
  fills and a `--z-*` ladder on top of the shadcn set. Those are this standard's, not shadcn's.

## 4. Adding, changing and removing a token

**Adding.** Decide the layer first, and reuse before adding:

1. An existing semantic token whose **meaning** fits — reach for it. Matching appearance instead of
   meaning is what couples a warning banner to the destructive re-tone.
2. No meaning fits → add a layer-2 name, valued `var(--primitive)`, **declared in both themes**, and
   aliased in layer 4 in the same commit.
3. The primitive it needs does not exist → add it to layer 1 first. A layer-2 value is never a
   literal.

**Changing.** A value change happens in layer 1 and propagates. A value changed in layer 2 or 3 is
either a mis-layered token or a genuine per-theme exception, and an exception carries the reason on
the line.

**Removing.** Grep the token name across `src/` and the layer-4 aliases before deleting it. A
removed token leaves the utility class emitted and unresolvable, which renders as the inherited
value rather than as an error.

Two uses of the same primitive utility (`bg-neutral-300`, `text-primary-400`) means the case wanted
a semantic token. Promote it.

## 5. Rebranding

Edit layer 1. Nothing else.

Swap the `--primary-*` ramp, the `--neutral-*` ramp, the status hues, the font stacks and the
`--radius` base. Layers 2, 3 and 4 are untouched, because every value in them is a reference. A
rebrand that reaches layer 2 is the signal that a literal leaked in — `check-tokens.mjs` reports it
as `derived-literal`.

Then re-check the pairs the ramp swap invalidates: every `-foreground` against its surface, and the
dark-theme status hues, which are separate primitives precisely so a rebrand can move them
independently. Contrast targets and the full dark procedure: `references/dark-theme.md`.

Multi-brand and white-label — one build, several layer-1 blocks — is in
`references/token-architecture.md`.

## 6. Dark theme

- **A class, not a media query.** `.dark` on the root element, `@custom-variant dark (&:is(.dark *))`
  for the utility variant. A media query cannot be overridden by a user's in-app toggle.
- **`color-scheme` is declared in both blocks.** Without it the browser paints form controls,
  scrollbars and the canvas behind the page in the wrong mode.
- **Layer 3 declares only names layer 2 already declared.** A name that first appears in `.dark`
  does not exist in light mode; `check-tokens.mjs` fails on it as `dark-only-token`.
- **Never a hex fallback inside `var()`.** `var(--card, #fff)` pins the light value and wins exactly
  when the token is missing — the measured failure is
  `../eq-frontend-standards/references/styling.md` §5.2.
- Contrast is verified in **both** themes. Dark mode is where contrast regressions hide, and a
  status colour tuned to pass AA on white fails on near-black.

Toggle wiring, first-paint flash, the exceptions catalogue (status hues, shadows, images, borders)
and how to test a theme: `references/dark-theme.md`.

## 7. Primitives and components

The token system is what a component library consumes; it is not the component library. This
standard names no primitive library (`../eq-frontend-standards/references/styling.md` §1.1), and the
starter installs none. What the token system guarantees is that a shadcn/ui component copied in
renders correctly with no edit, because the names it reads are the names declared here.

Where a variant's colours live, what belongs in `components/ui/` versus a feature folder, and why a
generated primitive is never hand-edited: `references/primitives.md`.

## 8. What is machine-enforced

`scripts/check-tokens.mjs` — six checks, all in files oxlint never opens or in class strings no lint
rule inspects. Exit 0 clean, **2** on findings, 1 when the run could not start.

| Check | Catches |
|---|---|
| `color-literal` | a hex or an `rgb()`/`hsl()`/`oklch()`/`lab()` call anywhere outside the token file, and bare `white`/`black` in a CSS value position — a quoted `'white'` inside JS is not matched |
| `var-fallback` | `var(--x, <literal>)` — the fallback that pins one theme and reports nothing |
| `dark-only-token` | a name declared in `.dark` and not in `:root` |
| `derived-literal` | a themed token valued with a literal instead of a primitive reference |
| `broken-alias` | a layer-4 alias pointing at a custom property nothing declares |
| `arbitrary-value` | `bg-[#…]`, `rounded-[10px]`, `p-[13px]` — a scale step, restated |

Run it over `src/`, or over a path list. `--tokens <file>` names the token file when the repo has
more than one stylesheet declaring `@theme`. A deliberate finding is suppressed with a
`ds-ok: <reason>` comment on the line; the reason is required, so every suppression is reviewable.

Not detected, and therefore reviewer-enforced: a token named for its appearance rather than its
purpose, a `-foreground` that fails contrast against its surface, a semantic token nothing uses, a
primitive utility used twice where a semantic token belonged, and a dark override that is a
different colour rather than the same colour re-toned.

`grid-cols-[repeat(…)]`, `max-h-[calc(100vh-4rem)]` and `w-[280px]` compute a shape rather than
restate a scale, and are not findings.

## 9. Universal, and stack-specific

Universal in any component-based frontend: the four-layer split, one editable brand layer, semantic
names owned by purpose, both themes declaring every themed name, and no literal below layer 1.

Specific to the prescribed stack — Tailwind v4's CSS `@theme` — is layer 4's mechanism: the
`--color-*` alias, the `@custom-variant` line, and the utility names. A repo on Tailwind v3 keeps
layers 1–3 in CSS and expresses layer 4 in the JS config. A repo on CSS-in-JS keeps layers 1–3 and
maps them into its theme object. The token file stays the single source in all three.
