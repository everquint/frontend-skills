# Feature docs

One file per shipped user-facing capability, named `<ticket>-<slug>.md`. This directory is the
feature index: listing it answers "does X already exist?", the file answers what X does and why.

**Written by the agent that ships the feature, in the shipping PR** — the content already exists
in the ticket; this file is where it survives the ticket. **Updated by whoever changes the
feature's behaviour, in that same PR.** A cited code path that no longer exists fails the CI
structure check.

Format — short, behaviour-first, no implementation detail (the code owns the how):

```md
# <Capability, as a PM would name it>

Shipped: <date>, <PR link>. Entry point: `src/<path>`.

## What it does
The observable behaviour, present tense. What a person sees, clicks, or receives.

## Why
The problem it solves, one paragraph.

## Decisions
The choices that shaped it and their reasons — the part code cannot state.

## Out of scope
What it deliberately does not do, and where that is ruled (constraints.md entry, or a follow-up
ticket).
```
