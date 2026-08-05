---
name: eq-create-issue
description: Write a Linear issue that a PM can read and a dev can execute — one template, two branches — for work about to start, and for work already shipped that has no ticket. Use when asked to create a Linear issue or ticket, file the work just done, turn a conversation or a diff into a ticket, or write acceptance criteria.
---

# Linear Tickets

One issue, two audiences. A PM decides priority from the top half; a dev executes from the bottom
half. A ticket that serves only one of them gets rewritten by the other, and the rewrite loses
detail.

**Every branch needs a ticket ID** — `eq-frontend-workflow` branch naming is
`<type>/<ticket>-<slug>`, one branch to one ticket. That is why work already shipped still gets a
ticket written after the fact.

## Pick the branch first

| The work is | Branch | Ends as |
|---|---|---|
| Not started, or mid-discussion | **Ahead** | An issue in the team's backlog state, unassigned or assigned to whoever picks it up |
| Already committed, merged, or in a PR | **Retro** | An issue in the team's done state, linked to the PR, assigned to whoever wrote it |

Both write the same template. Retro fills it from the diff and writes past tense; Ahead fills it
from the conversation and writes intended behaviour.

## Before writing either

1. **Search Linear for an existing issue** covering this. Duplicate tickets split the discussion and
   the history. If one exists, update it instead of creating a second, and say which you did.
2. **Read the repo's product docs when it has them.** Listing `docs/features/` answers "does this
   already exist?" before a duplicate capability gets scoped — a ticket matching an existing
   feature doc is an update to that behaviour, and says so. `docs/product/constraints.md` answers
   "is this feasible?" before the acceptance criteria promise something the architecture rules
   out; when the answer is no, the ticket names the violated constraint instead of being filed
   as-is. Link the docs rather than restating them — the ticket is ephemeral, the docs are the
   record.
3. **Read the team's real field values** — statuses, labels, projects, cycles — from Linear rather
   than assuming them. Status names differ per team and an invented one fails the write.
4. **Ask for team, project, and priority once, together.** These three are the PM's call and cannot
   be inferred from a diff. Everything else in the template you write yourself.

## The template

```md
## Why

The problem, from the person who has it. What they cannot do today, and what it costs them.

## What changes

The observable before and after. What a person sees, clicks, or receives that differs.

## Acceptance criteria

- [ ] A checkable statement of behaviour — someone can run it and say pass or fail
- [ ] One per distinct behaviour

## Technical notes

The modules, seams, and contracts involved. Schema changes, API shape, migration order.

## Out of scope

What this ticket deliberately does not do, and the follow-up ticket if one exists.
```

**Retro adds one section at the top**, before `## Why`:

```md
## Shipped

Merged in <PR link> on <date>. Verified by: <the commands actually run, and their output>.
```

## The plain-language gate

**Title, Why, and What changes contain no code nouns.** No file names, no component names, no hook
names, no function names, no table names. A PM reads those three and knows whether to prioritise it.

| Rewrite | As |
|---|---|
| "Fix `useComposerState` stale closure" | "Typing in the composer is lost when a message arrives" |
| "Add `retryCount` to the upload mutation" | "A failed upload retries instead of asking the user to start over" |
| "Refactor the citation parser" | "Citations render in the same order the model returned them" |

Technical notes is where the code nouns live. That separation is the whole point of the template —
one document, read at two depths.

## Rules that bind both branches

- **No file paths and no code snippets** anywhere in the ticket. They are stale within a sprint and
  a reader who trusts them looks in the wrong place. One exception: a schema, type shape, or state
  machine that encodes a decision more precisely than prose — inline that, trimmed to the decision.
- **Acceptance criteria are checkable.** "Handles errors correctly" is not a criterion; "an upload
  that fails twice shows the retry banner and keeps the file selected" is.
- **One ticket is one vertical slice** — a complete path through every layer it touches, demoable on
  its own, sized to fit one working session. A ticket covering only the API with no UI is a task
  list item, not a slice. When the work is bigger than one slice, split it into several tickets and
  state each one's blockers using Linear's native blocking relation, created blockers-first so the
  links resolve.
- **Never close or edit a parent issue** while writing children.
- **The ticket ID goes into the branch name.** Report it back so the branch can be created.

## Ahead — work not yet started

1. Gather from the conversation, the linked doc, or the spec the user names. Read linked issues and
   their comments in full.
2. Explore the codebase enough to write Technical notes in the project's own vocabulary and to name
   the seam the change lands on. A ticket written without opening the repo invents module names.
3. Draft the template and **show it to the user before creating anything.** Ask two questions: is
   the scope one slice, and are the acceptance criteria the right ones. Iterate until approved.
4. Create the issue. Report the ID, the URL, and the branch name it implies.

The user approving the draft is the completion criterion. Creating an issue that was never shown is
the failure mode this step exists to prevent.

## Retro — work already shipped

The ticket is derived from the diff, not from memory.

1. Pin the range: `git log <base>..HEAD --oneline` and `git diff <base>...HEAD --stat`. If the work
   is merged, use the merge commit or the PR.
2. Write **only behaviour visible in that diff.** Intent you remember but the diff does not show is
   not part of this ticket. If the diff does two unrelated things, that is two tickets — say so.
3. Fill `## Shipped` with the PR link and the verification actually run. **Never paste a command
   output you did not produce.** "Typecheck and lint pass, tests not re-run" is a complete answer.
4. Acceptance criteria are written in the past tense as what the change now does, and each one is
   checkable against the merged code.
5. Create the issue in the team's done state, link the PR as an attachment, and report the ID.

A retro ticket that describes more than the diff delivered is worse than no ticket: it becomes the
record everyone trusts, and it is wrong.

## Handing off

An Ahead ticket that is ready to build is picked up by `eq-take-issue`, which reads it, agrees an
approach with a human, and builds it under `eq-frontend-workflow`.
