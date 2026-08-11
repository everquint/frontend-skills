# Adopting the token system into a repo that already has colours

A greenfield scaffold is `SKILL.md` §2 and takes minutes. This is the other case: an app with
hundreds of literals spread across components and stylesheets. The order below exists because the
obvious order — convert files one by one — produces a half-tokenised app that is worse than either
end state, since a reviewer can no longer tell which literals are pending and which were decided.

## 1. Census first, conversion second

Run the audit before changing anything. The count is what sizes the work and what proves progress:

```bash
node scripts/check-tokens.mjs src --json > /tmp/tokens-before.json
```

With no token file present the script exits 1 and says so — that is the expected first result on a
repo with no `@theme` block. Add the starter (step 2), then take the census.

Read the distribution, not just the total. Three shapes call for different treatment:

| Shape | Signal | Treatment |
|---|---|---|
| The same literal in many files | one decision, copy-pasted | one token, one sweep — the cheapest win, do it first |
| Many near-identical literals (`#2d2d2d`, `#2e2d2b`, `#2c2c31`) | a decision nobody made twice on purpose | collapse to one token; the difference is noise, not intent |
| One literal in one place | a genuine one-off, or a missing token | decide per case; a second occurrence later settles it |

## 2. Land the token file before converting anything

Copy `starter/index.css` to `src/index.css` (or merge into the existing entry stylesheet, keeping
the `@import "tailwindcss"` and `@custom-variant` lines at the top) and fill layer 1 with the
brand's **current** values, read off the existing app — converted to `oklch()`, with the source hex
kept in a trailing comment.

Expect the contrast check to fail on this first commit, and **do not fix it by loosening anything**.
An app that has never had a contrast gate almost always has a failing `--muted-foreground` or an
input border under 3:1; those are real defects the migration has just made visible for the first
time. They belong in step 1 or 2 below, as their own commit, described as the accessibility fixes
they are.

This is the step people skip, and skipping it inverts the work: without a complete token set,
converting a component means inventing a token, and tokens invented one component at a time end up
named for that component (`--user-card-border`) instead of for a purpose.

Ship this commit on its own. It changes no rendering — every token is new and unreferenced.

## 3. Convert by token, not by file

Pick one token. Sweep every literal that meant it, across the whole repo, in one commit.

```bash
grep -rnE '#2d2d2d|rgb\(45,\s*45,\s*45\)' src
```

Two reasons this beats file-by-file:

- **The decision is made once.** File-by-file asks "what is this colour for?" separately at each
  site, and the answers diverge — the same grey becomes `--muted-foreground` in one file and
  `--border-strong` in another.
- **The diff is reviewable.** A commit that says "every occurrence of the body-text grey is now
  `--foreground`" is checkable by reading the token name. A commit touching forty files with mixed
  substitutions is not.

**Match meaning, not appearance.** A warning banner and a delete button are both red today; they are
two tokens. Converting by appearance re-couples them, and the coupling surfaces the first time
`--destructive` is re-toned and every warning follows it.

## 4. Order of conversion

1. **Surfaces and text** — `--background`, `--foreground`, `--card`, `--card-foreground`,
   `--muted-foreground`. These are the highest-count literals and they unblock the dark theme.
2. **Borders and lines** — `--border`, `--input`, `--ring`. Low count, high consistency payoff.
3. **Brand** — `--primary` and its foreground.
4. **Status** — destructive, warning, success, info, and their subtle fills.
5. **Radius, spacing, shadow** — the `arbitrary-value` findings. Mechanical, and safe to batch.
6. **Charts and one-offs** — last, because the right answer often only becomes clear once the rest
   of the palette is named.

Dark mode is enabled **after** step 4, not before. A dark theme laid over a half-converted app
renders the unconverted half in light-theme colours, which reads as a broken theme rather than as
pending work, and generates bug reports that are really progress reports.

## 5. Ratchet the count

The audit is the gate. Wire it the same way the `noUncheckedIndexedAccess` error-count baseline works
(`../eq-frontend-standards/references/hygiene.md`): record where the repo is, then allow only
improvement. Coverage used to be the example here and no longer is — a floor that rewrites itself to
current coverage silently demands ~100% of all new code, which is why coverage moved to a per-change
gate (`../eq-frontend-quality-bar/SKILL.md` §1).

```bash
# fails when the finding count rises above the recorded floor
node scripts/check-tokens.mjs src --json | node -e '…compare against the committed baseline…'
```

A repo mid-migration cannot pass a zero-findings gate, and a gate that always fails is a gate that
gets deleted. A non-increasing count is enforceable from day one and reaches zero on the same
schedule the sweeps do.

Until it reaches zero, the suppression comment is for **decided** exceptions only —
`ds-ok: <reason>` — never for "not converted yet". Pending work is counted by the baseline; a
suppression says the finding was examined and is correct. Mixing the two destroys the meaning of
both numbers.

## 6. What not to do

- **Do not add a compatibility shim** that maps old literal-named classes onto new tokens. It makes
  the old spelling permanently valid, so the migration never finishes.
- **Do not convert generated primitives by hand.** Files produced by a component-library CLI already
  reference the shadcn names; if the token file uses those names, they are already correct
  (`references/primitives.md`).
- **Do not rename the shadcn semantic tokens to match the old codebase's vocabulary.** The names are
  the compatibility surface. Rename the old vocabulary instead.
- **Do not tokenise a literal that is genuinely not a design decision** — a brand asset's colour
  inside an inline SVG logo, a third-party embed's required value. Suppress it with a reason.
