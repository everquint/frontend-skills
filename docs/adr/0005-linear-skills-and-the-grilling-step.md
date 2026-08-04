# 5. Linear as the tracker, and grilling as a step rather than a skill

Date: 2026-08-04

## Context

The standard covered code, delivery, and the quality bar, but nothing upstream of the branch:
`eq-frontend-workflow` requires `<type>/<ticket>-<slug>` and one branch per ticket, while nothing
said how a ticket comes to exist or how a dev turns one into an agreed approach.

Two shapes were taken from [mattpocock/skills](https://github.com/mattpocock/skills): the vertical
tracer-bullet slice with declared blocking edges (`to-tickets`), and the one-question-at-a-time
interview (`grilling`). Its `code-review` contributed the observation that a spec axis is a
different review from a standards axis.

## Decision

**Linear is named, not abstracted.** Every consuming team is on it, and a tracker-agnostic skill
degrades into instructions to read a config file that then has to be written per repo. Naming it
buys concrete steps — read the team's real statuses, use the native blocking relation, attach the
PR. If a team moves tracker, this is superseded rather than parameterised.

**Two skills, split by audience, not by tracker verb.** `eq-create-issue` writes issues; its whole
design problem is that a PM and a dev read the same document at two depths, which the template
solves by keeping code nouns out of the top three sections. `eq-take-issue` consumes an issue; its
design problem is that an approach discovered mid-edit is defended rather than chosen, which it
solves with an approval gate before the first edit.

Both are named for the verb a dev says out loud — create an issue, take an issue — rather than for
the tracker. The tracker is already in the description, where it does its invocation work; putting
it in the name too spends a word on a fact the body states five times.

**Grilling is a step inside `eq-take-issue`, not a published skill.** The interview is
valuable — one question per turn, recommendation attached, facts looked up rather than asked. As a
free-floating `/grill-me` it has no completion criterion, so it ends when the human tires of it. As
step 4 of an implement flow it ends on a checkable condition: every decision the plan depends on has
an explicit answer. Devs who want the standalone version install it from upstream; this repo does
not fork a generic skill it would then have to maintain.

**The spec axis was added to `eq-take-issue`, not to the workflow's review pair.** The
conventions and correctness reviews apply to every change. A does-the-diff-match-the-ticket review
is only possible when a ticket exists, so it lives in the skill that guarantees one.

## Consequences

- Two more `SKILL.md` descriptions sit in context every turn. That is the cost of model invocation;
  both earn it by firing on phrasing devs already use ("file a ticket", "pick up AB-1420").
- The four-skill set now has a cycle by design: implement finishes by filing deferred work back
  through the ticket skill.
- Tracker-specific steps rot with Linear's API. The skills name operations, never field IDs.
- `to-tickets`-style breakdown of a large effort into a blocked ticket graph is present only as a
  rule inside `eq-create-issue`. If teams start planning multi-week efforts through it, that becomes
  its own skill and this is superseded.
