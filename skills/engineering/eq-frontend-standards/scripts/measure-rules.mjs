#!/usr/bin/env node
// Measures a repo against the standard's oxlint rule set and SEQUENCES THE FIX.
//
// It no longer sizes a suppressions baseline: oxlint has no suppressions file
// (oxc-project/oxc#10549), so SKILL.md §3 branches on the measured total instead. This script
// prints which branch applies and orders the work cheapest-first.
//
// READ-ONLY on the audited repo. The probe config and its node_modules symlink are written to a
// temp dir, never into the repo, so a crashed run cannot leave the repo altered.
//
// Usage, from the root of the repo being measured:
//   node <path>/measure-rules.mjs [--dir src] [--tooling <dir>] [--json]
//
// Exit 0 clean, 1 violations found, 2 the measurement could not be trusted.

import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, existsSync, statSync, mkdtempSync, rmSync, copyFileSync, symlinkSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';

const SKILL_DIR = join(import.meta.dirname, '..');
const STARTER = join(SKILL_DIR, 'starter');

// SKILL.md §3. A judgement calibrated on two measurements, not a derived constant — a proxy for a
// PR a human can review and land. docs/adr/0002 owns the reasoning.
const THRESHOLD = 300;

// Measured on the starter config, on a real consumer repo at oxlint 1.77.0. A LOWER count than
// EXPECTED means rules were silently dropped and the run enforces less than it claims, while still
// exiting 0 on a clean repo. The 206 case is defensive: oxlint 1.77.0 hard-fails on a missing
// plugin, so a fail-soft bridge is the only way to reach it. The 199 case is real and reachable
// today — verified by dropping the flag.
//
// 226 = 206 native and type-aware rules + the 20 `react-hooks-js/*` rules, which exist only once
// the `jsPlugins` bridge resolves and so never appear in the resolved config. Recompute from a
// real run rather than copying the number forward — `npx oxlint --rules` prints nothing in 1.77.0,
// so it is not readable off the CLI without parsing:
//
//   # 226 — rules actually loaded by the run this script asserts on
//   npx oxlint -c .oxlintrc.strict.json --type-aware -f json src \
//     | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s).number_of_rules))'
//
// THIS NUMBER IS DUPLICATED. Its second copy is `EXPECTED_OXLINT_RULES` in the `env:` block of
// starter/.github/workflows/ci.yml. Nothing links them and nothing can: that workflow ships into a
// consuming repo where this script is absent, and this script runs from the skill where that
// workflow is absent, so neither side can import the other. A rule added to .oxlintrc.json or
// .oxlintrc.strict.json moves both, and both are edited in the same commit.
const EXPECTED_RULES = 226;
const KNOWN_SHORTFALL = new Map([
    [199, '--type-aware was not passed: all 27 type-aware rules are SKIPPED — the full recommended-type-checked set, typescript/no-floating-promises included.'],
    [206, 'the jsPlugins bridge did not load: all 20 eslint-plugin-react-hooks rules were dropped.'],
    [168, 'the fast config (.oxlintrc.json) ran instead of .oxlintrc.strict.json.'],
]);

// oxlint's diagnostic `code` is `plugin(rule)` using each plugin's DISPLAY name; its config and
// --print-config use the plugin's CONFIG prefix. The two differ for exactly these, so the mapping
// is a table rather than a string transform.
const CONFIG_PREFIX = { eslint: '', 'jsx-a11y': 'jsx_a11y/' };

const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const json = has('--json');

// A failure must not look like a clean run. In --json mode stdout still carries parseable JSON so a
// consumer cannot mistake an argument error for a zero-violation report.
const fail = (message, detail = []) => {
    if (json) console.log(JSON.stringify({ error: message, detail }, null, 2));
    else {
        console.error(`\n✗ ${message}`);
        for (const line of detail) console.error(`  ${line}`);
        console.error('');
    }
    process.exit(2);
};

const HELP = `
measure-rules.mjs — measures a repo against the standard's oxlint rules and sequences the fix.

  --dir <path>       source root to lint (default: src). Scope it on large repos.
  --tooling <dir>    directory whose node_modules holds oxlint, oxlint-tsgolint and
                     eslint-plugin-react-hooks. Default: the audited repo, then this skill.
  --json             machine-readable output on stdout, including {"error": …} on failure
  --help, -h         this text

Read-only. Exit 0 clean, 1 violations found, 2 the measurement could not be trusted.
`.trim();

if (has('--help') || has('-h')) { console.log(HELP); process.exit(0); }

const VALUE_FLAGS = new Set(['--dir', '--tooling']);
const BOOLEAN_FLAGS = new Set(['--json', '--help', '-h']);
const opts = { '--dir': 'src', '--tooling': null };
for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (VALUE_FLAGS.has(token)) {
        const value = argv[++i];
        // `--dir` with no value silently audited the default root while the caller believed the run
        // was scoped, and a typo swallowed everything after it.
        if (!value || value.startsWith('-')) fail(`${token} needs a value`);
        opts[token] = value;
    } else if (!BOOLEAN_FLAGS.has(token)) {
        fail(`unknown argument '${token}'`, ['run with --help for the accepted flags']);
    }
}

const cwd = process.cwd();
const dir = opts['--dir'];
const dirPath = resolve(cwd, dir);
if (!statSync(dirPath, { throwIfNoEntry: false })?.isDirectory()) fail(`--dir '${dir}' is not a readable directory under ${cwd}`);

const BASE_CONFIG = join(STARTER, '.oxlintrc.json');
const STRICT_CONFIG = join(STARTER, '.oxlintrc.strict.json');
for (const f of [BASE_CONFIG, STRICT_CONFIG]) {
    if (!existsSync(f)) fail(`the standard's config is missing: ${f}`, ['re-install the skill; the configs ship beside it in starter/']);
}

// `baseUrl` in any tsconfig makes oxlint-tsgolint reject the project SILENTLY: every type-aware
// rule reports zero at exit 0 while still counting as loaded, so a measurement taken over it
// records false zeros for exactly the rules this script exists to measure. Found on a real
// migrated repo — its type-aware counts were all zero until baseUrl was deleted, then 174 findings
// surfaced. Fatal, because a poisoned measurement is worse than none.
for (const f of readdirSync(cwd).filter((n) => /^tsconfig.*\.json$/.test(n))) {
    try {
        if (/"baseUrl"\s*:/.test(readFileSync(join(cwd, f), 'utf8'))) {
            fail(`${f} sets "baseUrl", which makes oxlint-tsgolint silently skip ALL type-aware rules`, [
                'Every type-aware count this run produced would be a false zero.',
                'Delete baseUrl — the @/* alias needs only "paths" — then re-run.',
            ]);
        }
    } catch { /* an unreadable tsconfig will fail the lint run itself */ }
}

// The three packages the full gate needs. oxlint resolves a jsPlugins specifier relative to the
// config file that declares it, which is why the configs are COPIED next to a node_modules
// symlink rather than passed in place from starter/.
const platformBin = `${process.platform}-${process.arch}/tsgolint${process.platform === 'win32' ? '.exe' : ''}`;
const toolingParts = (root) => ({
    oxlint: join(root, 'node_modules', '.bin', process.platform === 'win32' ? 'oxlint.cmd' : 'oxlint'),
    tsgolint: join(root, 'node_modules', '@oxlint-tsgolint', platformBin),
    plugin: join(root, 'node_modules', 'eslint-plugin-react-hooks'),
});
const candidates = [opts['--tooling'] && resolve(cwd, opts['--tooling']), cwd, SKILL_DIR].filter(Boolean);
const toolingRoot = candidates.find((root) => Object.values(toolingParts(root)).every((p) => existsSync(p)));
if (!toolingRoot) {
    fail('could not find oxlint, oxlint-tsgolint and eslint-plugin-react-hooks together in one node_modules', [
        `looked in: ${candidates.join(', ')}`,
        'install them in the repo:',
        '  npm i -D oxlint@^1.77.0 oxlint-tsgolint@^7.0.2001 eslint-plugin-react-hooks@^7.1.1',
        'or point at an existing install with --tooling <dir>.',
    ]);
}
const tools = toolingParts(toolingRoot);

const probe = mkdtempSync(join(tmpdir(), 'eq-measure-'));
// A `finally` block does not run when the process is signalled, and a pass over a large repo takes
// long enough that Ctrl-C during it is normal.
const cleanup = () => { try { rmSync(probe, { recursive: true, force: true }); } catch { /* nothing left to do */ } };
process.on('exit', cleanup);
for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(signal, () => { cleanup(); process.exit(130); });
process.on('uncaughtException', (err) => { cleanup(); console.error(err); process.exit(1); });

copyFileSync(BASE_CONFIG, join(probe, '.oxlintrc.json'));
copyFileSync(STRICT_CONFIG, join(probe, '.oxlintrc.strict.json'));
symlinkSync(join(toolingRoot, 'node_modules'), join(probe, 'node_modules'), 'dir');

const probeConfig = join(probe, '.oxlintrc.strict.json');
const env = { ...process.env, OXLINT_TSGOLINT_PATH: tools.tsgolint };
const runOxlint = (args, what) => {
    let out = '';
    try {
        out = execFileSync(tools.oxlint, args, { cwd, env, encoding: 'utf8', maxBuffer: 1024 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (err) {
        // oxlint exits 1 whenever it reports a diagnostic; stdout is still the report. Any other
        // failure puts its own message on stdout, not stderr, so both are surfaced.
        out = err.stdout || err.stderr || String(err.message);
    }
    // oxlint prefixes the JSON report with a plain-text notice in some cases ("No files found to
    // lint"), so the report is located rather than assumed to start at byte 0.
    const start = out.indexOf('{');
    try { return JSON.parse(out.slice(start === -1 ? 0 : start)); } catch { /* fall through — not a report */ }
    return fail(`oxlint could not ${what}`, out.trim().split('\n').slice(0, 12));
};

// The declared rule set, read from the standard's own configs. oxlint reads JSONC, Node does not.
const stripComments = (text) => {
    let out = '';
    for (let i = 0, inString = false; i < text.length; i++) {
        if (inString) {
            if (text[i] === '\\') { out += text[i] + (text[i + 1] ?? ''); i++; continue; }
            if (text[i] === '"') inString = false;
            out += text[i];
            continue;
        }
        if (text[i] === '"') { inString = true; out += text[i]; continue; }
        if (text[i] === '/' && text[i + 1] === '/') { while (i < text.length && text[i] !== '\n') i++; out += '\n'; continue; }
        if (text[i] === '/' && text[i + 1] === '*') { i += 2; while (i < text.length && !(text[i] === '*' && text[i + 1] === '/')) i++; i++; continue; }
        out += text[i];
    }
    return out;
};
const readConfig = (file) => {
    try { return JSON.parse(stripComments(readFileSync(file, 'utf8'))); } catch (err) { return fail(`could not parse ${file}: ${err.message}`); }
};
const severityOf = (value) => (Array.isArray(value) ? value[0] : value);
const isOn = (value) => !['off', 'allow'].includes(severityOf(value));

const declared = { ...readConfig(BASE_CONFIG).rules, ...readConfig(STRICT_CONFIG).rules };
const printed = runOxlint(['-c', probeConfig, '--type-aware', '--print-config'], 'print its resolved config').rules ?? {};
const enabled = new Set([
    ...Object.entries(printed).filter(([, v]) => isOn(v)).map(([k]) => k),
    ...Object.entries(declared).filter(([, v]) => isOn(v)).map(([k]) => k),
]);

const report = runOxlint(['-c', probeConfig, '--type-aware', '-f', 'json', dir], `lint ${dir}/`);
const loaded = report.number_of_rules;
const scanned = report.number_of_files;

// Both silent-failure modes below exit 0 on a clean repo while enforcing less than the standard.
// `enabled` is derived from the same configs oxlint just read, so the two counts must agree.
if (typeof loaded !== 'number') fail('oxlint reported no `number_of_rules`, so the loaded rule set cannot be verified');
if (loaded < EXPECTED_RULES || loaded !== enabled.size) {
    fail(`${loaded} rules loaded, expected ${EXPECTED_RULES} (${enabled.size} enabled by the standard's configs)`, [
        KNOWN_SHORTFALL.get(loaded) ?? 'a rule the standard declares was not registered.',
        'A run with fewer rules exits 0 while enforcing less than it claims. Refusing to report counts from it.',
    ]);
}
// Never report clean for a run that examined nothing.
if (!scanned) fail(`oxlint examined 0 files under ${dir}/`, ['check the path, and the config\'s ignorePatterns.']);

const counts = new Map();
const files = new Map();
for (const d of report.diagnostics ?? []) {
    const parsed = /^([a-z0-9_-]+)\(([^)]+)\)$/.exec(d.code ?? '');
    const rule = parsed ? `${CONFIG_PREFIX[parsed[1]] ?? `${parsed[1]}/`}${parsed[2]}` : (d.code ?? 'unknown');
    counts.set(rule, (counts.get(rule) ?? 0) + 1);
    if (!files.has(rule)) files.set(rule, new Set());
    files.get(rule).add(d.filename);
}

// A rejected tsconfig is FATAL, never one finding among many. oxlint-tsgolint refuses the whole
// project (`baseUrl`, removed in TypeScript 6.0, is the common cause) and then SKIPS all three
// type-aware rules — so typescript/no-floating-promises measures ZERO over any number of real
// violations, and this script would list a correctness rule in the "zero violations — enable for
// free" set while dozens of unhandled rejections sit in the repo. Measured on the first migrated
// repo: 48 real no-floating-promises sites reported as a clean rule. A false zero on a correctness
// rule is the one output this script must never print, so the run refuses to report at all.
const tsconfigErrors = [...counts.keys()].filter((r) => r.includes('tsconfig-error'));
if (tsconfigErrors.length) {
    const affected = [...(files.get(tsconfigErrors[0]) ?? [])].slice(0, 3);
    fail(`the type-aware rules did NOT run: oxlint-tsgolint rejected this repo's tsconfig (${tsconfigErrors.join(', ')} × ${tsconfigErrors.reduce((a, r) => a + counts.get(r), 0)})`, [
        'Every type-aware count would be a FALSE ZERO: typescript/no-floating-promises,',
        'no-misused-promises and no-duplicate-type-constituents were skipped, not clean.',
        `Reported against: ${affected.join(', ')}${(files.get(tsconfigErrors[0])?.size ?? 0) > 3 ? ', …' : ''}`,
        'Common cause: `baseUrl` in a tsconfig — TypeScript 6.0 removed it; use relative `paths` instead.',
        'Fix the tsconfig, then re-run.',
    ]);
}

const total = [...counts.values()].reduce((a, b) => a + b, 0);
// Cheapest wins first: zero-violation rules go straight to `error` for free, then ascending count.
const free = [...enabled].filter((r) => !counts.has(r)).sort();
const sequence = [...counts.keys()].sort((a, b) => counts.get(a) - counts.get(b) || a.localeCompare(b));
const branch = total <= THRESHOLD ? 'ai-assisted-fix' : 'stay-on-eslint';
const BRANCH_TEXT = {
    'ai-assisted-fix': `${total} violations is at or below ~${THRESHOLD} — one-time AI-assisted fix, landed as ONE reviewable PR (SKILL.md §3).`,
    'stay-on-eslint': `${total} violations is above ~${THRESHOLD} — stay on ESLint + suppressions until oxc-project/oxc#10549 lands (SKILL.md §3).`,
};

if (json) {
    console.log(JSON.stringify({
        measuredAt: new Date().toISOString().slice(0, 10),
        dir, filesScanned: scanned, rulesLoaded: loaded, total, threshold: THRESHOLD, branch,
        freeToEnable: free,
        fixSequence: sequence.map((rule) => ({ rule, count: counts.get(rule), files: files.get(rule).size })),
    }, null, 2));
    process.exit(total ? 1 : 0);
}

console.log(`\nMEASURED ${dir}/ — ${total} violation(s) across ${scanned} files, ${loaded} rules loaded\n`);
console.log(`§3 BRANCH: ${BRANCH_TEXT[branch]}\n`);
console.log(`FIX SEQUENCE — cheapest first.\n`);
console.log(`  1. FREE — ${free.length} rule(s) at zero violations. Set these to 'error' now; they can only regress from here.`);
for (const rule of free) console.log(`       ✓ ${rule}`);
if (sequence.length) {
    console.log(`\n  2. THEN, ascending by count — ${sequence.length} rule(s):`);
    console.log(`       ${'rule'.padEnd(46)}${'count'.padStart(7)}${'files'.padStart(7)}`);
    for (const rule of sequence) console.log(`       ${rule.padEnd(46)}${String(counts.get(rule)).padStart(7)}${String(files.get(rule).size).padStart(7)}`);
} else {
    console.log(`\n  2. Nothing to fix — this repo already satisfies every rule in the standard.`);
}
console.log('');
process.exit(total ? 1 : 0);
