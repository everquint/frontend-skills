# 0002 — AI-assisted one-time migration instead of a suppressions baseline

Date: 2026-08-04

## Context

The standard's migration ladder was built on ESLint 9.24+ bulk suppressions: rules at zero violations
go to `error` immediately, everything else goes to `error` plus a recorded baseline written by
`--suppress-all` and narrowed later by `--prune-suppressions`. The baseline can only ratchet down, so
new code complies while old debt sits recorded rather than hidden.

**oxlint has no equivalent.** Read from `oxlint --help` and the oxlint documentation on 2026-08-03:
inline `oxlint-disable`, `--report-unused-disable-directives`, ignore files and `--max-warnings` all
exist; there is no suppressions file and no `--suppress-all`. The feature request is
[oxc-project/oxc#10549](https://github.com/oxc-project/oxc/issues/10549), "Support ESLint-style bulk
suppression via suppressions file", open since 2025-04-22.

Adopting oxlint (ADR 0001) therefore removes the mechanism step 3 of the migration procedure depends on.

## Decision

Replace the baseline with a **one-time, AI-assisted fix of every violation**. Suppressions exist to
adopt a rule set onto debt a team cannot afford to fix; fixing it is a valid substitute now that the
fixing is cheap.

**The size boundary is the load-bearing part of this decision.** Measured on 2026-08-03:
inbox-ledger had **167** violations across 428 files, and migrated in a single pass. FluentMind had
**1,474** violations across 2,382 files — 2,105 with type-aware rules enabled — and was **not**
migrated, deliberately. oxc's own issue thread describes that scale as *"a PR that is not land-able,
with all the potential to get merge conflicted."*

**Threshold: about 300 violations.** That number is a judgement calibrated on those two measurements,
not a constant derived from anything. A repo above it stays on ESLint with its existing suppressions
baseline until #10549 lands, rather than attempting a reformat-plus-fix change no reviewer can read.

## Consequences

- A repo that starts clean still acquires violations when the standard adds a rule, so every repo
  eventually wants suppressions. This decision defers that problem; it does not remove it.
- **Migrating breaks existing disable comments.** `react-hooks` is a reserved oxlint plugin name, so the
  plugin is aliased, and every `// eslint-disable-next-line react-hooks/*` stops suppressing anything.
  Measured: inbox-ledger 82 findings against 74, FluentMind 891 against 890. Each of those deltas is a
  comment that silently went inert.
- `oxlint-tsgolint` rejects `baseUrl` in `tsconfig`, so a repo using it cannot run type-aware rules
  until `baseUrl` is removed. inbox-ledger has it, and removing it is part of that repo's migration.
- FluentMind is not a consumer of this standard. It keeps its own ESLint setup, maintained
  independently, and its numbers here are measurements of a large real codebase rather than a migration
  plan for it.

**Supersede this when [oxc-project/oxc#10549](https://github.com/oxc-project/oxc/issues/10549) lands.**
A suppressions file in oxlint restores the ratchet, removes the size threshold, and returns large repos
to the original ladder.
