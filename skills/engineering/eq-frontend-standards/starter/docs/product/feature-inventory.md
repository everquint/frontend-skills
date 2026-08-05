# Feature inventory

Current state, not history — the changelog owns history. One line per shipped user-facing
capability: what it is, the code entry point in backticks, and at most one constraint worth
knowing. Entries answer "what and where", never "how" — the code owns the how.

**A PR that adds or removes a user-facing capability updates this file in the same PR.**
`/pre-pr` reports the gap; a cited path that no longer exists fails the CI structure check.

What a product deliberately does NOT do is recorded as a `NOT SUPPORTED:` line — absence is
invisible in code, so these lines are the highest-value entries here.

## <domain — one section per screen or feature area>

- <capability> — `src/<entry-point>/` — <one constraint, if any>
- NOT SUPPORTED: <deliberately absent behaviour> (see constraints.md)
