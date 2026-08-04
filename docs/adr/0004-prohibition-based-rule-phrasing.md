# 0004 — Prohibition-based rule phrasing, against published skill-writing guidance

Date: 2026-08-04
Status: Accepted

## Context

The three skills are written in prohibitions. Counted on 2026-08-04: `never` appears 16 times in
`eq-frontend-standards/SKILL.md`, 11 in `eq-frontend-workflow/SKILL.md`, and 6 in
`eq-frontend-quality-bar/SKILL.md` — "Never commit to the default branch", "Never merge with a red gate",
"Never pass `--no-verify` to get past a failing hook", "Never `lint-staged --no-stash`", "Never report
'all green' for a step that did not run".

Published guidance on writing agent skills says the opposite: state the positive target behaviour, and
avoid steering by prohibition. The stated reason is that a prohibition describes the space of wrong
actions rather than the one right action, which leaves the reader to infer what to do.

That reason holds for instructions whose subject is a procedure with one correct path. It does not hold
for the rules in these skills, which are gates. A gate names a specific action that destroys something,
and its useful content is the destruction, not the alternative.

Inverting one shows the loss. "Never pass `--no-verify` to get past a failing hook" inverts to "run the
hooks and let them pass" — which is not checkable, because it does not name the thing a reviewer would
find in the history. The prohibition names an artefact: a commit whose hook did not run. The positive
form names a mood.

The other half of the context is a rule this repo already enforces on itself. `README.md` requires that
every rule carry a concrete failure scenario — specific inputs or state leading to wrong output, a crash,
or data loss — and `references/correctness-rules.md` states that a rule earns its place only if that
scenario can be written down. A prohibition paired with such a scenario is not a mood either: it names an
action, and it names what breaks. `Never lint-staged --no-stash` carries "a task that corrupts the working
tree leaves nothing to recover from", and that sentence is what makes the rule arguable, testable, and
possible to retire when it stops being true.

## Decision

The skills keep prohibition-based phrasing for gates, deliberately and against the published guidance.

**The pairing is the standard, not the prohibition.** A `Never` ships only with a concrete failure
scenario attached, in the same sentence or the one after it. The scenario carries the reasoning; the
`Never` carries the checkability.

**The limit of the divergence: a bare `Never` is a defect by this repo's own bar.** A prohibition with no
failure scenario is exactly the "This is unconventional" finding that `README.md` says is not a rule, and
it is the case the published guidance is right about. It is fixed by supplying the scenario or by deleting
the rule — not by rewording it into a positive that hides the missing scenario.

Positive phrasing stays the default everywhere the subject is a procedure rather than a gate: the
migration ladder, the setup steps, the review sequence. This decision is scoped to rules that exist to
stop one specific action.

## Consequences

- The skills read as stern, and to a reader expecting current skill-writing style they read as badly
  written. That cost is accepted in exchange for rules a reviewer can check against a diff or a history.
- **A new failure mode to watch: prohibitions accrete.** Each one is individually cheap to add and none is
  ever obviously worth deleting, so the count grows and the signal per `Never` falls. The failure-scenario
  requirement is the only brake — a rule whose scenario can no longer be written is a rule to remove.
- An automated skill linter built on the published guidance will flag these files. The flags are expected
  and are not defects; this ADR is the answer to them.
- A rule stated as a prohibition is harder to convert into a positive checklist item later, so a future
  decision to align with the guidance is a rewrite of every gate rather than a formatting pass.

## Alternatives rejected

- **Follow the guidance and invert every rule.** Produces vague positives for the gates: "keep the default
  branch clean", "keep the build green". Neither names an action, so neither is auditable, and the failure
  scenario has nowhere to attach.
- **State both forms — positive target plus prohibition.** Doubles the length of every rule and restates
  the same rule twice, which is the duplication defect the standard's own `duplication.md` names. The
  second copy also drifts: one form gets updated and the other keeps the old bound.
- **Keep the prohibitions and drop the failure-scenario requirement**, on the grounds that a gate is
  self-evident. This removes the only thing separating these rules from taste, and it removes the test for
  when a rule should be retired.
