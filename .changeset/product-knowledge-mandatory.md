---
"frontend-skills": minor
---

Product knowledge (docs/product/) is now a mandatory part of the standard. Agents working from the repo alone — CI, Cyrus, Claude Tag, cloud sandboxes — could not answer "does this capability already exist?" or "is this feasible?", because a capability's absence is invisible in code. The starter now ships four templates (INDEX.md router, feature-inventory.md, constraints.md, current-focus.md), AGENTS.md routes agents to them, and freshness is enforced: a PR that adds or removes a user-facing capability must update the inventory in the same PR (/pre-pr step 7), check-structure rule 7 fails cited entry-point paths that no longer exist, and standard-check flags the files when missing. eq-create-issue checks the inventory and constraints before filing; eq-take-issue reads them while orienting and treats the inventory entry as part of the deliverable. Migration 1.9.0 names the seeding steps; rationale in ADR 0014 and references/product-knowledge.md.
