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
const read = (f) => { try { return readFileSync(p(f), 'utf8'); } catch { return ''; } };

const pkg = (() => { try { return JSON.parse(read('package.json')); } catch { return {}; } })();
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
const suffix = tests.filter((f) => /\.test\./.test(f)).length >= tests.filter((f) => /\.spec\./.test(f)).length
    ? '.test.' : '.spec.';
const networkSeam = dep('msw') ? fact('msw', 'msw dependency') : unknown('no network-level mocking library');

// ── gates: what is already wired ─────────────────────────────────────────────
const huskyDir = exists('.husky');
const hooks = huskyDir ? readdirSync(p('.husky')).filter((f) => !f.startsWith('_') && !f.startsWith('.')) : [];
const ciFiles = exists('.github/workflows') ? readdirSync(p('.github/workflows')) : [];

const gates = {
    hookManager: huskyDir ? fact('husky', '.husky/ present') : dep('lefthook') ? fact('lefthook', 'dependency') : unknown('none'),
    hooksPresent: fact(hooks.length ? hooks : 'none', '.husky/ contents'),
    lintStaged: 'lint-staged' in pkg || dep('lint-staged') ? fact(true, 'config or dependency') : fact(false, 'absent'),
    commitlint: dep('@commitlint/cli') ? fact(true, 'dependency') : fact(false, 'absent'),
    ci: fact(ciFiles.length ? ciFiles : 'NONE — no CI workflows', '.github/workflows'),
    coverageThreshold: /thresholds/.test(read('vitest.config.ts') + read('vite.config.ts'))
        ? fact(true, 'vitest config') : fact(false, 'no thresholds in vitest config'),
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
const at = (q) => lens.length ? lens[Math.floor(lens.length * q)] : 0;

const profile = {
    profiledAt: new Date().toISOString().slice(0, 10),
    packageManager, framework, uiLib,
    monorepo: pkg.workspaces || exists('pnpm-workspace.yaml') ? fact(true, 'workspaces field') : fact(false, 'single package'),
    router: dep('react-router-dom') ? fact('react-router-dom', 'dependency')
        : dep('@tanstack/react-router') ? fact('@tanstack/react-router', 'dependency')
        : framework.value.startsWith('next') ? fact('next built-in', 'framework') : unknown('none detected'),
    serverState: dep('@tanstack/react-query') ? fact('react-query', 'dependency')
        : dep('swr') ? fact('swr', 'dependency') : unknown('none detected'),
    clientState: [dep('@reduxjs/toolkit') && 'redux-toolkit', dep('zustand') && 'zustand',
        dep('jotai') && 'jotai', dep('@tanstack/react-store') && 'tanstack-store'].filter(Boolean),
    formatter: dep('prettier') ? fact('prettier', 'dependency')
        : dep('@biomejs/biome') ? fact('biome', 'dependency')
        : fact('none — @stylistic ESLint rules are the formatter', 'no formatter dependency'),
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
line('coverage', `${profile.tests.files} tests / ${profile.tests.sourceFiles} source = ${profile.tests.ratio}`);
console.log('\nGATES');
for (const [k, v] of Object.entries(gates)) line(k, show(v));
console.log('\nNODE / EDITOR PINNING');
for (const [k, v] of Object.entries(pinning)) line(k, JSON.stringify(v));
console.log('\nFILE SIZE (raw lines, non-test)');
line('p50 / p90 / max', `${profile.sizeDistribution.p50} / ${profile.sizeDistribution.p90} / ${profile.sizeDistribution.max}`);
line('over 500 raw', profile.sizeDistribution.filesOver500Raw);
console.log('\nThese are facts, not a standard. Use them to sequence the migration.\n');
