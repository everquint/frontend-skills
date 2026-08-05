# Product knowledge — docs/product/

Why the standard carries product docs at all: agents are assigned issues in environments where the
repo is all they have — CI, cloud sandboxes, Cyrus, Claude Tag — and two questions they must answer
there cannot be answered from code. "Does this already exist?" fails on code because reading 2,000
files is not a lookup, and "is this feasible?" fails on code because a capability's **absence is
invisible**: nothing in a codebase states what was deliberately not built, or what the architecture
rules out. A tracker cannot hold these answers either — tickets are ephemeral by design and nothing
forces them current — so the answers live in git, beside the code, updated in the same PR that
changes them. That same-PR coupling is the property no wiki or tracker has, and the reason this is
a repo directory and not a Linear document.

## The tree, and what each file answers

```
docs/product/
├── INDEX.md              # router — the only file read first; ~15 lines
├── feature-inventory.md  # "does this exist?" — one line per capability + entry point
├── constraints.md        # "is this feasible?" — hard limits, NOT SUPPORTED list
├── current-focus.md      # "does this fit priorities?" — the cycle's objective
└── domains/<area>.md     # deep dive per feature area — created on first touch
```

Token cost is flat in product size: agents load the AGENTS.md bullet (always), INDEX.md (only on
feature and feasibility tasks), then the one leaf file the task routes to. Scale adds leaves,
never per-session load. A domain file past ~300 lines splits by sub-area, closest file wins.

## Writing the inventory

- **State, not history.** The inventory says what the product can do today; CHANGELOG.md owns what
  changed when. An inventory that logs every PR is a second changelog and gets skipped.
- **What and where, never how.** One line: capability, entry point in backticks, at most one
  constraint. The moment a line explains implementation it duplicates the code and starts rotting —
  the code is the single source of truth for the how.
- **`NOT SUPPORTED:` lines are the highest-value entries.** They are the one fact an agent can
  never recover from the codebase. Every deliberate "no" a review or a planning call produces is
  a line here, pointing at the constraints entry that argues it.
- **Entry points in backticks, real paths.** `check-structure.mjs` rule 7 asserts every cited
  `src/…` path exists, so a move that forgets the inventory goes red in CI instead of lying to the
  next agent.

## The freshness contract

Documentation rots wherever nothing forces it current, so every layer here is a forcing function,
not a request:

| Layer | Mechanism |
|---|---|
| Same-PR rule | A PR that adds or removes a user-facing capability updates the inventory in that PR — stated in AGENTS.md, checked by `/pre-pr` step 7 against the diff |
| Stale citations | `check-structure.mjs` rule 7 fails CI on cited paths that no longer exist |
| Presence | `standard-check.mjs` flags any of the four files missing, so a repo cannot record compliance without them |
| current-focus.md | The one file allowed to churn: owned by whoever runs planning, restamped at cycle boundaries, and its `Updated:` line lets a reader judge staleness |

What does NOT owe an entry: bug fixes, refactors, styling, and performance work inside existing
behaviour. The test is "did this change what the product can do?" — if every PR touched the
inventory, it would be a changelog, and the signal would drown.

## Seeding an existing repo

Seed thin; deepen on touch. Backfilling ten rich domain files up front is how these trees die.

1. **feature-inventory.md** — one agent pass over the routes/screens tree drafts the one-liners; a
   human verifies and adds the `NOT SUPPORTED:` lines the agent cannot know.
2. **constraints.md** — written by hand. It is the highest-value file and only a human knows the
   hard limits and the deliberate "no" list.
3. **current-focus.md** — the current cycle's objective, dated.
4. **domains/** — created empty of files. Each domain file is written the first time someone works
   in that domain: the author writes the ~50 lines they wished they had on arrival. Six months
   later the map covers exactly the terrain that gets traffic.

## How the skills consume it

- `eq-create-issue` checks the inventory for duplicates and constraints.md for feasibility before
  filing, and links ticket sections here instead of restating them.
- `eq-take-issue` reads INDEX.md while orienting — the inventory names the prior art, and a
  constraint can veto an approach before it is proposed — and treats the inventory entry as part
  of the deliverable when the diff changes a capability.
- `/pre-pr` step 7 is the last local gate before the PR carries the change out.
