#!/usr/bin/env node
// The claim validator — the sediment gate for rule names. The skills' prose names lint rules the
// starter configs are claimed to carry; nothing linked the two, so a renamed or dropped rule left
// the docs asserting enforcement that no longer existed. This script fails the build when a doc
// mentions a PREFIXED rule name (`plugin/rule`) that no starter lint config declares.
//
// Scope, deliberately v1:
//   * prefixed names only — bare core-rule names (`no-console`, `max-lines`) collide with ordinary
//     kebab prose, so they stay reviewer-checked;
//   * existence only, not severity — whether a doc says "error" where the config says "off" is a
//     judgement about the sentence around the name, which a grep cannot decide.
//
// A rule discussed WITHOUT being configured (a rejected rule, a forbidden spelling, a placeholder)
// goes in KNOWN_UNCONFIGURED with its reason. A new unconfigured mention fails until it is either
// configured or allowlisted — that decision surfacing in review is the point of the gate.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const STARTER = join(ROOT, 'skills', 'engineering', 'eq-frontend-standards', 'starter');

// oxlint configs carry comments; strip them before parsing. Line comments only start outside
// strings in these files, and no value contains `//`, so the simple form holds.
const readConfig = (p) =>
    JSON.parse(readFileSync(p, 'utf8').split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n'));

const configuredRules = new Set();
for (const f of ['.oxlintrc.json', '.oxlintrc.strict.json']) {
    const c = readConfig(join(STARTER, f));
    for (const section of [c.rules ?? {}, ...(c.overrides ?? []).map((o) => o.rules ?? {})]) {
        for (const name of Object.keys(section)) configuredRules.add(name);
    }
}

const KNOWN_UNCONFIGURED = new Map([
    ['react/prop-types', 'discussed as deliberately unused — prop types are TypeScript\'s job'],
    ['react-hooks/exhaustive-deps', 'the FORBIDDEN suppression spelling; docs name it to ban it'],
    ['react/recommended', 'a preset name, not a rule'],
    ['typescript/x', 'placeholder in prose'],
    ['jsx_a11y/x', 'placeholder in prose'],
    ['import/no-restricted-paths', 'evaluated and not adopted; named in prose as the rejected option'],
    ['react/no-children-prop', 'named in eslint-branch.md as an ESLint rule to enable on that branch; oxlint covers it via the correctness category rather than a by-name pin'],
]);

const mdFiles = [];
const walk = (dir) => {
    for (const e of readdirSync(dir)) {
        const p = join(dir, e);
        if (statSync(p).isDirectory()) {
            if (e === 'node_modules' || e === 'starter') continue; // starter configs ARE the source of truth
            walk(p);
        } else if (e.endsWith('.md')) mdFiles.push(p);
    }
};
walk(join(ROOT, 'skills'));

const PREFIXED_RULE = /`((?:react|typescript|jsx_a11y|import|oxc|react-hooks-js|react-hooks|eslint)\/[a-z0-9-]+)`/g;

const problems = [];
for (const f of mdFiles) {
    const text = readFileSync(f, 'utf8');
    for (const m of text.matchAll(PREFIXED_RULE)) {
        const name = m[1];
        if (configuredRules.has(name) || KNOWN_UNCONFIGURED.has(name)) continue;
        const line = text.slice(0, m.index).split('\n').length;
        problems.push(`${f.replace(ROOT + '/', '')}:${line} — \`${name}\` is not declared in any starter lint config and not allowlisted`);
    }
}

// The allowlist is itself sediment-prone: an entry whose name stops appearing in any doc is stale.
const allText = mdFiles.map((f) => readFileSync(f, 'utf8')).join('\n');
for (const name of KNOWN_UNCONFIGURED.keys()) {
    if (!allText.includes(`\`${name}\``)) {
        problems.push(`KNOWN_UNCONFIGURED entry '${name}' matches no doc mention — remove it from validate-claims.mjs`);
    }
}

if (problems.length) {
    console.error(`\n✗ ${problems.length} rule-name claim(s) drifted from the starter configs:`);
    for (const p of problems) console.error(`  ${p}`);
    console.error('\nFix the doc, configure the rule, or allowlist it with a reason in validate-claims.mjs.\n');
    process.exit(1);
}
console.log(`claims valid: ${configuredRules.size} configured rules, ${mdFiles.length} docs scanned, 0 drifted mentions`);
