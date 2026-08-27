#!/usr/bin/env node
// Sets up PROTOTYPE MODE in a new repo: the reduced gate set from eq-prototype SKILL.md §3, plus
// the marker that tells every later reader — human, agent, or standard-check.mjs — that the gates
// are missing on purpose and when that stops being true.
//
// This is NOT a lighter init-greenfield.mjs. It lands a strict SUBSET of the same starter files,
// read from `../eq-frontend-standards/starter` at run time, so the configs and dependency
// versions have exactly one home. Nothing is copied into this skill and nothing is restated: a
// prototype that graduates must not have to reconcile two versions of oxlint.
//
// What it deliberately does NOT land, and why each is safe to drop, is the table in SKILL.md §3.
// Change that table and this file together: the table is what a reader is told, this list is what
// actually lands, and nothing checks that the two agree.
//
// Usage, from the root of the new repo (after `npm create vite@latest . -- --template react-ts`):
//   node <path>/init-prototype.mjs --question "<the one question>" --expires YYYY-MM-DD [--dry-run]
//
// Exit codes:
//   0  setup complete, or any --dry-run (a dry run wrote nothing, so it cannot have failed).
//   1  the run did not happen: wrong directory, missing arguments, an expiry in the past, an
//      incomplete skill install, or the sibling standards skill not found. Nothing was written.
//   2  files landed, but a kept gate is not actually enforcing: the repo's own .oxlintrc.json is
//      what `npm run lint` reads, its leaf tsconfigs do not set the checking flags, or the `@/`
//      alias is wired on the tsc side only. All are files this script must not overwrite. Make the
//      printed edit(s) and re-run; nothing else in the setup is affected. Prototype mode keeps two
//      gates — one that exits 0 while enforcing nothing is worse here than in a production repo,
//      because nothing else is watching.

import { readFileSync, writeFileSync, mkdirSync, existsSync, chmodSync, appendFileSync } from 'node:fs';
import { join, dirname } from 'node:path';

const OWN_STARTER = join(import.meta.dirname, '..', 'starter');
// scripts/ -> eq-prototype/ -> engineering/ : the standards skill installs as a flat sibling.
const STANDARDS = join(import.meta.dirname, '..', '..', 'eq-frontend-standards');
const SHARED_STARTER = join(STANDARDS, 'starter');
const cwd = process.cwd();

// ── the subset ──────────────────────────────────────────────────────────────
// Every path is relative to the standards starter. A file NOT in this list is not part of
// prototype mode; the reason it is out is in SKILL.md §3, next to the gate it belongs to.
const SHARED_FILES = [
    '.editorconfig',
    '.nvmrc',
    '.oxfmtrc.json',
    // The BASE lint config only. .oxlintrc.strict.json is the type-aware half and needs a full
    // type build per run — the one gate whose cost is felt on every edit.
    '.oxlintrc.json',
    '.vscode/extensions.json',
    '.vscode/settings.json',
    // Typecheck survives prototype mode (SKILL.md §3), so all three configs come along: the root
    // is solution-style and compiles nothing without its two leaves.
    'tsconfig.json',
    'tsconfig.app.json',
    'tsconfig.node.json',
    // Tests are optional in prototype mode, but the runner must already work the moment one is
    // worth writing — wiring vitest mid-prototype is exactly the delay this mode exists to remove.
    'vitest.config.ts',
    'src/test/setup.ts',
    // The formatter hook. Free per edit, and it keeps graduation from becoming a formatting diff.
    '.claude/hooks/lint-fix.sh',
    // The protected-files guard. It costs nothing per edit and it defends exactly the files whose
    // quiet edit hollows the two gates this mode keeps: the lint config, the leaf tsconfigs, the
    // formatter config, the settings file itself. The init-time verification below runs once; this
    // runs on every write for the life of the prototype.
    '.claude/hooks/guard-protected-files.sh',
];

// Own starter: the two files that exist BECAUSE the mode is temporary. settings.json is a separate
// file rather than the standards copy because that one wires branch-guard.sh, which blocks commits
// to the default branch — the exact thing prototype mode does on purpose (SKILL.md §4).
const OWN_FILES = ['.claude/settings.json', '.claude/hooks/prototype-expiry.sh'];

// Scripts are taken from the standards fragment BY KEY, never retyped: `lint` in prototype mode is
// the fragment's own `lint:fast` (base config, no type-aware pass), so the two cannot drift.
const SCRIPT_KEYS = { typecheck: 'typecheck', lint: 'lint:fast', 'lint:fix': 'lint:fix', format: 'format', 'format:check': 'format:check', test: 'test' };
const DEV_DEPS = ['oxlint', 'oxfmt', 'vitest', 'jsdom', '@testing-library/react', '@testing-library/jest-dom', '@testing-library/user-event'];

// ── arguments ───────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const flag = (name) => {
    const i = argv.indexOf(`--${name}`);
    return i === -1 ? undefined : argv[i + 1];
};
const dryRun = argv.includes('--dry-run');
const question = flag('question');
const expires = flag('expires');

const die = (msg) => { console.error(msg); process.exit(1); };

if (!question || question.startsWith('--')) {
    die('--question "<the one question this prototype answers>" is required.\nA prototype with no question is a product being built without gates (SKILL.md §1).');
}
// Rejected rather than defaulted: a default expiry is one nobody chose, and the whole mode is
// bounded by this date.
if (!expires || !/^\d{4}-\d{2}-\d{2}$/.test(expires)) {
    die('--expires YYYY-MM-DD is required — the date this prototype is deleted or graduated (SKILL.md §1).');
}
if (Number.isNaN(Date.parse(expires))) die(`--expires '${expires}' is not a real date.`);
// `<=`, not `<`: the expiry date is the day the prototype is due (standard-check.mjs reports it as
// DUE TODAY), so setting it to today would fail the gate before any code is written.
if (expires <= new Date().toISOString().slice(0, 10)) {
    die(`--expires '${expires}' is today or in the past — the prototype would be due before it is written. Pick a future date.`);
}

if (!existsSync(join(cwd, 'package.json'))) {
    die('No package.json here. Run this from the root of the repo you are setting up, after the framework scaffold.');
}
if (!existsSync(SHARED_STARTER)) {
    die(`The eq-frontend-standards skill was not found at ${STANDARDS}.\nPrototype mode reads its configs from there so the two cannot drift. Install the full skill set, then re-run.`);
}
if (existsSync(join(cwd, 'PROTOTYPE.md'))) {
    console.log('PROTOTYPE.md already exists — this repo is already in prototype mode. Topping up the missing files.');
}

// ── file copies ─────────────────────────────────────────────────────────────
const created = [];
const skipped = [];
const conflicts = [];

// Reads of files the USER controls. Unreadable must be "not proved", never an exception: a dangling
// symlink and a chmod 000 file both mean "this file does not demonstrate the thing", and neither may
// abort a run that has already written to the repo. Same contract as init-greenfield.mjs's
// readTextFile.
const readConfigText = (file) => {
    try { return readFileSync(file, 'utf8'); } catch { return null; }
};

const land = (srcRoot, rel, target = rel) => {
    const src = join(srcRoot, rel);
    if (!existsSync(src)) { conflicts.push(`missing from the skill install: ${rel} — the install is incomplete, so this file was not landed`); return; }
    const dest = join(cwd, target);
    if (existsSync(dest)) { skipped.push(target); return; }
    if (!dryRun) {
        mkdirSync(dirname(dest), { recursive: true });
        writeFileSync(dest, readFileSync(src));
        // A hook without the executable bit looks wired and never runs — the worst of both states.
        if (target.startsWith('.claude/hooks/')) chmodSync(dest, 0o755);
    }
    created.push(target);
};

for (const rel of SHARED_FILES) land(SHARED_STARTER, rel);
for (const rel of OWN_FILES) land(OWN_STARTER, rel);

// Reads of the SKILL's OWN files. An incomplete install must be reported the way land() reports it,
// never thrown: by this point package.json has not been written yet, but files HAVE landed, and a
// raw stack trace tells the user nothing about which half of the setup happened.
const readOwn = (root, rel) => {
    try { return readFileSync(join(root, rel), 'utf8'); } catch { conflicts.push(`missing or unreadable in the skill install: ${rel} — the install is incomplete`); return null; }
};

// PROTOTYPE.md — the marker a person reads. Substituted from the template so the question and the
// date are in the first file anyone opens, not only in package.json.
const template = readOwn(OWN_STARTER, 'PROTOTYPE.template.md');
if (existsSync(join(cwd, 'PROTOTYPE.md'))) skipped.push('PROTOTYPE.md');
else if (template !== null) {
    if (!dryRun) writeFileSync(join(cwd, 'PROTOTYPE.md'), template.replace('__QUESTION__', question).replace('__EXPIRES__', expires));
    created.push('PROTOTYPE.md');
}

// .gitignore — appended, never replaced: the framework scaffold wrote one and it holds real
// entries. The fragment is idempotent by its first entry.
const gitignorePath = join(cwd, '.gitignore');
const fragment = readOwn(SHARED_STARTER, '.gitignore.fragment');
const existingIgnore = existsSync(gitignorePath) ? (readConfigText(gitignorePath) ?? '') : '';
if (fragment === null || existingIgnore.includes('.claude/settings.local.json')) skipped.push('.gitignore (fragment already present or unavailable)');
else {
    if (!dryRun) appendFileSync(gitignorePath, (existingIgnore && !existingIgnore.endsWith('\n') ? '\n' : '') + '\n' + fragment);
    created.push('.gitignore (fragment appended)');
}

// ── package.json merge ──────────────────────────────────────────────────────
// Key-by-key, never wholesale: the scaffold's own scripts and dependencies stay. An existing key
// with a DIFFERENT value is reported and left alone — silently overwriting a repo's build command
// is how an init script gets banned.
const pkgPath = join(cwd, 'package.json');
// Existence was checked before anything was written; VALIDITY is checked here, and a throw at this
// point would abandon the run with files already on disk and no report. Exit 2, not 1: the header's
// exit 1 promises "nothing was written", and by now 13 files have landed.
let pkg;
try {
    pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
} catch (err) {
    console.error(`\npackage.json could not be parsed: ${err.message}`);
    console.error(`The files above landed; package.json was NOT touched and prototype mode is NOT marked.`);
    console.error(`Fix the JSON, then re-run — this script never overwrites, so the second run only tops up.\n`);
    process.exit(2);
}
// The fragment is the single source of the scripts and dependency versions. Missing or unreadable
// means an incomplete install, which is reported the way land() reports it — the gate checks and the
// rest of the report still run, and neither merge loop does anything.
let fragmentPkg = null;
try {
    fragmentPkg = JSON.parse(readFileSync(join(SHARED_STARTER, 'package.fragment.json'), 'utf8'));
} catch {
    conflicts.push('missing or unreadable in the skill install: package.fragment.json — no scripts or devDependencies were merged');
}

// `??=` does not replace a non-nullish non-object, so `"scripts": "oxlint"` in a hand-edited
// package.json would throw mid-merge on a repo whose files have already been written.
const merging = ['scripts', 'devDependencies'].filter((key) => {
    if (pkg[key] === undefined || pkg[key] === null) { pkg[key] = {}; return true; }
    if (typeof pkg[key] !== 'object' || Array.isArray(pkg[key])) {
        conflicts.push(`package.json's "${key}" is not an object — left untouched. Fix it by hand, then re-run.`);
        return false;
    }
    return true;
});
const mergeScripts = fragmentPkg !== null && merging.includes('scripts');
const mergeDeps = fragmentPkg !== null && merging.includes('devDependencies');

for (const [key, sourceKey] of mergeScripts ? Object.entries(SCRIPT_KEYS) : []) {
    const value = fragmentPkg.scripts?.[sourceKey];
    // A missing key means the standards fragment was renamed under us. Reported, not guessed at:
    // a hand-written fallback is the drift this indirection exists to prevent.
    if (!value) { conflicts.push(`the standards fragment has no script '${sourceKey}' — 'npm run ${key}' was not set`); continue; }
    if (pkg.scripts[key] === undefined) pkg.scripts[key] = value;
    else if (pkg.scripts[key] !== value) conflicts.push(`scripts.${key} already set to '${pkg.scripts[key]}' — prototype mode expects '${value}'`);
}

for (const name of mergeDeps ? DEV_DEPS : []) {
    const version = fragmentPkg.devDependencies?.[name];
    if (!version) { conflicts.push(`the standards fragment no longer pins '${name}' — it was not added`); continue; }
    if (pkg.devDependencies[name] === undefined && pkg.dependencies?.[name] === undefined) pkg.devDependencies[name] = version;
}

// The marker the tooling reads. `expires` is what prototype-expiry.sh compares against today, and
// what standard-check.mjs reads to tell "deliberately not migrated" from "behind".
//
// An EXISTING marker is never rewritten. PROTOTYPE.md is also never overwritten, so a second run
// with different arguments would leave the two disagreeing about the question and the date — and
// the date is the one thing this mode is bounded by. Extending an expiry is a decision that gets
// made in both files, by hand.
const existing = pkg.eqPrototype;
if (existing && typeof existing === 'object') {
    if (existing.question !== question || existing.expires !== expires) {
        conflicts.push(`package.json already records eqPrototype { question: '${existing.question}', expires: '${existing.expires}' } — left as is. To change either, edit package.json AND PROTOTYPE.md together.`);
    }
} else {
    pkg.eqPrototype = { question, expires };
}

if (!dryRun) writeFileSync(pkgPath, JSON.stringify(pkg, null, 4) + '\n');

// ── the two kept gates — VERIFIED, never written ─────────────────────────────
// Prototype mode keeps `typecheck` and base `lint` (SKILL.md §3), and both read files this script
// must not overwrite. A scaffold that ships its own keeps it, and the gate then exits 0 having
// enforced almost nothing — the one failure mode this mode cannot absorb, because nothing else is
// watching a prototype. Measured on a clean `npm create vite@latest -- --template react-ts` on
// 2026-08-27 (Vite 8.2.2): the template ships a two-rule `.oxlintrc.json`, its leaf tsconfigs set
// none of the three checking flags, and `= .oxlintrc.json` in the "left alone" list above reads as
// harmlessly as `= tsconfig.json`.
//
// Only LINE comments are stripped before matching, so a commented-out `// "strict": true,` reports
// as missing — same as init-greenfield.mjs. Block comments are deliberately left in: the `"@/*"`
// path mapping contains the pair `/*`, so stripping them eats the mapping and everything after it.
const stripLineComments = (text) => text.replace(/^[ \t]*\/\/.*$/gm, '');
const readConfig = (file) => {
    const raw = readConfigText(join(cwd, file));
    return raw === null ? null : stripLineComments(raw);
};
const flagTrue = (text, flag) => new RegExp(`"${flag}"\\s*:\\s*true`).test(text);

const gateGaps = [];

// The lint config. The sentinel is a RULE NAME, not the file's bytes, so a repo that took the
// standard's base and then added to it still counts as the standard's — same device as greenfield.
const STANDARD_BASE_SENTINEL = 'max-lines';
if (skipped.includes('.oxlintrc.json')) {
    const body = readConfig('.oxlintrc.json');
    if (body === null || !body.includes(STANDARD_BASE_SENTINEL)) {
        gateGaps.push([
            `.oxlintrc.json already existed and was NOT replaced — this script does not overwrite your files —`,
            `but it ${body === null ? 'could not be read, so it cannot be shown to hold' : 'does not hold'} the standard's rules (no \`${STANDARD_BASE_SENTINEL}\` budget in it).`,
            `\`npm run lint\` reads YOUR file, so whatever is missing from it is missing from the gate, green.`,
            `Replace it, then merge any rules of your own back on top:`,
            `  cp ${join(SHARED_STARTER, '.oxlintrc.json')} .oxlintrc.json`,
        ].join('\n    '));
    }
}

// The agent policy file. Both hooks land as files, and both are inert unless .claude/settings.json
// wires them — so a repo where a developer already ran Claude Code keeps its own settings, the
// formatter never runs on an edit, and the expiry warning never prints. Same hollow-gate class as
// the two configs below: present, reported as "left alone", enforcing nothing.
if (skipped.includes('.claude/settings.json')) {
    const body = readConfigText(join(cwd, '.claude', 'settings.json'));
    const wired = (hook) => body !== null && body.includes(hook);
    const unwired = ['prototype-expiry.sh', 'lint-fix.sh', 'guard-protected-files.sh'].filter((h) => !wired(h));
    if (unwired.length) {
        gateGaps.push([
            `.claude/settings.json already existed and was NOT replaced, and nothing in it references ${unwired.map((h) => `\`${h}\``).join(' or ')}.`,
            `Both hooks were copied into .claude/hooks/ and a hook no settings file references never runs:`,
            `no formatting on edit, no expiry warning, and no guard on the gate files — everything this mode relies on being automatic.`,
            `Merge the hook entries from ${join(OWN_STARTER, '.claude', 'settings.json')} into your own file.`,
        ].join('\n    '));
    }
}

// The leaf tsconfigs' checking flags. All three, matching greenfield: `noImplicitOverride` catches
// an override that does not override (a typo'd `componentDidCatch` stops catching, silently), which
// is a wrong ANSWER, not untidiness.
const LEAF_TSCONFIGS = ['tsconfig.app.json', 'tsconfig.node.json'];
const TS_CHECKING_FLAGS = ['strict', 'noUncheckedIndexedAccess', 'noImplicitOverride'];
const rootText = readConfig('tsconfig.json') ?? '';

for (const leaf of LEAF_TSCONFIGS) {
    if (!existsSync(join(cwd, leaf))) continue;   // no such project here — nothing to check
    if (created.includes(leaf)) continue;         // this run wrote the starter copy, which sets all three
    const text = readConfig(leaf);
    if (text === null) { gateGaps.push(`${leaf} could not be read, so it cannot be shown to enable the checking flags. \`npm run typecheck\` is worth whatever that file says.`); continue; }
    const missing = TS_CHECKING_FLAGS.filter((f) => !flagTrue(text, f));
    if (!missing.length) continue;
    // `extends` puts the flags somewhere this script does not follow (a package, another file). A
    // gate that cannot be satisfied except by duplicating the base config is one people switch off,
    // so this drops to advice and does not count towards exit 2.
    if (/"extends"\s*:/.test(text)) {
        console.log(`\nⓘ ${leaf} sets ${missing.map((f) => `"${f}"`).join(', ')} nowhere in its own text but does \`extends\` another config.`);
        console.log(`  Verify the base config enables ${missing.join(', ')} — this script reads only this file.`);
        continue;
    }
    // A flag set in the solution-style ROOT is inert for referenced projects — the trap worth
    // naming explicitly, because the repo looks configured and is not.
    const inRootOnly = missing.filter((f) => flagTrue(rootText, f));
    gateGaps.push([
        `${leaf} already existed and was NOT replaced, and it does not set ${missing.map((f) => `"${f}": true`).join(', ')}.`,
        `\`npm run typecheck\` then passes on unchecked code — the gate prototype mode relies on most.`,
        inRootOnly.length
            ? `${inRootOnly.join(', ')} is set in tsconfig.json, which does NOT count: a solution-style root's compilerOptions are inert for referenced projects.`
            : `Add them to this file's "compilerOptions".`,
        `Reference: ${join(SHARED_STARTER, 'tsconfig.app.json')}`,
    ].join('\n    '));
}

// The `@/` alias, when a tsconfig here maps it. `paths` makes `@/x` TYPE-CHECK; only a bundler alias
// makes vitest resolve it — so the tsc half alone buys a repo where every test importing `@/` fails
// while typecheck and build stay green (measured in init-greenfield.mjs, which verifies the same
// pair). Prototype mode does not require the alias; it requires the two halves not to disagree.
// Skipped when there is no readable vite config: another bundler declares its half out of reach of
// this regex, and a gate that cannot be satisfied gets ignored.
const TS_PATH_ALIAS = /(['"])@\/\*\1\s*:/;
const VITE_SRC_ALIAS = /(['"])@\/?\1\s*:\s*[^,}\n]*\bsrc\b|\bfind\s*:\s*(['"])@\/?\2[\s\S]{0,160}?\breplacement\s*:\s*[^,}\n]*\bsrc\b/;
const viteConfig = ['vite.config.ts', 'vite.config.js', 'vite.config.mts', 'vite.config.mjs'].find((f) => existsSync(join(cwd, f)));
const viteSource = viteConfig ? readConfig(viteConfig) : null;

if (viteSource !== null) {
    const tsHasPaths = ['tsconfig.json', ...LEAF_TSCONFIGS].some((f) => {
        const body = readConfig(f);
        return body !== null && TS_PATH_ALIAS.test(body);
    });
    if (tsHasPaths && !VITE_SRC_ALIAS.test(viteSource)) {
        gateGaps.push([
            `a tsconfig here maps "@/*" but ${viteConfig} declares no resolve.alias for "@".`,
            `\`@/…\` imports type-check and then fail under \`vitest run\`. Add both lines to ${viteConfig}:`,
            `  import { fileURLToPath } from 'node:url';   // beside the other imports`,
            `  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },`,
            `                                             // a sibling of \`plugins\`, inside defineConfig`,
        ].join('\n    '));
    }
}

// ── report ──────────────────────────────────────────────────────────────────
const label = dryRun ? 'would create' : 'created';
console.log(`\n${label} (${created.length}):`);
for (const f of created) console.log(`  + ${f}`);
if (skipped.length) {
    console.log(`\nalready present, left alone (${skipped.length}):`);
    for (const f of skipped) console.log(`  = ${f}`);
}
if (conflicts.length) {
    console.log(`\nresolve by hand (${conflicts.length}):`);
    for (const c of conflicts) console.log(`  ! ${c}`);
}

// The closing message states what is TRUE after this run. A dry run set nothing up, and a report
// that says otherwise is the reason someone believes a repo is marked when it is not.
const recorded = pkg.eqPrototype ?? { question, expires };
if (gateGaps.length) {
    console.log(`\nNOT ENFORCING (${gateGaps.length}) — prototype mode keeps two gates and this many are hollow:`);
    for (const g of gateGaps) console.log(`  ✗ ${g}`);
}

console.log(`
${dryRun ? 'DRY RUN — nothing was written. Re-run without --dry-run to set prototype mode up.' : 'prototype mode is set.'}
Question: ${recorded.question}
Expires: ${recorded.expires} — on that date, delete this repo or graduate it (eq-prototype references/graduation.md).

Next:
  npm install
  npm run format          # normalizes the scaffold to this standard's quotes, semicolons and indent
  npm run typecheck && npm run lint

Then build. Run those two commands before you trust any answer this prototype gives.
`);

// Non-zero LAST, so the whole report is printed first: a wrapper that stops on failure still shows
// the user what landed.
if (gateGaps.length && !dryRun) process.exit(2);
