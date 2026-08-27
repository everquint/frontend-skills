# 0023 — other hosts are adapted from one source, never supported in parallel

Date: 2026-08-27

## Context

The skills are plain Agent Skills and load in every host we care about. The *enforcement* around them
is not portable: the hooks, the reviewer subagents and the shell denials live in `.claude/`, and each
host reads a different subset of that directory. Consumers asked for the standard to work in Cursor
"without any missing things".

Measured against official documentation (2026-08-27), the ground is more uneven than the request
assumes:

- **No single skills directory covers everything.** Claude Code reads only `.claude/skills`. Zed reads
  only `.agents/skills`. The other six read one, the other, or both.
- **Six of eight hosts have a blocking pre-tool hook. Zed has none at all** — no agent hook system
  exists there, only git hooks and a one-event task hook.
- **Every hook config disagrees on all three axes**: the event key's name and casing
  (`preToolUse` / `PreToolUse` / `BeforeTool`), the file's shape (flat array vs nested matcher groups),
  and the timeout unit (seconds vs milliseconds). A config in the wrong shape parses, loads, and never
  runs.
- **Fail-open is the default** on Cursor, Gemini and Windsurf; only Cursor has a `failClosed` switch.
- **Even where a hook exists, it is not guaranteed live**: Cursor's third-party loading sits behind a
  per-account setting, Codex project hooks need the `.codex/` layer trusted plus a per-hook SHA
  review, and Cascade hooks are inert in Restricted Mode.

Two options were rejected before the third.

**Support each host natively.** Write and maintain `.cursor/`, `.codex/`, `.gemini/`, `.zed/`,
`.opencode/` trees as first-class sources. Rejected: five copies of every rule, five schemas that
change weekly, and no way to tell which copy a repo is actually enforcing.

**Claim host-neutrality and ship only the skills.** Rejected for the opposite reason: it is what we
already did, and it is why a Cursor user believed the guard hook was protecting their lint config when
nothing was reading it.

## Decision

**One source, generated adapters, and a written statement of what does not port.**

`.claude/` remains the only place a rule is authored. `scripts/adapt-hosts.mjs` derives each host's
configuration from it, and `references/hosts.md` records where skills load, where a blocking hook is
possible, and what is lost where it is not — with a citation per claim and a re-check warning, because
these products ship weekly.

Three specific choices:

1. **The vendored tree stays in `.claude/skills`, and is *exposed* at `.agents/skills`.** Claude Code
   is the primary host and gets native loading; four other hosts read that path directly. The exposure
   is either a `bridge` (a pointer `SKILL.md` per skill — no duplication, one extra read on Codex,
   Gemini and Zed) or a `mirror` (real copies, with a content-hash check so drift fails a gate). Two
   real trees by default was rejected: a duplicate that nothing compares is a duplicate that diverges.
2. **The hook scripts are one file per rule, made host-agnostic** — the target path is read across
   `tool_input.file_path`, `tool_info.file_path`, `tool_info.edits[].file_path` and the top-level
   `file_path`; each host's matcher is generated in that host's own tool vocabulary; the event name is normalised
   inside the hook, so a hook wired to `beforeShellExecution` or `BeforeTool` dispatches like
   `PreToolUse` instead of falling through to a silent exit 0; all logging goes to stderr,
   because Gemini requires stdout to carry nothing but the decision JSON.
3. **The residue is reported, per host, every run.** `adapt-hosts.mjs` exits 2 when a requested host
   cannot enforce part of the standard and names what covers it instead. A script that writes four
   files and says "done" leaves a team believing in a guard that does not exist there.

## Consequences

- Minor version. Nothing changes for a Claude-Code-only repo except three hook scripts that now read
  more payload shapes, and a `references/hosts.md` that did not exist.
- **The honest answer to "no missing things" is no.** On Zed, every check that must compute — read the
  pending diff, run typecheck, consult git state — cannot run inside the agent loop; it degrades to CI
  detection. On Cursor a subagent cannot be restricted by tool. On Codex a patch's file path is not in
  the payload. Those are written down rather than smoothed over, and each has a named substitute.
- This makes CI duplication a hard requirement rather than good practice: no host guarantees the hook
  a repo ships is live on a fresh clone. The hook makes a violation impossible to commit by accident;
  CI makes it impossible to merge. A standard that ships only the first is one a new laptop silently
  opts out of.
- The generated configs are pinned to schemas confirmed on one date. `hosts.md` says so, and every row
  carries its source, so the next person can re-verify rather than re-derive. A host that changes its
  schema breaks its adapter — visibly on the next run, since the generator is the only writer.
- Adding a host is a table entry plus an emitter. Dropping one is deleting them. Neither touches a rule.
