---
name: eq-code-graph
description: Optional, recommended — use a pre-indexed code knowledge graph (codegraph) to answer structural questions about a repo in one tool call instead of grepping and reading. Use when asked "what depends on X", "what's the blast radius of changing X", "how does this feature flow end-to-end", or to trace callers/callees across a codebase. NOT a required part of the standard. Reach for grep/ripgrep instead for exhaustive "find every occurrence" questions.
---

# Code Knowledge Graph (recommended, not mandated)

**This is a recommendation, not a rule.** Nothing in the enforced everquint standard requires it; no
gate, hook, or review step checks for it. A repo that never installs it is fully conformant. The
rationale and the evaluation behind this stance are [ADR 0020](../../../docs/adr/0020-code-graph-as-a-recommended-tool.md).

`codegraph` (MIT, tree-sitter → SQLite, exposed to the agent over MCP with a watcher that keeps the
index in sync) pre-indexes a repo so structural questions are answered from a graph in one call
instead of reconstructed with grep-and-read. It earns its place on some questions and loses to plain
`ripgrep` on others — the whole value is knowing which is which.

## Reach for it — questions about *relationships*

The request is always the quoted argument:

- **Blast radius / impact** — `codegraph impact "envelope"` — what depends on a symbol, transitively.
  This is its strongest case: on the evaluation repo, ~5× faster and ~3× fewer tool calls than
  grep-and-read, with a deterministic symbol closure.
- **Trace a flow** — `codegraph explore "how does authentication work end to end"` — relevant
  symbols, call paths, and source in one shot.
- **Callers / callees** — `codegraph callers "useMe"`, `codegraph callees "post"`.
- **One symbol in context** — `codegraph node "ProtectedRoute"` — its source plus its caller/callee
  trail.

When the MCP server is connected, the agent calls these as tools automatically — you ask in plain
English and it picks the tool. The CLI output is identical, for a terminal or a subagent.

## Do NOT reach for it — and two traps

- **Exhaustive enumeration → use `ripgrep`.** "Every call site of `cn`", "every place this string
  appears" — grep is faster and complete; the graph is not built for it and lost this case in the
  evaluation.
- **Arrow-function components are under-counted.** `codegraph callers` / `codegraph impact` missed
  every arrow-function component in a React UI layer. **Do not trust a `callers`/`impact` count as
  complete for components.** Use the graph as a starting map, then confirm completeness with
  `rg "<Component"` or a grep for the call site.
- **Literal shape-coupling is invisible.** A symbol graph sees references, not object literals — a
  test mock hardcoding `{ success, message, value }` couples to a shape without referencing the
  symbol. `impact` will not list it; reason about wire-shape changes separately.

The pattern that worked: **graph first for the map, grep to confirm completeness.**

## Safe setup — project-local and reversible

Never run the tool's global `codegraph install` (it rewrites every agent's MCP config). Wire it into
one project only:

```bash
npm i -g @colbymchenry/codegraph        # or: npx @colbymchenry/codegraph
codegraph telemetry off                  # telemetry is ON by default
codegraph init .                         # build the index (.codegraph/)
printf '\n# CodeGraph local index\n.codegraph/\n' >> .git/info/exclude   # local ignore, NOT the shared .gitignore
claude mcp add codegraph --scope local -- codegraph serve --mcp          # private to you + this project
```

`--scope local` keeps it out of the team repo and out of your global agent config. The watcher
auto-syncs on file changes; the MCP tools attach at session start, so restart the agent once after
adding. Undo it all: `claude mcp remove codegraph -s local`, then `codegraph uninit .` and drop the
`.git/info/exclude` line.

## When to escalate this from a recommendation

If a team relies on it daily and the arrow-function blind spot and enumeration cap are fixed
upstream, that is a new decision — write a superseding ADR against 0020, do not quietly promote it
into an enforced gate.
