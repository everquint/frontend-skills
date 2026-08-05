# 0009 — 2-space indent, over the 4 inherited from the ESLint era

Date: 2026-08-05

## Context

`tabWidth: 4` was never decided: it came from the old `@stylistic/indent: 4` config, survived the
oxfmt migration (ADR 0001) the same way `printWidth: 200` survived `max-len`, and no ADR recorded
it. A review of the standard called it out: **2-space is the dominant JS/TS convention** — Prettier's
default, Airbnb, Google, StandardJS, and every mainstream scaffold including Vite's react-ts
template — while 4-space is idiomatic in Python, C#, PHP and Java. Unlike the printWidth case there
is no concrete failure scenario; the cost of 4 is convention surprise (onboarding friction, every
pasted ecosystem example arriving at a different indent), and internal consistency made it harmless.
The standard's owner ruled for the industry-standard, readable choice.

## Decision

**`tabWidth: 2`**, with `.editorconfig`'s `indent_size` matching. `printWidth: 120` is kept: ADR
0007 chose 120 over 100 partly because 4-space burned columns, and at 2-space that argument softens
— but 120 remains inside the mainstream band, the readability decision was made and paid for days
ago, and re-litigating to 100 would cost every adopted repo a second full rewrap for marginal
alignment. 2 + 120 is a common real-world TS/React combination.

Two simplifications fall out: the YAML `tabWidth: 2` override in `.oxfmtrc.json` and the
`.editorconfig` YAML carve-out are retired — the global value is now the one YAML tooling assumes —
and a fresh Vite scaffold's indent matches the standard from the first file, shrinking the
first-run reformat to quotes and semicolons.

## Consequences

- Adopted repos re-run `npm run format` once; this touches most indented lines, so the mechanical
  commit MUST be listed in `.git-blame-ignore-revs`. The 1.3.0 migration entry names the steps.
- The value is stated in `.oxfmtrc.json`, `.editorconfig`, `SKILL.md` §1 and `hygiene.md` §8 — they
  move together or the docs contradict the config.
- ADR 0007's "4-space burns columns" clause is superseded in part by this decision; its width
  conclusion stands.

Supersede this only with the whole formatter decision — an indent value flips per-repo churn every
time it moves, so it should move at most once more, if ever.
