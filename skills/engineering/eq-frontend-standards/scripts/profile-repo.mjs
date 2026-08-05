#!/usr/bin/env node
// Detects STACK FACTS about a repo. Facts only — never conventions, never a standard.
//
// The standard does not vary per repo. This exists to tell you which parts of it apply
// (framework overlays, which gates are already wired) and where the gaps are. It must
// never be used to infer what a repo's rules "should" be from what it currently does.
//
// Every field reports its evidence. A fact with no evidence is reported as unknown, not
// guessed — a wrong guess here becomes a wrong rule in someone's repo.
//
// Usage, from the root of the repo being profiled:
//   node <path>/profile-repo.mjs [--json]

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const cwd = process.cwd();
const json = process.argv.includes('--json');
const p = (f) => join(cwd, f);
const exists = (f) => existsSync(p(f));
const isDir = (f) => { try { return statSync(p(f)).isDirectory(); } catch { return false; } };
const listDir = (f) => { try { return readdirSync(p(f)); } catch { return []; } };
const read = (f) => { try { return readFileSync(p(f), 'utf8'); } catch { return ''; } };

const pkg = (() => {
    try {
        const parsed = JSON.parse(read('package.json'));
        // `JSON.parse('null')` succeeds. Optional chaining on a property does not guard a null base.
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch { return {}; }
})();
const deps = { ...pkg.dependencies, ...pkg.devDependencies };
const dep = (n) => n in deps;

const walk = (dir, out = []) => {
    let entries = [];
    try { entries = readdirSync(dir); } catch { return out; }
    for (const e of entries) {
        if (e === 'node_modules' || e.startsWith('.')) continue;
        const full = join(dir, e);
        let st; try { st = statSync(full); } catch { continue; }
        if (st.isDirectory()) walk(full, out);
        else out.push(full);
    }
    return out;
};

const srcRoot = ['src', 'app', 'lib'].map(p).find(existsSync) ?? cwd;
const allFiles = walk(srcRoot);
const source = allFiles.filter((f) => /\.(ts|tsx|js|jsx)$/.test(f) && !/\.(test|spec)\./.test(f));
const tests = allFiles.filter((f) => /\.(test|spec)\.(ts|tsx|js|jsx)$/.test(f));

const fact = (value, evidence) => ({ value, evidence });
const unknown = (why) => ({ value: 'unknown', evidence: why });

// ── stack ────────────────────────────────────────────────────────────────────
const packageManager =
      exists('pnpm-lock.yaml') ? fact('pnpm', 'pnpm-lock.yaml')
    : exists('yarn.lock') ? fact('yarn', 'yarn.lock')
    : exists('bun.lockb') ? fact('bun', 'bun.lockb')
    : exists('package-lock.json') ? fact('npm', 'package-lock.json')
    : unknown('no lockfile found');

// Config files are matched by prefix, not exact name: a repo with multiple entry points names them
// `vite.config.app.ts`, `vite.config.admin.ts` and so on, and an exact-name check misses all of them.
const rootEntries = (() => { try { return readdirSync(cwd); } catch { return []; } })();
const configLike = (prefix) => rootEntries.filter((f) => f.startsWith(`${prefix}.config`) && /\.(ts|js|mjs|cjs)$/.test(f));

const nextConfigs = configLike('next');
const viteConfigs = configLike('vite');
const metroConfigs = configLike('metro');

const framework =
      nextConfigs.length
        ? fact(exists('app') || exists('src/app') ? 'next-app-router' : 'next-pages-router',
            `${nextConfigs.join(', ')} + directory shape`)
    : dep('expo') || metroConfigs.length ? fact('expo', dep('expo') ? 'expo dependency' : metroConfigs.join(', '))
    : viteConfigs.length ? fact('vite-spa', viteConfigs.join(', '))
    : dep('react-scripts') ? fact('cra', 'react-scripts dependency')
    : unknown('no framework config file matched');

const uiLib = dep('react') ? fact(`react@${deps.react}`, 'package.json') : unknown('react not a dependency');

// ── styling census — a distribution, not a winner ────────────────────────────
const count = (re) => allFiles.filter((f) => re.test(f)).length;
const styling = {
    'css-modules': count(/\.module\.(css|scss)$/),
    'plain-scss': count(/\.scss$/) - count(/\.module\.scss$/),
    'plain-css': count(/\.css$/) - count(/\.module\.css$/),
    'vanilla-extract': count(/\.css\.ts$/),
    tailwind: dep('tailwindcss') ? 'dependency present' : 0,
    'styled-components': dep('styled-components') || dep('@emotion/react') ? 'dependency present' : 0,
};

// ── test setup ───────────────────────────────────────────────────────────────
const runner = dep('vitest') ? fact('vitest', 'vitest dependency')
    : dep('jest') ? fact('jest', 'jest dependency')
    : unknown('no test runner dependency');
const suffix = tests.length === 0
    ? unknown('no test files found').value
    : (tests.filter((f) => /\.test\./.test(f)).length >= tests.filter((f) => /\.spec\./.test(f)).length ? '.test.' : '.spec.');
const networkSeam = dep('msw') ? fact('msw', 'msw dependency') : unknown('no network-level mocking library');

// Formatting done INSIDE the linter: @stylistic rules produce no formatter dependency, so without
// this the formatter row reads `unknown` for exactly the setup the standard replaces. The config
// scan covers flat and legacy eslint configs at the root; a config kept elsewhere is missed and the
// deps check is what usually catches it anyway (the plugin must be installed to run).
const eslintConfigFiles = rootEntries.filter((f) => /^eslint\.config\.[cm]?[jt]s$/.test(f) || f.startsWith('.eslintrc'));
const stylisticInLinter = Object.keys(deps).some((d) => d.startsWith('@stylistic/')) ? '@stylistic plugin in dependencies'
    : eslintConfigFiles.find((f) => read(f).includes('@stylistic')) ?? null;

// ── gates: what is already wired ─────────────────────────────────────────────
const huskyDir = isDir('.husky');
const hooks = listDir('.husky').filter((f) => !f.startsWith('_') && !f.startsWith('.'));
const ciFiles = listDir('.github/workflows');

const gates = {
    hookManager: huskyDir ? fact('husky', '.husky/ present') : dep('lefthook') ? fact('lefthook', 'dependency') : unknown('none'),
    hooksPresent: fact(hooks.length ? hooks : 'none', '.husky/ contents'),
    lintStaged: 'lint-staged' in pkg || dep('lint-staged') ? fact(true, 'config or dependency') : fact(false, 'absent'),
    commitlint: dep('@commitlint/cli') ? fact(true, 'dependency') : fact(false, 'absent'),
    ci: fact(ciFiles.length ? ciFiles : 'NONE — no CI workflows', '.github/workflows'),
    // Exact filenames miss vitest.config.mts, vitest.workspace.ts and vite.config.app.ts, and
    // reporting `false` for "we could not find a config" asserts a fact that was never measured.
    coverageThreshold: (() => {
        const candidates = [...configLike('vitest'), ...configLike('vite')];
        if (!candidates.length && !('vitest' in (pkg ?? {}))) return unknown('no vitest/vite config file found');
        const body = candidates.map((f) => read(f)).join('\n') + JSON.stringify(pkg.vitest ?? {});
        return /thresholds/.test(body)
            ? fact(true, candidates.join(', ') || 'package.json')
            : fact(false, `no thresholds in ${candidates.join(', ') || 'package.json'}`);
    })(),
    errorReporter: Object.keys(deps).some((d) => /sentry|bugsnag|rollbar|datadog/i.test(d))
        ? fact(true, 'dependency') : fact(false, 'no error-reporting dependency'),
};

// ── pinning consistency ──────────────────────────────────────────────────────
const nvmrc = exists('.nvmrc') ? read('.nvmrc').trim() : null;
const engines = pkg.engines?.node ?? null;
const pinning = {
    nvmrc: nvmrc ?? 'absent',
    engines: engines ?? 'absent',
    packageManager: pkg.packageManager ?? 'absent',
    editorconfig: exists('.editorconfig'),
    consistent: Boolean(nvmrc && engines && pkg.packageManager && exists('.editorconfig')),
};

// ── size distribution — informs the migration, not the limit ─────────────────
const lens = source.map((f) => read(f.slice(cwd.length + 1)).split('\n').length).sort((a, b) => a - b);
// Nearest-rank. `lens[floor(n*q)]` is one rank high, which makes p90 equal max for n <= 10 —
// so a 3-file repo reports its largest file as the 90th percentile.
const at = (q) => (lens.length ? lens[Math.min(lens.length - 1, Math.max(0, Math.ceil(q * lens.length) - 1))] : 0);

const profile = {
    profiledAt: new Date().toISOString().slice(0, 10),
    packageManager, framework, uiLib,
    monorepo: pkg.workspaces ? fact(true, 'workspaces field in package.json')
        : exists('pnpm-workspace.yaml') ? fact(true, 'pnpm-workspace.yaml')
        : fact(false, 'no workspaces field, no pnpm-workspace.yaml'),
    router: dep('react-router-dom') ? fact('react-router-dom', 'dependency')
        : dep('@tanstack/react-router') ? fact('@tanstack/react-router', 'dependency')
        : framework.value.startsWith('next') ? fact('next built-in', 'framework') : unknown('none detected'),
    serverState: dep('@tanstack/react-query') ? fact('react-query', 'dependency')
        : dep('swr') ? fact('swr', 'dependency') : unknown('none detected'),
    clientState: [dep('@reduxjs/toolkit') && 'redux-toolkit', dep('zustand') && 'zustand',
        dep('jotai') && 'jotai', dep('@tanstack/react-store') && 'tanstack-store'].filter(Boolean),
    // Detection only. A repo formatting through @stylistic lint rules has no formatter dependency,
    // and reporting that as `unknown` hid the one arrangement the standard exists to replace — the
    // audit then never surfaced it. The @stylistic branch is evidence-based (the plugin in deps or
    // named in an eslint config), unlike the old unconditional fallback that asserted it for every
    // repo with no formatter.
    formatter: dep('oxfmt') ? fact('oxfmt', 'dependency')
        : dep('prettier') ? fact('prettier', 'dependency')
        : dep('@biomejs/biome') ? fact('biome', 'dependency')
        : stylisticInLinter ? fact('none (formatting via @stylistic lint rules — the anti-pattern the standard replaces)', stylisticInLinter)
        : unknown('no formatter dependency'),
    styling,
    tests: {
        runner, suffix, networkSeam,
        files: tests.length, sourceFiles: source.length,
        ratio: source.length ? `${((tests.length / source.length) * 100).toFixed(1)}%` : 'n/a',
    },
    gates, pinning,
    sizeDistribution: { p50: at(0.5), p90: at(0.9), max: lens.at(-1) ?? 0, filesOver500Raw: lens.filter((n) => n > 500).length },
};

if (json) { console.log(JSON.stringify(profile, null, 2)); process.exit(0); }

const line = (k, v) => console.log(`  ${String(k).padEnd(22)} ${v}`);
const show = (f) => typeof f === 'object' && f && 'value' in f ? `${JSON.stringify(f.value)}   (${f.evidence})` : JSON.stringify(f);

console.log(`\nSTACK FACTS — ${cwd}\n`);
for (const k of ['packageManager', 'framework', 'uiLib', 'monorepo', 'router', 'serverState', 'formatter']) line(k, show(profile[k]));
line('clientState', JSON.stringify(profile.clientState));
console.log('\nSTYLING CENSUS');
for (const [k, v] of Object.entries(styling)) if (v) line(k, v);
console.log('\nTESTS');
line('runner', show(runner)); line('suffix', suffix); line('network seam', show(networkSeam));
// "coverage" was a lie: this is a file-count ratio, not line coverage — a repo with one giant test
// file per module reads low, one with thin smoke tests reads high. Label it as what it measures.
line('test-file density', `${profile.tests.files} tests / ${profile.tests.sourceFiles} source = ${profile.tests.ratio}`);
console.log('\nGATES');
for (const [k, v] of Object.entries(gates)) line(k, show(v));
console.log('\nNODE / EDITOR PINNING');
for (const [k, v] of Object.entries(pinning)) line(k, JSON.stringify(v));
console.log('\nFILE SIZE (raw lines, non-test)');
line('p50 / p90 / max', `${profile.sizeDistribution.p50} / ${profile.sizeDistribution.p90} / ${profile.sizeDistribution.max}`);
line('over 500 raw', profile.sizeDistribution.filesOver500Raw);
console.log('\nThese are facts, not a standard. Use them to sequence the migration.\n');
