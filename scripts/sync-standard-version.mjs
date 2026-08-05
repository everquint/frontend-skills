#!/usr/bin/env node
// Rewrites standard-check.mjs's STANDARD_VERSION to match package.json.
//
// WHY THIS EXISTS. validate-skills.mjs asserts the two agree, and `changeset version` bumps only
// package.json — so without this step the release job's own Version PR fails CI on a rule this repo
// enforces. The constant cannot simply read package.json at runtime: standard-check.mjs is invoked
// from an installed skill directory, by absolute path, against a *different* repo, so there is no
// package.json of ours beside it. Embedding the version is what makes it survive being copied out;
// syncing it at version time is the cost of that.
//
// Runs as part of `npm run version`, immediately after `changeset version`.
//
// Exit codes:
//   0  the constant already matched, or was rewritten to match
//   1  the constant could not be found, or the rewrite did not take — never silently pass, because
//      a no-op here surfaces later as a red release PR with a confusing error

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const TARGET = join(ROOT, 'skills', 'engineering', 'eq-frontend-standards', 'scripts', 'standard-check.mjs');
const PATTERN = /^(const STANDARD_VERSION = ')([^']+)(';)$/m;

const version = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).version;
const source = readFileSync(TARGET, 'utf8');
const found = source.match(PATTERN);

if (!found) {
    console.error(`sync-standard-version: no 'const STANDARD_VERSION = ...' line in ${TARGET}`);
    console.error('The constant was renamed or reformatted. Fix this script, or validate-skills.mjs will fail the release PR.');
    process.exit(1);
}

if (found[2] === version) {
    console.log(`sync-standard-version: STANDARD_VERSION already ${version}`);
} else {
    writeFileSync(TARGET, source.replace(PATTERN, `$1${version}$3`));

    // Read back rather than trusting the write: a regex that matched but substituted nothing would
    // otherwise report success and leave the release PR red.
    const after = readFileSync(TARGET, 'utf8').match(PATTERN);
    if (after?.[2] !== version) {
        console.error(`sync-standard-version: rewrite did not take — still '${after?.[2]}', wanted '${version}'`);
        process.exit(1);
    }

    console.log(`sync-standard-version: STANDARD_VERSION ${found[2]} -> ${version}`);
}

// The Claude Code plugin manifest carries its own version, and `changeset version` does not touch
// it either. Same contract as the constant above: validate-skills.mjs asserts the two agree, so a
// release that skipped this step fails CI rather than shipping a manifest claiming an old version.
const MANIFEST = join(ROOT, '.claude-plugin', 'plugin.json');
const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'));

if (manifest.version === version) {
    console.log(`sync-standard-version: plugin.json version already ${version}`);
} else {
    const before = manifest.version;
    manifest.version = version;
    // Rewritten through JSON.stringify, so key order follows the object — `version` keeps its
    // position because parsing preserves insertion order. Trailing newline matches the original.
    writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + '\n');
    console.log(`sync-standard-version: plugin.json version ${before} -> ${version}`);
}
