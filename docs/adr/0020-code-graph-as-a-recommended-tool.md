# 0020 — a code knowledge graph (codegraph) is recommended, not mandated

Date: 2026-08-12

## Context

Agents working a repo reconstruct structure on every question — grepping for callers, reading files
to trace a flow, guessing a change's blast radius. A pre-indexed code knowledge graph
(`codegraph`, MIT, tree-sitter → SQLite, exposed to the agent over MCP with a file watcher that
auto-syncs the index) promises to answer those questions from a graph in one tool call instead.

It was evaluated hands-on against a real everquint repo (the CleverClerk client, ~1,150 files). The
finding is genuinely mixed, and the mix is the whole point:

- **Impact / blast-radius questions** ("what depends on `envelope`?") — a decisive win: ~5× faster
  and ~3× fewer tool calls than grep-and-read, with a deterministic, correct symbol closure.
- **Architecture tracing** ("how does auth work end-to-end?") — a modest, real win: fewer tool
  calls, comparable output quality.
- **Exhaustive enumeration** ("every call site of `cn`") — it **lost** to `ripgrep`. `codegraph
  callers` capped its result and **missed every arrow-function component** — which is most of a
  React UI layer — forcing a grep fallback that was slower and costlier than grep alone.

Three properties keep it below the bar the rest of this standard holds. Everything the standard
mandates is deterministic, universal, and machine-enforced (oxlint, oxfmt, `import/no-cycle`); an
agent may trust it without checking. codegraph is **probabilistic**, its accuracy **varies by
question shape**, and its one measured blind spot — arrow-function components — lands on the exact
construct our components are written as. It also carries operational weight a mandate should not
impose blindly: telemetry on by default, a per-repo index and watcher, and per-developer MCP setup.
The supporting benchmark is n=1 per question — directional, not conclusive.

Mandating it was the alternative considered. It fails: a standard encodes "always do X," and the
honest instruction here is "reach for it when the question is structural, distrust its counts for
components, and use grep for enumeration." That is agent judgement, not a rule, and writing it as a
rule would hand every consumer wrong impact analyses on their most common component style.

## Decision

Ship codegraph as a **recommended productivity skill (`eq-code-graph`), never a required part of the
enforced standard.** The skill states, in one place: when to reach for it (impact, tracing), when
not to (`rg` for enumeration; do not trust `callers`/`impact` counts as complete for arrow-function
components), and the safe, reversible setup validated in the evaluation — **project-local** MCP scope
only, index ignored via `.git/info/exclude` (never the shared `.gitignore`), telemetry off, and no
global `codegraph install`.

It lands in `skills/productivity/`, alongside the Linear skills, deliberately outside
`skills/engineering/`. Nothing under the enforced engineering standard references it; no gate, hook,
or review step requires it; a repo that never installs it is fully conformant.

## Consequences

- Minor version. Consumers gain an optional skill; no rule they were following changed.
- The recommendation is reversible by design — it is a suggestion with an uninstall recipe, not a
  dependency baked into a gate. If the tool stalls, is abandoned, or its arrow-function blind spot
  is not fixed, the skill is retired without touching anything enforced.
- The evaluation's counter-evidence is recorded here on purpose. A future "let's mandate it" starts
  from the arrow-function miss and the n=1 caveat, not from zero.
- Endorsing a third-party, pre-maturity tool (v1.5.x, one primary maintainer, real npm adoption but
  implausible star counts) is a known risk. Confining the endorsement to a *recommendation* is how
  that risk is bounded: the standard's authority is not lent to it.
- This decision is the record for one tool, not the category. A different graph tool, or a later
  codegraph that resolves arrow-function components and the enumeration cap, warrants its own ADR;
  this one is not a blanket rejection of mandating such a tool forever.
