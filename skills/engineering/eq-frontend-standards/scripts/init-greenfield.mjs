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
// carries the hooks, reviewer agents and commands and this script lands them in the repo. With
// --vendor-skills the skill directories are copied in as REAL FILES rather than left as the
// symlink `npx skills add` makes: git stores a symlink as its target path, so a committed symlink
// hands every teammate a broken link into one machine's home directory.
//
// It also VERIFIES, and exits non-zero on, the one part of the standard that cannot be installed:
// tailwindcss ships in package.fragment.json, but Tailwind is inert until two SOURCE files say so.
// This script never edits source, so it reports the exact two edits and fails until they exist —
// see the styling-pipeline block near the bottom for why a printed reminder is not sufficient.
//
// Usage, from the root of the new repo:
//   node <path>/init-greenfield.mjs [--dry-run] [--vendor-skills]
//
// Exit codes — distinct, because a wrapper has to tell "finish the setup" from "the run never
// started", and the two need opposite responses:
//   0  setup complete: everything landed and the styling pipeline is wired. Also EVERY --dry-run,
//      including one that reports styling gaps — a dry run wrote nothing, so it cannot have failed,
//      and `node … --dry-run && node …` has to reach the real run.
//   1  the run did not happen: wrong directory, an incomplete skill install, --vendor-skills with
//      the sibling skills missing, or an unexpected throw. Nothing was written.
//   2  files landed, but the styling pipeline is unwired. Make the two printed source edits and
//      re-run; nothing else in the install is affected.

import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync, statSync, realpathSync, chmodSync, cpSync } from 'node:fs';
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

const isPlainObject = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);

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
        if (k in pkg[key] && pkg[key][k] !== v) {
            // Never silently replace a script or dependency the repo already chose.
            conflicts.push(`package.json ${key}.${k}: yours ${JSON.stringify(pkg[key][k])}, standard ${JSON.stringify(v)}`);
        } else {
            pkg[key][k] = v;
        }
    }
};

// ── foreign linter holding the lint gate ────────────────────────────────────
// `scripts.lint` is not user content, it is the definition of the gate: starter/.github/workflows/
// ci.yml runs `npm run lint`, so whatever sits there is what CI enforces. The Vite react-ts template
// ships `"lint": "oxlint"`, and keeping it means CI runs oxlint's two-rule default config and never
// the eslint.config.js this script just wrote — every correctness rule and every budget in the
// standard passes unenforced, on a green build, with only a one-time warning in this output to say
// so. So a recognised foreign linter is moved aside to a named key and `eslint .` takes the gate.
// An `eslint` command with different flags is a user choice inside the standard's own tool: that
// stays an ordinary reported conflict, untouched.
// [name, matches the segment's FIRST EXECUTABLE TOKEN, optional extra test on the whole segment].
const FOREIGN_LINTERS = [
    ['oxlint', /^oxlint$/],
    ['biome', /^(@biomejs\/)?biome$/],
    ['rome', /^(@rometools\/)?rome$/],
    ['standard', /^standard$/],
    ['xo', /^xo$/],
    ['tslint', /^tslint$/],
    // A formatter used as the lint gate. `prettier --write` is a fixer, not a gate, so only the
    // checking form counts.
    ['prettier --check', /^prettier$/, /(^|\s)(--check|-c)(\s|$)/],
];
const FOREIGN_LINTER_CONFIGS = ['.oxlintrc.json', 'oxlintrc.json', 'biome.json', 'biome.jsonc', 'tslint.json'];

// Classification reads the first executable token of each `&&` / `;` / `||` / `|` segment, never the
// whole string. Searching anywhere matched a script NAME: `"lint": "npm run standard-lint"` with
// `"standard-lint": "eslint . --max-warnings 0 && tsc --noEmit"` was relocated as the `standard`
// linter, silently dropping `--max-warnings 0` and the typecheck from CI. `run-s standard-checks` and
// `echo standard` misfired the same way, and `xo` had the same pattern shape.
const ENV_ASSIGNMENT = /^[A-Za-z_][A-Za-z0-9_]*=/;
// Tools that run something else: the thing they run is the token that decides.
const COMMAND_WRAPPERS = new Set(['npm', 'npx', 'pnpm', 'pnpx', 'yarn', 'bun', 'bunx', 'dlx', 'exec', 'cross-env', 'env', 'dotenv', 'dotenv-cli']);
const SCRIPT_RUNNERS = /^(run-s|run-p|npm-run-all)$/;
// One level of `npm run` indirection is what hid oxlint in practice; the depth cap and the visited
// set are what stop `"lint": "npm run lint"` from recursing forever.
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

// Every classifier below returns 'eslint', a foreign linter's name, or null.
const firstLinterIn = (results) => (results.includes('eslint') ? 'eslint' : results.find(Boolean) ?? null);

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
    if (bin === 'eslint') return 'eslint';
    const linter = FOREIGN_LINTERS.find(([, tokenPattern, segmentPattern]) => tokenPattern.test(bin) && (!segmentPattern || segmentPattern.test(segment)))?.[0];
    if (linter) return linter;
    // A bare script name, as `yarn <script>` and `run-s` both allow.
    return classifyScriptName(bin, scripts, seen, depth);
}

const foreignLinterIn = (cmd, scripts) => {
    const found = classifyChain(cmd, scripts, new Set(), 0);
    return found && found !== 'eslint' ? found : null;
};

const moved = [];

const relocateForeignLint = (key) => {
    const existing = pkg.scripts?.[key];
    if (typeof existing !== 'string') return;
    const tool = foreignLinterIn(existing, pkg.scripts);
    if (!tool) return;

    const dest = `${key}:legacy`;
    const standard = JSON.stringify(fragment.scripts[key]);
    if (dest in pkg.scripts) {
        // This line says everything the merge's generic conflict would, and more, so suppress that one.
        scriptKeysAlreadyReported.add(key);
        conflicts.push(`package.json scripts.${key}: yours ${JSON.stringify(existing)} runs ${tool}, and scripts.${dest} is already taken — nothing was moved. CI runs \`npm run ${key}\`, so ${tool} is still your gate and the standard is not enforced until you set scripts.${key} to ${standard} by hand.`);
        return;
    }

    pkg.scripts[dest] = existing;
    delete pkg.scripts[key];   // so the merge below installs the standard's value, not a conflict
    moved.push(`package.json scripts.${key}: yours ran ${tool}, not eslint — kept verbatim as scripts.${dest}, and the standard's ${standard} installed as scripts.${key}, because CI's \`npm run ${key}\` step would otherwise enforce ${tool} instead of the eslint.config.js written above. To reverse: swap the two values back by hand.`);
};

for (const key of ['lint', 'lint:fix']) relocateForeignLint(key);

// Reported, never deleted — this script does not remove a user's files.
const staleLinterConfigs = readdirSync(cwd).filter((e) => FOREIGN_LINTER_CONFIGS.includes(e) || e.startsWith('.xo-config'));

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

if (conflicts.length) {
    console.log(`\n⚠ resolve by hand — your value was kept:`);
    console.log(conflicts.map((c) => `  ! ${c}`).join('\n'));
}

if (staleLinterConfigs.length) {
    console.log(`\n⚠ delete by hand — a foreign linter's config, unused now that eslint is the gate (this script never removes your files):`);
    console.log(staleLinterConfigs.map((f) => `  ! ${f}`).join('\n'));
}

console.log(`\nNext:`);
console.log(`  npm install`);
if (staleLinterConfigs.length) {
    console.log(`  rm ${staleLinterConfigs.join(' ')}`);
    console.log(`                          # stale foreign-linter config, and drop that linter from`);
    console.log(`                          # devDependencies — eslint.config.js is the only config read now`);
}
if (!vendorSkills) {
    console.log(`  node <skill>/scripts/init-greenfield.mjs --vendor-skills`);
    console.log(`                          # copies the skills into .claude/skills as REAL files, so a`);
    console.log(`                          # clone inherits the exact standard. Commit .claude/ — it is`);
    console.log(`                          # repo policy, not personal config.`);
}
console.log(`  npx husky init          # only if .husky/_ is missing; it wires core.hooksPath`);
console.log(`  npx eslint . --fix      # REQUIRED FIRST: a scaffold written 2-space/no-semicolon`);
console.log(`                          # produces ~130 formatting errors, all mechanically fixable`);
console.log(`  npm run lint && npm run typecheck && npm run build`);
console.log(`                          # \`npm run lint\` is what CI runs — verify it is eslint, not the`);
console.log(`                          # linter the scaffold shipped`);
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

// An unreadable file is NOT A MATCH, never an exception: a dangling symlink (ENOENT) and a chmod 000
// stylesheet (EACCES) are both "this file does not wire Tailwind", and neither may abort the run.
const readTextFile = (file) => {
    try {
        const buf = readFileSync(file);
        // A UTF-16 stylesheet decoded as utf8 is NUL-interleaved mojibake, so its `@import` is
        // invisible and the gate reported "no stylesheet imports Tailwind" about a wired repo.
        if (buf[0] === 0xff && buf[1] === 0xfe) return buf.subarray(2).toString('utf16le');
        if (buf[0] === 0xfe && buf[1] === 0xff) return buf.subarray(2).swap16().toString('utf16le');
        // A UTF-8 BOM sits in front of the first character and would break a first-line anchor.
        return buf.toString('utf8').replace(/^\uFEFF/, '');
    } catch {
        return null;
    }
};

// Same approach as check-structure.mjs rule 5: a state machine with newlines preserved, not a regex
// a `*/` inside a quoted value would break. A commented-out `@import 'tailwindcss'` or a
// commented-out plugin import is the exact bug this exit code exists to catch, so neither may read as
// wiring. `//` is not a CSS comment, so line comments are opt-in and used only for the vite config.
const stripComments = (body, { lineComments = false } = {}) => {
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
        if (body[i] === '/' && body[i + 1] === '*') { inBlock = true; i += 2; continue; }
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

if (!viteConfig) {
    console.log(`ℹ no vite.config.* here, so the bundler half of the Tailwind wiring was not checked —`);
    console.log(`  register Tailwind the way your bundler wants it (Next.js, Rspack, and webpack use`);
    console.log(`  @tailwindcss/postcss instead of @tailwindcss/vite; swap the dependency to match).\n`);
}

if (styleGaps.length) {
    console.log(`✗ SETUP INCOMPLETE — tailwindcss is installed but produces no CSS, so every utility`);
    console.log(`  class in the repo is inert while typecheck, lint, test and build all pass:`);
    console.log(styleGaps.map((g) => `  ! ${g}`).join('\n'));
    console.log(`\n  Make the edit(s) above, then re-run this script. It exits 0 once both hold. Nothing`);
    console.log(`  else here is affected — every file listed above was still ${dryRun ? 'reported' : 'written'}.\n`);
    console.log(dryRun ? `  Exit 0: a dry run wrote nothing, so there is nothing to fail.\n` : `  Exit code 2 (files landed, styling unwired) — distinct from 1, which means the run never started.\n`);
    // A --dry-run must not exit non-zero, or `node … --dry-run && node …` never reaches the real run.
    process.exit(dryRun ? 0 : 2);
}

// Deliberately narrow: the check proves one readable `.css` under the scanned root holds the import,
// not that the entry module imports THAT file. Claiming more is how a stray stylesheet passed for a
// pipeline that emitted nothing.
const bundlerNote = viteConfig ? `${viteConfig} imports and calls @tailwindcss/vite, and ` : '';
console.log(`✓ styling pipeline wired: ${bundlerNote}${relative(cwd, tailwindEntry)} imports Tailwind.`);
console.log(`  Scanned ${relative(cwd, scanRoot) || '.'}/ only — if that stylesheet is not the one your entry module imports, the utilities are still inert.\n`);
