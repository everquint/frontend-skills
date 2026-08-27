# Running this standard on hosts other than Claude Code

The skills are plain [Agent Skills](https://agentskills.io/specification) and load in every host
below. What does **not** port for free is the enforcement around them: the hooks, the reviewer
subagents, and the shell denials all live in `.claude/`, and each host reads a different subset.

This file is the measured map — where the skills load from, where a *blocking* hook is possible, and
what is genuinely lost where it is not. Researched 2026-08-27; every row carries its source. Re-check
before trusting a row that matters: these products ship weekly.

`scripts/adapt-hosts.mjs` writes the per-host configuration from the one source in `.claude/`.

## 1. Where skills load from

| Host | `.claude/skills` | `.agents/skills` | Its own | Source |
|---|---|---|---|---|
| **Claude Code** | **yes — the only one it reads** | no | — | [skills](https://code.claude.com/docs/en/skills.md) |
| Cursor | yes (compat; behind a setting) | yes | `.cursor/skills` | [skills](https://cursor.com/docs/skills) |
| Copilot / VS Code | yes | yes | `.github/skills` | [agent-skills](https://code.visualstudio.com/docs/agent-customization/agent-skills) |
| Windsurf → Devin | yes (flag, default on) | yes | `.windsurf/skills` | [cascade/skills](https://docs.devin.ai/desktop/cascade/skills) |
| OpenCode | yes | yes | `.opencode/skills` | [skills](https://opencode.ai/docs/skills/) |
| Codex CLI | **no** | yes | — | [build-skills](https://learn.chatgpt.com/docs/build-skills.md) |
| Gemini CLI | **no** | yes | `.gemini/skills` | [skills](https://github.com/google-gemini/gemini-cli/blob/main/docs/cli/skills.md) |
| Zed | **no** | **yes — the only one it reads** | — | [skills](https://zed.dev/docs/ai/skills) |

**No single directory covers everything.** `.claude/skills` reaches five hosts including Claude Code;
`.agents/skills` reaches seven but not Claude Code. So the vendored tree lives in `.claude/skills`
(the primary host, native loading, and four others get it free) and is *exposed* at `.agents/skills`:

- **bridge** (default) — one short `SKILL.md` per skill under `.agents/skills/<name>/`, same `name`
  and `description`, whose body points at the real file. Codex, Gemini and Zed pay one extra read. No
  content is duplicated, so content cannot drift — but the pointer can still name a pre-rename path,
  which `standard-check.mjs` flags.
- **mirror** — real copies. No extra read, two trees; `standard-check.mjs` compares them so drift is
  a gate failure rather than a surprise.

**Keep frontmatter to `name` and `description`.** Zed honours only those plus
`disable-model-invocation`; OpenCode silently ignores unknown keys, so a `allowed-tools` there is not
a restriction, it is a comment. `allowed-tools` is flagged experimental in the spec itself.

## 2. Where a blocking hook is possible

| Host | Config it reads | Block | Fails **open**? | Source |
|---|---|---|---|---|
| Claude Code | `.claude/settings.json` | exit 2 + stderr, or `permissionDecision` | no | [hooks](https://code.claude.com/docs/en/hooks-guide.md) |
| Cursor | `.cursor/hooks.json`, **and** `.claude/settings.json` | exit 2 ("matches Claude Code"), or `{permission:"deny"}` | **yes** unless `failClosed: true` | [hooks](https://cursor.com/docs/hooks) · [third-party](https://cursor.com/docs/reference/third-party-hooks) |
| Codex CLI | `.codex/hooks.json` or `config.toml` | exit 2 + stderr | no, but the `.codex/` layer must be trusted and each hook SHA reviewed | [hooks](https://learn.chatgpt.com/docs/hooks.md) |
| Gemini CLI | `hooks` in `.gemini/settings.json` | exit 2 + stderr, or `{"decision":"deny"}` | **yes** | [hooks](https://github.com/google-gemini/gemini-cli/blob/main/docs/hooks/reference.md) |
| Copilot / VS Code | `.github/hooks/*.json`, **and** `.claude/settings.json` | exit 2 | preview; behaviour may change | [hooks](https://code.visualstudio.com/docs/agent-customization/hooks) |
| Devin Local | `.devin/hooks.v1.json`, **and** `.claude/settings.json` | exit 2 or `{"decision":"block"}` | Cascade hooks **do not run in Restricted Mode** | [lifecycle-hooks](https://docs.devin.ai/cli/extensibility/hooks/lifecycle-hooks) |
| OpenCode | JS/TS plugin | `throw` inside `tool.execute.before` | no | [plugins](https://opencode.ai/docs/plugins/) |
| **Zed** | **none — no agent hook system exists** | — | — | [tasks#hooks](https://github.com/zed-industries/zed/blob/main/docs/src/tasks.md#hooks) |

Three consequences the starter's hooks are written around:

1. **The payload field differs.** `tool_input.file_path` on Claude Code, Codex, Copilot and Devin
   Local; `tool_info.file_path` (or `tool_info.edits[].file_path`) on Windsurf Cascade; Cursor
   documents `tool_input` only for shell calls, so its write shape is unconfirmed. The hooks read all
   of them — a hook that reads the wrong key exits 0 and guards nothing.
2. **Tool names differ**, so each generated matcher is that host's vocabulary, not one shared string:
   `Edit|Write|write_file` on Cursor's `preToolUse`, `Edit|Write|apply_patch` on Codex's `PreToolUse`,
   `write_file|replace` on Gemini's `BeforeTool`, and the command fragment `git` on Cursor's
   `beforeShellExecution`, which matches a command string rather than a tool name. Cursor maps
   `Edit`→`Write` and has no `NotebookEdit`, so notebook writes are unguarded there.
3. **stdout is reserved.** Gemini requires stdout to carry nothing but the final JSON, so every hook
   logs to stderr only.

## 2b. What `adapt-hosts.mjs` writes, and the shape traps it exists to avoid

One hook script per rule, in `.claude/hooks/`, invoked by every host. Only the *addressing* is
generated, because every host disagrees about all three of the things a config must state:

| | Cursor | Codex CLI | Gemini CLI |
|---|---|---|---|
| File | `.cursor/hooks.json` | `.codex/hooks.json` | `hooks` in `.gemini/settings.json` |
| Event key | `preToolUse` (camelCase) | `PreToolUse` (PascalCase) | **`BeforeTool`** — there is no `PreToolUse` |
| Shape | event → flat array of `{command, matcher}` | event → matcher groups → inner `hooks` array | event → matcher groups → inner `hooks` array |
| Timeout unit | seconds | seconds | **milliseconds** |
| Path rule | repo-relative, run from project root | docs warn against relative — resolve the git root | `$GEMINI_PROJECT_DIR` prefix |
| Fail closed | `failClosed: true` | no equivalent | no equivalent |

A Cursor-shaped flat hook object under a Codex or Gemini event has no `type` and no inner `hooks`
array: it parses, loads, and never runs. That is the failure mode this script exists to remove, and
it is why the configs are generated rather than documented as snippets to copy.

`failClosed: true` is set on the guard for Cursor only, because only Cursor has it. It is **not** set
on the formatter: a formatter that can block an edit gets switched off within a week.

Two payload gaps are worth knowing before trusting the guard on those hosts:

- **Cursor** documents `tool_input` only for shell calls, so the pre-write field carrying the file
  path is unconfirmed. The hook reads every known shape; an unrecognised one means the write proceeds.
- **Codex** delivers file edits as `apply_patch` with the patch text in `tool_input.command` and no
  path field, so the guard cannot tell which file a patch touches there.

For **Zed**, which has no hooks at all, the script generates `.zed/settings.json` with
`agent.tool_permissions` denials — read out of `guard-protected-files.sh`'s own list rather than
restated, so the two cannot drift. That covers the pattern half of the guard unconditionally; the
computed half does not exist there.

`.gemini/settings.json` and `.zed/settings.json` are the repo's own files, so they are **merged at leaf
granularity**: an existing `agent.default_model` or an unrelated `hooks` event survives, and only the
exact leaves this script generates are replaced — each replacement named in the report. A file with
comments (JSONC, which both hosts document) cannot be merged safely, so the block is written beside it
and the run exits 2 rather than reporting success. `standard-check.mjs` flags a `.agents/skills` exposure that has gone stale: a
bridge pointing at a pre-rename path, a mirrored copy that no longer matches, an orphan directory left
by a rename, or a skill with no exposure at all.

## 3. What is genuinely lost, per host

| Host | Lost | The nearest substitute |
|---|---|---|
| **Zed** | Every *computed* check: read the pending diff, run typecheck, consult git state, enforce a budget. Also subagents — no per-agent prompt, tools or model. | `agent.tool_permissions.always_deny` (Rust regex) gives unconditional path and command denials, which covers the guard hook's *pattern* half. The computed half degrades from prevention to CI detection. A reviewer subagent becomes a skill that runs in the parent's context with the parent's tools. |
| Cursor | A subagent's `tools:` allowlist — the field does not exist. `permissions.deny` in the IDE (the block list there is prose fed to a classifier, not patterns). | `readonly: true` on the subagent; `Shell(...)` denials in the CLI config; or a `beforeShellExecution` hook, which is deterministic and works in the IDE. |
| Codex CLI | One file serving both hosts for subagents (theirs is TOML with the prompt as a string field). Repo-committed slash commands. | Generate the TOML; convert commands to skills. |
| Gemini CLI | Project-tier declarative denials — documented as **non-functional**. Reading `AGENTS.md` without config. | Hooks (they work) plus user- or admin-tier policy. Set `context.fileName`. |
| Copilot | Hard shell denial: `autoApprove: false` means *ask*, not deny. | Hooks, or the sandbox's `denyWrite`/`denyRead`. |
| OpenCode | `.claude/agents` and `.claude/commands` are not read; no session-start/prompt-submit pair. | Duplicate the agent files; `permission` in `opencode.json` is finer-grained than `tools:`. |
| Devin Cascade | Subagents entirely; hooks are inert in Restricted Mode, so they are not a security boundary there. | Use **Devin Local**, which reads `.claude/*` almost fully. Treat Cascade as legacy. |

## 4. Instruction files

Claude Code reads **`CLAUDE.md` only** — point it at `AGENTS.md` with `@AGENTS.md` or a symlink,
which is what `starter/CLAUDE.md` does. Cursor, Copilot, Devin, Zed and OpenCode read `AGENTS.md`
directly; Codex needs `project_doc_fallback_filenames`, Gemini needs `context.fileName`.

**Zed loads only the FIRST match** of `.rules`, `.cursorrules`, `.windsurfrules`, `.clinerules`,
`.github/copilot-instructions.md`, `AGENT.md`, `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`
([instructions](https://zed.dev/docs/ai/instructions)). A stray `.cursorrules` in a repo therefore
shadows `AGENTS.md` entirely. Do not commit one.

## 5. The rule this whole file exists to state

**Every enforcement-critical rule must also exist in CI**, and not only because of Zed. Cursor's
third-party loading sits behind a per-account setting; Codex project hooks require the `.codex/`
layer to be trusted plus a one-time SHA review; Cascade hooks are dead in Restricted Mode. A repo
cannot assume the hook it ships is live on a fresh clone in any host. The hook is what makes a
violation *impossible to commit by accident*; CI is what makes it *impossible to merge*. Shipping
only the first is a standard that a new laptop silently opts out of.

## 6. Two facts with a shelf life

- **Gemini CLI is being retired for non-Enterprise users**: it stopped serving free, AI Pro and AI
  Ultra accounts on 2026-06-18, and only Gemini Code Assist Standard/Enterprise licensees retain
  support ([announcement](https://developers.googleblog.com/an-important-update-transitioning-gemini-cli-to-antigravity-cli/)).
  Antigravity CLI is the successor and is **not** covered here.
- **Windsurf is Devin Desktop.** `docs.windsurf.com` redirects to `docs.devin.ai/desktop/*`, and the
  product ships two agents with different capabilities. Target Devin Local.
