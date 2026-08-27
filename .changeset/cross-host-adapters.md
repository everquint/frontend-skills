---
"frontend-skills": minor
---

Run the standard on hosts other than Claude Code, from one source.

The skills always loaded elsewhere; the enforcement did not. `scripts/adapt-hosts.mjs` now derives
each host's own configuration from `.claude/`: the `.agents/skills` exposure that Zed, Codex CLI and
Gemini CLI need to see the skills at all (a pointer `bridge` by default, or a hash-checked `mirror`),
plus `.cursor/hooks.json`, `.codex/hooks.json`, a merged `hooks` block for `.gemini/settings.json`,
and `.zed/settings.json` denials read out of `guard-protected-files.sh`'s own list. Every run also
reports, per host, what that host cannot enforce and what covers it instead — and exits 2 rather than
implying full coverage.

The three hook scripts are now host-agnostic: the target path is read across `tool_input.file_path`,
`tool_info.file_path`, `tool_info.edits[].file_path` and a top-level `file_path`; the command across
`command` and `command_line`; the project directory across `CLAUDE_PROJECT_DIR`, `CURSOR_PROJECT_DIR`,
`CODEX_PROJECT_DIR` and `DEVIN_PROJECT_DIR`.

`standard-check.mjs` flags a `.agents/skills` exposure that has gone stale — a bridge pointing at a
pre-rename path, a mirror that no longer matches, an orphan left by a rename, or a skill with no
exposure at all.

`references/hosts.md` is the map: where skills load, where a blocking hook is possible, the event-name
and timeout-unit traps that make a wrongly-shaped config load and never run, and what is genuinely
lost per host — Zed has no agent hooks at all, so computed checks degrade to CI. Sourced per claim,
measured 2026-08-27.

Rationale: `docs/adr/0023-other-hosts-are-adapted-not-supported-in-parallel.md`.
