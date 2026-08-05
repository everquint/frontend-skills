# 0014 — product knowledge (docs/product/) is part of the standard

Date: 2026-08-05

## Context

Agents are assigned issues in environments where the repo is all they have — CI runners, cloud
sandboxes, Cyrus, Claude Tag (the same environments ADR-era v1.6.0's portable enforcement targets).
Two questions they must answer there cannot be answered from code: "does this capability already
exist?" (reading 2,000 files is not a lookup) and "is this feasible?" (a capability's absence is
invisible — nothing in a codebase states what was deliberately not built or what the architecture
rules out). Trackers and wikis cannot hold the answers either: nothing ties their content to the
code, so it drifts within weeks and agents read stale pages with unwarranted confidence.

The components composing the fix are individually proven — docs-as-code at Google (g3doc) and
Spotify (TechDocs), AGENTS.md as the agent entry point (60k+ repos, Linux Foundation stewardship),
progressive disclosure (this skill set's own design) — but the assembly needed a decision: optional
convention, separate skill, or mandatory part of this standard.

## Decision

**Mandatory, inside eq-frontend-standards.** The stated goal of v1.6.0 is that agents in
environments without a personal skill install are still governed by the repo; that guarantee only
holds for things the standard carries by default. Four starter files under `docs/product/` —
`INDEX.md` (router), `feature-inventory.md` (one line per user-facing capability + entry point,
including `NOT SUPPORTED:` lines), `constraints.md` (hard limits), `current-focus.md` (the cycle's
objective) — routed to by a bullet in `starter/AGENTS.md`, with the condition in the pointer's
wording so bug-fix sessions never load it.

Freshness is enforced, not requested, because unforced docs rot (measured on one adopted repo: 19
unindexed docs, ~5,100 lines, mixing durable truth with expired session artifacts):

- the same-PR rule — a capability added or removed updates the inventory in that PR — checked by
  `/pre-pr` step 7 against the diff;
- `check-structure.mjs` rule 7 fails CI on cited entry-point paths that no longer exist;
- `standard-check.mjs` flags any of the four files missing, so compliance cannot be recorded
  without them.

Content stays reviewer-owned: the scripts assert presence and path validity, never quality.
Existing repos seed thin — inventory drafted by an agent pass and verified by a human,
constraints.md written by hand, domain files only on first touch — per
`references/product-knowledge.md`.

## Consequences

- Migration 1.9.0: adopted repos create and seed the four files before `--check` passes again.
  Seeding the inventory is the one real cost; constraints.md is deliberately human-written.
- The inventory is state, not history — CHANGELOG.md owns history. If every PR touched the
  inventory the signal would drown; only capability changes owe an entry.
- The `/pre-pr` capability check is agent judgement over a diff, not a script: "new route or
  feature directory" is a heuristic, and a mechanical version would misfire both ways. CI still
  catches the stale-path half mechanically.
- A future relational layer (feature graph, embeddings) would be built over these files, not
  instead of them — the tree stays the source of truth.
