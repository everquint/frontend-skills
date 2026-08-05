---
"frontend-skills": minor
---

Feature-doc format refinements from the first external review of a seeded repo. The naming rule now admits ticketless backfills (`<slug>.md` for legacy features; `<ticket>-<slug>.md` stays the rule for ticketed work — previously every backfilled doc violated the stated convention). The template gains: "who it is for" in What it does, an optional `Status:` line for deprecation (`deprecated <date> — <replacement>`), and the rule that a reversed decision is rewritten to say what it replaced and when, never silently edited. current-focus.md is now explicitly a one-paragraph summary plus a tracker link, not a copy of the cycle. Rejected from the same review, deliberately: hand-written success metrics (violates the generate-every-measured-claim rule) and per-repo ADR directories (the enforce-ADRs decision stands).
