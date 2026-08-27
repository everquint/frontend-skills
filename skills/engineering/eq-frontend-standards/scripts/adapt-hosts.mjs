#!/usr/bin/env node
// Makes a repo that carries this standard enforceable on hosts OTHER than Claude Code.
//
// The skills themselves are portable — plain Agent Skills, loaded by every host in
// references/hosts.md. The enforcement around them is not: the hooks, the reviewer subagents and the
// shell denials live in `.claude/`, and each host reads a different subset of it. This script writes
// each host's own configuration FROM that one source, and prints what the host cannot enforce at all.
//
// Two jobs, and the second is the important one:
//   1. Write the adapters (`.agents/skills/` exposure, per-host hook configs).
//   2. Report the residue. A host with no blocking hook cannot be adapted into having one, and a
//      script that quietly writes four files and says "done" leaves a team believing in a guard that
//      does not exist there. Every unenforceable rule is named, per host, with what to do instead.
//
// READ-ONLY on `.claude/`: this never edits the source of truth, only derives from it.
//
// Usage, from the root of the consumer repo:
//   node <path>/adapt-hosts.mjs [--hosts all|cursor,codex,gemini,zed,...] [--agents-skills bridge|mirror|none] [--dry-run]
//
// Exit codes:
//   0  adapters written (or a dry run), and every requested host can enforce the gates.
//   1  the run did not happen: not a repo carrying this standard, an unknown host, a bad flag.
//   2  adapters written, but at least one requested host CANNOT enforce part of the standard. The
//      report says which rule, on which host, and what covers it instead. This is information, not a
//      failure to fix — CI is the answer, and `--hosts` without that host clears it.

import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync, cpSync } from 'node:fs';
import { join, dirname } from 'node:path';

import { readManifest, vendoredDir } from './vendor-names.mjs';

const cwd = process.cwd();
const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const FLAGS = new Set(['hosts', 'agents-skills', 'dry-run', 'help']);
const flagValue = (name) => {
    // Both spellings, because `--hosts=zed` silently selected EVERY host and wrote every adapter.
    const inline = argv.find((a) => a.startsWith(`--${name}=`));
    if (inline) return inline.slice(name.length + 3) || undefined;
    const i = argv.indexOf(`--${name}`);
    const v = i === -1 ? undefined : argv[i + 1];
    return v && !v.startsWith('--') ? v : undefined;
};
const dryRun = argv.includes('--dry-run');

// An unrecognised flag is exit 1, not a shrug: `--host cursor` (singular, a plausible typo) used to
// run with defaults — every host, bridge exposure — and report success.
const unknownFlags = argv.filter((a) => a.startsWith('--')).map((a) => a.replace(/^--/, '').split('=')[0]).filter((n) => !FLAGS.has(n));

const die = (msg, extra) => {
    console.error(msg);
    if (extra) console.error(extra);
    process.exit(1);
};

if (unknownFlags.length) {
    die(`Unknown flag(s): ${unknownFlags.map((f) => `--${f}`).join(', ')}.`, `Known: --hosts, --agents-skills, --dry-run.`);
}

// ── the hosts ───────────────────────────────────────────────────────────────
// `reads` is what the host picks up from `.claude/` WITHOUT an adapter — the reason the list is not
// uniform. `blocking` is whether a pre-tool hook can refuse an action there. `residue` is what stays
// unenforceable after everything this script can write; it is quoted in the report verbatim.
const HOSTS = {
    cursor: {
        label: 'Cursor',
        reads: ['skills', 'agents', 'hooks (behind a per-account setting)'],
        blocking: true,
        needsAgentsSkills: false,
        residue: [
            'A reviewer subagent cannot be restricted to read-only TOOLS — Cursor has no `tools:` field. `readonly: true` is the nearest, and it blocks edits rather than tools.',
            '`NotebookEdit` has no Cursor tool to match, so notebook writes are not covered by the protected-files guard.',
            'Cursor documents `tool_input` only for shell calls, so the pre-write payload field holding the FILE PATH is unconfirmed. The guard reads every known shape; if Cursor uses another, it cannot identify the file and the write proceeds. `failClosed: true` is set so a crash blocks, but an unrecognised payload is not a crash — CI is the backstop.',
            'Third-party (`.claude/`) loading is behind a setting and an account flag, so a fresh clone may enforce nothing until someone enables it — which is why this script writes `.cursor/hooks.json` as well.',
        ],
    },
    codex: {
        label: 'Codex CLI',
        reads: [],
        blocking: true,
        needsAgentsSkills: true,
        residue: [
            'Subagents are TOML with the prompt as a string field, so `.claude/agents/*.md` do not port as files. Convert each by hand if that host needs them.',
            'Project hooks load only once the `.codex/` layer is trusted, and each hook is SHA-reviewed on first use. Until then nothing is enforced.',
            'File edits arrive as `apply_patch` with the PATCH TEXT in `tool_input.command` and no file-path field, so the protected-files guard cannot tell which file a patch touches. It still covers `Edit`/`Write`-shaped calls; for patches, CI is the only gate.',
            'There is no `failClosed` equivalent: a hook that crashes or times out does not block.',
        ],
    },
    gemini: {
        label: 'Gemini CLI',
        reads: [],
        blocking: true,
        needsAgentsSkills: true,
        residue: [
            'Project-tier declarative denials are documented as non-functional, so a committed policy file does not enforce. Hooks do work.',
            '`AGENTS.md` is not read until `context.fileName` includes it.',
            'Being retired for non-Enterprise accounts (2026-06-18). Confirm the host is still supported before relying on it.',
            'No `failClosed` equivalent, and a non-2 exit code is a warning that lets the action proceed. Hook stdout must carry nothing but the final JSON — the scripts log to stderr for this reason.',
        ],
    },
    copilot: {
        label: 'GitHub Copilot (VS Code)',
        reads: ['skills', 'agents', 'hooks'],
        blocking: true,
        needsAgentsSkills: false,
        residue: [
            'Declarative shell denial does not exist: `autoApprove: false` means ASK, not deny. The hook is the only hard stop.',
            'Hooks are a preview feature; the format may change.',
        ],
    },
    devin: {
        label: 'Windsurf / Devin Desktop (Devin Local)',
        reads: ['skills', 'agents', 'hooks'],
        blocking: true,
        needsAgentsSkills: false,
        residue: [
            'On the legacy Cascade agent there are no subagents at all, and hooks do not run in Restricted Mode — so a Cascade hook is not a security boundary. Target Devin Local.',
        ],
    },
    opencode: {
        label: 'OpenCode',
        reads: ['skills'],
        blocking: true,
        needsAgentsSkills: false,
        residue: [
            '`.claude/agents` and `.claude/commands` are not read — duplicate them under `.opencode/` if that host needs them.',
            'Hooks are JS/TS plugins that block by throwing, so the shell hook scripts must be shelled out from a plugin rather than configured directly.',
        ],
    },
    zed: {
        label: 'Zed',
        reads: [],
        blocking: false,
        needsAgentsSkills: true,
        residue: [
            'THERE IS NO AGENT HOOK SYSTEM. Every check that must compute — read the pending diff, run typecheck, consult git state — cannot run inside the agent loop. Those degrade to CI detection.',
            'Pattern-based denials DO port, and unconditionally: `agent.tool_permissions.always_deny` (Rust regex) covers the protected-files paths and the `git stash` denial. Set it in the user or project Zed settings.',
            'Subagents cannot be expressed: no per-agent prompt, tools or model. A reviewer subagent becomes a skill in the parent context with the parent tools.',
        ],
    },
};

// ── preconditions ───────────────────────────────────────────────────────────
const requested = (() => {
    const raw = flagValue('hosts') ?? 'all';
    if (raw === 'all') return Object.keys(HOSTS);
    const names = raw.split(',').map((n) => n.trim()).filter(Boolean);
    const unknown = names.filter((n) => !HOSTS[n]);
    if (unknown.length) die(`Unknown host(s): ${unknown.join(', ')}.`, `Known: ${Object.keys(HOSTS).join(', ')}, or 'all'.`);
    return names;
})();

const exposure = flagValue('agents-skills') ?? 'bridge';
if (!['bridge', 'mirror', 'none'].includes(exposure)) {
    die(`--agents-skills '${exposure}' is not one of bridge, mirror, none.`);
}

const manifest = readManifest(cwd);
if (manifest?.corrupt) die('.claude/skills/.eq-vendor.json could not be parsed.', 'Fix or delete it first — every path below is derived from it.');
const standardDir = vendoredDir(cwd, 'eq-frontend-standards');
if (!existsSync(join(cwd, standardDir, 'SKILL.md'))) {
    die(`No vendored standard at ${standardDir}.`,
        'Vendor it first: node <skill>/scripts/init-greenfield.mjs --prefix <short>\nAdapters point at the vendored copy, because a personal install is absent on a teammate\'s machine.');
}
const vendored = Object.entries(manifest?.skills ?? {}).map(([source, dir]) => ({ source, dir }));
if (!vendored.length) die('The manifest records no skills.', 'Re-vendor: node <skill>/scripts/init-greenfield.mjs --prefix <short>');

const written = [];
const skipped = [];

const write = (rel, body) => {
    const target = join(cwd, rel);
    if (!dryRun) {
        mkdirSync(dirname(target), { recursive: true });
        writeFileSync(target, body);
    }
    written.push(rel);
};

// ── .agents/skills — the only directory Codex, Gemini and Zed read ──────────
// Zed reads NOTHING under .claude/, so for that host this is not a convenience, it is the whole
// mechanism. The real tree stays in .claude/skills because Claude Code reads only that.
const AGENTS_ROOT = join('.agents', 'skills');

const frontmatter = (skillDir) => {
    const raw = readFileSync(join(cwd, skillDir, 'SKILL.md'), 'utf8');
    const fm = raw.match(/^---\n([\s\S]*?)\n---\n/);
    const field = (key) => fm?.[1].match(new RegExp(`^${key}:\\s*(.+)$`, 'm'))?.[1]?.trim();
    return { name: field('name'), description: field('description') };
};

// Written only when a requested host actually reads `.agents/skills`, or when the flag was passed
// explicitly. Creating it for a Cursor-only repo added a tree nothing there reads AND a permanent
// freshness obligation, since standard-check gates on it once it exists.
const exposureAsked = argv.some((a) => a === '--agents-skills' || a.startsWith('--agents-skills='));
const exposureNeeded = requested.some((h) => HOSTS[h].needsAgentsSkills);

if (exposure !== 'none' && (exposureNeeded || exposureAsked)) {
    for (const { dir } of vendored) {
        const skillDir = join('.claude', 'skills', dir);
        const { name, description } = frontmatter(skillDir);
        if (!name || !description) {
            die(`${skillDir}/SKILL.md has no readable name/description frontmatter.`, 'The exposure copies both, and a host rejects a skill missing either.');
        }
        const targetDir = join(AGENTS_ROOT, dir);

        if (exposure === 'mirror') {
            // Real copies. Two trees means drift is possible, so standard-check compares them.
            if (existsSync(join(cwd, targetDir)) && !dryRun) rmSync(join(cwd, targetDir), { recursive: true, force: true });
            if (!dryRun) cpSync(join(cwd, skillDir), join(cwd, targetDir), { recursive: true, dereference: true });
            written.push(`${targetDir}/ (mirrored)`);
            continue;
        }

        // A previous MIRROR left references/ and scripts/ here, and a bridge that shares a directory
        // with a frozen copy of the real tree is worse than either: those hosts read the stale copy
        // and nothing flags it. The directory is cleared first for that reason.
        if (existsSync(join(cwd, targetDir)) && !dryRun) rmSync(join(cwd, targetDir), { recursive: true, force: true });

        // bridge: one file, same identity, pointing at the real tree. The body is written for an
        // agent that has already loaded it — imperative, no options — because that is the only thing
        // standing between this file and the procedure it stands in for.
        write(join(targetDir, 'SKILL.md'), `---
name: ${name}
description: ${description}
---

# ${name}

This is a POINTER, not the procedure. The skill itself lives in this repo at:

    ${skillDir}/SKILL.md

**Read that file now, in full, before doing anything else, then follow it.** Its \`references/\` and
\`scripts/\` are beside it, at \`${skillDir}/references/\` and \`${skillDir}/scripts/\`. Paths written
\`<skill>/…\` inside it mean that directory.

Why the indirection: Claude Code loads skills only from \`.claude/skills\`, and Zed, Codex CLI and
Gemini CLI load them only from \`.agents/skills\`. One real tree with a pointer is the only layout
that serves both without two copies that drift. Generated by \`adapt-hosts.mjs\`; edit the real skill.
`);
    }
}


// ── the hook scripts, as each host addresses them ───────────────────────────
// The scripts themselves are NOT copied: one file per hook, in .claude/hooks, invoked by every host.
// Only the addressing differs, and each host documents a different rule for it:
//   Cursor  — project hooks run FROM the project root, and the docs say to use `.cursor/…`-style
//             repo-relative paths. A repo-relative path is what we emit.
//   Codex   — the docs warn AGAINST repo-relative paths: a session may start in a subdirectory, so
//             the command resolves the git root itself.
//   Gemini  — the environment is sanitized and the working directory is undocumented, so the docs'
//             own examples prefix with $GEMINI_PROJECT_DIR. We do the same.
const HOOK_DIR = join('.claude', 'hooks');
const hookPath = {
    cursor: (name) => `${HOOK_DIR}/${name}`,
    codex: (name) => `"$(git rev-parse --show-toplevel)"/${HOOK_DIR}/${name}`,
    gemini: (name) => `"$GEMINI_PROJECT_DIR"/${HOOK_DIR}/${name}`,
};

const hookExists = (name) => existsSync(join(cwd, HOOK_DIR, name));
const HOOKS = {
    guard: 'guard-protected-files.sh',
    branch: 'branch-guard.sh',
    lint: 'lint-fix.sh',
};

// Merge a generated block into a settings file the repo already owns, without clobbering it. A host
// config is the consumer's file: overwriting one to install a hook is how an adapter gets deleted.
//
// The merge is at LEAF granularity, not at the top-level key. Refusing whenever `agent` or `hooks`
// already existed meant the common real file — a `.zed/settings.json` with `agent.default_model`, a
// `.gemini/settings.json` with any hooks at all — got NOTHING, while the run still exited 0. On Zed
// the denials are the entire mechanism, so that silence was the whole adapter.
const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

const deepMerge = (base, incoming, path, replaced) => {
    const out = { ...base };
    for (const [key, value] of Object.entries(incoming)) {
        const here = [...path, key];
        if (isPlainObject(value) && isPlainObject(out[key])) {
            out[key] = deepMerge(out[key], value, here, replaced);
        } else {
            // A leaf that already exists is REPLACED and reported: an `always_deny` list or one
            // event's hook array is generated wholesale, so merging two of them would produce a
            // union nobody wrote. Reporting is what keeps that visible.
            if (out[key] !== undefined) replaced.push(here.join('.'));
            out[key] = value;
        }
    }
    return out;
};

const mergeJson = (rel, key, value) => {
    const target = join(cwd, rel);
    if (!existsSync(target)) { write(rel, `${JSON.stringify({ [key]: value }, null, 4)}\n`); return; }

    const raw = readFileSync(target, 'utf8');
    let existing = null;
    try { existing = JSON.parse(raw); } catch { /* handled below */ }

    if (!isPlainObject(existing)) {
        // Both hosts document JSONC for these files, and a comment is not corruption — so the
        // generated block is written beside it and named, rather than silently dropped. Exit 2 below
        // depends on this being recorded: a skip means an adapter is NOT installed.
        const jsonc = /^\s*\/\//m.test(raw) || raw.includes('/*');
        write(`${rel.replace(/\.json$/, '')}.eq-generated.json`, `${JSON.stringify({ [key]: value }, null, 4)}\n`);
        skipped.push(`${rel} — ${jsonc ? 'contains comments (JSONC), which cannot be merged safely' : 'is not a JSON object'}; merge the generated file beside it by hand`);
        return;
    }

    const replaced = [];
    const merged = deepMerge(existing, { [key]: value }, [], replaced);
    write(rel, `${JSON.stringify(merged, null, 4)}\n`);
    for (const path of replaced) skipped.push(`${rel} — replaced the existing "${path}" with the generated one; check it if you had hand-written entries there`);
};

const emit = {
    // Flat: each event maps to an array of hook objects carrying their own matcher. version: 1 per the
    // docs. `failClosed` exists ONLY here — and only on the guard: a formatter that can block an edit
    // gets switched off within a week, so lint-fix must fail open.
    cursor: () => {
        const hooks = {};
        // `Edit|Write|write_file`, matching the source settings' `Edit|Write|NotebookEdit` as closely
        // as Cursor's tool names allow: it maps Edit onto Write, and has nothing for NotebookEdit.
        if (hookExists(HOOKS.guard)) hooks.preToolUse = [{ command: hookPath.cursor(HOOKS.guard), matcher: 'Edit|Write|write_file', timeout: 10, failClosed: true }];
        // beforeShellExecution matches the COMMAND STRING, not a tool name, so the matcher is a
        // command fragment. The hook itself decides what counts as a git commit.
        if (hookExists(HOOKS.branch)) hooks.beforeShellExecution = [{ command: hookPath.cursor(HOOKS.branch), matcher: 'git', timeout: 10, failClosed: true }];
        // afterFileEdit, not postToolUse: it is the event whose payload documents `file_path`. No
        // matcher — it is a file event, and a tool-name matcher there matches nothing.
        if (hookExists(HOOKS.lint)) hooks.afterFileEdit = [{ command: hookPath.cursor(HOOKS.lint), timeout: 30 }];
        if (!Object.keys(hooks).length) return;
        write(join('.cursor', 'hooks.json'), `${JSON.stringify({ version: 1, hooks }, null, 4)}\n`);
    },

    // Nested: event -> matcher groups -> inner `hooks` array of handlers. PascalCase events. Timeouts
    // in seconds. A Cursor-shaped flat object here has no `type`/`hooks` and simply never runs.
    codex: () => {
        const group = (matcher, name, timeout) => ({ matcher, hooks: [{ type: 'command', command: hookPath.codex(name), timeout }] });
        const hooks = {};
        const pre = [];
        if (hookExists(HOOKS.guard)) pre.push(group('Edit|Write|apply_patch', HOOKS.guard, 30));
        if (hookExists(HOOKS.branch)) pre.push(group('Bash', HOOKS.branch, 30));
        if (pre.length) hooks.PreToolUse = pre;
        if (hookExists(HOOKS.lint)) hooks.PostToolUse = [group('Edit|Write|apply_patch', HOOKS.lint, 60)];
        if (!Object.keys(hooks).length) return;
        write(join('.codex', 'hooks.json'), `${JSON.stringify({ description: 'Generated from .claude/hooks by eq-frontend-standards adapt-hosts.mjs. Edit the scripts, not this file.', hooks }, null, 4)}\n`);
    },

    // Gemini has NO PreToolUse: the pre-write event is BeforeTool. Timeouts are MILLISECONDS. The
    // block lives inside settings.json, which the repo may already own, so it is merged.
    gemini: () => {
        const group = (matcher, name, label, timeout) => ({ matcher, hooks: [{ name: label, type: 'command', command: hookPath.gemini(name), timeout }] });
        const hooks = {};
        const before = [];
        if (hookExists(HOOKS.guard)) before.push(group('write_file|replace', HOOKS.guard, 'eq-guard-protected-files', 10000));
        if (hookExists(HOOKS.branch)) before.push(group('run_shell_command', HOOKS.branch, 'eq-branch-guard', 10000));
        if (before.length) hooks.BeforeTool = before;
        if (hookExists(HOOKS.lint)) hooks.AfterTool = [group('write_file|replace', HOOKS.lint, 'eq-lint-fix', 30000)];
        if (!Object.keys(hooks).length) return;
        mergeJson(join('.gemini', 'settings.json'), 'hooks', hooks);
    },

    // Zed has no hooks at all, so the only thing that ports is the PATTERN half of the guard: the
    // list of gate files it refuses. Those are read out of the guard script itself rather than
    // restated here — a second copy of the list would drift from the hook that owns it.
    zed: () => {
        if (!hookExists(HOOKS.guard)) return;
        let script;
        try { script = readFileSync(join(cwd, HOOK_DIR, HOOKS.guard), 'utf8'); } catch { return; }
        const block = script.match(/case "\$rel" in([\s\S]*?)\nesac/);
        if (!block) { skipped.push(`.zed/settings.json — could not read the protected-file list out of ${HOOKS.guard}`); return; }
        const patterns = [...block[1].matchAll(/^\s{4}([^\s#][^)]*)\)/gm)].flatMap(([, alts]) => alts.split('|'));
        const toRegex = (glob) => `^${glob.trim().replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')}$`;
        const deny = [...new Set(patterns.map(toRegex))].sort().map((pattern) => ({ pattern }));
        if (!deny.length) return;
        mergeJson(join('.zed', 'settings.json'), 'agent', {
            tool_permissions: {
                tools: {
                    edit_file: { always_deny: deny },
                    write_file: { always_deny: deny },
                    terminal: { always_deny: [{ pattern: '^git\\s+stash' }] },
                },
            },
        });
    },
};

// A host with no emitter is NOT silently fine: the report must say a config was not generated, or a
// team reads "blocking hook: yes" and ships nothing. The path is the one references/hosts.md cites.
const MANUAL = {
    copilot: '.github/hooks/*.json — or rely on Copilot reading .claude/settings.json directly (it does)',
    devin: '.devin/hooks.v1.json — or rely on Devin Local reading .claude/settings.json directly (it does)',
    opencode: 'a JS/TS plugin under .opencode/plugins/ that shells out to .claude/hooks/*.sh and throws to block',
};

for (const host of requested) {
    if (emit[host]) emit[host]();
}

// ── report ──────────────────────────────────────────────────────────────────
const nonBlocking = requested.filter((h) => !HOSTS[h].blocking);

console.log(`\n${dryRun ? 'would write' : 'wrote'} (${written.length}):`);
for (const w of written) console.log(`  + ${w}`);
if (skipped.length) {
    console.log(`\nleft alone (${skipped.length}):`);
    for (const s of skipped) console.log(`  = ${s}`);
}

console.log(`\nHOSTS — what each one reads from this repo:`);
for (const h of requested) {
    const host = HOSTS[h];
    const reads = host.reads.length ? host.reads.join(', ') : 'nothing under .claude/';
    console.log(`\n  ${host.label}`);
    console.log(`    reads natively:  ${reads}`);
    console.log(`    skills come from: ${host.needsAgentsSkills ? (exposure === 'none' ? '.agents/skills — NOT WRITTEN (--agents-skills none)' : `.agents/skills (${exposure})`) : '.claude/skills, directly'}`);
    console.log(`    blocking hook:   ${host.blocking ? 'yes' : 'NO — nothing can be refused inside the agent loop'}`);
    if (MANUAL[h]) console.log(`    NO CONFIG WRITTEN for this host — wire it by hand: ${MANUAL[h]}`);
    for (const r of host.residue) console.log(`    · ${r}`);
}

console.log(`
WHAT THIS DOES NOT CHANGE

  Every enforcement-critical rule must ALSO exist in CI. Not only because of a host with no hooks:
  Cursor's third-party loading is behind a per-account setting, Codex project hooks need the .codex/
  layer trusted plus a SHA review, and Cascade hooks are inert in Restricted Mode. No host guarantees
  that the hook this repo ships is live on a fresh clone. The hook makes a violation impossible to
  commit by accident; CI makes it impossible to merge. Ship both.

  Details, with sources: ${standardDir}/references/hosts.md
`);

if (nonBlocking.length || skipped.length) {
    if (nonBlocking.length) {
        console.log(`${nonBlocking.map((h) => HOSTS[h].label).join(', ')} cannot enforce the hook-based half of the standard. The rules above say what covers it instead.`);
    }
    if (skipped.length) {
        console.log(`${skipped.length} adapter(s) were NOT installed — see "left alone" above. Until those are merged, those hosts enforce nothing.`);
    }
    // A dry run wrote nothing, so it cannot report an installation state — 0 keeps
    // `node … --dry-run && node …` reaching the real run, the same contract as the sibling scripts.
    console.log('');
    process.exit(dryRun ? 0 : 2);
}
process.exit(0);
