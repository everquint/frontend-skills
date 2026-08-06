# 0018 — OKLCH token values, machine-checked contrast, and no DTCG layer

Date: 2026-08-06
Extends [0017](0017-design-system-as-its-own-skill.md), which established the skill. Nothing in 0017
is reversed.

## Context

0017 shipped the token system with hex values, and stated that contrast was reviewer-enforced. A
review of the result against current industry practice found three things worth deciding rather than
leaving implicit.

- **Colour format.** Tailwind v4's default palette is OKLCH and shadcn/ui converted its themes from
  HSL to OKLCH for v4. Our hex starter was the odd one out in its own stack, and a repo pasting a
  shadcn block into it would be running two colour models in one `@theme`.
- **Contrast.** The skill told reviewers to verify WCAG AA in both themes while shipping a file that
  contains every colour and every pairing needed to compute it. Asking a human to do arithmetic the
  data supports is the weakest kind of rule.
- **DTCG.** The W3C Design Tokens Community Group format reached its first stable version (2025.10)
  with Adobe, Google, Figma, Salesforce and Shopify behind it, and Style Dictionary consumes it. A
  standard that says nothing about it reads as unaware of it.

## Decision

**1. Layer 1 is OKLCH, with the source hex in a trailing comment.** The format buys three concrete
things: a ramp derived by moving L alone with C and H fixed, `color-mix()` that interpolates without
a desaturated midpoint, and dark-theme brightening as a repeatable lift in L rather than four colours
picked by eye. The hex comment stays because it is the number on the brand guidelines.

**2. Contrast becomes check 7 of `check-tokens.mjs`, with derived pairs.** Every `--x-foreground` is
paired with `--x`; page and muted text with `--background` and `--card`; `--input` and `--ring` with
both surfaces at the 3:1 non-text floor of WCAG 1.4.11. A `-foreground` the derivation cannot pair is
itself a finding.

**Derivation over a listed pair set is the load-bearing part of this decision.** The reference
implementation this was modelled on used a hand-maintained array, and adding a `--warning` pair to
the token file left it unchecked while the audit still printed a pass — verified, at 1.74:1. A gate
that reports success over an unchecked pair is worse than no gate, because it is trusted. Deriving
the list means adding a token to the file cannot escape the audit.

**`--border` is deliberately exempt from 3:1.** It is a decorative separator, not a control boundary.
Holding it to 1.4.11 fails every mainstream design system and would get the check switched off, which
costs more than the rule buys.

**3. No DTCG/JSON layer, with a stated trigger.** A token pipeline pays off per consumer and a
web-only product has one; the return on JSON-as-source is emitting Swift, XML or Figma variables,
which is worth a lot at two or more consumers and nothing at one. The trigger to adopt it is a second
consumer appearing — a native app, Figma variable round-tripping, or a separately released component
library — not a repo reaching some size. The migration is additive: layer 1 maps one-to-one onto DTCG
`color`/`dimension`/`shadow`, and layers 2–4 become Style Dictionary transforms.

## Consequences

- Minor version. The starter's values changed representation but not appearance: every OKLCH value
  round-trips to its original hex exactly, verified across all 26 primitives.
- **Three real contrast defects in the shipped 0017 starter were found by the new check and fixed**,
  which is the clearest argument for the check existing. `--input` was 1.20:1 against the page; the
  dark `--muted-foreground` was 3.62:1 on `--muted`. The fixes retune `--neutral-500` to a true
  mid-grey, point `--input` at it in both themes, and move dark muted text to the 400 step.
- Two pairs sit close to their floor — `--input` at 3.08:1 and dark muted-on-muted at 4.58:1. A brand
  change will move them, and the check is what will say so.
- The dark theme's muted text is now visibly closer to its primary text than it was. That is what AA
  costs on a dark surface; the alternative was a pair that failed.
- A repo on 2.6.0 that copied the starter has the same defects and no gate. Re-running the updated
  `check-tokens.mjs` against its token file reports them without touching the repo.
- The contrast maths is a second implementation of something browsers already do. It is fenced by
  being verified against an independent hex-only implementation across the full palette, agreeing to
  four decimal places.
