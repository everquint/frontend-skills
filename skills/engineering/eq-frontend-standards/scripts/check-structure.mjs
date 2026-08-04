#!/usr/bin/env node
// Reports violations of the MECHANICAL half of references/structure.md. Read-only.
//
// Structure rules have no runtime failure scenario, which is why correctness-rules.md excludes
// them — so nothing in a normal lint setup catches them and they drift silently. This script
// closes exactly the subset a filesystem walk can decide:
//
//   1  kebab-case filenames and directory names
//   2  a hooks/ folder contains only hooks
//   3  a component folder has an index.ts barrel
//   4  no __tests__/ directories, no .spec.* test files
//   5  a top-level style class selector is declared in exactly one file
//
// Exit codes:
//   0  the scan completed and found no violations
//   1  the scan completed and found violations
//   2  the scan could NOT be trusted — bad argument, unreadable directory, or zero source files
//      examined. Never report "clean" for a run that did not look at anything: a pass/fail gate
//      whose failure modes are indistinguishable from success is worse than no gate.
//
// What it deliberately does NOT check, because a filesystem walk cannot decide it:
//   * placement — "one consumer or two" needs an import graph, not a directory listing
//   * whether an HTTP call sits inline in a component
//   * whether a helper belongs in utils/ or beside its caller
//   * file size and complexity — oxlint's max-lines and complexity own those (SKILL.md §1)
// Those stay reviewer-enforced. A script that guessed at them would produce noise, and a noisy
// structure gate is the kind that gets deleted.
//
// Rule 5 is LINE-ANCHORED on /^\.[a-zA-Z_-]/ and BRACE-DEPTH-GATED — it sees a selector only at
// column 0 outside every block. A duplicated indented selector and a second class after a comma
// are invisible to it; a selector nested inside `@media`/`@layer` is skipped even when written
// unindented, because at depth > 0 it is not a top-level declaration. `/* … */` spans are stripped
// before scanning, so a commented-out declaration is not an owner. The one residual inaccuracy is
// a literal `/*` or a brace inside a quoted value, which shifts the parser's idea of comment and
// depth state for the rest of the file.
//
// It also requires the class to be the WHOLE selector (`.foo {` or `.foo,`), not merely its first
// compound. `.dark .toast` and `.dark .error-block` are two different rules that happen to share a
// theme ancestor, so counting them as two declarations of `.dark` reports a collision that does not
// exist — measured on a real repo, that shape was the only finding the loose form produced.
//
// Usage, from the root of the repo being audited:
//   node <path>/check-structure.mjs [--dir src] [--json]

import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, relative, basename, sep } from 'node:path';

const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const json = has('--json');

// A failure must not look like a clean run. In --json mode that means stdout still carries
// parseable JSON: a consumer doing JSON.parse(stdout) otherwise throws on an empty string and
// cannot tell an argument error from a violation report.
const fail = (message) => {
    if (json) console.log(JSON.stringify({ error: message }, null, 2));
    else console.error(`✗ ${message}`);
    process.exit(2);
};

const HELP = `
check-structure.mjs — audits a repo against the mechanical structure rules.

  --dir <path>   source root to walk (default: src/, else app/ unless it is a Next.js
                 route root, else the current directory)
  --json         machine-readable output on stdout, including {"error": …} on failure
  --help, -h     this text

Read-only. Exit 0 clean, 1 violations found, 2 the check could not run.
Rules 1 and 3 skip CLI-generated components/ui/; rule 5 does not — see the header comment.
`.trim();

if (has('--help') || has('-h')) {
    console.log(HELP);
    process.exit(0);
}

// argv is validated token by token rather than scanned with indexOf. `--dir` with no value used to
// silently audit the autodetected root while the caller believed the run was scoped, and a typo
// (`--dirr src`) used to be ignored along with everything after it.
const VALUE_FLAGS = new Set(['--dir']);
const BOOLEAN_FLAGS = new Set(['--json', '--help', '-h']);

let explicitDir = null;
for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (VALUE_FLAGS.has(token)) {
        const value = argv[i + 1];
        if (value === undefined || value.startsWith('-')) fail(`${token} needs a directory path, e.g. --dir src`);
        explicitDir = value;
        i += 1;
        continue;
    }
    if (BOOLEAN_FLAGS.has(token)) continue;
    fail(`Unknown argument: ${token}\n\n${HELP}`);
}

const cwd = process.cwd();

const SKIP_DIRS = new Set([
    'node_modules', '.git', 'coverage',
    // build output — a compiled bundle is not source, and its classes recur after every build
    'dist', 'build', 'out', '.next', '.output', '.svelte-kit', '.turbo', 'storybook-static',
    // static and vendored trees — shipped as-is, not ours to rename
    'public', 'vendor',
    // agent tooling
    '.agents', '.claude',
]);
const SOURCE_EXT = /\.(ts|tsx|scss|css)$/;
const STYLE_EXT = /\.(scss|css)$/;

// A CLI-generated UI primitives directory (`npx shadcn@latest add` writes src/components/ui/) is
// overwritten wholesale on the next add, so its filenames and barrels are not ours to fix —
// rules 1 and 3 skip it. Rule 5 deliberately does NOT: a class collision with a file the CLI
// overwrites is worse than one between two hand-written files, because the next `add` silently
// restores the losing declaration and the bug returns with no diff to explain it.
// Matched on any adjacent `components/ui` segment pair, not only at the source root, so
// src/app/components/ui/ and packages/*/src/components/ui/ are recognised too.
const isCliUiDir = (rel) => {
    const parts = rel.split(sep);
    return parts.some((p, i) => p === 'components' && parts[i + 1] === 'ui');
};

const isDirectory = (p) => {
    try { return statSync(p).isDirectory(); } catch { return false; }
};

// In the Next.js app-router, `app/` is the ROUTE root, not the source root: components/, hooks/
// and lib/ are its siblings. Treating app/ as the source root walks two route files and reports a
// stock create-next-app tree as clean while every real violation sits in a directory never opened.
const topLevelEntries = () => {
    try { return readdirSync(cwd, { withFileTypes: true }); } catch { return []; }
};

const isNextRouteRoot = (dir) => {
    if (topLevelEntries().some((e) => e.isFile() && /^next\.config\./.test(e.name))) return true;
    return ['page.tsx', 'page.jsx', 'page.js', 'layout.tsx', 'layout.jsx', 'layout.js']
        .some((f) => existsSync(join(dir, f)));
};

const autodetectRoot = () => {
    const src = join(cwd, 'src');
    if (isDirectory(src)) return src;
    const app = join(cwd, 'app');
    if (isDirectory(app) && !isNextRouteRoot(app)) return app;
    return cwd;
};

let sourceRoot;
if (explicitDir === null) {
    sourceRoot = autodetectRoot();
} else {
    sourceRoot = join(cwd, explicitDir);
    if (!existsSync(sourceRoot)) fail(`No such directory: ${sourceRoot}`);
    // existsSync alone let a FILE through: walk() swallowed the resulting ENOTDIR and the run
    // reported 0 files and exit 0, which reads as a clean repo.
    if (!isDirectory(sourceRoot)) fail(`--dir must name a directory, and this is not one: ${sourceRoot}`);
}

// Whatever root won, name what it excludes. A source root that hides half the repo is the failure
// mode this whole script had, and the only defence that survives a future refactor is saying so
// in the output every time.
const unscanned = sourceRoot === cwd
    ? []
    : topLevelEntries()
        .filter((e) => e.isDirectory() && !SKIP_DIRS.has(e.name) && join(cwd, e.name) !== sourceRoot)
        .map((e) => e.name)
        .sort();

// ── walk ─────────────────────────────────────────────────────────────────────
const dirs = [];
const files = [];
const readErrors = [];

const walk = (dir) => {
    let entries = [];
    // A swallowed readdir failure makes an unreadable subtree indistinguishable from an empty one:
    // `chmod 000 src` used to report clean with violating files unread inside it. Record it.
    try { entries = readdirSync(dir, { withFileTypes: true }); } catch (err) { readErrors.push(`${relative(cwd, dir) || '.'} — ${err.code ?? err.message}`); return; }
    for (const e of entries) {
        const full = join(dir, e.name);
        let entryIsDir = e.isDirectory();
        if (e.isSymbolicLink()) {
            // A symlinked skills folder is the common case and following it audits someone
            // else's tree. Record it as a file entry so casing still applies; never descend.
            try { entryIsDir = statSync(full).isDirectory(); } catch { continue; }
            if (entryIsDir) continue;
        }
        if (entryIsDir) {
            if (SKIP_DIRS.has(e.name)) continue;
            dirs.push(full);
            walk(full);
        } else {
            files.push(full);
        }
    }
};

walk(sourceRoot);

const rel = (p) => relative(cwd, p) || '.';
const relToRoot = (p) => relative(sourceRoot, p);
const sourceFiles = files.filter((f) => SOURCE_EXT.test(f));

if (sourceFiles.length === 0) {
    const detail = readErrors.length ? ` ${readErrors.length} director(ies) could not be read: ${readErrors.join('; ')}.` : '';
    fail(`Examined 0 source files under ${rel(sourceRoot)}. Nothing was checked, so this is not a clean result.${detail}`
        + (unscanned.length ? ` Not scanned: ${unscanned.join(', ')}.` : '')
        + ' Point --dir at the directory holding the .ts/.tsx/.scss/.css sources.');
}

const violations = { casing: [], hooksFolder: [], barrel: [], testPlacement: [], styleCollision: [] };

// ── rule 1: kebab-case ───────────────────────────────────────────────────────
// Checked segment by segment on the dot-separated name, so `<name>.types.ts`, `<name>.test.tsx`
// and `<name>.d.ts` pass without an allowlist of companion suffixes to keep in sync — every
// segment simply has to be lowercase kebab. A leading `_` (SCSS partial) and a leading `.` are
// stripped first. Digits are allowed anywhere.
const KEBAB = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const kebabName = (name) => {
    const stripped = name.replace(/^[._]+/, '');
    return stripped.length > 0 && KEBAB.test(stripped);
};

// Next.js route conventions are not casing violations: `(marketing)` route groups, `[slug]` and
// `[...slug]` dynamic segments, `@modal` parallel routes, `_private` colocation folders.
const kebabDir = (name) => kebabName(name.replace(/^[@(]+|[)]+$/g, '').replace(/^\[+\.{0,3}|\]+$/g, ''));

const toKebab = (name) => name
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
    .replace(/[_\s]+/g, '-')
    .toLowerCase();

// A suggestion has to be actionable. `_` kebabs to `-`, and a non-ASCII name kebabs to itself, so
// the old message told people to "rename it to -" or echoed the name back unchanged.
const remedy = (name) => {
    const suggestion = toKebab(name).replace(/-+/g, '-').replace(/^-|-$/g, '');
    const segments = suggestion.replace(/^[._]+/, '').split('.');
    if (suggestion === name || !segments.every((s) => KEBAB.test(s))) {
        return 'it contains characters outside [a-z0-9-]; rename it to lowercase kebab-case';
    }
    return `rename it to ${suggestion}`;
};

// `__tests__` fails the casing test too, but rule 4 owns it and states the real fix. Reporting it
// twice with two different remedies invites a rename that leaves the directory in place. Every
// other `__double__` folder is a tool convention (`__mocks__`) or tool-generated and unrenameable
// (`__snapshots__`), and the internals of a tool-owned dot-directory (`.husky/_`) are not ours.
const isToolOwnedDir = (dir) => {
    const segments = relToRoot(dir).split(sep);
    return segments.some((s) => /^__.+__$/.test(s) || (s.startsWith('.') && s.length > 1));
};

for (const dir of dirs) {
    const relDir = relToRoot(dir);
    if (isCliUiDir(relDir) || isToolOwnedDir(dir)) continue;
    if (!kebabDir(basename(dir))) {
        violations.casing.push(`${rel(dir)} — directory names are kebab-case; ${remedy(basename(dir))}`);
    }
}

for (const file of sourceFiles) {
    const relFile = relToRoot(file);
    if (isCliUiDir(relFile) || isToolOwnedDir(join(file, '..'))) continue;
    const name = basename(file);
    const segments = name.replace(/^[._]+/, '').split('.');
    if (!segments.every((s) => KEBAB.test(s))) {
        violations.casing.push(`${rel(file)} — filenames are kebab-case; ${remedy(name)}`);
    }
}

// ── rule 2: a hooks/ folder contains only hooks ──────────────────────────────
// Only the IMMEDIATE parent counts. A hook that owns companion files gets its own folder named for
// the hook — `hooks/use-gallery-state/{use-gallery-state.ts,types.ts,utils/…}` — and those companions
// are correctly placed. Matching any `hooks` ancestor would flag every one of them; measured on a
// real repo that was 39 of 51 findings, all wrong.
//
// `use-thing.test.ts` passes: a test is co-located beside the file it tests (rule 4), so moving a
// hook's own test out of the hook's folder would just relocate the violation. `use-thing.d.ts`
// passes because it declares that hook's types — the old message told the author it "exports a hook
// but is not named use-*", which the filename plainly contradicts.
const HOOK_FILE = /^use-[a-z0-9-]+(\.test|\.d)?\.(ts|tsx|scss|css)$/;

for (const file of sourceFiles) {
    if (basename(join(file, '..')) !== 'hooks') continue;
    const name = basename(file);
    if (name === 'index.ts' || name === 'index.tsx' || HOOK_FILE.test(name)) continue;
    violations.hooksFolder.push(
        `${rel(file)} — a hooks/ folder contains only hooks. Pure helpers go to the feature's utils/, ` +
        `types to <feature>/types.ts, constants to <feature>/constants.ts. A module that exports a hook ` +
        `but is not named use-* gets renamed, not moved.`,
    );
}

// ── rule 3: component folder barrel ──────────────────────────────────────────
const dirEntries = new Map();
for (const file of files) {
    const dir = join(file, '..');
    if (!dirEntries.has(dir)) dirEntries.set(dir, new Set());
    dirEntries.get(dir).add(basename(file));
}

for (const [dir, names] of dirEntries) {
    const relDir = relToRoot(dir);
    if (isCliUiDir(relDir)) continue;
    // A folder holding a bundler entry point is an application root, not a component: nothing
    // imports it by name, so a barrel there re-exports into no consumer. Without this, a
    // conventional `src/app/{app.tsx,main.tsx}` layout reports a violation nobody should fix,
    // which is how a checker teaches people to ignore it.
    if (names.has('main.tsx') || names.has('main.ts')) continue;
    const own = `${basename(dir)}.tsx`;
    // `index.tsx` is a barrel too. Reporting a folder that has one as missing one is a finding
    // whose only available fix is renaming a working file.
    if (names.has(own) && !names.has('index.ts') && !names.has('index.tsx')) {
        violations.barrel.push(`${rel(dir)} — holds ${own} but no index.ts; add the barrel: export { default } from './${basename(dir)}';`);
    }
}

// ── rule 4: test placement ───────────────────────────────────────────────────
for (const dir of dirs) {
    if (basename(dir) === '__tests__') {
        violations.testPlacement.push(`${rel(dir)} — no __tests__/ directories; co-locate each test beside the file it tests`);
    }
}

// Gated on a test extension. Unfiltered, this rule reported OpenAPI documents — `orders.spec.yaml`,
// `petstore.spec.json`, where `.spec.` is the ecosystem's own name — and advised renaming them to
// `.test.yaml`.
const SPEC_TEST_FILE = /\.spec\.(ts|tsx|js|jsx)$/;

for (const file of files) {
    if (SPEC_TEST_FILE.test(basename(file))) {
        violations.testPlacement.push(`${rel(file)} — no .spec.* suffix; rename to ${basename(file).replace('.spec.', '.test.')}`);
    }
}

// ── rule 5: duplicate top-level style class selectors ────────────────────────
const CLASS_AT_COLUMN_ZERO = /^\.([a-zA-Z_-][\w-]*)\s*(\{|,|$)/;
const classOwners = new Map();

// A declaration inside `/* … */` is not a declaration. Newlines are preserved so the column-zero
// anchor still means what it says. `//` lines need no handling — they fail the `^\.` anchor.
const stripBlockComments = (body) => {
    let out = '';
    let inComment = false;
    let i = 0;
    while (i < body.length) {
        if (inComment) {
            if (body[i] === '*' && body[i + 1] === '/') { inComment = false; i += 2; continue; }
            if (body[i] === '\n') out += '\n';
            i += 1;
            continue;
        }
        if (body[i] === '/' && body[i + 1] === '*') { inComment = true; i += 2; continue; }
        out += body[i];
        i += 1;
    }
    return out;
};

// A compiled `a.css` emitted beside its `a.scss` source declares every class the source does, so
// each one reports as a collision with the file it was built from.
const hasPreprocessorSource = (file) => file.endsWith('.css')
    && ['.scss', '.sass', '.less'].some((ext) => existsSync(file.replace(/\.css$/, ext)));

for (const file of files) {
    if (!STYLE_EXT.test(file)) continue;
    if (hasPreprocessorSource(file)) continue;
    let body = '';
    try { body = readFileSync(file, 'utf8'); } catch (err) { readErrors.push(`${rel(file)} — ${err.code ?? err.message}`); continue; }
    // A UTF-8 BOM sits in front of the first line, so `^\.` failed on it and the FIRST declaration
    // in the file was invisible — missing exactly the collision this rule exists to catch.
    const seen = new Set();
    let depth = 0;
    for (const line of stripBlockComments(body.replace(/^﻿/, '')).split('\n')) {
        // Depth is evaluated BEFORE the line's own braces, so `.foo {` is still depth 0 while a
        // selector written unindented inside `@media (…) {` is depth 1 and correctly skipped.
        const m = depth === 0 ? CLASS_AT_COLUMN_ZERO.exec(line) : null;
        for (const ch of line) {
            if (ch === '{') depth += 1;
            else if (ch === '}') depth = Math.max(0, depth - 1);
        }
        if (!m) continue;
        if (seen.has(m[1])) continue;   // one file declaring it twice is one owner, not a collision
        seen.add(m[1]);
        if (!classOwners.has(m[1])) classOwners.set(m[1], []);
        classOwners.get(m[1]).push(rel(file));
    }
}

for (const [cls, owners] of [...classOwners].sort(([a], [b]) => a.localeCompare(b))) {
    if (owners.length < 2) continue;
    violations.styleCollision.push(
        `.${cls} — declared at column 0 in ${owners.length} files: ${owners.join(', ')}. ` +
        `They merge per-property by load order, so editing one silently does nothing. ` +
        `Hoist the shared declaration into a *-shared.scss at the nearest common ancestor, or rename per component.`,
    );
}

// ── report ───────────────────────────────────────────────────────────────────
const RULES = [
    ['casing', '1. kebab-case filenames and directories'],
    ['hooksFolder', '2. a hooks/ folder contains only hooks'],
    ['barrel', '3. component folder missing its index.ts barrel'],
    ['testPlacement', '4. test placement — no __tests__/, no .spec.*'],
    ['styleCollision', '5. top-level style class declared in more than one file'],
];

const total = Object.values(violations).reduce((n, v) => n + v.length, 0);

// A path the walk could not open means the answer is unknown, not clean, and rule 5 in particular
// cannot decide a collision against a file it never read. An incomplete scan therefore exits 2 even
// when it found nothing, so CI never turns green on a permission problem.
const exitCode = readErrors.length ? 2 : (total ? 1 : 0);

if (json) {
    console.log(JSON.stringify({
        checkedAt: new Date().toISOString().slice(0, 10),
        sourceRoot: rel(sourceRoot),
        sourceFilesScanned: sourceFiles.length,
        filesWalked: files.length,
        notScanned: unscanned,
        unreadable: readErrors,
        total,
        violations,
    }, null, 2));
    process.exit(exitCode);
}

console.log(`\nSTRUCTURE CHECK — ${rel(sourceRoot)} (${sourceFiles.length} source files of ${files.length} walked)\n`);

if (unscanned.length) {
    console.log(`  not scanned, outside ${rel(sourceRoot)}: ${unscanned.join(', ')}`);
    console.log(`  re-run with --dir . to include them\n`);
}
if (readErrors.length) {
    console.log(`  ⚠ could not read ${readErrors.length} path(s), so their contents were NOT checked:`);
    for (const e of readErrors) console.log(`      ${e}`);
    console.log('');
}

for (const [key, title] of RULES) {
    const found = violations[key];
    console.log(`${found.length ? '✗' : '✓'} ${title}  —  ${found.length}`);
    for (const v of found) console.log(`    ${v}`);
    if (found.length) console.log('');
}

console.log(`\n${total} violation(s).`);
if (total) {
    console.log('Mechanical rules only. Placement, API-module and file-size rules stay reviewer-enforced —');
    console.log('see references/structure.md.\n');
}
if (readErrors.length) {
    console.log(`This scan was INCOMPLETE — ${readErrors.length} path(s) unreadable. Not a clean result.\n`);
} else if (!total) {
    console.log('references/structure.md, mechanical half: clean.\n');
}
process.exit(exitCode);
