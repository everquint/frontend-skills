#!/usr/bin/env node
// Records which version of the standard a repo was migrated to, and detects when it falls behind.
//
// The problem this solves: `npx skills update` refreshes the skill TEXT, but nothing updates a
// repo's eslint config, hooks, or CI. So a repo silently stops complying the moment the standard
// moves. A version marker nobody reads is a comment, so `--check` exits non-zero for CI.
//
// The design is copier's (https://copier.readthedocs.io/en/stable/updating/), reduced to what a
// JS repo needs — there is no mature JS equivalent, so the pattern is borrowed rather than the tool:
//   * store the ANSWERS alongside the version, so an update can re-derive the intended state
//   * named migrations between versions, so "what changed" is a step and not a changelog to read
//   * refuse to write on a dirty worktree, or the diff cannot separate the user's edits from ours
//
// Usage, from the root of the repo being migrated:
//   node <path>/standard-check.mjs --check     # CI gate: exit 1 if behind or unmigrated
//   node <path>/standard-check.mjs --record    # after a migration: write the marker
//   node <path>/standard-check.mjs             # human-readable status

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';

const MARKER = '.eq-frontend-skills.json';
const cwd = process.cwd();
const has = (f) => process.argv.includes(f);

// Version of the standard this script ships with, read from the skills repo's own package.json.
const standardVersion = (() => {
    let dir = import.meta.dirname;
    for (let i = 0; i < 6; i++) {
        const p = join(dir, 'package.json');
        if (existsSync(p)) {
            try {
                const pkg = JSON.parse(readFileSync(p, 'utf8'));
                if (pkg.name === 'eq-frontend-skills') return pkg.version;
            } catch { /* keep walking */ }
        }
        dir = dirname(dir);
    }
    return '0.0.0';
})();

// Each entry names what a consumer must DO to move between versions. A version bump that changes
// enforcement without an entry here is a bug — the consumer has no way to know what to change.
const MIGRATIONS = {
    '0.1.0': [
        'Enable every react-hooks rule that measures zero violations, at `error`.',
        'Baseline the rest: `npx eslint . --fix && npx eslint . --suppress-all`.',
        'Wire pre-commit (lint-staged), commit-msg (commitlint), pre-push (typecheck --force).',
        'Mirror every hook in CI. A repo with hooks and no CI has no gate.',
        'Pin node consistently: .nvmrc + engines + packageManager + CI node-version-file.',
        'Add .editorconfig matching the lint config indent and quote style.',
        'Set vitest coverage thresholds with autoUpdate: true to lock in the current floor.',
    ],
};

const cmp = (a, b) => {
    const pa = String(a).split('.').map(Number);
    const pb = String(b).split('.').map(Number);
    for (let i = 0; i < 3; i++) {
        if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) < (pb[i] ?? 0) ? -1 : 1;
    }
    return 0;
};

const markerPath = join(cwd, MARKER);
const recorded = existsSync(markerPath)
    ? (() => { try { return JSON.parse(readFileSync(markerPath, 'utf8')); } catch { return null; } })()
    : null;

const isDirty = () => {
    try {
        return execFileSync('git', ['status', '--porcelain'], { cwd, encoding: 'utf8' }).trim().length > 0;
    } catch {
        return false; // not a git repo — nothing to protect
    }
};

// ── --record ────────────────────────────────────────────────────────────────
if (has('--record')) {
    if (isDirty() && !has('--allow-dirty')) {
        console.error(`Refusing to write ${MARKER} with a dirty worktree.`);
        console.error('Commit the migration first, so the marker records a state that actually exists.');
        console.error('Override with --allow-dirty if you know what you are doing.');
        process.exit(1);
    }
    const answers = {
        standardVersion,
        recordedAt: new Date().toISOString().slice(0, 10),
        // Answers, not just the version — an update can re-derive the intended state from these.
        answers: {
            fileLineLimit: 500,
            complexity: 15,
            maxDepth: 4,
            formatter: 'none — @stylistic ESLint rules',
            mergeStrategy: 'merge-commit',
            suppressionsBaseline: existsSync(join(cwd, 'eslint-suppressions.json')),
        },
    };
    writeFileSync(markerPath, JSON.stringify(answers, null, 4) + '\n');
    console.log(`Recorded standard v${standardVersion} in ${MARKER}`);
    console.log('Commit it. Never hand-edit it — a wrong marker is worse than none.');
    process.exit(0);
}

// ── status / --check ────────────────────────────────────────────────────────
const behind = recorded && cmp(recorded.standardVersion, standardVersion) < 0;
const ahead = recorded && cmp(recorded.standardVersion, standardVersion) > 0;

if (!recorded) {
    console.error(`\n✗ This repo has never been migrated to the frontend standard.`);
    console.error(`  No ${MARKER} found.\n`);
    console.error(`  Run the migration (see the frontend-standards skill), then:`);
    console.error(`    node <path>/standard-check.mjs --record\n`);
    process.exit(has('--check') ? 1 : 0);
}

if (ahead) {
    console.log(`\n⚠ This repo records v${recorded.standardVersion}; the installed standard is v${standardVersion}.`);
    console.log(`  The installed skill is OLDER than the repo. Run \`npx skills update\`.\n`);
    process.exit(has('--check') ? 1 : 0);
}

if (!behind) {
    console.log(`\n✓ Up to date with the frontend standard — v${standardVersion}`);
    console.log(`  Migrated ${recorded.recordedAt}.\n`);
    process.exit(0);
}

// Behind: list every migration step between the recorded version and this one.
const steps = Object.entries(MIGRATIONS)
    .filter(([v]) => cmp(v, recorded.standardVersion) > 0 && cmp(v, standardVersion) <= 0)
    .sort(([a], [b]) => cmp(a, b));

console.error(`\n✗ Behind the frontend standard.`);
console.error(`  repo: v${recorded.standardVersion}   standard: v${standardVersion}   (migrated ${recorded.recordedAt})\n`);

if (steps.length) {
    for (const [version, actions] of steps) {
        console.error(`  → v${version}`);
        for (const a of actions) console.error(`      - ${a}`);
    }
} else {
    console.error(`  No migration steps recorded between these versions — the change was text-only.`);
    console.error(`  Re-record after review: --record`);
}

console.error(`\n  Measure the delta first:  node <path>/measure-rules.mjs\n`);
process.exit(has('--check') ? 1 : 0);
