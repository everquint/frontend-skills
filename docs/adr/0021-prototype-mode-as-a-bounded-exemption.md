# 0021 — prototype work gets a bounded exemption, not a second standard

Date: 2026-08-27

## Context

Consumers report the standard as a good fit for existing repos and processes, and too slow for new
work that is exploratory — a prototype, a POC, a demo built to answer one question. The friction was
named in four places at once: initial setup, the per-change gates, the delivery ceremony (branch, PR
body, reviewer passes, changeset), and the product documentation the standard asks for up front.

Some of that report is a misreading — `init-greenfield.mjs` on a new repo is minutes, and the
per-change gates are the standard's value, not a tax to be earned later. The rest is real. Diff
coverage at 90%, a type-aware lint pass, an e2e scaffold, release machinery, two reviewer passes and
a four-heading PR body all pay for themselves over months of maintenance. A repo that will be
deleted in three weeks never reaches the payoff, and every one of those gates still costs on every
change.

The failure this creates is not slowness. It is that teams under time pressure skip the gates
anyway, without saying so — and then the prototype gains a user and the skipping is permanent,
undocumented, and invisible to `standard-check.mjs`, which reports the repo as "never migrated"
exactly as a neglected production repo would.

Three options were considered.

**Do nothing.** The standard already says a spike may skip release machinery. That is one gate out
of a dozen, and it leaves the other eleven to be skipped informally. Rejected: the informal path is
the one already being taken, and it has no expiry and no graduation step.

**A separate lightweight standard.** A parallel skill with its own rules and its own starter files.
Rejected: two standards drift by construction. The moment oxlint is bumped or a rule is added, one
copy is stale, and the stale copy is the one prototypes graduate *out of* — so the drift lands in
production code. It also gives a team a permanent home for work that wants no gates, which is the
opposite of the intent.

**A mode of the one standard.** One small skill that lists the relaxations, marks the repo, and owns
the path back.

## Decision

Ship `eq-frontend-prototype`: prototype mode as a **bounded, marked, expiring exemption** from the one
standard.

Four properties make it bounded rather than a loophole:

1. **An entry test.** One named question, an expiry date, no external dependents, no production data
   or live credentials. All four, or the mode does not apply.
2. **A marker, in two places.** `PROTOTYPE.md` for people and `package.json`'s `eqPrototype` for
   tooling. `standard-check.mjs` now reads it and reports prototype mode as a distinct outcome from
   "never migrated" — and fails `--check` once the expiry passes, or if both markers are present at
   once (the half-graduated state).
3. **A written graduation procedure** (`references/graduation.md`), run in one sitting, ending in
   `--record`. `--record` refuses while the prototype marker is still there. `graduate-check.mjs`
   sizes the backlog first — delegating every count to the standards skill's existing scripts — so
   "one sitting or not" is a number rather than a feeling, which is what keeps a repo out of the
   half-graduated state.
4. **Non-negotiables that do not relax:** no secrets, no production or customer data, fabricated
   data labelled as fabricated, no shared or public deployment. These are about harm, not quality,
   and speed is not an argument against them.

`init-prototype.mjs` lands a strict **subset** of `eq-frontend-standards/starter`, read at run time
from the sibling skill — no config and no dependency version is copied into this skill. `lint` in
prototype mode is the standards fragment's own `lint:fast` value, looked up by key. There is
therefore no second source of truth to drift.

Typecheck, base lint and the formatter hook stay on. They are close to free per change, and each one
protects the prototype's *answer* rather than its maintainability: an `any` or a stale closure makes
a prototype confidently wrong, which is the only way a prototype can actually fail.

No rule is restated in the four production skills, and no relaxation lives in them — which is also
why they stay inside their 200-line budgets. The single change on their side is `standard-check.mjs`
learning to read the marker.

## Consequences

- Minor version. Consumers gain a skill; no rule they were following changed. The one behaviour
  change is in `standard-check.mjs`, and it only fires on a repo that opted into the marker.
- The exemption is auditable for the first time. "Which of our repos are running reduced gates, and
  which of those are overdue?" is now a grep for `eqPrototype` plus a date comparison.
- Prototype mode is a plausible thing to abuse — a team can declare a real product a prototype and
  set the expiry a year out. The mitigation is deliberately social rather than mechanical: the
  question and the date sit in `PROTOTYPE.md` at the top of the repo and print at every session
  start. A standard cannot stop a team from lying to itself; it can stop that from being quiet.
- Graduation is a large, reviewed PR by design, not a gradual tightening. That is a real cost, paid
  once, and it is the cost the expiry date exists to keep small.
- If the mode turns out to be used for work that should never have been exempt, the next ADR
  tightens the entry test or withdraws the mode. Withdrawing it costs one skill directory and the
  `standard-check.mjs` branch; nothing enforced depends on it.
