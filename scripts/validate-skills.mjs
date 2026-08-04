#!/usr/bin/env node
// Validates every SKILL.md against the Agent Skills spec and this repo's own budgets.
// Exits non-zero on any failure so CI gates it.
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';

const ROOT = join(import.meta.dirname, '..', 'skills');
const MAX_LINES = 200;
// Mirrors the stricter of the published Agent Skills limits, so a skill that passes here is
// installable. The `skills` CLI's registry-index validator rejects a description over 1024 chars
// and a name that is empty, over 64 chars, not `[a-z0-9-]`, hyphen-terminated, or doubly-hyphenated.
// Whether the git-clone install path runs the same checks is unconfirmed — these hold us to the
// documented limit either way rather than to whatever one code path happens to enforce.
const MAX_DESCRIPTION = 1024;
const MAX_NAME = 64;
const HEDGES = /\b(consider|generally|where possible|as appropriate|try to)\b/i;

// Path-like mentions in a SKILL.md body that must resolve to a real file. Three shapes, all of
// which appear in the current bodies:
//   references/<file>.md            — beside the skill
//   scripts/<file>.mjs              — beside the skill
//   ../<other-skill>/references/…   — cross-skill link; assumes skills install flat as siblings
// `<skill>/` is the bodies' placeholder for the install location and is stripped before resolving.
// A concrete lowercase-hyphen basename plus extension is required, which is what keeps prose and
// abbreviations out: bare `scripts/`, `~/.claude/skills/<name>/scripts/`, the literal
// `scripts/<name>.mjs` abbreviation, and directory-less filenames like `check-structure.mjs` or
// `structure.md` all fail to match. See the `hasOwnDir` gate below for the remaining trap.
const PATH_MENTION = /(?:<skill>\/)?((?:\.\.\/[a-z0-9-]+\/)?(?:references|scripts)\/[a-z0-9-]+\.(?:md|mjs))/g;

const find = (dir) => readdirSync(dir).flatMap((e) => {
    const p = join(dir, e);
    const st = statSync(p, { throwIfNoEntry: false });
    if (!st) return [];   // broken symlink — skip rather than abort the whole run
    return st.isDirectory() ? find(p) : (e === 'SKILL.md' ? [p] : []);
});

// Reads one scalar out of the frontmatter, handling YAML block scalars (`>-`, `>`, `|`, `|-`)
// as well as plain inline values. A naive single-line regex silently reports the block marker
// itself as the value, so a 2,000-character folded description passes a 1,536-character cap.
// `name: "demo"` is legal YAML. Leaving the quotes in makes the value fail both the
// lowercase-and-hyphens test and the directory-match test, so CI rejects a valid skill.
const unquote = (v) => (v && /^(['"]).*\1$/.test(v) ? v.slice(1, -1) : v);

const yamlScalar = (frontmatter, key) => {
    const lines = frontmatter.split('\n');
    const start = lines.findIndex((l) => new RegExp(`^${key}:`).test(l));
    if (start === -1) return undefined;

    const inline = lines[start].slice(key.length + 1).trim();
    if (inline && !/^[|>][-+]?$/.test(inline)) return unquote(inline);

    // Block scalar: consume the following more-indented lines.
    const body = [];
    for (let i = start + 1; i < lines.length; i++) {
        if (/^\S/.test(lines[i]) && lines[i].trim() !== '') break;
        body.push(lines[i].trim());
    }
    return unquote(body.join(' ').replace(/\s+/g, ' ').trim()) || undefined;
};

const findNamed = (dir, target) => readdirSync(dir).flatMap((e) => {
    const p = join(dir, e);
    const st = statSync(p, { throwIfNoEntry: false });
    if (!st) return [];
    return st.isDirectory() ? findNamed(p, target) : (e === target ? [p] : []);
});

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
    if (name && name.length > MAX_NAME) errors.push(`${rel}: name ${name.length} chars exceeds ${MAX_NAME}`);
    if (name && (name.startsWith('-') || name.endsWith('-'))) errors.push(`${rel}: name '${name}' must not start or end with a hyphen`);
    if (name && name.includes('--')) errors.push(`${rel}: name '${name}' must not contain a doubled hyphen`);
    if (name && name !== basename(dirname(file))) errors.push(`${rel}: name '${name}' does not match its directory`);
    if (desc && desc.length > MAX_DESCRIPTION) errors.push(`${rel}: description ${desc.length} chars exceeds ${MAX_DESCRIPTION}`);

    const lines = raw.split('\n').length;
    if (lines > MAX_LINES) errors.push(`${rel}: ${lines} lines exceeds the ${MAX_LINES}-line budget`);

    // The body starts after the whole frontmatter block, so a body-relative index reports a line
    // number that lands on unrelated text in an editor. Offset by the frontmatter's own length.
    const frontmatterLines = fm[0].split('\n').length - 1;
    const body = raw.slice(fm[0].length);
    body.split('\n').forEach((line, i) => {
        // Quoted examples of bad phrasing are legitimate; only flag unquoted prose.
        if (HEDGES.test(line) && !line.includes('"') && !line.includes('`')) {
            errors.push(`${rel}:${frontmatterLines + i + 1}: hedging phrase — state the rule instead: ${line.trim().slice(0, 60)}`);
        }
    });

    // Progressive disclosure is the repo's core asset: procedure in SKILL.md, detail in
    // references/, executables in scripts/. A renamed target breaks the chain with no error at
    // load time, so every mentioned path is stat'd here.
    const skillDir = dirname(file);
    // A skill with no scripts/ (or references/) folder of its own cannot be naming its own file —
    // eq-frontend-quality-bar discusses the *standards* skill's `scripts/check-structure.mjs` in
    // prose. Without this gate that sentence is a false positive, and a validator that cries wolf
    // gets switched off.
    const hasOwnDir = (kind) => existsSync(join(skillDir, kind));
    const seen = new Set();
    for (const [, rel] of body.matchAll(PATH_MENTION)) {
        if (seen.has(rel)) continue;
        seen.add(rel);
        if (!rel.startsWith('../') && !hasOwnDir(rel.split('/')[0])) continue;
        // A `../<skill>/…` link is written for the *installed* layout, where every skill is a flat
        // sibling. In this repo they are nested under category folders, so resolving it literally
        // against skillDir only works when both skills happen to share a category — it broke the
        // moment the first skill moved out of `engineering/`. Resolve the sibling by name instead;
        // the duplicate-name check below is what makes that lookup unambiguous.
        const sibling = rel.match(/^\.\.\/([a-z0-9-]+)\/(.+)$/);
        const siblingDir = sibling && skills.map(dirname).find((d) => basename(d) === sibling[1]);
        const target = sibling ? (siblingDir && join(siblingDir, sibling[2])) : join(skillDir, rel);
        if (!target || !statSync(target, { throwIfNoEntry: false })) {
            errors.push(`${basename(skillDir)}/SKILL.md: references missing file '${rel}'`);
        }
    }
}

// standard-check.mjs embeds its version as a constant so it survives being copied by
// `npx skills add` without the repo manifest. That only holds if the two cannot drift.
const pkgVersion = JSON.parse(readFileSync(join(import.meta.dirname, '..', 'package.json'), 'utf8')).version;
// Found by search, not by a hardcoded path: a renamed skill directory would silently skip this
// assertion, which is the same class of failure the assertion exists to catch.
const checkers = findNamed(ROOT, 'standard-check.mjs');
if (checkers.length !== 1) {
    errors.push(`expected exactly one standard-check.mjs under skills/, found ${checkers.length}`);
} else {
    const embedded = readFileSync(checkers[0], 'utf8').match(/^const STANDARD_VERSION = '([^']+)';$/m)?.[1];
    if (!embedded) errors.push('standard-check.mjs: no STANDARD_VERSION constant found');
    else if (embedded !== pkgVersion) {
        errors.push(`standard-check.mjs: STANDARD_VERSION '${embedded}' != package.json '${pkgVersion}'`);
    }
}

const dupes = skills.map((f) => basename(dirname(f))).filter((n, i, a) => a.indexOf(n) !== i);
if (dupes.length) errors.push(`duplicate skill names: ${[...new Set(dupes)].join(', ')}`);

console.log(`checked ${skills.length} skill(s)`);
if (errors.length) { console.error('\n' + errors.map((e) => `  ✗ ${e}`).join('\n')); process.exit(1); }
console.log('all skills valid');
