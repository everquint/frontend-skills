#!/usr/bin/env node
// Validates every SKILL.md against the Agent Skills spec and this repo's own budgets.
// Exits non-zero on any failure so CI gates it.
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';

const ROOT = join(import.meta.dirname, '..', 'skills');
const MAX_LINES = 200;
const MAX_DESCRIPTION = 1536;
const HEDGES = /\b(consider|generally|where possible|as appropriate|try to)\b/i;

const find = (dir) => readdirSync(dir).flatMap((e) => {
    const p = join(dir, e);
    return statSync(p).isDirectory() ? find(p) : (e === 'SKILL.md' ? [p] : []);
});

// Reads one scalar out of the frontmatter, handling YAML block scalars (`>-`, `>`, `|`, `|-`)
// as well as plain inline values. A naive single-line regex silently reports the block marker
// itself as the value, so a 2,000-character folded description passes a 1,536-character cap.
const yamlScalar = (frontmatter, key) => {
    const lines = frontmatter.split('\n');
    const start = lines.findIndex((l) => new RegExp(`^${key}:`).test(l));
    if (start === -1) return undefined;

    const inline = lines[start].slice(key.length + 1).trim();
    if (inline && !/^[|>][-+]?$/.test(inline)) return inline;

    // Block scalar: consume the following more-indented lines.
    const body = [];
    for (let i = start + 1; i < lines.length; i++) {
        if (/^\S/.test(lines[i]) && lines[i].trim() !== '') break;
        body.push(lines[i].trim());
    }
    return body.join(' ').replace(/\s+/g, ' ').trim() || undefined;
};

const errors = [];

if (!existsSync(ROOT)) {
    console.error(`No skills/ directory found at ${ROOT}. Run this from the repo that owns it.`);
    process.exit(1);
}

const skills = find(ROOT);

for (const file of skills) {
    const rel = file.slice(ROOT.length + 1);
    const raw = readFileSync(file, 'utf8');
    const fm = raw.match(/^---\n([\s\S]*?)\n---\n/);

    if (!fm) { errors.push(`${rel}: missing YAML frontmatter`); continue; }

    const name = yamlScalar(fm[1], 'name');
    const desc = yamlScalar(fm[1], 'description');

    if (!name) errors.push(`${rel}: frontmatter missing required 'name'`);
    if (!desc) errors.push(`${rel}: frontmatter missing required 'description'`);
    if (name && !/^[a-z0-9-]+$/.test(name)) errors.push(`${rel}: name '${name}' must be lowercase with hyphens`);
    if (name && name !== basename(dirname(file))) errors.push(`${rel}: name '${name}' does not match its directory`);
    if (desc && desc.length > MAX_DESCRIPTION) errors.push(`${rel}: description ${desc.length} chars exceeds ${MAX_DESCRIPTION}`);

    const lines = raw.split('\n').length;
    if (lines > MAX_LINES) errors.push(`${rel}: ${lines} lines exceeds the ${MAX_LINES}-line budget`);

    const body = raw.slice(fm[0].length);
    body.split('\n').forEach((line, i) => {
        // Quoted examples of bad phrasing are legitimate; only flag unquoted prose.
        if (HEDGES.test(line) && !line.includes('"') && !line.includes('`')) {
            errors.push(`${rel}:${i + 2}: hedging phrase — state the rule instead: ${line.trim().slice(0, 60)}`);
        }
    });
}

const dupes = skills.map((f) => basename(dirname(f))).filter((n, i, a) => a.indexOf(n) !== i);
if (dupes.length) errors.push(`duplicate skill names: ${[...new Set(dupes)].join(', ')}`);

console.log(`checked ${skills.length} skill(s)`);
if (errors.length) { console.error('\n' + errors.map((e) => `  ✗ ${e}`).join('\n')); process.exit(1); }
console.log('all skills valid');
