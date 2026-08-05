#!/usr/bin/env node
// Applies the standard to a NEW repo, where there is no debt to negotiate: every rule goes to
// 'error' from the first commit, so no measurement and no suppressions baseline are needed.
//
// For an EXISTING repo, do not use this. Run measure-rules.mjs, enable only the rules at zero
// violations, and baseline the rest. Dropping the full config into a mature repo produces hundreds
// of errors at once, which is how a whole rule set gets switched back off.
//
// Never overwrites. Anything already present is reported and skipped, so a second run is safe and
// a partially-configured repo can be topped up. package.json is merged key-by-key, and an existing
// script with a different value is left alone and printed for you to resolve. The one exception is
// a `lint` script running a DIFFERENT linter, which is moved aside rather than kept — see the
// FOREIGN_LINTERS block for why keeping it silently disables the whole standard.
//
// .claude/ is treated as COMMITTED repo policy, not per-developer config, so the starter tree
// carries the hooks, reviewer agents and commands and this script lands them in the repo. By
// default the skill directories are also copied in as REAL FILES rather than left as the
// symlink `npx skills add` makes: git stores a symlink as its target path, so a committed symlink
// hands every teammate a broken link into one machine's home directory.
//
// It also VERIFIES, and exits non-zero on, the parts of the standard that cannot be installed by
// copying a file — the ones whose failure mode is a GREEN build:
//   * the base lint config .oxlintrc.strict.json extends. If the repo already had its own
//     .oxlintrc.json, that file is the gate, and never-overwrite means this script cannot fix it.
//   * the `@/` source alias. tsconfig `paths` makes it type-check; only a bundler alias makes vitest
//     and vite 7 resolve it. Both files are ones this script must not edit.
//   * the styling pipeline. tailwindcss ships in package.fragment.json, but Tailwind is inert until
//     two SOURCE files say so, and this script never edits source.
//   * the release job. .changeset/config.json and .github/workflows/release.yml are written here, but
//     a pre-existing changesets config with `privatePackages.tag` unset tags nothing while exiting 0,
//     and release.yml runs whatever `scripts.version` and `scripts.release` already contained.
// All are reported in ONE run, with the exact change to make, and fail until those changes exist. See
// the blocks they live in for why a printed reminder is not sufficient.
//
// Usage, from the root of the new repo:
//   node <path>/init-greenfield.mjs [--dry-run] [--no-vendor-skills]
//
// Exit codes — distinct, because a wrapper has to tell "finish the setup" from "the run never
// started", and the two need opposite responses:
//   0  setup complete: everything landed and both verified gates are enforcing. Also EVERY --dry-run,
//      including one that reports gaps — a dry run wrote nothing, so it cannot have failed, and
//      `node … --dry-run && node …` has to reach the real run.
//   1  the run did not happen: wrong directory, an incomplete skill install, vendoring with
//      the sibling skills missing, or an unexpected throw. Nothing was written.
//   2  files landed, but a verified gate is not enforcing: a pre-existing .oxlintrc.json is the base
//      of the lint gate, the styling pipeline is unwired, and/or the release job would report a
//      release it did not make. Make the printed change(s) and re-run; nothing else in the install is
//      affected. The two release items printed under `ℹ` are deliberately NOT part of this: they stop
//      a release from happening at all, which is visible rather than falsely green.

import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync, statSync, realpathSync, chmodSync, cpSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';

const STARTER = join(import.meta.dirname, '..', 'starter');
// scripts/ -> eq-frontend-standards/ -> engineering/, the directory holding every skill in the set.
const SKILLS_SRC = join(import.meta.dirname, '..', '..');
const VENDORED_SKILLS = ['eq-frontend-standards', 'eq-frontend-workflow', 'eq-frontend-quality-bar'];
const cwd = process.cwd();
const dryRun = process.argv.includes('--dry-run');
// Vendoring is the DEFAULT: the standard must be enforceable from the repo alone — a CI runner, a
// cloud sandbox, Cyrus, or any agent host has no ~/.claude and no ~/.agents, so a repo that does
// not carry the skills carries no standard there. --no-vendor-skills opts out for the rare repo
// that cannot commit the tree; --vendor-skills is still accepted for older instructions.
const vendorSkills = !process.argv.includes('--no-vendor-skills');

if (!existsSync(join(cwd, 'package.json'))) {
    console.error('No package.json here. Run this from the root of the repo you are setting up.');
    process.exit(1);
}
if (!existsSync(STARTER)) {
    console.error(`Starter files not found at ${STARTER}. Is the skill installed completely?`);
    process.exit(1);
}

const created = [];
const skipped = [];
const conflicts = [];

const walk = (dir, base = dir) => readdirSync(dir).flatMap((e) => {
    const p = join(dir, e);
    return statSync(p).isDirectory() ? walk(p, base) : [relative(base, p)];
});

// Every gate this script VERIFIES rather than writes reads a file the user controls, so an unreadable
// file must be NOT A MATCH and never an exception: a dangling symlink (ENOENT) and a chmod 000 file
// (EACCES) both mean "this file does not prove the thing", and neither may abort a run that has
// already rewritten package.json.
const readTextFile = (file) => {
    try {
        const buf = readFileSync(file);
        // A UTF-16 file decoded as utf8 is NUL-interleaved mojibake, so the string being searched for
        // is invisible and a WIRED repo gets reported as unwired.
        if (buf[0] === 0xff && buf[1] === 0xfe) return buf.subarray(2).toString('utf16le');
        if (buf[0] === 0xfe && buf[1] === 0xff) return buf.subarray(2).swap16().toString('utf16le');
        // A UTF-8 BOM sits in front of the first character and would break a first-line anchor.
        return buf.toString('utf8').replace(/^﻿/, '');
    } catch {
        return null;
    }
};

// ── plain file copies ───────────────────────────────────────────────────────
for (const rel of walk(STARTER)) {
    // `.fragment` files are merged, not copied.
    if (rel.includes('fragment')) continue;

    const target = join(cwd, rel);
    if (existsSync(target)) { skipped.push(rel); continue; }
    if (!dryRun) {
        mkdirSync(dirname(target), { recursive: true });
        writeFileSync(target, readFileSync(join(STARTER, rel)));
        // A hook that is not executable does not run and reports nothing, which is worse than
        // having no hook at all. Same reasoning for .husky/ and for .claude/hooks/.
        if (rel.startsWith('.husky/') || rel.startsWith('.claude/hooks/')) chmodSync(target, 0o755);
    }
    created.push(rel);
}

// ── the base lint config the strict config inherits — VERIFIED, never written ─
// The two lint configs are a pair: .oxlintrc.strict.json is `"extends": ["./.oxlintrc.json"]` plus the
// expensive checks, and `npm run lint` runs the strict one. The copy loop above never overwrites, so a
// repo that already has its OWN .oxlintrc.json keeps it — and the strict config then extends THAT.
// `extends` can add but never subtract, so there is no config-side fix: the base file has to be the
// standard's.
//
// WHY THIS CARRIES EXIT 2, the same as the styling pipeline below: it is strictly the worse of the
// two. An unwired Tailwind pipeline is VISIBLE — styles do not apply and someone notices in the
// browser within minutes. A strict config extending a scaffold's base is INVISIBLE: `npm run lint`
// exits 0, CI is green, and the repo enforces the scaffold's handful of rules instead of the
// standard's full set. A gate whose failure is indistinguishable from success is worse than no gate,
// which is the principle every other verified check here already rests on. The Vite react-ts template
// ships a two-rule .oxlintrc.json, so this is the most common scaffold in the world, not an edge case
// — and `= .oxlintrc.json` in the "left alone" list reads as harmlessly as tsconfig.json.
const OXLINTRC = '.oxlintrc.json';
// The sentinel is a RULE NAME, not the file's bytes: a repo that took the standard's base and then
// retuned a value or added its own rules must not be pinned at exit 2 forever, so "derived from the
// standard" has to count as the standard's. Same device as the .gitignore sentinel further down.
// `max-lines` is the §1 size budget — it is in the standard's base config and in no scaffold's.
const STANDARD_BASE_SENTINEL = 'max-lines';
const lintGaps = [];
if (skipped.includes(OXLINTRC)) {
    const body = readTextFile(join(cwd, OXLINTRC));
    if (body === null || !body.includes(STANDARD_BASE_SENTINEL)) {
        const why = body === null ? `could not be read, so it cannot be shown to hold the standard's rules` : `does not contain the standard's base rules (no \`${STANDARD_BASE_SENTINEL}\` budget in it)`;
        lintGaps.push([
            `${OXLINTRC} already existed and was NOT replaced — this script does not overwrite your`,
            `files — but it ${why}.`,
            `.oxlintrc.strict.json extends ./${OXLINTRC}, so YOUR file is the base of the gate that`,
            `\`npm run lint\` and CI run: whatever is missing from it is missing from the gate, green.`,
            `Replace it with the standard's, then merge any additions of your own back on top:`,
            `      cp ${join(STARTER, OXLINTRC)} ${OXLINTRC}`,
        ].join('\n    '));
    }
}

// ── vendored skills ─────────────────────────────────────────────────────────
// Real copied files, never a symlink: git records a symlink as its target path, so committing the
// link `npx skills add` creates gives every other clone a dangling path into one home directory.
if (vendorSkills) {
    const missing = VENDORED_SKILLS.filter((n) => !existsSync(join(SKILLS_SRC, n, 'SKILL.md')));
    if (missing.length) {
        console.error(`Cannot vendor skills: ${SKILLS_SRC} does not hold ${missing.join(', ')}.`);
        console.error('This script must run from inside the installed skill, at <skills>/engineering/eq-frontend-standards/scripts/.');
        process.exit(1);
    }
    for (const name of VENDORED_SKILLS) {
        const rel = join('.claude', 'skills', name);
        const target = join(cwd, rel);
        // Presence of the DIRECTORY is not presence of the skill. Editors, agent tooling and a
        // partially-completed earlier run all create an empty .claude/skills/<name>/, and skipping on
        // that husk reports "left alone (already present)" while vendoring nothing — after which
        // ci.yml resolves the empty directory FIRST in its candidate list and the structure gate dies
        // on MODULE_NOT_FOUND instead of failing with its own instructions. Vendored is a statement
        // about CONTENT: SKILL.md for every skill, plus the script the CI gate actually executes for
        // the standard itself. Same sentinel-not-bytes approach as STANDARD_BASE_SENTINEL above.
        const sentinels = [join(target, 'SKILL.md')];
        if (name === 'eq-frontend-standards') sentinels.push(join(target, 'scripts', 'check-structure.mjs'));
        if (sentinels.every((s) => existsSync(s))) { skipped.push(rel); continue; }
        // dereference: the source may itself be a symlinked install; the copy must be real files.
        // force: false fills a husk or completes a partial copy without replacing any file that does
        // exist — the same never-overwrite contract as the plain copy loop above.
        if (!dryRun) cpSync(join(SKILLS_SRC, name), target, { recursive: true, dereference: true, force: false });
        created.push(`${rel}/ (vendored)`);
    }
}

// ── package.json merge ──────────────────────────────────────────────────────
const pkgPath = join(cwd, 'package.json');
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
const fragment = JSON.parse(readFileSync(join(STARTER, 'package.fragment.json'), 'utf8'));

const isPlainObject = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);

// `!==` on an object-valued entry compares REFERENCES, so a lint-staged map byte-identical to the
// fragment's read as a conflict — every re-run then told the user to resolve, by hand, two values
// that were the same. JSON.stringify equality assumes matching key order, which holds in the case
// this exists for (the repo's value came from this fragment, so the order is the fragment's); a
// hand-reordered but equal value still reads as a conflict, and that errs on the side this whole
// merge errs on — report rather than overwrite.
const valuesEqual = (a, b) => a === b || JSON.stringify(a) === JSON.stringify(b);

// Keys the foreign-linter relocation below already reported in full. Without this, a taken
// `lint:legacy` produces two conflict lines for the same key: the relocation's explanation, and then
// the generic "yours X, standard Y" from this merge.
const scriptKeysAlreadyReported = new Set();

const mergeSection = (key) => {
    if (!fragment[key]) return;
    if (typeof fragment[key] !== 'object') {
        if (key in pkg && pkg[key] !== fragment[key]) conflicts.push(`package.json ${key}: yours ${JSON.stringify(pkg[key])}, standard ${JSON.stringify(fragment[key])}`);
        else pkg[key] = fragment[key];
        return;
    }
    // A hand-written `"scripts": "oxlint"` is legal JSON. Merging keys into a string threw, which
    // aborted the run after the starter tree had landed and BEFORE package.json was written back and
    // .gitignore was appended — a genuine half-install. Report it and keep going.
    if (pkg[key] != null && !isPlainObject(pkg[key])) {
        conflicts.push(`package.json ${key}: yours is ${JSON.stringify(pkg[key])}, not an object, so the standard's ${key} could not be merged into it — replace it by hand with ${JSON.stringify(fragment[key])}`);
        return;
    }
    pkg[key] ??= {};
    for (const [k, v] of Object.entries(fragment[key])) {
        if (key === 'scripts' && scriptKeysAlreadyReported.has(k)) continue;
        if (k in pkg[key] && !valuesEqual(pkg[key][k], v)) {
            // Never silently replace a script or dependency the repo already chose.
            conflicts.push(`package.json ${key}.${k}: yours ${JSON.stringify(pkg[key][k])}, standard ${JSON.stringify(v)}`);
        } else {
            pkg[key][k] = v;
        }
    }
};

// ── foreign linter holding the lint gate ────────────────────────────────────
// `scripts.lint` is not user content, it is the definition of the gate: starter/.github/workflows/
// ci.yml runs `npm run lint`, so whatever sits there is what CI enforces. A repo that ships
// `"lint": "eslint ."` and keeps it means CI runs that eslint config and never the .oxlintrc.strict
// .json this script just wrote — every correctness rule and every budget in the standard passes
// unenforced, on a green build, with only a one-time warning in this output to say so. So a
// recognised foreign linter is moved aside to a named key and the standard's oxlint command takes
// the gate. An `oxlint` command with different flags is a user choice inside the standard's own
// tool: that stays an ordinary reported conflict, untouched.
//
// oxlint is OURS, so it must never appear in the list below: the Vite react-ts template ships
// `"lint": "oxlint"`, and treating that as a rival relocates the standard's own linter to
// `lint:legacy`. See reconcileLintScript for what that head start gets instead.
const STANDARD_LINTER = 'oxlint';
// [name, matches the segment's FIRST EXECUTABLE TOKEN, optional extra test on the whole segment].
const FOREIGN_LINTERS = [
    ['eslint', /^eslint$/],
    ['biome', /^(@biomejs\/)?biome$/],
    ['rome', /^(@rometools\/)?rome$/],
    ['standard', /^standard$/],
    ['xo', /^xo$/],
    ['tslint', /^tslint$/],
    // A formatter used as the lint gate. `prettier --write` is a fixer, not a gate, so only the
    // checking form counts.
    ['prettier --check', /^prettier$/, /(^|\s)(--check|-c)(\s|$)/],
];
// The standard's own .oxlintrc*.json and .oxfmtrc.json are deliberately absent: reporting the config
// this script just wrote as a file to delete is how a repo gets talked into deleting its own gate.
const FOREIGN_LINTER_CONFIGS = [
    'eslint.config.js', 'eslint.config.mjs', 'eslint.config.cjs', 'eslint.config.ts', 'eslint.config.mts',
    'biome.json', 'biome.jsonc', 'tslint.json',
];

// Classification reads the first executable token of each `&&` / `;` / `||` / `|` segment, never the
// whole string. Searching anywhere matched a script NAME: `"lint": "npm run standard-lint"` with
// `"standard-lint": "oxlint --max-warnings 0 && tsc --noEmit"` was relocated as the `standard`
// linter, silently dropping `--max-warnings 0` and the typecheck from CI. `run-s standard-checks` and
// `echo standard` misfired the same way, and `xo` had the same pattern shape.
const ENV_ASSIGNMENT = /^[A-Za-z_][A-Za-z0-9_]*=/;
// Tools that run something else: the thing they run is the token that decides.
const COMMAND_WRAPPERS = new Set(['npm', 'npx', 'pnpm', 'pnpx', 'yarn', 'bun', 'bunx', 'dlx', 'exec', 'cross-env', 'env', 'dotenv', 'dotenv-cli']);
const SCRIPT_RUNNERS = /^(run-s|run-p|npm-run-all)$/;
// One level of `npm run` indirection is what hid a foreign linter in practice; the depth cap and the
// visited set are what stop `"lint": "npm run lint"` from recursing forever.
const MAX_SCRIPT_DEPTH = 3;

const tokenize = (segment) => segment.trim().split(/\s+/).map((t) => t.replace(/^['"]+|['"]+$/g, '')).filter(Boolean);

// Drops leading `FOO=1`, flags, and wrapper commands, so `cross-env FOO=1 npx oxlint` classifies on
// `oxlint`. Also leaves `run` exposed, which is how `npm run <script>` is recognised below.
const stripWrappers = (tokens) => {
    let i = 0;
    while (i < tokens.length && (ENV_ASSIGNMENT.test(tokens[i]) || tokens[i].startsWith('-') || COMMAND_WRAPPERS.has(tokens[i]))) i += 1;
    return tokens.slice(i);
};

// `./node_modules/.bin/oxlint` is oxlint; a scoped package name is not a path.
const binName = (token) => (token.startsWith('@') ? token : token.slice(token.lastIndexOf('/') + 1));

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// `npm-run-all lint:*` names its scripts by glob.
const expandScriptGlob = (arg, scripts) => {
    if (!arg.includes('*')) return [arg];
    const pattern = new RegExp(`^${arg.split('*').map(escapeRe).join('.*')}$`);
    return Object.keys(scripts ?? {}).filter((name) => pattern.test(name));
};

// Every classifier below returns STANDARD_LINTER, a foreign linter's name, or null. The standard's
// own tool anywhere in the chain wins: `tsc --noEmit && oxlint` is our gate, not a foreign one.
const firstLinterIn = (results) => (results.includes(STANDARD_LINTER) ? STANDARD_LINTER : results.find(Boolean) ?? null);

const classifyChain = (cmd, scripts, seen, depth) => firstLinterIn(cmd.split(/[;&|]+/).map((segment) => classifySegment(segment, scripts, seen, depth)));

const classifyScriptName = (name, scripts, seen, depth) => {
    if (depth >= MAX_SCRIPT_DEPTH || seen.has(name)) return null;
    const body = scripts?.[name];
    if (typeof body !== 'string') return null;
    seen.add(name);
    return classifyChain(body, scripts, seen, depth + 1);
};

// A `function` declaration, not an arrow, only because it is mutually recursive with classifyChain
// above: hoisting is what lets the pair reference each other.
function classifySegment (segment, scripts, seen, depth) {
    let tokens = stripWrappers(tokenize(segment));
    if (!tokens.length) return null;

    if (tokens[0] === 'run') {
        const rest = stripWrappers(tokens.slice(1));
        return rest.length ? classifyScriptName(rest[0], scripts, seen, depth) : null;
    }
    if (SCRIPT_RUNNERS.test(binName(tokens[0]))) {
        const names = tokens.slice(1).filter((t) => !t.startsWith('-')).flatMap((arg) => expandScriptGlob(arg, scripts));
        return firstLinterIn(names.map((name) => classifyScriptName(name, scripts, seen, depth)));
    }

    const bin = binName(tokens[0]);
    // The standard's own tool running in the chain means this is flags, not a different linter.
    if (bin === STANDARD_LINTER) return STANDARD_LINTER;
    const linter = FOREIGN_LINTERS.find(([, tokenPattern, segmentPattern]) => tokenPattern.test(bin) && (!segmentPattern || segmentPattern.test(segment)))?.[0];
    if (linter) return linter;
    // A bare script name, as `yarn <script>` and `run-s` both allow.
    return classifyScriptName(bin, scripts, seen, depth);
}

const foreignLinterIn = (cmd, scripts) => {
    const found = classifyChain(cmd, scripts, new Set(), 0);
    return found && found !== STANDARD_LINTER ? found : null;
};

// A bare `oxlint`, with no flags and no paths, is the scaffold's default rather than a decision: the
// Vite react-ts template ships exactly that. It is the standard's own linter, so relocating it would
// be nonsense — but it is not the standard's gate either. Bare `oxlint` reads .oxlintrc.json only, so
// CI would run the fast native-only set and never the type-aware rules and jsPlugins in
// .oxlintrc.strict.json: green, and half the standard unenforced. The fragment's command is a strict
// superset of what the bare form does, so it replaces it. Any oxlint command carrying a flag or a path
// IS a decision inside our own tool and is left alone as an ordinary reported conflict.
const isBareStandardLinter = (cmd) => {
    const tokens = stripWrappers(tokenize(cmd));
    return tokens.length === 1 && binName(tokens[0]) === STANDARD_LINTER;
};

const moved = [];
const upgraded = [];

const reconcileLintScript = (key) => {
    const existing = pkg.scripts?.[key];
    if (typeof existing !== 'string') return;
    const standard = JSON.stringify(fragment.scripts[key]);

    if (isBareStandardLinter(existing)) {
        delete pkg.scripts[key];   // so the merge below installs the standard's value, not a conflict
        upgraded.push(`package.json scripts.${key}: yours was ${JSON.stringify(existing)} — already the standard's linter, so nothing was moved aside. Replaced with ${standard}, because bare \`${STANDARD_LINTER}\` reads .oxlintrc.json only and CI's \`npm run ${key}\` would never run the type-aware rules in .oxlintrc.strict.json. To reverse: set scripts.${key} back by hand.`);
        return;
    }

    const tool = foreignLinterIn(existing, pkg.scripts);
    if (!tool) return;

    const dest = `${key}:legacy`;
    if (dest in pkg.scripts) {
        // This line says everything the merge's generic conflict would, and more, so suppress that one.
        scriptKeysAlreadyReported.add(key);
        conflicts.push(`package.json scripts.${key}: yours ${JSON.stringify(existing)} runs ${tool}, and scripts.${dest} is already taken — nothing was moved. CI runs \`npm run ${key}\`, so ${tool} is still your gate and the standard is not enforced until you set scripts.${key} to ${standard} by hand.`);
        return;
    }

    pkg.scripts[dest] = existing;
    delete pkg.scripts[key];   // so the merge below installs the standard's value, not a conflict
    moved.push(`package.json scripts.${key}: yours ran ${tool}, not ${STANDARD_LINTER} — kept verbatim as scripts.${dest}, and the standard's ${standard} installed as scripts.${key}, because CI's \`npm run ${key}\` step would otherwise enforce ${tool} instead of the .oxlintrc*.json written above. To reverse: swap the two values back by hand. Note that ${tool} is NOT in the standard's devDependencies, so \`npm run ${dest}\` only works while you keep it installed.`);
};

for (const key of ['lint', 'lint:fix']) reconcileLintScript(key);

// Reported, never deleted — this script does not remove a user's files.
// `.eslintrc*` and `.xo-config*` are prefix families (`.eslintrc`, `.eslintrc.json`, `.eslintrc.cjs`,
// `.eslintrc.yml`, …), so they cannot be listed exhaustively above.
const staleLinterConfigs = readdirSync(cwd).filter((e) => FOREIGN_LINTER_CONFIGS.includes(e) || e.startsWith('.eslintrc') || e.startsWith('.xo-config'));

for (const key of ['engines', 'packageManager', 'scripts', 'lint-staged', 'devDependencies']) mergeSection(key);
if (!dryRun) writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');

// ── .gitignore append ───────────────────────────────────────────────────────
const giPath = join(cwd, '.gitignore');
const giFragment = readFileSync(join(STARTER, '.gitignore.fragment'), 'utf8');
const gi = existsSync(giPath) ? readFileSync(giPath, 'utf8') : '';
// Sentinel is settings.local.json, the one line unique to this fragment. `.claude/skills` cannot
// be the sentinel: it is deliberately absent now that skills are vendored and committed.
if (!gi.includes('.claude/settings.local.json')) {
    if (!dryRun) writeFileSync(giPath, gi.trimEnd() + '\n\n' + giFragment);
    created.push('.gitignore (appended)');
} else {
    skipped.push('.gitignore (already covers .claude/settings.local.json)');
}

// ── report ──────────────────────────────────────────────────────────────────
const label = dryRun ? 'WOULD CREATE' : 'created';
console.log(`\n${label}:`);
console.log(created.length ? created.map((f) => `  + ${f}`).join('\n') : '  (nothing)');

if (skipped.length) {
    console.log(`\nleft alone (already present):`);
    console.log(skipped.map((f) => `  = ${f}`).join('\n'));
}

if (moved.length) {
    console.log(dryRun ? `\n→ WOULD MOVE ASIDE — a foreign linter was holding the CI lint gate:` : `\n→ moved aside — a foreign linter was holding the CI lint gate:`);
    console.log(moved.map((m) => `  > ${m}`).join('\n'));
}

if (upgraded.length) {
    console.log(dryRun ? `\n→ WOULD UPGRADE — the standard's own linter was holding the CI lint gate with default arguments:` : `\n→ upgraded — the standard's own linter was holding the CI lint gate with default arguments:`);
    console.log(upgraded.map((m) => `  > ${m}`).join('\n'));
}

if (conflicts.length) {
    console.log(`\n⚠ resolve by hand — your value was kept:`);
    console.log(conflicts.map((c) => `  ! ${c}`).join('\n'));
}

if (staleLinterConfigs.length) {
    console.log(`\n⚠ delete by hand — a foreign linter's config, unused now that oxlint is the gate (this script never removes your files):`);
    console.log(staleLinterConfigs.map((f) => `  ! ${f}`).join('\n'));
}

console.log(`\nNext:`);
console.log(`  npm install`);
if (staleLinterConfigs.length) {
    console.log(`  rm ${staleLinterConfigs.join(' ')}`);
    console.log(`                          # stale foreign-linter config, and drop that linter from`);
    console.log(`                          # devDependencies — .oxlintrc.json and .oxlintrc.strict.json`);
    console.log(`                          # are the only lint configs read now`);
}
if (!vendorSkills) {
    console.log(`  node <skill>/scripts/init-greenfield.mjs --vendor-skills`);
    console.log(`                          # REQUIRED, not optional: copies the skills into`);
    console.log(`                          # .claude/skills as REAL files, so a clone inherits the exact`);
    console.log(`                          # standard. ci.yml's structure gate runs check-structure.mjs`);
    console.log(`                          # from there and FAILS when it is absent, because a check that`);
    console.log(`                          # skips reports green while enforcing nothing. Commit`);
    console.log(`                          # .claude/ — it is repo policy, not personal config.`);
}
console.log(`  npx husky init          # only if .husky/_ is missing; it wires core.hooksPath`);
console.log(`  npm run lint:fix        # REQUIRED FIRST: \`oxfmt && oxlint --fix\`. A scaffold written`);
console.log(`                          # 2-space/no-semicolon reformats wholesale here, and the`);
console.log(`                          # remaining lint errors are the ones worth reading`);
console.log(`  npm run lint && npm run typecheck && npm run build`);
console.log(`                          # \`npm run lint\` is what CI runs — verify it is the standard's`);
console.log(`                          # \`oxlint -c .oxlintrc.strict.json --type-aware\``);
console.log(`                          # \`--ignore-pattern .claude/skills\`, not the bare \`oxlint\` or`);
console.log(`                          # other linter the scaffold shipped. The ignore flag is on the`);
console.log(`                          # script and not in the config because oxlint does NOT inherit`);
console.log(`                          # ignorePatterns through \`extends\`.`);
console.log(`  # write the first test    # EXPECTED RED UNTIL YOU DO: \`npm run test:coverage\` is a live`);
console.log(`                          # CI gate, and \`vitest run\` exits 1 on a repo with no test files`);
console.log(`                          # (measured, vitest 4.1.10). passWithNoTests is deliberately NOT`);
console.log(`                          # set: a coverage gate that passes with zero tests reports green`);
console.log(`                          # while asserting nothing. The first test is setup work, like the`);
console.log(`                          # scaffold's PascalCase App.tsx that the structure gate rejects.`);
console.log(`  # rewrite README.md     # the scaffold's stock README is the one file every human opens`);
console.log(`                          # first and says nothing about this repo — one paragraph plus a`);
console.log(`                          # pointer at AGENTS.md beats a stale template`);
console.log(`  git add .claude && git commit                      # commit the shared agent config`);
console.log(`  node <skill>/scripts/standard-check.mjs --record   # writes .eq-frontend-skills.json,`);
console.log(`                          # the version CI reads via --check. Run after the first commit.\n`);
if (dryRun) console.log('Dry run — nothing was written.\n');

// ── styling pipeline — verified, never written ───────────────────────────────
// `tailwindcss` and `@tailwindcss/vite` are now in the fragment, so `npm install` puts them on
// disk. That installs nothing: Tailwind produces no CSS until the bundler registers its plugin AND
// one stylesheet the app already imports holds `@import 'tailwindcss'`. Both are source files this
// script must not touch, so it checks them instead.
//
// The check exists because the failure is silent in every gate. With Tailwind unwired, every
// layer-2 utility class in the repo is inert while typecheck, lint, test, build and CI all stay
// green — the same shape as a foreign linter holding `scripts.lint` above. A line in this output is
// what that bug already looked like, so this one carries an exit code: re-run the script until it
// exits 0.
//
// It runs AFTER the report on purpose. It reads files the user controls, so it is the one part of the
// script that can throw on someone else's data — and it runs after scripts.lint has already been
// rewritten. When a dangling symlink made a read throw here, the process died with a stack trace and
// an EMPTY stdout: no created list, and no notice that the CI lint gate had just changed. Every read
// below is guarded as well, so both defences hold.
const STYLE_SCAN_SKIP = new Set([
    'node_modules', 'dist', 'build', 'coverage', '.git', '.husky', '.claude', '.agents',
    // Build output and tool caches. None is a perf problem at this size; each is a place a stale
    // copy of a wired stylesheet can sit and pass the gate for a source tree that is not wired.
    '.next', '.turbo', '.output', 'out', 'storybook-static', 'test-results', 'playwright-report', '.venv',
]);

const statOrNull = (p) => {
    try { return statSync(p); } catch { return null; }
};

// Same approach as check-structure.mjs rule 5: a state machine with newlines preserved, not a regex
// a `*/` inside a quoted value would break. A commented-out `@import 'tailwindcss'` or a
// commented-out plugin import is the exact bug this exit code exists to catch, so neither may read as
// wiring. `//` is not a CSS comment, so line comments are opt-in and used only for the vite config.
// blockComments is opt-OUT for one reason, and it is not hypothetical: this stripper is not
// string-aware, and the tsconfig mapping `"@/*": ["./src/*"]` CONTAINS the pair `/*`. Stripping block
// comments from a tsconfig therefore eats the mapping and everything after it, and the `@/` gate below
// reported a correctly-wired repo as unwired — a gate that cannot be satisfied. tsconfig comments are
// `//` in practice, so the alias check turns block stripping off and keeps line stripping on.
const stripComments = (body, { lineComments = false, blockComments = true } = {}) => {
    let out = '';
    let inBlock = false;
    let inLine = false;
    let i = 0;
    while (i < body.length) {
        if (inBlock) {
            if (body[i] === '*' && body[i + 1] === '/') { inBlock = false; i += 2; continue; }
            if (body[i] === '\n') out += '\n';
            i += 1;
            continue;
        }
        if (inLine) {
            if (body[i] === '\n') { inLine = false; out += '\n'; }
            i += 1;
            continue;
        }
        if (blockComments && body[i] === '/' && body[i + 1] === '*') { inBlock = true; i += 2; continue; }
        if (lineComments && body[i] === '/' && body[i + 1] === '/') { inLine = true; i += 2; continue; }
        out += body[i];
        i += 1;
    }
    return out;
};

const cssFiles = (dir, seen = new Set()) => {
    // Keyed on the real path, so a symlink pointing back at an ancestor cannot recurse forever.
    let real;
    try { real = realpathSync(dir); } catch { return []; }
    if (seen.has(real)) return [];
    seen.add(real);
    let entries;
    try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return []; }
    return entries.flatMap((e) => {
        const p = join(dir, e.name);
        // A symlinked directory is not isDirectory(), so a repo whose src/ is a link scanned as empty
        // and could never satisfy the gate. Follow it, and let statOrNull absorb a dangling link.
        const isDir = e.isDirectory() || (e.isSymbolicLink() && statOrNull(p)?.isDirectory() === true);
        if (isDir) return STYLE_SCAN_SKIP.has(e.name) ? [] : cssFiles(p, seen);
        return e.name.endsWith('.css') ? [p] : [];
    });
};

// Tailwind v4's two documented entry forms: the bundled `@import 'tailwindcss'`, and the granular
// split (`tailwindcss/theme`, `/preflight`, `/utilities`, each with or without `.css`). Demanding the
// closing quote right after `tailwindcss` made the gate permanently unsatisfiable for a repo on the
// granular form. Of the subpaths only `utilities` is accepted as sufficient: theme and preflight emit
// variables and resets, so a file importing those alone still leaves every utility class inert.
// `.scss` is deliberately not scanned: Sass resolves a bare quoted `@import 'tailwindcss'` as a Sass
// load and fails, so the Tailwind entry is always a `.css` file.
const TAILWIND_ENTRY = /@import\s+(['"])tailwindcss(\/(index|utilities)(\.css)?)?\1/;
const VITE_CONFIG = /^vite\.config\.[cm]?[jt]s$/;
// The plugin has to be imported AND CALLED. A bare `.includes('@tailwindcss/vite')` passed on
// `// TODO: import tailwindcss from '@tailwindcss/vite'` with `plugins: [react()]`, which builds
// green and emits no Tailwind CSS. Matching the binding rather than the literal `tailwindcss()` keeps
// a renamed import (`import tw from '@tailwindcss/vite'`) working.
const PLUGIN_BINDINGS = [
    /import\s+([A-Za-z_$][\w$]*)\s+from\s+(['"])@tailwindcss\/vite\2/,
    /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*require\(\s*(['"])@tailwindcss\/vite\2/,
];

const pluginCalled = (source) => PLUGIN_BINDINGS.some((pattern) => {
    const m = source.match(pattern);
    return m ? new RegExp(`\\b${m[1]}\\s*\\(`).test(source.slice(m.index + m[0].length)) : false;
});

// Restricted to src/ when src/ holds any stylesheet at all. Scanning the whole repo let any `.css`
// anywhere satisfy the gate: docs/examples/old-prototype.css, or a wired sibling package in a
// monorepo, reported the pipeline as wired while every utility class in src/ was dead.
//
// The fallback is not laxness, it is what keeps the gate satisfiable. This script always writes
// src/styles/_breakpoints.scss, so src/ exists after any run — and a Next.js app whose stylesheet is
// app/globals.css would then have an empty source root and could never pass, on a bundler this script
// explicitly supports. With no stylesheet under src/ there is nothing to be precise about, so it
// looks wider and says which root it looked at.
const srcRoot = join(cwd, 'src');
const srcCss = statOrNull(srcRoot)?.isDirectory() ? cssFiles(srcRoot) : [];
const scanRoot = srcCss.length ? srcRoot : cwd;
const scanned = srcCss.length ? srcCss : cssFiles(cwd);

const viteConfig = readdirSync(cwd).find((e) => VITE_CONFIG.test(e));
const viteBody = viteConfig ? readTextFile(join(cwd, viteConfig)) : null;
const viteSource = viteBody === null ? null : stripComments(viteBody, { lineComments: true });
const tailwindEntry = scanned.find((f) => {
    const body = readTextFile(f);
    return body !== null && TAILWIND_ENTRY.test(stripComments(body));
});

const styleGaps = [];
if (viteConfig && viteSource === null) {
    styleGaps.push(`${viteConfig} could not be read, so the bundler half was not checked. Fix its permissions or encoding and re-run.`);
} else if (viteSource !== null && !pluginCalled(viteSource)) {
    styleGaps.push([
        `${viteConfig} does not register the Tailwind plugin. Add exactly these two lines:`,
        `      import tailwindcss from '@tailwindcss/vite';        // beside the other plugin imports`,
        `      plugins: [react(), tailwindcss()],                  // add the call to the existing array`,
    ].join('\n    '));
}
if (!tailwindEntry) {
    styleGaps.push([
        `no .css file under ${relative(cwd, scanRoot) || '.'}/ imports Tailwind (a file that cannot be read,`,
        `or one where the import is commented out, does not count). Add this as the FIRST line of the`,
        `stylesheet your entry module already imports (a Vite react-ts scaffold: src/index.css,`,
        `imported by src/main.tsx):`,
        `      @import 'tailwindcss';`,
    ].join('\n    '));
}

// ── the `@/` source alias — two halves, both required ───────────────────────
// tsconfig `paths` makes `@/x` TYPE-CHECK. It does not make every consumer RESOLVE it. Measured on the
// exact scaffold this script targets (vite 8.2.0, vitest 4.1.10, tsc 5.9):
//
//   tsc -b --noEmit    `paths` alone ......................... ✔ passes
//   vite build         `paths` alone, vite 8 ................. ✔ passes (the new resolver reads paths)
//   vite build         `paths` alone, vite 7 ................. ✘ "error during build"
//   vitest run         `paths` alone, vitest 4 ............... ✘ "Cannot find package '@/lib/greet'"
//
// So `paths` on its own buys a repo that type-checks and builds while every test importing `@/` fails,
// and a `resolve.alias` on its own buys one that bundles while tsc rejects the import. Both halves or
// neither — and do not lean on vite 8 reading `paths`, since vite 7 does not.
//
// This is checked, not written: `paths` lives in a tsconfig and the alias lives in vite.config.*, and
// both are files this script must not edit (a scaffold's own tsconfig.app.json is skipped by the copy
// loop, so the standard's `paths` may never have landed).
const TSCONFIG_AT_ROOT = /^tsconfig(\..+)?\.json$/;
const TS_PATH_ALIAS = /(['"])@\/\*\1\s*:/;
// Object form `'@': <expr naming src>`, and the array form `{ find: '@', replacement: <expr naming
// src> }`, with or without the key's trailing slash. Deliberately loose about HOW src is resolved
// (path.resolve, fileURLToPath, a bare '/src') and strict about the two things that decide it: the key
// is `@`, and the target names src.
const VITE_SRC_ALIAS = /(['"])@\/?\1\s*:\s*[^,}\n]*\bsrc\b|\bfind\s*:\s*(['"])@\/?\2[\s\S]{0,160}?\breplacement\s*:\s*[^,}\n]*\bsrc\b/;

const aliasGaps = [];
// Skipped entirely when there is no readable vite config: a Next.js or webpack repo declares the
// bundler half somewhere this regex would never see, and a gate that cannot be satisfied gets ignored.
if (viteSource !== null) {
    const tsconfigs = readdirSync(cwd).filter((e) => TSCONFIG_AT_ROOT.test(e));
    // jsonc: a `//`-commented-out `"@/*"` is not a path mapping, exactly as a commented-out plugin
    // import is not a registered plugin. blockComments is off here — see stripComments for why.
    const tsHasPaths = tsconfigs.some((e) => {
        const body = readTextFile(join(cwd, e));
        return body !== null && TS_PATH_ALIAS.test(stripComments(body, { lineComments: true, blockComments: false }));
    });
    const viteHasAlias = VITE_SRC_ALIAS.test(viteSource);
    if (!tsHasPaths || !viteHasAlias) {
        const lines = [`the \`@/\` source alias is only half-wired, so \`@/…\` imports work in some tools and not others.`];
        if (!tsHasPaths) {
            lines.push(
                `MISSING the tsc half: no tsconfig*.json here maps "@/*". Add it to the LEAF config that`,
                `covers src (tsconfig.app.json), not the root — a solution-style root with only`,
                `"references" applies no compilerOptions to your files:`,
                `      "paths": { "@/*": ["./src/*"] }        // inside compilerOptions`,
            );
        }
        if (!viteHasAlias) {
            lines.push(
                `MISSING the bundler half: ${viteConfig} declares no resolve.alias for "@". Without it`,
                `\`vitest run\` cannot resolve \`@/…\` at all (and on vite 7 neither can \`vite build\`).`,
                `Add exactly these two edits:`,
                `      import { fileURLToPath } from 'node:url';   // beside the other imports`,
                `      resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },`,
                `                                                  // a sibling of \`plugins\`, inside defineConfig`,
            );
        }
        aliasGaps.push(lines.join('\n    '));
    }
}

// ── the leaf tsconfigs' checking flags — VERIFIED, never written ─────────────
// tsconfig.app.json and tsconfig.node.json land in the copy loop, so a fresh repo is covered. A
// PRE-EXISTING leaf config is kept by never-overwrite, and it is then the config `tsc -b` actually
// reads: a repo whose own tsconfig.app.json lacks `strict` passes typecheck, lint, tests and build,
// all green, while `undefined` flows through the app unchecked. That is the most invisible of the
// verified gates — an unwired Tailwind pipeline shows in the browser within minutes; a missing
// checking flag shows the first time a user hits the crash it would have caught. Same
// sentinel-not-bytes approach as STANDARD_BASE_SENTINEL: the flag must be PRESENT AND TRUE after
// line-comment stripping, so a commented-out flag and an explicit `"strict": false` both report.
// (Block stripping stays OFF for tsconfig — the `"@/*"` mapping contains `/*`; see stripComments.)
const LEAF_TSCONFIGS = ['tsconfig.app.json', 'tsconfig.node.json'];
const TS_CHECKING_FLAGS = ['strict', 'noUncheckedIndexedAccess', 'noImplicitOverride'];
const readJsonc = (file) => {
    const raw = readTextFile(file);
    return raw === null ? null : stripComments(raw, { lineComments: true, blockComments: false });
};
const flagTrue = (body, flag) => new RegExp(`"${flag}"\\s*:\\s*true`).test(body);

// The ratchet path is legitimate, not a gap: an existing repo REMOVES noUncheckedIndexedAccess from
// the leaf configs and keeps it only in tsconfig.strict.json while the error count ratchets down.
// With that spelling live, its absence from a leaf is the documented migration, so it is not asked
// for twice.
const strictConfigBody = readJsonc(join(cwd, 'tsconfig.strict.json'));
const ratchetCarriesNUIA = strictConfigBody !== null && flagTrue(strictConfigBody, 'noUncheckedIndexedAccess');

const tsGaps = [];
for (const leaf of LEAF_TSCONFIGS.filter((f) => skipped.includes(f))) {
    const body = readJsonc(join(cwd, leaf));
    const missing = body === null
        ? TS_CHECKING_FLAGS
        : TS_CHECKING_FLAGS.filter((f) => !flagTrue(body, f) && !(f === 'noUncheckedIndexedAccess' && ratchetCarriesNUIA));
    if (!missing.length) continue;
    tsGaps.push([
        `${leaf} already existed and was NOT replaced — this script does not overwrite your files —`,
        body === null
            ? `but it could not be read, so it cannot be shown to hold the standard's checking flags.`
            : `but it does not set ${missing.map((f) => `\`${f}\``).join(', ')} to \`true\`.`,
        `A leaf config is what \`tsc -b\` actually reads (a flag in the solution-style root checks`,
        `nothing), so whatever is missing here is missing from the typecheck gate: green, while the`,
        `bug class it exists to catch ships. Add the flag(s) inside compilerOptions — the failure each`,
        `one prevents is in references/typescript-config.md — or start from the standard's file and`,
        `merge your own options back on top:`,
        `      cp ${join(STARTER, leaf)} ${leaf}`,
    ].join('\n    '));
}

if (!viteConfig) {
    console.log(`ℹ no vite.config.* here, so the bundler half of the Tailwind wiring and the \`@/\` alias`);
    console.log(`  were not checked — register Tailwind the way your bundler wants it (Next.js, Rspack and`);
    console.log(`  webpack use @tailwindcss/postcss instead of @tailwindcss/vite; swap the dependency to`);
    console.log(`  match), and declare the \`@\` → src alias in the same place.\n`);
}

// ── the release job — written, then VERIFIED ─────────────────────────────────
// starter/.changeset/config.json and starter/.github/workflows/release.yml land in the copy loop, so
// a repo with neither is fully set up by this script and has nothing to report here. What is checked
// is the two ways the machinery lands and still releases nothing:
//
//   1. A pre-existing .changeset/config.json. Never-overwrite keeps it, and a consumer repo is a
//      PRIVATE application, so `privatePackages.tag` decides everything: changesets defaults a
//      private package to `{ version: true, tag: false }`, and with `tag: false` `changeset tag`
//      filters the package out, creates no tag, prints nothing and exits 0. changesets/action then
//      finds no `New tag:` line to parse and pushes nothing either. The release job is green and
//      there is no tag and no CHANGELOG.md — the same false-green shape as a scaffold's base config
//      holding the lint gate, so it carries the same exit 2.
//   2. `scripts.version` / `scripts.release` that are not the standard's. release.yml passes those
//      two script NAMES to changesets/action as `version:` and `publish:`, so whatever sits there is
//      what a merge to the default branch executes. A repo whose `release` script is `npm publish`
//      or a deploy gets that command run by the workflow this script just installed, on a private
//      package, triggered by a PR merge. Blocking, and the loudest of the two.
//
// The baseBranch and the foreign-workflow cases are reported without an exit code: they stop a
// release from ever happening, which is visible the first time someone looks for a tag, rather than
// producing a green job that claims to have released.
const CHANGESET_CONFIG = join('.changeset', 'config.json');
const RELEASE_WORKFLOW = join('.github', 'workflows', 'release.yml');
const landed = (rel) => created.includes(rel) || skipped.includes(rel);
// ci.yml's `on: push: branches` — changesets diffs against baseBranch to find changed packages, so a
// baseBranch the CI workflow does not gate means the two disagree about what the default branch is.
const CI_DEFAULT_BRANCH = 'main';

const releaseGaps = [];
const releaseNotes = [];

if (skipped.includes(CHANGESET_CONFIG)) {
    const body = readTextFile(join(cwd, CHANGESET_CONFIG));
    let config = null;
    try { config = body === null ? null : JSON.parse(body); } catch { config = null; }
    if (config === null || config.privatePackages?.tag !== true) {
        const why = config === null
            ? `could not be read as JSON, so it cannot be shown to enable tagging`
            : `sets privatePackages.tag to ${JSON.stringify(config.privatePackages?.tag)}, not true`;
        releaseGaps.push([
            `${CHANGESET_CONFIG} already existed and was NOT replaced — this script does not overwrite`,
            `your files — but it ${why}.`,
            `This repo is a private package, and changesets SKIPS private packages when tagging unless`,
            `that key is true: \`changeset tag\` then prints nothing, creates no tag, and exits 0, so`,
            `the release job succeeds having produced no version tag and no CHANGELOG.md entry.`,
            `Add it, keeping the rest of your config:`,
            `      "privatePackages": { "version": true, "tag": true }`,
        ].join('\n    '));
    } else if (config.baseBranch !== CI_DEFAULT_BRANCH) {
        releaseNotes.push([
            `${CHANGESET_CONFIG} sets baseBranch to ${JSON.stringify(config.baseBranch)}, while`,
            `${join('.github', 'workflows', 'ci.yml')} and ${RELEASE_WORKFLOW} run on \`${CI_DEFAULT_BRANCH}\`. changesets diffs against`,
            `baseBranch to decide which packages changed, so set both to your real default branch.`,
        ].join('\n    '));
    }
}

// `scripts.version` and `scripts.release` only decide anything while a workflow passes them to
// changesets/action. A repo that kept its OWN release.yml runs neither, so reporting them there would
// name the wrong file and demand a change that fixes nothing — that repo gets the note below instead.
const workflowRunsChangesets = landed(RELEASE_WORKFLOW) && (readTextFile(join(cwd, RELEASE_WORKFLOW)) ?? '').includes('changesets/action');

if (workflowRunsChangesets) {
    for (const key of ['version', 'release']) {
        const mine = pkg.scripts?.[key];
        if (mine === fragment.scripts[key]) continue;
        releaseGaps.push([
            `package.json scripts.${key} is ${JSON.stringify(mine ?? null)}, not ${JSON.stringify(fragment.scripts[key])}.`,
            `${RELEASE_WORKFLOW} passes the script NAMES \`npm run version\` and \`npm run release\` to`,
            `changesets/action, so that command is what a merge to \`${CI_DEFAULT_BRANCH}\` executes. Yours runs`,
            `instead of changesets — and if it publishes or deploys, a merged "Version Packages" PR runs it.`,
            `Set it by hand, then re-run:`,
            `      npm pkg set scripts.${key}=${JSON.stringify(fragment.scripts[key])}`,
        ].join('\n    '));
    }
} else if (landed(RELEASE_WORKFLOW)) {
    releaseNotes.push([
        `${RELEASE_WORKFLOW} already existed and does not run \`changesets/action\` (or could not be`,
        `read). Nothing bumps the version or regenerates CHANGELOG.md, so the release row of the`,
        `standard's gate table is unenforced, and scripts.version / scripts.release were not checked`,
        `because your workflow does not call them. Compare yours against ${join(STARTER, RELEASE_WORKFLOW)}.`,
    ].join('\n    '));
}

// EVERY verified gate reports in ONE run and the script exits once. Discovering them serially — fix
// Tailwind, re-run, exit 2 again for a different reason, re-run — makes a first run feel like a fight
// and trains people to stop reading this output, which is the only place these failures are visible.
if (lintGaps.length || tsGaps.length || aliasGaps.length || styleGaps.length || releaseGaps.length) {
    console.log(`✗ SETUP INCOMPLETE — every file above landed, but a gate below is installed and NOT`);
    console.log(`  doing its job. These are grouped so one re-run can clear all of them:`);
    if (lintGaps.length) {
        console.log(`\n  the lint gate runs your base config, not the standard's — green, and unenforced:`);
        console.log(lintGaps.map((g) => `  ! ${g}`).join('\n'));
    }
    if (tsGaps.length) {
        console.log(`\n  the typecheck gate reads your tsconfig, and it is missing checking flags:`);
        console.log(tsGaps.map((g) => `  ! ${g}`).join('\n'));
    }
    if (aliasGaps.length) {
        console.log(`\n  the \`@/\` source alias resolves in some tools and not others:`);
        console.log(aliasGaps.map((g) => `  ! ${g}`).join('\n'));
    }
    if (styleGaps.length) {
        console.log(`\n  tailwindcss is installed but produces no CSS, so every utility class is inert:`);
        console.log(styleGaps.map((g) => `  ! ${g}`).join('\n'));
    }
    if (releaseGaps.length) {
        console.log(`\n  the release job would run and report success while producing no version bump, no`);
        console.log(`  CHANGELOG.md entry and no tag:`);
        console.log(releaseGaps.map((g) => `  ! ${g}`).join('\n'));
    }
    console.log(`\n  Make the change(s) above, then re-run this script. It exits 0 once they all hold.`);
    console.log(`  Nothing else here is affected — every file listed above was still ${dryRun ? 'reported' : 'written'}.\n`);
    console.log(dryRun ? `  Exit 0: a dry run wrote nothing, so there is nothing to fail.\n` : `  Exit code 2 (files landed, a gate is not enforcing) — distinct from 1, which means the run never started.\n`);
}

// Printed in the SAME run as the block above, and after it so the blocking items are read first.
// These two do not carry an exit code: they leave a repo that never releases, which is visible the
// first time someone looks for a tag — not a green job reporting a release that did not happen.
if (releaseNotes.length) {
    console.log(`ℹ the release setup is incomplete, but nothing reports a release it did not make:`);
    console.log(releaseNotes.map((g) => `  · ${g}`).join('\n'));
    console.log('');
}

// ── the CI structure gate reads a script that is not in this repo ────────────
// .github/workflows/ci.yml runs scripts/check-structure.mjs, and that script ships with the SKILL
// rather than with the consumer repo. The workflow resolves three locations — .claude/skills/, then
// $HOME/.claude/skills/, then $HOME/.agents/skills/ — and on a CI runner only the first can exist,
// because nothing installs anything into a runner's home directory. So the gate needs the skill
// VENDORED and committed.
//
// No exit code, unlike the blocks above. The failure here is a RED CI step with an error message
// naming this exact command, not a green one hiding an unenforced rule — the same distinction the
// release notes above are separated on. Reported after the report, so a repo run without
// --vendor-skills sees it whether or not anything else is wrong.
const CI_WORKFLOW = join('.github', 'workflows', 'ci.yml');
const VENDORED_STANDARD = join('.claude', 'skills', 'eq-frontend-standards');
if (landed(CI_WORKFLOW) && !existsSync(join(cwd, VENDORED_STANDARD))) {
    console.log(`ℹ ${CI_WORKFLOW}'s structure gate will FAIL until the standard is vendored:`);
    console.log(`  · that step runs scripts/check-structure.mjs, which ships with the skill and not with`);
    console.log(`    this repo. A CI runner has no $HOME install to fall back on, and the step fails`);
    console.log(`    rather than skipping — a skipped structure check reports green while enforcing`);
    console.log(`    nothing. Fix it by re-running this script with the flag, then committing the copy:`);
    // Absolute, not relative to cwd: a relative path out of the repo to a $HOME install is a wall of
    // `../` that nobody can copy with confidence.
    console.log(`          node ${import.meta.filename} --vendor-skills`);
    console.log(`          git add .claude/skills && git commit -m 'ci: vendor the standard'`);
    console.log('');
}

if (lintGaps.length || tsGaps.length || aliasGaps.length || styleGaps.length || releaseGaps.length) {
    // A --dry-run must not exit non-zero, or `node … --dry-run && node …` never reaches the real run.
    process.exit(dryRun ? 0 : 2);
}

// Deliberately narrow: the check proves one readable `.css` under the scanned root holds the import,
// not that the entry module imports THAT file. Claiming more is how a stray stylesheet passed for a
// pipeline that emitted nothing.
const bundlerNote = viteConfig ? `${viteConfig} imports and calls @tailwindcss/vite, and ` : '';
if (viteConfig) console.log(`✓ \`@/\` alias wired both halves: a tsconfig maps "@/*", and ${viteConfig} aliases "@" to src.`);
console.log(`✓ styling pipeline wired: ${bundlerNote}${relative(cwd, tailwindEntry)} imports Tailwind.`);
console.log(`  Scanned ${relative(cwd, scanRoot) || '.'}/ only — if that stylesheet is not the one your entry module imports, the utilities are still inert.\n`);
