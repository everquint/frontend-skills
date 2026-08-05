---
name: eq-take-issue
description: Take a Linear issue, read it against the codebase, settle the approach with the human one question at a time, then build it under the delivery workflow. Use when given a Linear issue ID or URL to implement, asked to pick up a ticket, or asked how a ticket should be built.
---

# Implement a Linear Issue

A ticket says what to build. It never says how, and the how is where the cost is. This skill spends
its first half turning a ticket into an agreed approach, and its second half building that approach.

**No file is edited before the approach is approved.** Step 5 is the gate. Reaching for the editor
during steps 1 to 4 is the failure this skill exists to prevent — an approach discovered mid-edit is
defended rather than chosen.

## 1. Read the whole issue

Fetch the issue and read every part of it: description, all comments, linked documents, attachments,
the parent, and any blocking issues. Read the blockers' resolutions — they carry decisions already
made that this ticket inherits.

State back, in three lines: what the issue asks for, what it rules out of scope, and what it leaves
undefined. Undefined is the list step 4 works through.

## 2. Orient in the codebase

Find the seam the change lands on before proposing anything. Prefer an existing seam to a new one,
and the highest seam that works — the fewer seams a codebase has, the cheaper every future change
at that boundary.

Report a short map: the modules involved, the current behaviour at the seam, and the prior art —
the closest thing the repo already does. Prior art settles more approach questions than discussion
does.

Where the repo has `docs/product/`, read `INDEX.md` and the files it routes to for this ticket:
the feature doc in `docs/features/` is the prior art and carries the decisions this ticket
inherits, and a `constraints.md` entry can veto an approach before it is proposed. A ticket that
duplicates an existing feature doc goes back to the human as a question, not into code.

Look outside the repo too, before proposing anything: whether a maintained package already solves this,
and how the libraries involved actually behave at the versions this repo pins. Both are facts, so both
are looked up rather than asked — `../eq-frontend-workflow/SKILL.md` owns the mechanisms and their
precedence. An approach built on a misremembered API gets settled in step 4 and discovered in step 6.

Look for a prefactor: a mechanical change that makes the real change small. Make the change easy,
then make the easy change. A prefactor is its own commit, landed first.

## 3. Restate the acceptance criteria as tests

For each acceptance criterion, name the test that proves it and the level it sits at — unit,
integration, or E2E per `../eq-frontend-quality-bar/SKILL.md`. A criterion with no test you can name
is either untestable as written or not a criterion; flag it and take it into step 4.

This list is the plan's contract. It is what step 7 checks against, and what the PR body reports.

## 4. Grill the approach

Interview the human relentlessly, walking down the decision tree one branch at a time and resolving
dependencies between decisions in order.

| Rule | Why |
|---|---|
| **One question per turn, then wait** | A block of five questions gets one answer covering two of them, and the other three are silently defaulted |
| **Every question carries your recommendation** | "Which cache key?" costs the human the whole design. "I recommend keying on conversation ID because X — agree?" costs them a yes |
| **Facts you look up, decisions you ask** | Anything the filesystem, the tracker, the tests, or the docs can answer is yours to find. Never spend a question on it |
| **An unanswered question is never a default** | Silence is not agreement. Ask again or stop |
| **Never answer for the human** | A grilling session where the agent supplies both sides has produced its own plan wearing the human's name |

Questions worth asking, in this order: the data shape and where state lives; the seam and whether it
is new; error and empty states; what happens to existing data or in-flight users; the rollout and
whether anything is reversible; what is deliberately left out.

**Completion criterion:** every decision the plan depends on has an explicit answer from the human,
and the undefined list from step 1 is empty. Then say the plan back in full and ask for approval —
in those words, waiting for it.

## 5. Publish the approach and claim the ticket

Once approved, before editing:

1. **Post the agreed approach as a comment on the issue.** It is the durable record — the next
   person, agent, or PM reads the ticket, not this session. Cover the approach, the decisions taken
   and their reasons, the test plan from step 3, and what is out of scope.
2. Assign the issue to yourself and move it to the team's in-progress state. Read the team's real
   statuses rather than assuming a name.
3. Create the branch: `<type>/<ticket>-<short-slug>` per `../eq-frontend-workflow/SKILL.md`.

## 6. Build it

Under `../eq-frontend-workflow/SKILL.md` for branch, commits, and delegation, and
`../eq-frontend-quality-bar/SKILL.md` for the tests.

- **Failing test first**, at the seam agreed in step 2 — never at a seam invented while coding.
- Prefactor commit first, behaviour commit second. Never mixed.
- Typecheck often, run the touched test files often, run the full suite once at the end.
- **The approach is settled.** A discovery that breaks it goes back to the human as a question, not
  into the diff as a decision. Post the change of approach to the issue comment when it lands.
- **A capability shipped is a feature doc shipped.** Write `docs/features/<ticket>-<slug>.md` from
  the ticket and the step 5 approach comment (why, behaviour, decisions, out of scope — format:
  the repo's `docs/features/README.md`) in the same branch; a changed behaviour updates the
  existing doc. It is part of the diff, not a follow-up; `/pre-pr` reports it missing.

## 7. Verify against the ticket, not against the code

Walk the acceptance criteria one at a time and state, per criterion, the test or command that proves
it and what that returned. A criterion with no evidence is unmet — say so.

Then run the full gate — `/pre-pr` where the repo has it, which adds the structure, standard-version
and feature-doc checks on top of typecheck/lint/tests/build; otherwise the gate table in
`../eq-frontend-workflow/SKILL.md` — and the two reviews from that skill: conventions and
correctness in parallel, both required, both by the agent that owns the whole change.

Add the third axis this skill makes possible: **does the diff match the ticket?** Three findings to
look for — asked-for behaviour that is missing or partial, behaviour in the diff that nobody asked
for, and criteria that look implemented but are implemented wrong. Quote the criterion for each.

## 8. Close out

- Open the PR with the four-section body from `../eq-frontend-workflow/SKILL.md`, linking the issue
  so Linear attaches it.
- Comment on the issue with what shipped and anything deferred, and file the deferred work as its
  own ticket via `../eq-create-issue/SKILL.md` rather than leaving it in a comment.
- Move the issue to the team's review state. **The human merges and moves it to done** — a merged
  PR is the author's call, and so is the status that follows it.
