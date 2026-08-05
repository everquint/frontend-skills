# 0015 — per-feature docs written by agents, over a hand-maintained inventory

Date: 2026-08-05
Supersedes the inventory artifact of [0014](0014-product-knowledge-in-the-standard.md); 0014's
decision that product knowledge is mandatory, and its enforcement design, stand.

## Context

0014 shipped `feature-inventory.md` — a hand-maintained one-line-per-capability table — as the
"does this exist?" answer. The standard's owner rejected it the same day: agents search code well
enough that a lookup table is marginal; what the product actually lacks is *feature docs* —
behaviour, intent, decisions, the why. A careful survey then split the evidence:

- **Per-feature spec docs are the emerging tool standard** (GitHub Spec Kit's `specs/<feature>/`,
  AWS Kiro's requirements/design/tasks) — but Fowler's analysis of all three SDD tools found specs
  are in practice **per-change artifacts**; "spec-anchored over time" is attempted only by Tessl
  and is experimental. "Specification rot" now has a name and a paper.
- **Big-company feature docs are point-in-time** (Google design docs, Uber RFCs): the recorded
  value is the forced thinking and the decision trail; nobody maintains them, and the recurring
  failure is what happens to the doc after acceptance.
- **Karpathy's llm-wiki names the maintenance model that works**: a git repo of markdown where
  **the LLM does the bookkeeping humans abandon** — humans curate, agents write and update, a
  periodic lint pass hunts contradictions, stale claims, and orphans. Hashimoto's harness
  engineering adds the update trigger: the moment an agent is misled is when the doc gets fixed.

## Decision

Feature docs, with the maintenance placed on agents and fenced by CI:

- **`docs/features/<ticket>-<slug>.md`, one per shipped capability.** Written by the shipping
  agent in the shipping PR, from the ticket material that already exists (Why, What changes,
  acceptance criteria, the approach comment) — write cost ~zero, and the content survives the
  ticket. Updated by whoever changes the behaviour, in that PR. Behaviour and intent only; the
  code owns the how.
- **The directory is the index.** No inventory file and no generator: listing `docs/features/`
  answers "does X exist?", filenames are the lookup. Nothing to rot.
- **`constraints.md` absorbs `NOT SUPPORTED:`** — deliberate absence is a ruling, and rulings
  live with the other hard limits.
- **`/doc-lint`** — a starter slash command, not new infrastructure: an agent pass over the docs
  for stale claims, contradictions, and orphans, fixing in place and escalating rulings. The
  mechanical half stays in CI (rule 7: cited paths must exist; now scans `docs/features/` and
  `docs/product/`).
- Enforcement carries over from 0014 unchanged in kind: `/pre-pr` step 7 (capability-changing
  diff must carry its feature-doc change), rule 7, presence gaps in `standard-check`.

## Consequences

- Major version (2.0.0): repos seeded on 1.9.0 convert inventory lines to feature docs and move
  `NOT SUPPORTED` lines into constraints; repos coming from earlier versions skip the inventory
  step entirely. Backfill of legacy features is explicitly NOT required — a legacy feature gets
  its doc the first time an agent works on it.
- The bet inherited from Karpathy's pattern — that agent-maintained docs plus a lint loop beat
  human discipline — is the part without long-term evidence yet. The fences (rule 7, step 7) are
  what bound the damage if it underdelivers: paths cannot go stale silently, and capability
  changes cannot ship docless.
- `domains/<area>.md` from 0014's tree is folded into feature docs and constraints; a repo that
  wants domain overviews can still add them, but the standard no longer names them.
