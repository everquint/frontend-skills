#!/usr/bin/env node
// Measures the graduation backlog of a prototype BEFORE anyone commits to graduating it, and says
// which of the two paths applies: one sitting, or the existing-repo measure-and-ratchet path.
//
// WHY this exists: graduation is a single ordered procedure that must not be half-done (references/
// graduation.md), and the only honest input to "can we finish it today" is a count. Without one the
// decision is made on a feeling, the PR is opened, the type-aware lint pass reports four hundred
// findings, and the repo sits half-graduated — production traffic against prototype gates — which is
// the exact state the mode is designed to prevent.
//
// READ-ONLY. It writes nothing, installs nothing, and changes no file in the repo. Every number
// comes from the standards skill's own scripts (measure-rules.mjs, check-structure.mjs) rather than
// from a second implementation here: this script sequences and judges, it does not measure.
//
// Usage, from the root of the prototype repo:
//   node <path>/graduate-check.mjs [--standard <dir>] [--dir src] [--json]
//
//   --standard   the installed eq-frontend-standards skill directory. Resolved automatically from
//                the sibling install, a vendored .claude/skills/*frontend-standards copy (any
//                project prefix), or $EQ_STANDARD.
//   --dir        source root to measure (default src)
//   --json       machine-readable, including {"error": …} on failure
//
// Exit codes — a wrapper has to tell "go" from "stop" from "the measurement is not trustworthy":
//   0  measured, and the backlog fits one sitting.
//   1  measured, and it does not: take the measure-and-ratchet path, or shrink the prototype first.
//   2  the measurement could not be trusted, or this repo is not in prototype mode. No verdict.

import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync, statSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const cwd = process.cwd();
const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const flag = (name, fallback) => {
    const i = argv.indexOf(`--${name}`);
    const value = i === -1 ? undefined : argv[i + 1];
    return value && !value.startsWith('--') ? value : fallback;
};
const json = has('--json');
const dir = flag('dir', 'src');

// A failure must not read as a clean run, in either mode — same contract as the standards scripts.
const bail = (message, detail) => {
    if (json) console.log(JSON.stringify({ error: message, detail }, null, 2));
    else {
        console.error(`\n✗ ${message}`);
        if (detail) console.error(`  ${detail}`);
        console.error('');
    }
    process.exit(2);
};

if (has('--help') || has('-h')) {
    console.log(readFileSync(new URL(import.meta.url), 'utf8').split('\n').slice(1, 26).join('\n').replace(/^\/\/ ?/gm, ''));
    process.exit(0);
}

// ── this must be a prototype ────────────────────────────────────────────────
// The judgement below is calibrated on a prototype: small, young, and written without the
// conventions. Running it on a mature unmigrated repo would answer a question it was not asked, and
// that repo already has its own path (eq-frontend-standards SKILL.md §1).
let pkg;
try {
    pkg = JSON.parse(readFileSync(join(cwd, 'package.json'), 'utf8'));
} catch (err) {
    bail('No readable package.json here.', `Run this from the root of the prototype repo. (${err.message})`);
}
const marker = pkg.eqPrototype;
if (!marker || typeof marker !== 'object') {
    bail('This repo carries no `eqPrototype` marker, so it is not in prototype mode.',
        'An unmigrated repo takes the measure-and-ratchet path in eq-frontend-standards SKILL.md §1 — measure it with that skill\'s measure-rules.mjs directly.');
}

// ── locate the standards skill ──────────────────────────────────────────────
// Four candidates because the same skill lives in four places depending on how it was installed,
// and a script that only knows one of them fails on every other install.
// A repo's vendored copy is named for the project that owns it — eq-<project>-frontend-standards —
// so the in-repo candidate is matched by shape, not by an exact name.
const vendored = (() => {
    const root = join(cwd, '.claude', 'skills');
    if (!existsSync(root)) return [];
    try { return readdirSync(root).filter((d) => d.endsWith('frontend-standards')).map((d) => join(root, d)); } catch { return []; }
})();
const candidates = [
    flag('standard'),
    process.env.EQ_STANDARD,
    join(import.meta.dirname, '..', '..', 'eq-frontend-standards'),          // flat sibling install
    ...vendored,                                                             // vendored in the repo
].filter(Boolean);
const standard = candidates.find((d) => existsSync(join(d, 'scripts', 'measure-rules.mjs')));
if (!standard) {
    bail('Could not find the eq-frontend-standards skill.',
        `Looked in: ${candidates.join(', ')}. Pass --standard <dir>, or set $EQ_STANDARD.`);
}

const sourceRoot = join(cwd, dir);
if (!existsSync(sourceRoot) || !statSync(sourceRoot).isDirectory()) {
    bail(`No ${dir}/ directory here.`, 'Pass --dir <source root> if this repo keeps its source elsewhere.');
}

// ── the measurements ────────────────────────────────────────────────────────
// Every `run` captures instead of inheriting stdio: a delegated script's own report would bury the
// verdict, and the counts are what this script is for. Exit codes are DATA here — measure-rules.mjs
// exits 1 on "violations found", which is a normal outcome, not a failure.
const run = (cmd, args) => {
    try {
        return { code: 0, out: execFileSync(cmd, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024 }) };
    } catch (err) {
        // A missing binary or a killed process has no exit code — that is not a measurement.
        return { code: err.status ?? null, out: `${err.stdout ?? ''}${err.stderr ?? ''}`, failed: err.status === undefined || err.status === null };
    }
};
// The delegated scripts print a banner around their JSON in some modes, so the object is extracted
// rather than parsed off the whole stream.
const lastJsonObject = (text) => {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start === -1 || end <= start) return null;
    try { return JSON.parse(text.slice(start, end + 1)); } catch { return null; }
};

// 1. Size. `git ls-files` and not a walk: an untracked scratch directory is not the repo's size, and
// a prototype accumulates those.
const SOURCE_EXT = /\.(ts|tsx|js|jsx|mts|cts)$/;
const TEST_FILE = /\.(test|spec)\.[a-z]+$/;
const tracked = run('git', ['ls-files', '--', dir]);
const sourceFiles = tracked.code === 0
    ? tracked.out.split('\n').filter((f) => f && SOURCE_EXT.test(f))
    : null;
const testFiles = sourceFiles?.filter((f) => TEST_FILE.test(f)) ?? null;
const codeFiles = sourceFiles?.filter((f) => !TEST_FILE.test(f)) ?? null;
const lines = codeFiles?.reduce((n, f) => {
    try { return n + readFileSync(join(cwd, f), 'utf8').split('\n').length; } catch { return n; }
}, 0) ?? null;

// 2. Typecheck. It is one of the two gates prototype mode keeps, so a red typecheck is not a
// graduation cost — it is a prototype whose answers were never checked, and it is fixed first.
const typecheck = pkg.scripts?.typecheck ? run('npm', ['run', '--silent', 'typecheck']) : null;

// 3. The lint backlog, measured against the FULL standard (strict config, type-aware where the
// tooling allows). This is the number that decides the verdict.
//
// The measurement needs three dev dependencies in one node_modules, and prototype mode installs
// only one of them (oxlint) — by design, since the type-aware pass is the gate it drops. So the
// FIRST run of this script in a prototype legitimately cannot measure, and the fix is one npm
// command. Printing that command is the whole job here; a stack of the delegated script's own
// diagnostics is not an answer.
const TOOLING = 'oxlint@^1.77.0 oxlint-tsgolint@^7.0.2001 eslint-plugin-react-hooks@^7.1.1';
const lint = run('node', [join(standard, 'scripts', 'measure-rules.mjs'), '--dir', dir, '--json']);
const lintData = lastJsonObject(lint.out);
if (!lintData || lintData.error || typeof lintData.total !== 'number') {
    const missingTooling = /could not find oxlint/i.test(lintData?.error ?? lint.out);
    bail(
        missingTooling
            ? 'The lint tooling is not installed here, so the backlog cannot be measured yet.'
            : 'The lint measurement failed, so there is no backlog figure to judge.',
        missingTooling
            ? `Prototype mode installs oxlint only — the type-aware pass is one of the gates it drops. Install the rest and re-run:\n\n    npm i -D ${TOOLING}\n\n  These are dev dependencies the repo needs at graduation anyway.`
            : `${lintData?.error ?? ''} ${lintData?.detail ?? ''}`.trim() || `Run it directly for the full report: node ${join(standard, 'scripts', 'measure-rules.mjs')} --dir ${dir}`,
    );
}

// 4. Structure and naming — never enforced in prototype mode, so this list is always non-empty on a
// scaffold (App.tsx alone does it).
const structure = run('node', [join(standard, 'scripts', 'check-structure.mjs'), '--dir', dir, '--json']);
const structureData = lastJsonObject(structure.out);

// ── the verdict ─────────────────────────────────────────────────────────────
// The lint threshold is the STANDARD's own (measure-rules.mjs THRESHOLD, ADR 0002), read out of its
// JSON rather than copied — a second copy of that number would drift against the decision it
// encodes. The other two are this script's, and they are deliberately generous: they exist to catch
// "this is not a prototype any more", not to grade the code.
const LINE_BUDGET = 8000;        // a prototype a reviewer can still read end-to-end in one PR
const STRUCTURE_BUDGET = 40;     // mechanical renames; past this the layout is a project, not a spike

const blockers = [];
const costs = [];

if (typecheck === null) blockers.push('There is no `typecheck` script. Prototype mode installs one — a repo without it has been running with no type gate at all, and its answers are unverified.');
else if (typecheck.code !== 0) blockers.push('`npm run typecheck` FAILS. That is a kept gate that regressed, not a graduation cost. Fix it before deciding anything.');

if (lintData.typeAwareMeasured === false) {
    costs.push(`The type-aware rules were NOT measured (${lintData.syntaxOnlyReason ?? 'tooling unavailable'}), so the real backlog is HIGHER than ${lintData.total}. Install the standard's lint tooling and re-run before trusting the verdict.`);
}
if (lintData.total > lintData.threshold) {
    costs.push(`${lintData.total} lint violation(s) against the full standard — over the ${lintData.threshold} threshold that separates "clear it in one pass" from "ratchet it down" (eq-frontend-standards SKILL.md §1).`);
}
if (lines !== null && lines > LINE_BUDGET) {
    costs.push(`${lines} lines of non-test code across ${codeFiles.length} file(s). Past ~${LINE_BUDGET} the graduation PR is too large to review honestly in one sitting.`);
}
if (structureData && structureData.total > STRUCTURE_BUDGET) {
    costs.push(`${structureData.total} structure/naming violation(s) — mechanical, but past ~${STRUCTURE_BUDGET} they are their own PR.`);
}
if (testFiles !== null && testFiles.length === 0 && codeFiles.length > 0) {
    costs.push(`No test files at all. Diff coverage at 90% applies to every change AFTER graduation, so the tests for the logic the product now depends on are written during it (graduation.md §4).`);
}

const verdict = blockers.length ? 'blocked' : costs.length ? 'ratchet' : 'one-sitting';

if (json) {
    console.log(JSON.stringify({
        checkedAt: new Date().toISOString().slice(0, 10),
        prototype: { question: marker.question ?? null, expires: marker.expires ?? null },
        size: { codeFiles: codeFiles?.length ?? null, testFiles: testFiles?.length ?? null, lines },
        typecheck: typecheck === null ? 'absent' : typecheck.code === 0 ? 'pass' : 'fail',
        lint: { total: lintData.total, threshold: lintData.threshold, branch: lintData.branch, typeAwareMeasured: lintData.typeAwareMeasured !== false },
        structure: structureData ? { total: structureData.total } : null,
        verdict, blockers, costs,
    }, null, 2));
    process.exit(verdict === 'one-sitting' ? 0 : verdict === 'blocked' ? 2 : 1);
}

// The same expiry-format rule the hook and standard-check.mjs apply: an unusable date means nothing
// can say whether this repo is overdue, and it is reported here rather than printed as if fine.
const expiryUnusable = typeof marker.expires !== 'string'
    || !/^\d{4}-\d{2}-\d{2}$/.test(marker.expires)
    || Number.isNaN(Date.parse(marker.expires));

const row = (label, value) => console.log(`  ${label.padEnd(22)}${value}`);
console.log(`\nGRADUATION BACKLOG — ${marker.question ?? '(no question recorded)'}`);
console.log(`  expires ${marker.expires ?? '(none)'}${expiryUnusable ? '  ← UNUSABLE: must be a "YYYY-MM-DD" string, so nothing can tell whether this repo is overdue' : ''}\n`);
row('code', codeFiles === null ? 'not measured (no git index here)' : `${codeFiles.length} file(s), ${lines} line(s)`);
row('tests', testFiles === null ? 'not measured' : `${testFiles.length} file(s)`);
row('typecheck', typecheck === null ? 'NO SCRIPT' : typecheck.code === 0 ? 'pass' : 'FAIL');
row('lint vs standard', `${lintData.total} violation(s), threshold ${lintData.threshold}${lintData.typeAwareMeasured === false ? ' (type-aware NOT measured — this is a floor)' : ''}`);
row('structure', structureData ? `${structureData.total} violation(s)` : 'not measured');

if (blockers.length) {
    console.log(`\nFIX FIRST — these are not graduation costs:`);
    for (const b of blockers) console.log(`  ✗ ${b}`);
}
if (costs.length) {
    console.log(`\nWHAT MAKES IT MORE THAN ONE SITTING:`);
    for (const c of costs) console.log(`  • ${c}`);
}

console.log('');
if (verdict === 'one-sitting') {
    console.log(`✓ ONE SITTING. Nothing here exceeds a single reviewed PR.`);
    console.log(`  Run the procedure in order and do not stop halfway: eq-frontend-prototype references/graduation.md\n`);
} else if (verdict === 'ratchet') {
    console.log(`⚠ NOT ONE SITTING. Two honest options:`);
    console.log(`    1. Shrink first — delete what was scaffolding for the ANSWER rather than the answer (graduation.md §0), then re-run this.`);
    console.log(`    2. Graduate on the existing-repo path — measure and ratchet, eq-frontend-standards SKILL.md §1 — and say so in the PR.`);
    console.log(`  Either way the procedure is graduation.md. What changes is how many PRs it takes, never whether it finishes.\n`);
} else {
    console.log(`✗ NO VERDICT until the blockers above are fixed. A backlog measured against a broken gate means nothing.\n`);
}
console.log(`  Full lint report:      node ${join(standard, 'scripts', 'measure-rules.mjs')} --dir ${dir}`);
console.log(`  Full structure report: node ${join(standard, 'scripts', 'check-structure.mjs')} --dir ${dir}\n`);

process.exit(verdict === 'one-sitting' ? 0 : verdict === 'blocked' ? 2 : 1);
