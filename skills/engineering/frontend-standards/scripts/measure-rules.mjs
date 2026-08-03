#!/usr/bin/env node
// Measures a repo against the standard's rules WITHOUT modifying its ESLint config.
//
// Copies nothing permanent: writes a temporary probe config that imports the repo's own
// config, appends the rules being measured, runs ESLint against the copy, then deletes it.
// Never edit a live config to measure it — a crashed run leaves the repo altered.
//
// Usage, from the root of the repo being measured:
//   node <path>/measure-rules.mjs [--dir src] [--set react-hooks|budgets|all] [--json]
//
// Scope with --dir on large repos: a full react-hooks pass invokes the React Compiler on
// every file and can exceed two minutes on ~1,500 files.

import { execFileSync } from 'node:child_process';
import { writeFileSync, unlinkSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const arg = (flag, fallback) => {
    const i = process.argv.indexOf(flag);
    return i === -1 ? fallback : process.argv[i + 1];
};
const has = (flag) => process.argv.includes(flag);

const dir = arg('--dir', 'src');
const set = arg('--set', 'all');
const cwd = process.cwd();

// Rules that report React Compiler limitations rather than defects in your code.
// See references/react-hooks-v7.md. Measured for information, never recommended.
const COMPILER_DIAGNOSTICS = new Set(['todo', 'invariant', 'incompatible-library']);
const INFRA_ONLY = new Set(['syntax', 'unsupported-syntax', 'config', 'gating', 'rule-suppression', 'fbt']);

const BUDGETS = {
    complexity: ['error', 15],
    'max-depth': ['error', 4],
    'max-lines': ['error', { max: 500, skipBlankLines: true, skipComments: true }],
};

const configFile = ['eslint.config.js', 'eslint.config.mjs', 'eslint.config.ts']
    .find((f) => existsSync(join(cwd, f)));

if (!configFile) {
    console.error('No flat ESLint config found (eslint.config.{js,mjs,ts}). Run this from the repo root.');
    process.exit(1);
}

const probe = join(cwd, `.probe.eslint.config.${Date.now()}.mjs`);
const wantHooks = set === 'all' || set === 'react-hooks';
const wantBudgets = set === 'all' || set === 'budgets';

writeFileSync(probe, `
import base from './${configFile}';
${wantHooks ? "import reactHooks from 'eslint-plugin-react-hooks';" : ''}

const rules = {};
${wantHooks ? `for (const r of Object.keys(reactHooks.rules)) rules['react-hooks/' + r] = 'error';` : ''}
${wantBudgets ? `Object.assign(rules, ${JSON.stringify(BUDGETS)});` : ''}

export default [
    ...base,
    {
        files: ['${dir}/**/*.{ts,tsx,js,jsx}'],
        ${wantHooks ? "plugins: { 'react-hooks': reactHooks }," : ''}
        rules,
    },
];
`);

let out = '';
try {
    out = execFileSync('npx', ['eslint', '--no-config-lookup', '-c', probe, dir, '--format', 'json'],
        { cwd, encoding: 'utf8', maxBuffer: 512 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] });
} catch (err) {
    // ESLint exits non-zero whenever it reports anything; stdout is still the report.
    out = err.stdout ?? '';
    if (!out) {
        console.error('ESLint produced no output. Is eslint installed in this repo? Try a smaller --dir.');
        unlinkSync(probe);
        process.exit(1);
    }
} finally {
    if (existsSync(probe)) unlinkSync(probe);
}

const results = JSON.parse(out);
const counts = new Map();
const files = new Map();

for (const file of results) {
    for (const msg of file.messages) {
        const id = msg.ruleId;
        if (!id) continue;
        const measured = id.startsWith('react-hooks/') || id in BUDGETS;
        if (!measured) continue;
        counts.set(id, (counts.get(id) ?? 0) + 1);
        if (!files.has(id)) files.set(id, new Set());
        files.get(id).add(file.filePath);
    }
}

const bare = (id) => id.replace('react-hooks/', '');
const classify = (id) => {
    const n = bare(id);
    if (COMPILER_DIAGNOSTICS.has(n)) return 'compiler-diagnostic';
    if (INFRA_ONLY.has(n)) return 'infra-only';
    return 'real';
};

const allRuleIds = [
    ...(wantHooks
        ? readdirSync(join(cwd, 'node_modules/eslint-plugin-react-hooks')).length
            ? Object.keys((await import(join(cwd, 'node_modules/eslint-plugin-react-hooks/index.js'))).default?.rules ?? {})
                .map((r) => `react-hooks/${r}`)
            : []
        : []),
    ...(wantBudgets ? Object.keys(BUDGETS) : []),
];

const real = allRuleIds.filter((id) => classify(id) === 'real');
const clean = real.filter((id) => !counts.has(id));
const dirty = real.filter((id) => counts.has(id)).sort((a, b) => counts.get(b) - counts.get(a));
const excluded = allRuleIds.filter((id) => classify(id) !== 'real' && counts.has(id));

if (has('--json')) {
    console.log(JSON.stringify({
        measuredAt: new Date().toISOString().slice(0, 10),
        dir,
        freeToEnable: clean.map(bare),
        needsMigration: dirty.map((id) => ({ rule: bare(id), count: counts.get(id), files: files.get(id).size })),
        neverEnable: excluded.map((id) => ({ rule: bare(id), count: counts.get(id), why: classify(id) })),
    }, null, 2));
    process.exit(0);
}

const total = [...counts.values()].reduce((a, b) => a + b, 0);
console.log(`\nMeasured ${dir}/ — ${total} violations across ${results.length} files scanned\n`);

console.log(`FREE TO ENABLE NOW at 'error' — ${clean.length} rule(s), zero violations:`);
console.log(clean.length ? clean.map(bare).map((r) => `  ✓ ${r}`).join('\n') : '  (none)');

console.log(`\nNEEDS MIGRATION — 'error' + suppressions baseline:`);
if (dirty.length) {
    console.log(`  ${'rule'.padEnd(34)}${'count'.padStart(7)}${'files'.padStart(7)}`);
    for (const id of dirty) {
        console.log(`  ${bare(id).padEnd(34)}${String(counts.get(id)).padStart(7)}${String(files.get(id).size).padStart(7)}`);
    }
} else {
    console.log('  (none — this repo is fully compliant)');
}

if (excluded.length) {
    console.log(`\nDO NOT ENABLE — reports tool limitations, not defects in your code:`);
    for (const id of excluded) {
        console.log(`  ✗ ${bare(id).padEnd(24)} ${String(counts.get(id)).padStart(5)} findings  (${classify(id)})`);
    }
}

console.log(`\nNext: enable the free rules at 'error', then for the rest:`);
console.log(`  npx eslint . --fix && npx eslint . --suppress-all`);
console.log(`Verify a rule is actually live (a typo fails silently):`);
console.log(`  npx eslint --print-config <a-real-file> | grep <rule-name>\n`);
