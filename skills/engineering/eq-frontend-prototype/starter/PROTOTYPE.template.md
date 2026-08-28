# Prototype

**Question this answers:** __QUESTION__

**Expires:** __EXPIRES__ — on that date this repo is deleted, or graduated to the full standard
(`eq-frontend-prototype` references/graduation.md). There is no third option.

This repo runs in **prototype mode**: a reduced gate set, sanctioned by `eq-frontend-prototype` SKILL.md.
It is not a template for a production repo. Copying files out of it copies the relaxations with
them.

## What is off

No CI, no coverage gate, no e2e suite, no changesets or releases, no commitlint or git hooks
beyond formatting, no PRs, no code review, no product docs. Commits go straight to the default
branch.

## What is on

`npm run typecheck` and `npm run lint` — run both before you trust any answer this prototype
gives. Formatting runs automatically on every agent edit.

## Non-negotiable, even here

- No secrets, tokens or keys in the repo or in client code.
- No production or customer data. Synthetic fixtures only.
- Any fabricated data shown in the UI is labelled as fabricated.
- Never deployed to a shared or public URL. A URL means users, and users end prototype mode.

## Findings

Record what the prototype actually showed, as you learn it. This section is the deliverable — the
code is not.

- 
