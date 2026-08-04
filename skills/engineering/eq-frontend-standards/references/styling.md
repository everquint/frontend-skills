# Styling — which layer owns a style

`references/structure.md` §7 owns the *bug* half of styling: a top-level class selector declared in
two files, media-query specificity, and co-located stylesheet naming. It states no decision
procedure, so the most frequently argued styling question — which layer do I reach for — is answered
per repo, per developer, per file. This file is that procedure.

Four layers exist. Exactly one owns any given property on any given element.

**The stack is prescribed, not detected.** `starter/package.fragment.json` installs `tailwindcss` +
`@tailwindcss/vite` for layer 2 and `sass` for layer 3, so both are real on the first commit and
every repo on this standard styles the same way. Layer 4 needs no tooling. Layer 1 is the one open
choice — see below.

## 1. The layer decision — apply top-down

The first layer that can express the style is the one that owns it. Stop there.

### 1. A UI primitive, for a control

Button, dialog, input, select, checkbox, tooltip, popover, dropdown, tabs, toast.

**This standard does not pick a primitive library, and the starter installs none.** That choice is
the repo's. What is fixed is how one is used: primitives live in `components/ui/`, and where the
library is CLI-generated (`npx shadcn@latest add <component>`) those files are never hand-written —
do not hand-edit a generated file and do not add a barrel to that directory, because the next `add`
overwrites both silently (`references/structure.md` §2). A repo with no primitive library has an
empty layer 1, and its controls start at layer 2 plus layer 3.

**Not this layer:** application layout, page shells, feature-specific composites. A primitive is a
control, not a screen.

### 2. Tailwind utility classes, for layout and spacing

`className` utilities where a direct utility exists: `flex`/`grid` and their alignment, `gap`,
padding, margin, width/height, `text-align`, `cursor`, `visibility`, border radius.

**Not this layer:** anything with no direct utility. A utility string that has grown a
`[grid-template-columns:repeat(auto-fill,minmax(255px,1fr))]` arbitrary value is layer 3 written in
the wrong place — it is unreadable, unsearchable, and not reusable.

### 3. A co-located `.scss` stylesheet, for what has no direct utility

Theme colors, shadows, gradients, pseudo-elements (`::before`, `::after`, `::placeholder`),
`@keyframes`, complex grid and grid-area templates, and anything needing a descendant, sibling, or
state selector the utility layer cannot express.

Named exactly after its component and living in that component's folder — `user-card.tsx` →
`user-card.scss`, both under `user-card/` (`references/structure.md` §2, §7).

**Not this layer:** padding, margin, gap, or flex alignment that a utility already expresses. A
stylesheet that redeclares `display: flex` competes with the `className` on the same element.

### 4. Inline `style`, for a runtime value only

A value computed at render time — a measured pixel width, a scroll offset, a progress percentage, a
CSS custom property populated from data — or a third-party component API whose contract is a style
object.

**Not this layer:** any static value. A static `style={{ marginTop: 8 }}` carries the highest
specificity in the document short of `!important`, so it silently defeats every other layer and
cannot be overridden by a breakpoint, a theme, or a modifier class.

### Why the order is a precedence and not a preference

**Two layers styling the same property is the defect.** Which one wins is decided by load order and
selector specificity, not by intent — so the developer who edits the losing declaration sees nothing
change and concludes the build is stale. `references/structure.md` §7 writes that failure out in
full, including the case where a file's *own* declaration is the dead one. Assigning each property
to exactly one layer is what makes the winner predictable.

## 2. Where the boundary actually falls

The abstract rule does not decide these, which is why they get argued. It decides them here.

| Case | Layer | Why |
|---|---|---|
| One-off margin on one element | 2 — utility | A direct utility exists; a stylesheet for one `margin` adds a file, an import, and a class name to keep unique |
| The same spacing value on 12 elements | 2 — utility, repeated | Repeated layout is shape, not a decision — `references/duplication.md` §4. Extracting `.card-gap` buys nothing and adds a repo-wide-unique class name |
| `:hover` | 2 if the property has a utility (`hover:bg-muted`), else 3 | A hover that changes a shadow, a pseudo-element, or a descendant is 3 |
| Focus ring | 1 first, where the repo has a primitive library — it already ships one. Otherwise 3 | A hand-rolled ring on top of a primitive's ring gives two rings; delete yours, do not stack it |
| Dark-mode color | 3 | Theme colors are 3 by definition. Declare both themes in the same block via the theme selector, so the pair is readable in one place |
| Responsive breakpoint | 2 if the property has a utility, else 3 through the `_breakpoints.scss` mixins — §4 below | Never a hand-typed `@media` value, in either layer |
| Animation | 3 | `@keyframes` has no utility form. The `animation` shorthand referencing it lives in the same stylesheet as the keyframes |
| Width from a measured element | 4 — inline | Runtime value. Prefer a CSS custom property set inline (`style={{ '--w': px }}`) consumed by the stylesheet, which keeps the rest of the rule in layer 3 |
| Conditional class | 2 — utility, composed through the repo's class-merge helper (`cn()`) | A boolean that toggles a *set* of layer-3 properties is a modifier class (`.is-compact`) — and `references/structure.md` §7's specificity rule then applies to it |
| Design token (brand color, elevation, radius scale) | Neither 2 nor 3 as a literal — a custom property in Tailwind's `@theme`, referenced by both | A literal hex in a stylesheet is a duplicated decision (`references/duplication.md` §4) and drifts from the same color in a utility class |

## 3. No CSS Modules — the decision and its consequence

**Class names are global and `kebab-case`.** No `*.module.css`, no `*.module.scss`.

The consequence is not optional: **a top-level class name is unique across the whole repo.** Two
files declaring `.card-header` do not shadow each other — they merge per-property by load order
(`references/structure.md` §7). `scripts/check-structure.mjs` rule 5 reports the collision; that
rule is the price of the global model and the reason it is safe here.

The tradeoff, stated plainly: CSS Modules solves the same collision by scoping each class to its
file, which removes the uniqueness burden entirely, at the cost of generated class names that do not
match what you wrote, a build-time transform on every stylesheet, and class names that no longer
appear in a repo-wide grep. This standard takes the grep-able global name plus a checker. A repo
already on CSS Modules is not broken — it is on the other side of a fork this standard picked once.
Do not mix the two models in one repo: half the classes then obey rule 5 and half are exempt, and
nothing tells a reader which a given class is.

## 4. Responsive — two declarations, one number, and the coupling named

**A raw `@media` with a hand-typed value is a finding in both layers.** Every breakpoint in the repo
resolves to a value from one of exactly two declarations, and those two hold identical numbers.

- **Layer 2** uses Tailwind's prefixes — `md:`, `lg:`, `max-lg:`, `md:max-xl:` — and nothing else.
  Tailwind's `@theme` is the declaration; the starter does not override it, so the values are
  Tailwind's defaults.
- **Layer 3** uses the mixins in `starter/src/styles/_breakpoints.scss` — `above('lg')`,
  `below('lg')`, `between('md','xl')` — which read one `$breakpoints` map. Each stylesheet reaches
  them with a relative `@use`. From a component folder of the shape `references/structure.md` §2
  prescribes — `src/components/user-card/user-card.scss` — that is `@use '../../styles/breakpoints'
  as *;`, and the number of `../` segments follows the stylesheet's own depth under `src/`: from that
  folder, one segment reaches `src/components/` and two reach `src/`. No `loadPaths` ships, because no
  `vite.config` is written, so the relative path is the only form. There is no global injection, so
  that line is visible and grep-able in every file that has a breakpoint.

**Single-sourcing the two is not achievable, and this file does not claim it.** Established by
building it: Tailwind v4 declares breakpoints as `--breakpoint-*` custom properties inside a CSS
`@theme` block, Sass runs *before* Tailwind in the bundler pipeline, and CSS forbids `var()` inside a
media query — so no mixin can read Tailwind's numbers. Tailwind's `theme(--breakpoint-lg)` escape
hatch resolves only inside the stylesheet holding `@import 'tailwindcss'`; the same expression in a
component `.scss` reaches the minifier unresolved and **fails the build** with
`Unexpected token Function("theme")`. That failure is version-scoped to the prescribed stack — Vite 8,
where lightningcss is the default minifier. On Vite 7, whose default minifier is esbuild, the identical
input **exits 0 and ships the unresolved media query into production CSS**, which is a dead breakpoint
with no build signal at all — worse than the failure.

So the enforceable rule is the coupling, stated rather than hidden: **the `$breakpoints` map mirrors
Tailwind's `--breakpoint-*` values exactly, and a commit that overrides one in `@theme` changes the
map in the same commit.** Nothing mechanical checks that pairing — it is a review item, and the
partial's header comment says so at the point of edit.

The values are `rem`, matching Tailwind: `sm` 40 · `md` 48 · `lg` 64 · `xl` 80 · `2xl` 96. `px` is
wrong even at the same nominal width, because a media query in `rem` tracks the reader's browser
font size and `1024px` does not — a disagreement that reproduces on one person's machine only.
`above('lg')` emits `@media (width >= 64rem)`, byte-identical to what Tailwind's `lg:` prefix emits,
which is what makes the mirroring checkable by grep. The two remain **two separate `@media` blocks** in
the built CSS: Tailwind's sits inside `@layer utilities` and the mixin's is unlayered, and no minifier
merges across a layer boundary. Measured in a real build — two occurrences of that query, at offsets 0
and 5154. `below` is `<`, not `<=`, so `above`/`below` partition the axis with no one-pixel band where
both apply.

A breakpoint is a maximum-width reset or a minimum-width addition, never both for one property.
`references/structure.md` §7 covers what happens when a modifier class outranks a breakpoint reset:
a media query adds no specificity, so the reset must be repeated on the modifier.

## 5. What is machine-enforced, and what is not

Machine-enforced — two rules, one of them the collision rule:

| Check | Gate | Reach |
|---|---|---|
| A top-level class selector is declared in exactly one file | `scripts/check-structure.mjs` rule 5 | Selector at column 0, whole selector, brace depth 0. Scans `.scss` and `.css` only — a `.sass` or a `.less` file is never read, so a class it declares is invisible to the rule. Blind to an indented selector, a second class after a comma, and anything nested inside `@media`/`@layer`. A `.css` sitting beside a same-named `.scss`, `.sass` or `.less` is skipped as compiled output |
| A component folder already named for its component has a barrel | `check-structure.mjs` rule 3 | Reach and both exceptions — `index.tsx` counts as the barrel, and a folder holding `main.ts(x)` is a bundler entry point and is skipped entirely — are `references/structure.md` §2 and its closing table. It does **not** detect that a stylesheet should have promoted a flat component to a folder, and does not check that the stylesheet's name matches the component — both reviewer-only |

**Installing Tailwind and Sass added no rule to those two.** `starter/eslint.config.js` globs
`**/*.{ts,tsx}` only, so no stylesheet in the repo is linted at all, and
`starter/package.fragment.json` ships no `stylelint` and no `eslint-plugin-tailwindcss`. Everything
else in this file is **reviewer-enforced**: nothing mechanical detects a layer chosen wrongly, a
static value in `style`, a redeclared `display: flex`, a hand-written `@media`, a `$breakpoints` map
drifted from `@theme`, an arbitrary-value utility standing in for a stylesheet, a `.module.scss`
appearing in the tree, or a hand-edit to a CLI-generated primitive. The `max-lines` budget in
`SKILL.md` §1 does not reach a stylesheet for the same globbing reason.

One **setup** gate exists alongside those two rule gates, and it is not a rule about how you style:
`scripts/init-greenfield.mjs` **exits 2** until one readable `.css` file under `src/` (the whole repo
only when there is no `src/`) holds either `@import 'tailwindcss'` or the granular v4 form
`@import 'tailwindcss/utilities'` — `theme` and `preflight` alone emit no utilities and do not count,
and neither does an import inside `/* … */` — and — **only when a `vite.config.*` is present in the
root** — until that config both imports `@tailwindcss/vite` and calls the plugin. Exit 2 is
deliberately distinct from exit 1, which means the run never started (wrong directory, incomplete
skill install); `--dry-run` always exits 0. The bundler half is conditional, not a conjunct: with no `vite.config.*` the
script prints that it did not check it, points at `@tailwindcss/postcss` for Next.js, webpack and
Rspack, and exits 0 on the CSS entry alone. It cannot make either edit — it never writes to
source, which is what makes it safe to run on a live repo. The exit code is there because an unwired
Tailwind leaves every layer-2 class in the repo inert while typecheck, lint, test, build and CI all
stay green, so a line of install output is not enough to carry it.

`scripts/profile-repo.mjs` reports a styling census — `css-modules`, `plain-scss`, `plain-css`,
`vanilla-extract`, `tailwind`, `styled-components` — as **facts for sizing a migration**, never as
the target. Detection never sets the standard (`SKILL.md`, the core rule).

## 6. What is universal, and what assumes the prescribed stack

Universal, in any component-based frontend regardless of tooling:

- The four-layer precedence and the stop-at-the-first-match procedure (§1).
- One layer owns one property on one element, because the alternative is decided by load order (§1).
- Inline `style` for runtime values only (§1.4).
- No hand-typed breakpoint value anywhere, in any layer (§4).
- A class name that is not file-scoped is repo-unique (§3).

Assumes the prescribed stack, and named as such:

- **The Tailwind prefixes in §4** (`md:`, `max-lg:`) and the `theme()` finding behind the coupling
  rule are specific to Tailwind v4's CSS `@theme`. Tailwind v3's JS config *is* readable from other
  tooling, so a v3 repo can single-source what a v4 repo cannot.
- **§4's mixins and the `.scss` naming in §1.3** assume Sass.
- **The `@tailwindcss/vite` wiring in §5** assumes Vite. Next.js, webpack, and Rspack take
  `@tailwindcss/postcss` instead; swap that dependency and the setup gate's bundler half no longer
  applies.
- **Layer 1** assumes nothing — no primitive library ships, and §1.1 says so.

A repo on a different CSS stack follows the layer **procedure** unchanged and substitutes its own
tools into it: layer 2 is whatever expresses layout in one token per property, layer 3 is whatever
owns theme and keyframes, and the breakpoint rule becomes one declaration per layer with the
duplication written down. Detection never sets the standard (`SKILL.md`, the core rule) — a repo
found on CSS-in-JS is being sized for migration, not ratified.
