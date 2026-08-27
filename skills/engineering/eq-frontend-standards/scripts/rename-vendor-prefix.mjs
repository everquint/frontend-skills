#!/usr/bin/env node
// Changes the prefix on a repo's VENDORED copy of this skill set — `eq-cc-frontend-standards` to
// `eq-clerk-frontend-standards`, or off entirely.
//
// WHY this is a script and not a `mv`: a vendored skill is three coupled things. The directory name,
// the frontmatter `name:` that a host requires to equal it, and every `../<sibling>/…` link the
// bodies use to reach each other. Rename the directory alone and the skill stops loading with no
// error anywhere; rewrite the frontmatter alone and the links point at directories that no longer
// exist. This moves all three, plus the manifest that records what the set is called.
//
// It does NOT touch the repo's own files outside .claude/skills — a CI workflow or an agent file
// that hardcodes the old path is reported, never edited, because those are the repo's to own. The
// starter's resolvers glob for `*frontend-standards` precisely so they survive this.
//
// Uses `git mv` when the repo is a git checkout, so history follows the rename and the diff reads as
// a rename rather than as a delete plus an add.
//
// Usage, from the root of the consumer repo:
//   node <path>/rename-vendor-prefix.mjs --to <short>     # eq-cc-… -> eq-<short>-…
//   node <path>/rename-vendor-prefix.mjs --to ""          # remove the prefix
//   node <path>/rename-vendor-prefix.mjs --dry-run --to <short>
//
// Exit codes:
//   0  renamed, or a dry run.
//   1  nothing was renamed: not vendored, no manifest, a bad prefix, a target directory already
//      taken, or a dirty .claude/skills that must be committed first. Nothing was written.
//   2  renamed, but references to the OLD names remain elsewhere in the repo (listed). They are the
//      repo's own files; fix them and the exit clears.

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, renameSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import { MANIFEST_REL, isStarterPath, nameMap, prefixError, readManifest, rewriteMarkdown, vendoredName, writeManifest } from './vendor-names.mjs';

const cwd = process.cwd();
const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const dryRun = has('--dry-run');

const die = (msg, extra) => {
    console.error(msg);
    if (extra) console.error(extra);
    process.exit(1);
};

if (has('--help') || has('-h')) {
    console.log(readFileSync(new URL(import.meta.url), 'utf8').split('\n').slice(1, 28).join('\n').replace(/^\/\/ ?/gm, ''));
    process.exit(0);
}

// `--to ""` is a real value — removing the prefix — so absence and empty string must not collapse.
const toIndex = argv.indexOf('--to');
if (toIndex === -1) die('--to <short> is required (--to "" removes the prefix).');
const rawTo = argv[toIndex + 1];
if (rawTo === undefined || (rawTo.startsWith('--') && rawTo !== '')) die('--to needs a value. Use --to "" to remove the prefix.');
const target = rawTo === '' ? null : rawTo;
if (target !== null) {
    const problem = prefixError(target);
    if (problem) die(`--to '${target}' is not usable: ${problem}.`, 'It becomes part of every vendored skill directory AND its frontmatter name, which the spec restricts.');
}

// The skills this set is made of. Named here rather than read from the manifest, because the whole
// point of the adoption path below is to work when there IS no manifest.
const SOURCE_SKILLS = ['eq-frontend-standards', 'eq-frontend-workflow', 'eq-frontend-quality-bar'];
const skillsRoot = join(cwd, '.claude', 'skills');

// Every repo vendored BEFORE the manifest existed has plain-named directories and no manifest — which
// is the state all current consumers are in, and the state the migration step tells them to fix. So a
// missing manifest is not "nothing to rename": the directories on disk are adopted, at whatever names
// they already have. Refusing here is what sent people to `init-greenfield --prefix`, which vendored a
// SECOND copy beside the first.
const adopt = () => {
    if (!existsSync(skillsRoot)) return null;
    let found;
    try { found = readdirSync(skillsRoot); } catch { return null; }
    const pairs = SOURCE_SKILLS.map((source) => {
        const suffix = source.replace(/^eq-/, '');
        const match = found.find((d) => d === source || (d.startsWith('eq-') && d.endsWith(`-${suffix}`)));
        return [source, match];
    });
    if (pairs.some(([, match]) => !match)) return null;
    // The prefix is derived from what is on disk, so an adopted set re-prefixes exactly like a
    // recorded one. `eq-cc-frontend-standards` -> `cc`; `eq-frontend-standards` -> null.
    const first = pairs[0][1];
    const derived = first === pairs[0][0] ? null : first.slice(3, first.length - pairs[0][0].replace(/^eq-/, '').length - 1);
    return { prefix: derived, skills: Object.fromEntries(pairs), adopted: true };
};

let manifest = readManifest(cwd);
if (manifest?.corrupt) {
    die(`${MANIFEST_REL} exists but could not be parsed.`,
        'Fix or delete it by hand. Renaming from a manifest that cannot be read would move directories on a guess.');
}
if (!manifest) {
    manifest = adopt();
    if (!manifest) {
        die(`No ${MANIFEST_REL} here, and .claude/skills does not hold a complete vendored set to adopt.`,
            `Vendor first: node <skill>/scripts/init-greenfield.mjs --prefix <short>\nExpected one directory per skill: ${SOURCE_SKILLS.join(', ')} (with or without a prefix).`);
    }
    console.log(`No ${MANIFEST_REL} — adopting the set already in .claude/skills (${manifest.prefix ? `prefix '${manifest.prefix}'` : 'unprefixed'}).`);
}
const current = manifest.prefix ?? null;
const skills = Object.entries(manifest.skills ?? {});
if (!skills.length) die(`${MANIFEST_REL} records no skills.`, 'Re-vendor rather than rename: node <skill>/scripts/init-greenfield.mjs --prefix <short>');
if (current === target) {
    console.log(`Already ${target === null ? 'unprefixed' : `prefixed '${target}'`} — nothing to do.`);
    process.exit(0);
}

// Source name -> the name it should have AFTER this run. The old name comes from the manifest rather
// than being re-derived, so a hand-renamed directory is caught below instead of being missed.
const next = nameMap(skills.map(([source]) => source), target);
const moves = skills.map(([source, from]) => ({ source, from, to: next.get(source) }));

for (const { from, to } of moves) {
    if (!existsSync(join(skillsRoot, from))) {
        die(`.claude/skills/${from} is missing, though ${MANIFEST_REL} records it.`,
            'The tree and the manifest disagree. Re-vendor instead of renaming: node <skill>/scripts/init-greenfield.mjs --prefix <short>');
    }
    if (from !== to && existsSync(join(skillsRoot, to))) {
        die(`.claude/skills/${to} already exists, so the rename would collide.`,
            'Move or delete it first — this script never overwrites a directory.');
    }
}

// A dirty vendored tree must be committed first: `git mv` on modified files mixes the rename with
// whatever was already changed there, and the reviewer of the resulting diff cannot separate them.
const git = (args) => {
    try { return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }); } catch { return null; }
};
const isGit = git(['rev-parse', '--git-dir']) !== null;
if (isGit && !dryRun) {
    const dirty = git(['status', '--porcelain', '--', '.claude/skills']);
    if (dirty && dirty.trim()) {
        die('.claude/skills has uncommitted changes.', `Commit or stash them first, so this rename lands as a rename:\n${dirty.trim()}`);
    }
}

const walk = (dir, base = dir) => readdirSync(dir).flatMap((e) => {
    const p = join(dir, e);
    const st = statSync(p, { throwIfNoEntry: false });
    if (!st) return [];
    return st.isDirectory() ? walk(p, base) : [relative(base, p)];
});

// ── the rename ──────────────────────────────────────────────────────────────
const renamed = [];
for (const { source, from, to } of moves) {
    if (from === to) continue;
    if (!dryRun) {
        // git mv keeps the rename visible in history and in the PR diff; a plain rename shows as a
        // whole tree deleted and another added, which is unreviewable at this size.
        try {
            if (!isGit || git(['mv', join('.claude', 'skills', from), join('.claude', 'skills', to)]) === null) {
                renameSync(join(skillsRoot, from), join(skillsRoot, to));
            }
        } catch (err) {
            // A throw here (EPERM, EXDEV, a case-insensitive-FS collision) leaves earlier skills moved
            // and later ones not. The manifest is written to match THE DISK before dying, or the next
            // run reports "recorded but missing" and refuses — a state with no way forward.
            const partial = new Map(moves.map(({ source: s2, from: f2, to: t2 }) => [s2, renamed.includes(`${f2} -> ${t2}`) ? t2 : f2]));
            writeManifest(cwd, { prefix: null, skills: partial, standardVersion: manifest.standardVersion ?? null });
            console.error(`\nFailed renaming ${from} -> ${to}: ${err.message}`);
            console.error(`${renamed.length} of ${moves.length} directories were moved. ${MANIFEST_REL} now records what is ACTUALLY on disk (as a mixed set), so a re-run can continue.`);
            console.error(`Fix the cause, then re-run: node <skill>/scripts/rename-vendor-prefix.mjs --to ${target ?? '""'}\n`);
            process.exit(1);
        }
    }
    renamed.push(`${from} -> ${to}`);
    void source;
}

// Rewrite the bodies: frontmatter `name:`, sibling links, and prose mentions. The mapping is
// old-vendored-name -> new-vendored-name, so a set that was already prefixed re-prefixes cleanly.
const bodyMap = new Map(moves.filter(({ from, to }) => from !== to).map(({ from, to }) => [from, to]));
const rewritten = [];
if (bodyMap.size) {
    for (const { from, to } of moves) {
        // In a dry run the directories have not moved, so the files are still under the OLD name —
        // reading the new path would report "0 files rewritten" and understate what the real run does.
        const dir = join(skillsRoot, dryRun ? from : to);
        if (!existsSync(dir)) continue;
        for (const file of walk(dir)) {
            if (!file.endsWith('.md')) continue;
            // starter/ files are templates for the consumer repo and name the PERSONAL install paths,
            // which carry no prefix. Rewriting them turns working fallbacks into dead paths.
            if (isStarterPath(file)) continue;
            const path = join(dir, file);
            let before;
            try { before = readFileSync(path, 'utf8'); } catch { continue; }
            const after = rewriteMarkdown(before, bodyMap);
            if (after === before) continue;
            if (!dryRun) writeFileSync(path, after);
            rewritten.push(join(to, file));
        }
    }
}

if (!dryRun) writeManifest(cwd, { prefix: target, skills: next, standardVersion: manifest.standardVersion ?? null });

// ── what the repo still says ────────────────────────────────────────────────
// Files OUTSIDE .claude/skills that name an old directory: a workflow, an agent file, a doc. They
// are the repo's own, so they are reported rather than edited. The starter's resolvers glob for
// `*frontend-standards`, so a repo on the current starter has nothing here.
const stale = [];
let staleScanned = false;
if (bodyMap.size) {
    // Untracked files count: a `.github/workflows/*.yml` or an ops script staged later still names a
    // directory that no longer exists. `--others --exclude-standard` adds them without pulling in
    // node_modules. A non-git checkout is walked instead, so the scan always runs.
    const listed = isGit
        ? (git(['ls-files', '--cached', '--others', '--exclude-standard']) ?? '').split('\n').filter(Boolean)
        : walk(cwd).filter((f) => !f.startsWith('node_modules'));
    staleScanned = true;
    const candidates = listed.filter((f) => !f.startsWith(join('.claude', 'skills')) && !f.startsWith('.claude/skills/'));
    for (const file of candidates) {
        let body;
        try { body = readFileSync(join(cwd, file), 'utf8'); } catch { continue; }
        for (const from of bodyMap.keys()) {
            if (body.includes(from)) { stale.push(`${file} — names ${from}`); break; }
        }
    }
}

const label = dryRun ? 'would rename' : 'renamed';
console.log(`\n${label} (${renamed.length}):`);
for (const r of renamed) console.log(`  ${r}`);
console.log(`\n${dryRun ? 'would rewrite' : 'rewrote'} ${rewritten.length} markdown file(s) — frontmatter names, sibling links and prose mentions.`);
console.log(`${dryRun ? 'would record' : 'recorded'} ${target === null ? 'no prefix' : `prefix '${target}'`} in ${MANIFEST_REL}.`);

if (stale.length) {
    console.log(`\nSTILL NAMES THE OLD DIRECTORIES (${stale.length}) — yours to fix, not this script's:`);
    for (const s of stale) console.log(`  ! ${s}`);
    console.log(`  The starter's CI and agent files resolve the standard by glob (\`*frontend-standards\`) and need no edit.`);
    console.log(`  Anything listed above hardcodes a path that no longer exists.\n`);
    process.exit(dryRun ? 0 : 2);
}

// `.agents/skills` is generated FROM these names, so a rename leaves it pointing at directories that
// no longer exist — and the hosts that read only that path are the ones with no other copy.
if (existsSync(join(cwd, '.agents', 'skills'))) {
    console.log(`\n.agents/skills exists and was NOT touched: it is generated. Regenerate it now, or the hosts that read only that path (Zed, Codex CLI, Gemini CLI) follow the old names:`);
    console.log(`    node <skill>/scripts/adapt-hosts.mjs\n  (standard-check --check flags this until you do.)`);
}

console.log(`\n${dryRun ? 'Dry run — nothing was written.' : 'Done. Commit .claude/skills as one rename commit.'}\n`);
