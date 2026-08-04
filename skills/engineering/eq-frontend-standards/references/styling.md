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

**Not this layer:** anything with no direct utility. The two bracket forms are not the same thing,
and the boundary is the syntax — this is the file's single rule on them, cited by §3 and §5.5:

| Form | Example | Verdict |
|---|---|---|
| **Arbitrary property** — `[property:value]`, no utility name in front | `[grid-template-columns:repeat(auto-fill,minmax(255px,1fr))]`, `[mask-image:linear-gradient(...)]` | **Layer 3 written in the wrong place.** Tailwind has no utility for the property, so the class is a stylesheet declaration smuggled into a class attribute: unreadable, unsearchable by property name, and not reusable. Move it to the stylesheet |
| **Arbitrary value** — a real utility with a computed value | `max-h-[calc(100vh-4rem)]`, `grid-cols-[repeat(auto-fill,minmax(255px,1fr))]`, `w-[var(--rail)]` | **Layer 2.** The utility names the property, so it greps as `max-h-`/`grid-cols-` like every other utility; the brackets carry one length no scale step names. §5.5 bounds this: a computed shape qualifies, restating a scale step (`p-[13px]`) does not |

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
| Design token (brand color, elevation, radius scale) | Neither 2 nor 3 as a literal — a custom property declared **inside** Tailwind's `@theme` block, which is what makes it reachable from both layers | A literal hex in a stylesheet is a duplicated decision (`references/duplication.md` §4) and drifts from the same color in a utility class. Declaring the property in `:root` instead emits **no utility** — §5.4 measures that, and §5 is the full rule |

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

### Naming a class so it cannot collide — the class-hook procedure

Rule 5 reports a collision only once both declarations exist. This is the procedure that makes the
name unique before it is written.

**Derive the prefix from the file, falling back to the folder.** The component's own filename is
already unique in the repo, so a name built from it is unique without any repo-wide search.

| File | Root hook | Region hooks |
|---|---|---|
| `user-card/user-card.tsx` | `user-card` | `user-card-header`, `user-card-body` |
| `wizard/wizard-form.tsx` | `wizard-form` | `wizard-form-container`, `wizard-form-navigation` |
| `blogs/index.tsx` | `blogs` | `blogs-header`, `blogs-content` |

**`index.tsx` and `index.ts` take the FOLDER name — never `index-*`.** A barrel-named hook is the
one derivation that produces a guaranteed collision: `references/structure.md` §2 puts an `index.ts`
in every component folder, so `.index-header` minted in `user-card/index.tsx` and again in
`tag-filter/index.tsx` is two files declaring one selector, and the rule that was supposed to
prevent collisions has manufactured one.

**The hook comes first in the class string, before every utility and before any `cn()` call.**

```tsx
<div className="file-preview-details flex min-w-0 gap-2">
```

Not `className="flex min-w-0 file-preview-details gap-2"`, and not appended after a conditional. The
reason is mechanical: a reader looking for the name to grep for in the stylesheet reads one token
instead of scanning a 14-utility string, and a commit that changes `gap-2` to `gap-3` does not move
the hook, so `git log -S'file-preview-details'` returns the commits that changed its styling rather
than every layout tweak the element ever received.

**Which elements earn a hook:** the component root, and each named structural region — header, body,
footer, content, list, item, toolbar, navigation, panel.

**Which do not:** a leaf element holding only layout utilities (`<div className="flex items-center
gap-2">`), icons, text spans, and any element already carrying a UI-primitive library's own classes —
a hook there competes with the primitive's styling, which is §1's two-layers-one-property defect.
Never add a hook inside a CLI-generated primitives directory: the next `add` overwrites the file and
the stylesheet rule behind the hook goes dead with no build signal (`references/structure.md` §2).

**A hook must have, or be about to have, a stylesheet rule.** Add it when the co-located stylesheet
styles it, or when that rule lands in the same commit. Do not mint a hook with no selector behind it
and do not create a stylesheet to host an empty rule — an unbacked hook is a name a future developer
must keep unique, and rule 5 will one day fail a build over a selector that styles nothing. **§1 above
decides whether the rule belongs in a stylesheet at all** — including both bracket forms, which §1.2's
table adjudicates and this section does not re-open. The reasons that reach layer 3 are
pseudo-elements, `@keyframes`, descendant and sibling selectors, and styling children the component
does not render.

**Grep the name before you use it.** If the name already appears as a top-level selector in another
stylesheet, pick a more specific one instead of adding a second declaration.

A **shared sub-concept keeps the exemption** — a name for the thing being styled rather than the file
styling it (`blog-post-card-link`, `tag-group`), because a concept used by four components should not
carry a fifth's arbitrary prefix. **The grep is mandatory before taking it**, and that is tighter
than the file-derived case, where the filename does the work for you. The failure it prevents,
concretely: a blog feature writes `.tag-group { gap: 0.5rem }` in `blog-post-card.scss` and, three
weeks later, a filter feature independently writes `.tag-group { gap: 1rem }` in `tag-filter.scss`.
Both names are reasonable; neither developer saw the other. The two declarations merge per-property
by load order, one `gap` wins, and the developer editing the losing file changes the number, sees no
movement in the browser, and starts debugging the build. Rule 5 catches it — after both exist, in CI,
attributed to whichever commit was second.

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

## 5. Design tokens — the value itself, in one declaration

§1 assigns each property to a layer. This section governs the **value** written into that property,
and it cuts across layers 2, 3 and 4 alike: a color, a spacing step, a radius, a shadow or a font
weight is a token reference, never a literal.

**The mechanism, in the prescribed stack.** One CSS `@theme` block declares the token set as
`--foo` custom properties. Tailwind generates a semantic utility (`bg-card`, `text-muted-foreground`,
`border-border`) for each token the theme block aliases under the family prefix Tailwind reads —
`--color-*` for colors. **Aliasing is per token, not automatic:** a token declared as `--surface`
with no `--color-surface` alias has no utility, and writing `bg-surface` produces no rule at all.
Layer 3 reaches the same token as `var(--surface)` with no aliasing needed.

**A theme is two declarations of one token, not two tokens.** Each token appears in both the light
and the dark theme block. That pairing is the entire point: a component references the token once and
both themes follow.

### 1. Never hardcode a color

No hex, no `rgb()`, no named color — not in a stylesheet, and not inside a Tailwind arbitrary value
(`bg-[#1a1a1a]`, `text-[rgb(45,45,45)]`). Reach for the token whose **meaning** fits, not the one
whose current appearance matches: `--destructive` for a delete action, not the red literal that
happens to look right today.

- **Failure:** the brand red moves one step darker. The token changes in one place and 200 elements
  follow; the 14 elements holding `#dc2626` do not. The result is not a broken build — it is two
  shades of red in the same toolbar, found by a designer weeks later, and no grep finds all of them
  because three sites wrote `rgb(220, 38, 38)` instead.
- **Failure from matching appearance instead of meaning:** a warning banner is written with the same
  literal as the destructive action because both are red. When destructive is later re-toned, the
  warning silently follows it, and a non-destructive banner now reads as a danger state.

### 2. No hex fallback inside `var()` — the highest-value rule here

`var(--text-primary, #2d2d2d)` is not defensive. It **pins one theme's value** and wins silently
whenever the token is absent from the active theme. Write `var(--text-primary)`. If the token does
not exist, add it to **both** theme blocks rather than smuggling a default into a call site.

The mechanism is worth stating precisely, because the two spellings fail in opposite directions and
only one of them is visible:

- `var(--x, #hex)` with `--x` undefined resolves to `#hex`. The declaration is **valid**, so the
  element renders a plausible color and nothing anywhere reports a problem.
- `var(--x)` with `--x` undefined makes the declaration *invalid at computed-value time*. The
  property falls back to inherited (for an inherited property such as `color`) or to its initial
  value. The element looks obviously wrong, which is what gets it fixed.

**Measured, not asserted.** Fixture: two theme blocks on a wrapper element, `--text-primary`
declared in the light block only — the shape produced by adding a token to one theme and forgetting
the other — read back with `getComputedStyle` in Chromium 151.0.7922.34:

```
LIGHT  {"--text-primary resolves to":"#2d2d2d",
        "a  var(--text-primary, #2d2d2d)":"rgb(45, 45, 45)",
        "b  var(--text-primary)":"rgb(45, 45, 45)",
        "c  var(--fg)  [in both themes]":"rgb(45, 45, 45)"}
DARK   {"--text-primary resolves to":"<undefined>",
        "a  var(--text-primary, #2d2d2d)":"rgb(45, 45, 45)",
        "b  var(--text-primary)":"rgb(0, 0, 0)",
        "c  var(--fg)  [in both themes]":"rgb(245, 245, 245)"}
```

Read the dark row. The properly-tokenised element `c` flips to `rgb(245,245,245)`. The
hex-fallback element `a` **does not move** — it renders `rgb(45,45,45)`, near-black text, on the dark
surface. The no-fallback element `b` computes to `rgb(0,0,0)`, because `color` is inherited and
nothing above it set one, so it is equally unreadable *and* equally obvious in review.

- **Failure:** the fallback element is the one that ships. It passed light-mode review, it passes
  every lint and every build, and it fails only for users on the dark theme — contrast around 1.3:1,
  which is text that cannot be read at all. It is also the hardest class of styling bug to locate,
  because the file that declares the color looks correct in isolation: the bug is the *absence* of a
  declaration in a different file.
- **Failure the fallback actively causes:** it removes the signal. Without the fallback, the missing
  token is discovered the first time anyone opens the dark theme, in seconds. With it, the value is
  silently correct-looking forever, and the token stays missing from the dark block — so every later
  consumer of that token inherits the same invisible bug.

### 3. Never hardcode one theme's value

`#fff`, `#000`, `white`, `black`, and near-black body text are single-theme values by construction.
A white card background and near-black text are the same defect as rule 2 without the `var()`
wrapper.

- **Failure:** `background: #fff` on a card. In dark mode the card stays white while its text follows
  the token to a light gray, so the card renders light-gray-on-white — unreadable, and it looks like
  a rendering glitch rather than a hardcoded value, so the bug report says "the cards flash white".
- **Failure at a boundary:** `border: 1px solid #000` disappears entirely against a dark surface, so
  a table loses its grid in dark mode and the columns run together.

### 4. Semantic utility in markup, `var(--token)` in a stylesheet

Layer 2 writes the utility — `bg-card`, `text-muted-foreground`, `border-border`, `rounded-lg`,
`shadow-md`. Layer 3 writes `var(--token)`. Layers 2 and 3 then reference the same declaration, which
is what makes §1's one-layer-per-property rule safe for colors.

**Declaring a custom property is not declaring a utility.** The alias inside the `@theme` block, under
the family prefix the framework reads, is what generates one. **Check the alias exists before writing
the semantic utility.** For a token with no alias, either use the variable shorthand
(`bg-(--surface)`, `text-(--text-primary)`) or add the alias in the same commit.

**Measured, not asserted.** Two builds of the same markup on `tailwindcss@4.3.3`, candidates fed
directly so nothing depends on file scanning. Build A declares `--surface` and `--brand` in `:root`
with **no** `@theme` block; build B adds `@theme inline { --color-surface: var(--surface);
--color-brand: var(--brand); --radius-card: 0.75rem; --spacing-card: 1.25rem; }`. Both exit 0 with no
warning. The emitted `@layer utilities`:

```
A) tokens in :root only          B) same tokens plus @theme aliases
@layer utilities {               @layer utilities {
  .bg-\[\#1a1a1a\] {               .rounded-card { border-radius: .75rem }
    background-color: #1a1a1a;     .bg-\[\#1a1a1a\] { background-color: #1a1a1a }
  }                                .bg-surface { background-color: var(--surface) }
}                                  .p-card { padding: 1.25rem }
                                   .text-brand { color: var(--brand) }
                                 }
```

In A, **none** of `bg-surface`, `text-brand`, `rounded-card` or `p-card` is emitted — the utilities
layer holds one rule, the hardcoded arbitrary value this section bans. The `:root` block ships in both
builds, so the token exists at runtime and the class that names it does not. In B all four appear, and
the two color rules resolve through `var()` rather than inlining the literal, which is what makes them
theme-aware. The shorthand was measured in a third build: `bg-(--surface)` and `text-(--brand)` both
emit with no alias present, in the same run where `bg-surface` emits nothing.

- **Failure:** `bg-surface` is written for a token declared in `:root` with no alias. No rule is
  emitted, so the class lands in the DOM and does nothing. The element keeps whatever background it
  inherited, in both themes. `npm run build` exits 0, oxlint never reads the class string, and the
  markup states a background the page does not have — so the next reader debugs specificity and load
  order for a rule that was never generated. This is the quietest failure in this file: rule 2 at
  least shows a wrong color, and this shows the *previous* correct-looking one.

### 5. Spacing, radius, shadow and font weight are tokens too

The scale is a token set, exactly like the palette. A raw `px` value re-derives a decision the scale
already made.

- **Failure:** `padding: 13px` beside eleven elements on the 12px step. Nothing breaks; the layout is
  one pixel out of rhythm in one place, which is unfixable-by-search and reappears every time someone
  copies that block. The same applies to `border-radius: 7px` next to a `--radius-md` of 8px, and to
  `font-weight: 550` where the scale has 500 and 600.
- **Failure at theme level:** a hand-written `box-shadow` does not follow the elevation set, so a
  dark theme that lightens every shadow leaves that one element with a light-theme shadow — a black
  halo on a dark surface.

**An arbitrary value is for genuinely one-off geometry** — `max-h-[calc(100vh-4rem)]`,
`grid-cols-[repeat(auto-fill,minmax(255px,1fr))]` compute a shape rather than restate a scale step, and
§1.2's table already places that form in layer 2. `p-[13px]` restates a scale step, badly, and is a
finding under this rule even though §1.2 admits the syntax: §1.2 decides the *layer*, this rule decides
whether the *value* was a decision the scale had already made. The arbitrary-property form
(`[padding:13px]`) is layer 3 in the wrong place by §1.2 and a hardcoded scale value by this rule —
both at once.

## 6. What is machine-enforced, and what is not

Machine-enforced — two rules, one of them the collision rule:

| Check | Gate | Reach |
|---|---|---|
| A top-level class selector is declared in exactly one file | `scripts/check-structure.mjs` rule 5 | Selector at column 0, whole selector, brace depth 0. Scans `.scss` and `.css` only — a `.sass` or a `.less` file is never read, so a class it declares is invisible to the rule. Blind to an indented selector, a second class after a comma, and anything nested inside `@media`/`@layer`. A `.css` sitting beside a same-named `.scss`, `.sass` or `.less` is skipped as compiled output |
| A component folder already named for its component has a barrel | `check-structure.mjs` rule 3 | Reach and both exceptions — `index.tsx` counts as the barrel, and a folder holding `main.ts(x)` is a bundler entry point and is skipped entirely — are `references/structure.md` §2 and its closing table. It does **not** detect that a stylesheet should have promoted a flat component to a folder, and does not check that the stylesheet's name matches the component — both reviewer-only |

**Installing Tailwind and Sass added no rule to those two.** oxlint reads JavaScript and TypeScript
only — verified: pointed at a directory holding one `.scss` it prints `No files found to lint` and
exits 1, so no stylesheet in the repo is linted at all — and `starter/package.fragment.json` ships no
`stylelint`. oxfmt does format `.css` and `.scss`, but a formatter changes layout and asserts nothing
about which layer a declaration belongs in. Everything
else in this file is **reviewer-enforced**: nothing mechanical detects a layer chosen wrongly, a
static value in `style`, a redeclared `display: flex`, a hand-written `@media`, a `$breakpoints` map
drifted from `@theme`, an arbitrary-**property** class standing in for a stylesheet (§1.2), a `.module.scss`
appearing in the tree, or a hand-edit to a CLI-generated primitive. **Every rule in §5 is
reviewer-enforced too**, and the `var()` fallback rule is the one to look for first: a hex literal in
a stylesheet, a `var(--x, #hex)`, a `#fff`, a raw `px` spacing value and a hand-written `box-shadow`
are all in files oxlint never opens. The one §5 case that lands in a file oxlint *does* read — a
`bg-[#1a1a1a]` inside a `.tsx` — is still uncaught, because no rule in `starter/.oxlintrc.json`
inspects the contents of a class string. `grep -rnE '#[0-9a-fA-F]{3,8}\b|rgba?\(' src` finds the
literals; nothing finds a token that exists in one theme block and not the other, which is why §5.2
is a review item and not a script. The `max-lines` budget in
`SKILL.md` §1 does not reach a stylesheet for the same reason: a 900-line `.scss` is never read by the
linter that would have flagged it.

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

## 7. What is universal, and what assumes the prescribed stack

Universal, in any component-based frontend regardless of tooling:

- The four-layer precedence and the stop-at-the-first-match procedure (§1).
- One layer owns one property on one element, because the alternative is decided by load order (§1).
- Inline `style` for runtime values only (§1.4).
- No hand-typed breakpoint value anywhere, in any layer (§4).
- A class name that is not file-scoped is repo-unique (§3).
- Every color, spacing step, radius, shadow and font weight is a token reference, and a token is
  declared once per theme (§5.1, §5.3, §5.5).
- No fallback literal inside a variable reference, in any variable syntax (§5.2). CSS `var()` is the
  case measured there; a preprocessor variable with a default and a CSS-in-JS theme lookup with an
  `??` default pin one theme's value the same way.

Assumes the prescribed stack, and named as such:

- **The Tailwind prefixes in §4** (`md:`, `max-lg:`) and the `theme()` finding behind the coupling
  rule are specific to Tailwind v4's CSS `@theme`. Tailwind v3's JS config *is* readable from other
  tooling, so a v3 repo can single-source what a v4 repo cannot.
- **§4's mixins and the `.scss` naming in §1.3** assume Sass.
- **The `@tailwindcss/vite` wiring in §6** assumes Vite. Next.js, webpack, and Rspack take
  `@tailwindcss/postcss` instead; swap that dependency and the setup gate's bundler half no longer
  applies.
- **The `@theme` alias mechanism in §5.4** — a token generating a utility only once aliased under a
  family prefix — is Tailwind v4's. The rule it carries survives any stack: check that the class you
  are about to write resolves to a rule, because a class with no rule behind it fails silently.
- **Layer 1** assumes nothing — no primitive library ships, and §1.1 says so.

A repo on a different CSS stack follows the layer **procedure** unchanged and substitutes its own
tools into it: layer 2 is whatever expresses layout in one token per property, layer 3 is whatever
owns theme and keyframes, and the breakpoint rule becomes one declaration per layer with the
duplication written down. Detection never sets the standard (`SKILL.md`, the core rule) — a repo
found on CSS-in-JS is being sized for migration, not ratified.
