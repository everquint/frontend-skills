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
// Usage, from the root of the new repo:
//   node <path>/init-greenfield.mjs [--dry-run]

import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync, statSync, chmodSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';

const STARTER = join(import.meta.dirname, '..', 'starter');
const cwd = process.cwd();
const dryRun = process.argv.includes('--dry-run');

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
        if (rel.startsWith('.husky/')) chmodSync(target, 0o755);
    }
    created.push(rel);
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
if (!gi.includes('.claude/skills')) {
    if (!dryRun) writeFileSync(giPath, gi.trimEnd() + '\n\n' + giFragment);
    created.push('.gitignore (appended)');
} else {
    skipped.push('.gitignore (already covers .claude/skills)');
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
console.log(`  npx husky init          # only if .husky/_ is missing; it wires core.hooksPath`);
console.log(`  npx eslint . --fix      # REQUIRED FIRST: a scaffold written 2-space/no-semicolon`);
console.log(`                          # produces ~130 formatting errors, all mechanically fixable`);
console.log(`  npx eslint . && npm run typecheck && npm run build`);
console.log(`  node <skill>/scripts/standard-check.mjs --record   # after the first commit\n`);
if (dryRun) console.log('Dry run — nothing was written.\n');
