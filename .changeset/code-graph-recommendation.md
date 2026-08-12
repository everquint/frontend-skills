---
"frontend-skills": minor
---

Adds `eq-code-graph`, an optional productivity skill recommending a pre-indexed code knowledge graph
(codegraph) for structural questions — blast radius, flow tracing, callers/callees — answered in one
tool call instead of grep-and-read.

It is a recommendation, not a mandate: it lives outside the enforced engineering standard, no gate or
review requires it, and a repo that never installs it stays conformant. The skill is honest about
where the tool loses — use `ripgrep` for exhaustive enumeration, and do not trust its
`callers`/`impact` counts as complete for arrow-function components — and ships a project-local,
reversible setup recipe (local MCP scope, `.git/info/exclude`, telemetry off, no global install).
The decision and its evaluation are recorded in ADR 0020.
