#!/usr/bin/env node
// Rewrites CHANGELOG.md into Keep a Changelog 1.1.0 form (https://keepachangelog.com/en/1.1.0/)
// after `changeset version` has prepended its raw output. Runs as the second half of
// `npm run version`, so the changelog STAYS a build output — never hand-edited — while conforming:
//
//   * preamble naming the format and SemVer
//   * `## [Unreleased]` with a compare link (the pending entries themselves live in .changeset/,
//     which is where an unreleased change exists under changesets)
//   * `## [X.Y.Z] - YYYY-MM-DD` headings, reverse-chronological; dates come from the version's
//     git tag when one exists (re-running never shifts history), else today
//   * change-type sections: changesets groups by SEMVER IMPACT (Major/Minor/Patch), Keep a
//     Changelog by CHANGE TYPE — mapped Major→Changed, Minor→Added, Patch→Fixed. The mapping
//     holds exactly as often as the changeset discipline does (breaking→major, feature→minor,
//     fix→patch); an entry that is really a removal or a security fix says so in its text.
//   * link references for every version at the bottom
//
// Idempotent by construction: the file is parsed and canonically rebuilt, never patched in place,
// so it does not matter whether changesets inserted above or below the preamble.
//
// Usage: node scripts/format-changelog.mjs   (from the repo root, after `changeset version`)

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const cwd = process.cwd();
const path = join(cwd, 'CHANGELOG.md');
if (!existsSync(path)) {
    console.error('format-changelog: no CHANGELOG.md here — run from the repo root, after `changeset version`.');
    process.exit(1);
}

const git = (...args) => {
    try {
        return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
    } catch {
        return '';
    }
};

// Compare links need the GitHub URL; derive it from the remote so the same script serves any
// repo. No parseable remote (a fresh init) → the doc is still valid KaC, just without links.
const remote = git('remote', 'get-url', 'origin');
const m = remote.match(/github\.com[:/]([^/]+\/[^/.]+?)(\.git)?$/);
const repoUrl = m ? `https://github.com/${m[1]}` : null;

const tagDate = (version) => {
    for (const tag of [`v${version}`, version]) {
        const d = git('log', '-1', '--format=%as', tag, '--');
        if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
    }
    return null;
};

const SECTION_MAP = { 'Major Changes': 'Changed', 'Minor Changes': 'Added', 'Patch Changes': 'Fixed' };
// Both changesets' raw section names and this script's own output must parse, or a re-run mangles
// the file. Anything else under a version (KaC's other categories, hand text) passes through.
const KNOWN_SECTIONS = new Set([...Object.keys(SECTION_MAP), ...Object.values(SECTION_MAP), 'Deprecated', 'Removed', 'Security']);

const lines = readFileSync(path, 'utf8').split('\n');

let title = null;
const versions = [];   // { version, date, body: string[] }
let current = null;

for (const line of lines) {
    const h1 = line.match(/^# (.+)$/);
    if (h1 && title === null) { title = h1[1]; continue; }

    const vh = line.match(/^## \[?(\d+\.\d+\.\d+)\]?(?: - (\d{4}-\d{2}-\d{2}))?\s*$/);
    if (vh) {
        current = { version: vh[1], date: vh[2] ?? null, body: [] };
        versions.push(current);
        continue;
    }
    if (line.match(/^## \[?Unreleased/i)) { current = null; continue; }   // regenerated below
    if (line.startsWith('[') && /^\[[^\]]+\]:\s*http/.test(line)) continue;   // link refs — regenerated
    if (current === null) continue;   // preamble text and anything above the first version — regenerated

    const sh = line.match(/^### (.+)$/);
    if (sh && KNOWN_SECTIONS.has(sh[1].trim())) {
        current.body.push(`### ${SECTION_MAP[sh[1].trim()] ?? sh[1].trim()}`);
        continue;
    }
    current.body.push(line);
}

if (versions.length === 0) {
    console.error('format-changelog: no `## <version>` headings found — nothing to format.');
    process.exit(1);
}

const cmpVersion = (a, b) => {
    const pa = a.split('.').map(Number);
    const pb = b.split('.').map(Number);
    for (let i = 0; i < 3; i++) if (pa[i] !== pb[i]) return pb[i] - pa[i];
    return 0;
};
versions.sort((a, b) => cmpVersion(a.version, b.version));

const today = new Date().toISOString().slice(0, 10);
for (const v of versions) v.date = tagDate(v.version) ?? v.date ?? today;

const trimBlank = (body) => {
    const out = [...body];
    while (out.length && out[0].trim() === '') out.shift();
    while (out.length && out[out.length - 1].trim() === '') out.pop();
    return out;
};

const out = [];
out.push(`# ${title ?? 'Changelog'}`, '');
out.push('All notable changes to this project are documented in this file.', '');
out.push('The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),');
out.push('and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).');
out.push('This file is generated by the release pipeline — do not edit it by hand; pending');
out.push('(unreleased) entries live as changeset files in `.changeset/`.', '');
out.push('## [Unreleased]', '');
for (const v of versions) {
    out.push(`## [${v.version}] - ${v.date}`, '');
    out.push(...trimBlank(v.body), '');
}

if (repoUrl) {
    out.push(`[Unreleased]: ${repoUrl}/compare/v${versions[0].version}...HEAD`);
    for (let i = 0; i < versions.length; i++) {
        const v = versions[i].version;
        const prev = versions[i + 1]?.version;
        out.push(prev
            ? `[${v}]: ${repoUrl}/compare/v${prev}...v${v}`
            : `[${v}]: ${repoUrl}/releases/tag/v${v}`);
    }
    out.push('');
}

writeFileSync(path, out.join('\n'));
console.log(`format-changelog: ${versions.length} version(s) formatted, dates from git tags${repoUrl ? ', links against ' + repoUrl : ', no remote — links skipped'}.`);
