# Product knowledge — docs/features/ and docs/product/

Why the standard carries product docs at all: agents are assigned issues in environments where the
repo is all they have — CI, cloud sandboxes, Cyrus, Claude Tag — and code cannot answer what a
feature is *supposed* to do, why it works the way it does, or what was deliberately never built.
A capability's **absence and intent are invisible in code**. Trackers and wikis cannot hold the
answers either — nothing ties their content to the code, so it drifts within weeks. In git, the PR
that changes the behaviour updates the doc, and CI can check it.

The design (docs/adr/0015) follows the maintenance model that holds up in practice: **agents write
and maintain the docs, humans curate, a lint loop audits** — human-maintained feature docs rot
everywhere they have been tried; point-in-time design docs survive but go stale by design. Placing
authorship on the shipping agent, from ticket material that already exists, makes the write cost
~zero and the update a normal part of the diff.

## The tree

```
docs/
├── features/              # one doc per shipped capability — the directory IS the index
│   ├── README.md          # the format (shipped in the starter)
│   └── <ticket>-<slug>.md
└── product/
    ├── INDEX.md           # router — read first, follow one link
    ├── constraints.md     # hard limits + the NOT SUPPORTED list
    └── current-focus.md   # the cycle's objective, dated
```

No inventory file: "does X exist?" is answered by listing `docs/features/` — filenames are the
lookup, so there is no hand-maintained table to rot and no generator to run. Token cost stays flat
in product size: the AGENTS.md bullet (always loaded), INDEX.md on feature/feasibility tasks, then
only the files the task touches.

## The lifecycle — who writes what, when

| Moment | Action | Actor |
|---|---|---|
| Feature ships | `docs/features/<ticket>-<slug>.md` written from the ticket (why, behaviour, decisions, out of scope) in the shipping PR | the shipping agent |
| Behaviour changes | that doc updated in the changing PR | whoever changes it |
| Capability removed | doc deleted, `NOT SUPPORTED:` line added to constraints.md if the removal was a ruling | whoever removes it |
| A doc misleads an agent | fixed in that same session — the moment of failure is when docs get corrected | the misled agent |
| Periodically / before a release | `/doc-lint` — stale claims, contradictions, orphans; fixes in place, escalates rulings | an agent, on demand |

Enforcement, each a fence rather than a request: `/pre-pr` step 7 fails a capability-changing diff
with no feature-doc change; `check-structure.mjs` rule 7 fails CI on cited code paths that no
longer exist; `standard-check` flags the scaffold files missing. What the docs *say* is owned by
`/doc-lint` and review — presence and path validity are the only machine claims.

## What does NOT owe a doc

Bug fixes, refactors, styling, and performance work inside existing behaviour. The test is "did
this change what the product can do?". Feature docs are behaviour and intent, never implementation
detail — a doc that explains the how duplicates the code and starts rotting; the code owns the how.

## Seeding an existing repo

Backfill is NOT required — a doc per legacy feature written from archaeology is low-value and
high-cost. Seed:

1. `docs/features/README.md` and the two `docs/product/` files from the starter templates.
2. `constraints.md` by hand — the hard limits and the deliberate `NOT SUPPORTED` list are the
   entries only a human knows, and the highest-value lines in the whole tree.
3. `current-focus.md` — the current cycle, dated.
4. Feature docs accumulate from now on: every shipped capability gets one, and a legacy feature
   gets one the first time an agent works on it (the agent drafts what it learned; a human
   verifies). Six months later the docs cover exactly the terrain that gets traffic.

## How the skills consume it

- `eq-create-issue` lists `docs/features/` (duplicate?) and reads `constraints.md` (feasible?)
  before filing, and links docs instead of restating them.
- `eq-take-issue` reads INDEX.md while orienting — the feature doc is the prior art and carries
  the decisions the ticket inherits — and writes/updates the feature doc as part of the diff.
- `/pre-pr` step 7 is the last local gate; `/doc-lint` is the periodic audit.
