# Where the token system meets components

The token system is consumed by components; it does not contain them. This file draws that boundary,
because the two failure modes sit on either side of it: a token file that grows component rules, and
a component that re-derives values the token file already decided.

## 1. shadcn/ui compatibility is the reason the names are fixed

A generated primitive is a file copied into the repo that references token names by string:
`bg-background`, `text-muted-foreground`, `border-border`, `ring-ring`, `bg-destructive`. Nothing
resolves those at build time against a schema. If the token file declares `--surface` where the
component reads `--background`, the class is emitted, the rule is emitted, the variable is undefined,
and the property is dropped at computed-value time — the element keeps whatever it inherited.

So the compatibility contract is one-directional and mechanical: **the token file declares the names
the component library reads.** Adding names is free. Renaming one is a breaking change to every
component that was generated before the rename and every component generated after it.

The starter's additions — `--warning`, `--info`, `--surface-hover`, `--border-strong`, the `-subtle`
fills and the `--z-*` ladder — sit alongside the shadcn set rather than replacing any of it.

## 2. Generated files are not hand-edited

`../eq-frontend-standards/references/structure.md` §2 owns this rule; it matters here because the
tempting edit is a token edit. A generated primitive whose colour looks wrong is fixed by changing
the token it reads, never by editing the file — the next `npx shadcn@latest add <component>`
overwrites it silently, and the fix disappears with no error.

If the primitive's *structure* is wrong for the app, wrap it in a component of the app's own rather
than editing it in place.

## 3. Which layer a variant's colours live in

A variant — `primary`, `secondary`, `destructive`, `ghost`, `outline` — is a mapping from a variant
name to a set of semantic tokens. The mapping belongs in the component; the values belong in the
token file.

```
variant: destructive  →  bg-destructive text-destructive-foreground hover:bg-destructive/90
```

Read that as three token references and no decisions. The opacity modifier is the one thing decided
in the component, and it is decided once per variant rather than per usage.

**A new variant that needs a colour the token file does not have is a token change first.** Adding
`bg-[#7c3aed]` to a variant is the same defect as adding it to a page, with wider blast radius,
because the variant is what other components copy.

## 4. What the token system owns, and what it does not

| Owned by the token file | Owned by the component |
|---|---|
| The value of every colour, radius step, shadow level, spacing unit, font stack | Which of them a given element uses |
| That a token exists in both themes | Layout, structure, and composition |
| The name a purpose is known by | The variant-to-token mapping |
| Global base rules that are pure token application — body background and colour, the default border colour, the focus-visible ring | Anything that names a component (`.card`, `.toolbar`) |

The last row is the boundary people cross first. A `@layer base` block that sets the body's
background from `--background` is token application. A `@layer base` block that sets
`.card { padding: 1rem }` is a component, and it belongs in the component's own stylesheet under
`../eq-frontend-standards/references/styling.md` §1.3 — where the next person who needs a different
card padding can change it without editing a file every screen depends on.

## 5. When no component library is installed

This standard names no primitive library and the starter installs none
(`../eq-frontend-standards/references/styling.md` §1.1). The token system does not require one — its
names are still the vocabulary, and hand-written controls read them exactly as generated ones would.

Keep the shadcn names anyway, even with no shadcn in the repo. They are a published, widely
understood vocabulary, adopting one later becomes a copy-in rather than a migration, and the
alternative is inventing a private vocabulary whose only documentation is the token file itself.

## 6. The promotion rule

A primitive utility (`bg-neutral-300`, `text-primary-400`) is an escape hatch for a genuinely
decorative one-off. **The second use is the signal.** Two elements reaching for the same primitive
means they share a purpose that has no name yet — add the semantic token, alias it, and replace both.

The failure this prevents is the slowest one in the system: primitive utilities spread, each one
individually defensible, until the semantic layer describes a shrinking fraction of the app and the
next theme change has to be done twice — once through tokens, once by grep.
