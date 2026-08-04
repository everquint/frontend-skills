# Architecture decision records

An ADR here records **why** a decision was made. What the rule is lives in the skills under
`skills/`. Rationale and facts rot at different speeds, so they are kept apart —
`eq-frontend-quality-bar` §6 is the mandate and the format: context, decision, consequences, date,
one page.

One is written when a dependency is chosen over an alternative, a rule is deliberately disabled, a
mechanism is rejected as overengineering, or a known-standard practice is skipped.

## Numbering

`NNNN-kebab-case-title.md`, zero-padded to four digits, allocated sequentially and never reused. The
number is permanent: it is how other documents cite the decision.

## Superseding

An ADR is never deleted and never rewritten to say something else. A decision that changes gets a
new ADR, which names the one it replaces; the old file gains a line at the top pointing forward. The
record of a decision that was later reversed is the most useful record in the directory — deleting
it destroys the reason the reversal happened.
