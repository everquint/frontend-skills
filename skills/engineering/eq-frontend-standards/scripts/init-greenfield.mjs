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
// script with a different value is left alone and printed for you to resolve.
//
// .claude/ is treated as COMMITTED repo policy, not per-developer config, so the starter tree
// carries the hooks, reviewer agents and commands and this script lands them in the repo. With
// --vendor-skills the skill directories are copied in as REAL FILES rather than left as the
// symlink `npx skills add` makes: git stores a symlink as its target path, so a committed symlink
// hands every teammate a broken link into one machine's home directory.
//
// Usage, from the root of the new repo:
//   node <path>/init-greenfield.mjs [--dry-run] [--vendor-skills]

import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync, statSync, chmodSync, cpSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';

const STARTER = join(import.meta.dirname, '..', 'starter');
// scripts/ -> eq-frontend-standards/ -> engineering/, the directory holding every skill in the set.
const SKILLS_SRC = join(import.meta.dirname, '..', '..');
const VENDORED_SKILLS = ['eq-frontend-standards', 'eq-frontend-workflow', 'eq-frontend-quality-bar'];
const cwd = process.cwd();
const dryRun = process.argv.includes('--dry-run');
const vendorSkills = process.argv.includes('--vendor-skills');

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
        if (existsSync(target)) { skipped.push(rel); continue; }
        // dereference: the source may itself be a symlinked install; the copy must be real files.
        if (!dryRun) cpSync(join(SKILLS_SRC, name), target, { recursive: true, dereference: true });
        created.push(`${rel}/ (vendored)`);
    }
}

// ── package.json merge ──────────────────────────────────────────────────────
const pkgPath = join(cwd, 'package.json');
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
const fragment = JSON.parse(readFileSync(join(STARTER, 'package.fragment.json'), 'utf8'));

const mergeSection = (key) => {
    if (!fragment[key]) return;
    if (typeof fragment[key] !== 'object') {
        if (key in pkg && pkg[key] !== fragment[key]) conflicts.push(`package.json ${key}: yours ${JSON.stringify(pkg[key])}, standard ${JSON.stringify(fragment[key])}`);
        else pkg[key] = fragment[key];
        return;
    }
    pkg[key] ??= {};
    for (const [k, v] of Object.entries(fragment[key])) {
        if (k in pkg[key] && pkg[key][k] !== v) {
            // Never silently replace a script or dependency the repo already chose.
            conflicts.push(`package.json ${key}.${k}: yours ${JSON.stringify(pkg[key][k])}, standard ${JSON.stringify(v)}`);
        } else {
            pkg[key][k] = v;
        }
    }
};

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

if (conflicts.length) {
    console.log(`\n⚠ resolve by hand — your value was kept:`);
    console.log(conflicts.map((c) => `  ! ${c}`).join('\n'));
}

console.log(`\nNext:`);
console.log(`  npm install`);
if (!vendorSkills) {
    console.log(`  node <skill>/scripts/init-greenfield.mjs --vendor-skills`);
    console.log(`                          # copies the skills into .claude/skills as REAL files, so a`);
    console.log(`                          # clone inherits the exact standard. Commit .claude/ — it is`);
    console.log(`                          # repo policy, not personal config.`);
}
console.log(`  npx husky init          # only if .husky/_ is missing; it wires core.hooksPath`);
console.log(`  npx eslint . --fix      # REQUIRED FIRST: a scaffold written 2-space/no-semicolon`);
console.log(`                          # produces ~130 formatting errors, all mechanically fixable`);
console.log(`  npx eslint . && npm run typecheck && npm run build`);
console.log(`  git add .claude && git commit                      # commit the shared agent config`);
console.log(`  node <skill>/scripts/standard-check.mjs --record   # writes .eq-frontend-skills.json,`);
console.log(`                          # the version CI reads via --check. Run after the first commit.\n`);
if (dryRun) console.log('Dry run — nothing was written.\n');
