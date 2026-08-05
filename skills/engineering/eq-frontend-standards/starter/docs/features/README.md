# Feature docs

One file per shipped user-facing capability. Named `<ticket>-<slug>.md` when the work has a
ticket; a backfilled doc for a legacy feature has no ticket and is plain `<slug>.md`. This
directory is the feature index: listing it answers "does X already exist?", the file answers what
X does and why.

**Written by the agent that ships the feature, in the shipping PR** — the content already exists
in the ticket; this file is where it survives the ticket. **Updated by whoever changes the
feature's behaviour, in that same PR.** A cited code path that no longer exists fails the CI
structure check.

Format — short, behaviour-first, no implementation detail (the code owns the how):

```md
# <Capability, as a PM would name it>

Shipped: <date>, <PR link>. Entry point: `src/<path>`.
Status: <omit when live; `deprecated <date> — <replacement or reason>` when sunsetting>

## What it does
The observable behaviour, present tense, and who it is for. What that person sees, clicks, or
receives.

## Why
The problem it solves, one paragraph.

## Decisions
The choices that shaped it and their reasons — the part code cannot state. A reversed decision is
rewritten to say what it replaced and when ("keyed per user since 2026-09, was per tenant"), never
silently edited — the trail is what makes this section worth reading.

## Out of scope
What it deliberately does not do, and where that is ruled (constraints.md entry, or a follow-up
ticket).
```
