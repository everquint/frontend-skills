#!/usr/bin/env node
// Records which version of the standard a repo was migrated to, and detects when it falls behind.
//
// The problem this solves: `npx skills update` refreshes the skill TEXT, but nothing updates a
// repo's lint config, hooks, or CI. So a repo silently stops complying the moment the standard
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
import { join } from 'node:path';

const MARKER = '.eq-frontend-skills.json';
const cwd = process.cwd();
const has = (f) => process.argv.includes(f);

// Version of the standard this script ships with.
//
// Embedded as a constant rather than read from package.json, because `npx skills add` installs the
// SKILL DIRECTORY without the repo manifest — so an upward walk finds nothing and any fallback
// default makes the drift gate permanently green in the primary install path. That is the one
// failure this script exists to prevent, so it must not be possible.
//
// `npm run validate` asserts this equals the repo's package.json version, so the two cannot drift.
const STANDARD_VERSION = '1.0.0';
const standardVersion = STANDARD_VERSION;

// Each entry names what a consumer must DO to move between versions. A version bump that changes
// enforcement without an entry here is a bug — the consumer has no way to know what to change.
// The 1.0.0 lint step BRANCHES on how much debt the repo has, because oxlint has no suppressions
// mechanism yet (oxc-project/oxc#10549). Measure with scripts/measure-rules.mjs first, then take
// exactly one branch — they are alternatives, not steps:
//   * at or under ~300 violations: adopt oxlint now and clear the violations in one AI-assisted pass.
//     There is nothing to baseline, so nothing gets permanently grandfathered in.
//   * above ~300: STAY on ESLint with a suppressions baseline until #10549 lands. This is the
//     deliberate fallback, not a legacy path — a repo that adopts oxlint with 2,000 violations has to
//     turn rules off to get green, and a rule turned off to get green never comes back on.
const MIGRATIONS = {
    '1.0.0': [
        'Enable every react-hooks rule that measures zero violations, at `error`.',
        'Then ONE of: (a) ≤ ~300 violations — move to oxlint + oxfmt and fix them in one pass;',
        '  (b) > ~300 — stay on ESLint and baseline: `npx eslint . --fix && npx eslint . --suppress-all`.',
        'Wire pre-commit (lint-staged), commit-msg (commitlint), pre-push (typecheck --force).',
        'Mirror every hook in CI. A repo with hooks and no CI has no gate.',
        'Pin node consistently: .nvmrc + engines + packageManager + CI node-version-file.',
        'Add .editorconfig matching the lint config indent and quote style.',
        'Set vitest coverage thresholds with autoUpdate: true to lock in the current floor.',
    ],
};

// Compares MAJOR.MINOR.PATCH, ignoring any prerelease tail. A naive `Number` on each dot-segment
// turns `1-beta.0` into NaN, and because NaN fails every comparison the mismatch branch is taken
// and the result is always "ahead" — so a prerelease install reports the repo as newer than the
// standard and tells the user to run the update that just landed. `??` does not catch NaN.
const parseVersion = (v) => {
    const core = String(v ?? '').trim().split(/[-+]/)[0];
    const parts = core.split('.').map((s) => Number.parseInt(s, 10));
    if (parts.length !== 3 || parts.some((n) => !Number.isInteger(n) || n < 0)) return null;
    return parts;
};

const cmp = (a, b) => {
    const pa = parseVersion(a);
    const pb = parseVersion(b);
    if (!pa || !pb) {
        console.error(`Cannot compare versions: ${JSON.stringify(a)} vs ${JSON.stringify(b)}.`);
        console.error(`Expected MAJOR.MINOR.PATCH. A malformed marker is a bug, not a direction.`);
        process.exit(1);
    }
    for (let i = 0; i < 3; i++) {
        if (pa[i] !== pb[i]) return pa[i] < pb[i] ? -1 : 1;
    }
    return 0;
};

const markerPath = join(cwd, MARKER);
const markerExists = existsSync(markerPath);

// "Absent" and "present but unparseable" must not collapse to the same state: reporting a corrupt
// marker as missing tells the user to --record, which overwrites the evidence of what went wrong.
// A truncated marker is a normal outcome of a bad merge resolution.
let recorded = null;
if (markerExists) {
    try {
        const parsed = JSON.parse(readFileSync(markerPath, 'utf8'));
        if (!parsed || typeof parsed !== 'object') throw new Error('not an object');
        recorded = parsed;
    } catch (err) {
        console.error(`\n✗ ${MARKER} exists but could not be parsed: ${err.message}`);
        console.error(`  Fix or delete it by hand. --record will not overwrite a corrupt marker.\n`);
        process.exit(1);
    }
}

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
            formatter: 'oxfmt',
            mergeStrategy: 'merge-commit',
            // Which branch of the 1.0.0 lint step this repo took. True means it is on the ESLint +
            // suppressions fallback and is WAITING for oxc-project/oxc#10549 — so an update must not
            // assume an .oxlintrc*.json is what governs it.
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
