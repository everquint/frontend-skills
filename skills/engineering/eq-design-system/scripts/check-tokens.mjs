#!/usr/bin/env node
// Token-system audit. Six checks, all of them things a linter in this stack cannot see: oxlint
// reads no stylesheet and inspects no class string, and oxfmt asserts nothing about values.
//
//   1 color-literal        a hex/rgb()/hsl()/`white`/`black` outside the token file
//   2 var-fallback         var(--x, <literal>) — pins one theme's value, silently
//   3 dark-only-token      a name declared in the dark block and not in :root
//   4 derived-literal      a semantic token or a dark override valued with a literal
//   5 broken-alias         a @theme alias pointing at a custom property nobody declares
//   6 arbitrary-value      bg-[#…], rounded-[10px], shadow-[…] — a scale step, restated
//
// Exit codes match `eq-frontend-standards/scripts/init-greenfield.mjs`: 0 clean, 2 findings,
// 1 the run never started (no paths, no token file). A finding is suppressed by `ds-ok: <reason>`
// in a comment on the same line; the reason is required, so a suppression is reviewable.
//
// Usage: node check-tokens.mjs [paths…] [--tokens <file>] [--json]

import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, extname, relative } from 'node:path';

const argv = process.argv.slice(2);
const flag = (name) => {
    const i = argv.indexOf(name);
    if (i === -1) return undefined;
    return argv[i + 1];
};
const asJson = argv.includes('--json');
const tokensFlag = flag('--tokens');
const roots = argv.filter((a, i) => !a.startsWith('--') && argv[i - 1] !== '--tokens');

const SOURCE = new Set(['.ts', '.tsx', '.js', '.jsx', '.mts', '.cts', '.css', '.scss', '.sass', '.less']);
const SKIP_DIR = new Set(['node_modules', 'dist', 'build', 'coverage', '.git', '.next', '.turbo', 'out']);

const walk = (dir, out = []) => {
    for (const entry of readdirSync(dir)) {
        if (SKIP_DIR.has(entry)) continue;
        const p = join(dir, entry);
        const st = statSync(p, { throwIfNoEntry: false });
        if (!st) continue;
        if (st.isDirectory()) walk(p, out);
        else if (SOURCE.has(extname(entry))) out.push(p);
    }
    return out;
};

const bail = (message) => {
    console.error(`check-tokens: ${message}`);
    process.exit(1);
};

const searchRoots = (roots.length ? roots : [existsSync('src') ? 'src' : '.']).filter((r) => {
    if (existsSync(r)) return true;
    bail(`path '${r}' does not exist`);
    return false;
});

const files = searchRoots.flatMap((r) => (statSync(r).isDirectory() ? walk(r) : [r]));
if (!files.length) bail('no source files found under ' + searchRoots.join(', '));

// The token file is the stylesheet that pulls in the framework and declares the theme. Its literals
// ARE the design system, so check 1 must not read it — and checks 3-5 read nothing else.
const isTokenFile = (f, text) =>
    extname(f) === '.css' && (/@theme\b/.test(text) || /@import\s+["']tailwindcss/.test(text));

const read = new Map(files.map((f) => [f, readFileSync(f, 'utf8')]));
const tokenFiles = tokensFlag ? [tokensFlag] : files.filter((f) => isTokenFile(f, read.get(f)));
if (tokensFlag && !existsSync(tokensFlag)) bail(`--tokens file '${tokensFlag}' does not exist`);
if (!tokenFiles.length) {
    bail('no token file found — expected one .css declaring @theme. Copy starter/index.css first.');
}
for (const f of tokenFiles) if (!read.has(f)) read.set(f, readFileSync(f, 'utf8'));

const findings = [];
const at = (file, text, index) => ({ file, line: text.slice(0, index).split('\n').length });
const lineOf = (text, index) => text.split('\n')[text.slice(0, index).split('\n').length - 1] ?? '';
const suppressed = (line) => /\bds-ok:\s*\S/.test(line);

const report = (check, file, text, index, message) => {
    const line = lineOf(text, index);
    if (suppressed(line)) return;
    findings.push({ check, ...at(file, text, index), message, source: line.trim().slice(0, 100) });
};

// Values that are colours by construction. `black`/`white` are matched as whole words only where a
// CSS value can start, which keeps `white-space` and a `whiteList` identifier out.
const COLOR_LITERAL =
    /#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?|oklch|lab)\(|(?<=[:\s(,])(?:white|black)(?=[;\s),]|$)/g;
const strippedComments = (text) => text.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));

// ── 1. colour literals outside the token file ───────────────────────────────
for (const [file, raw] of read) {
    if (tokenFiles.includes(file)) continue;
    const text = strippedComments(raw);
    for (const m of text.matchAll(COLOR_LITERAL)) {
        report('color-literal', file, raw, m.index, `\`${m[0]}\` — reference the token whose meaning fits`);
    }
}

// ── 2. literal fallbacks inside var() ───────────────────────────────────────
// A fallback that is itself a var() chain is a real pattern (a token aliasing another); only a
// literal default is the defect, because it wins whenever the token is absent from a theme.
for (const [file, raw] of read) {
    for (const m of strippedComments(raw).matchAll(/var\(\s*(--[\w-]+)\s*,\s*([^)]*)\)/g)) {
        if (/^\s*var\(/.test(m[2])) continue;
        report('var-fallback', file, raw, m.index, `var(${m[1]}, …) pins one theme's value — drop the fallback`);
    }
}

// ── token-file structure: parse :root and the dark block ────────────────────
const blockAt = (text, openIndex) => {
    let depth = 0;
    for (let i = openIndex; i < text.length; i++) {
        if (text[i] === '{') depth++;
        else if (text[i] === '}' && --depth === 0) return text.slice(openIndex, i + 1);
    }
    return text.slice(openIndex);
};
// A selector is preceded by start-of-file, a closing brace, or a semicolon — the `@import` and
// `@custom-variant` statements at the top of the file end in one, and anchoring on `}` alone silently
// found no `:root` at all.
const blocks = (text, selector) => {
    const out = [];
    for (const m of text.matchAll(new RegExp(`(?:^|[};])\\s*${selector}\\s*\\{`, 'g'))) {
        out.push(blockAt(text, m.index + m[0].length - 1));
    }
    return out;
};
const declared = (block) => [...block.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]);

for (const file of tokenFiles) {
    const raw = read.get(file);
    const text = strippedComments(raw);
    const rootBlocks = blocks(text, ':root');
    const darkBlocks = blocks(text, '\\.dark');
    const themeBlocks = blocks(text, '@theme[^{]*');

    const rootNames = new Set(rootBlocks.flatMap((b) => declared(b).map(([n]) => n)));
    const themeNames = new Set(themeBlocks.flatMap((b) => declared(b).map(([n]) => n)));

    // ── 3. a name that exists only in the dark block ────────────────────────
    for (const block of darkBlocks) {
        for (const [name] of declared(block)) {
            if (rootNames.has(name)) continue;
            const index = raw.indexOf(`${name}:`, raw.indexOf(block.slice(0, 40)));
            report('dark-only-token', file, raw, index === -1 ? raw.indexOf(name) : index,
                `${name} is declared in the dark theme only — light mode renders the fallback`);
        }
    }

    // ── 4. a derived token valued with a literal ────────────────────────────
    // Two populations, one rule: anything overridden per theme is layer 2 or 3, and a literal there
    // is a brand value that a rebrand will not reach. Layer 1 primitives are exempt by definition —
    // they are the only place a literal belongs — and are identified as the names the dark block
    // never touches.
    const perTheme = new Set(darkBlocks.flatMap((b) => declared(b).map(([n]) => n)));
    for (const block of [...rootBlocks, ...darkBlocks]) {
        for (const [name, value] of declared(block)) {
            if (!perTheme.has(name)) continue;
            const literal = value.match(COLOR_LITERAL);
            if (!literal) continue;
            const index = raw.indexOf(`${name}: ${value}`);
            report('derived-literal', file, raw, index === -1 ? raw.indexOf(name) : index,
                `${name} is themed, so \`${literal[0]}\` belongs in a layer-1 primitive it references`);
        }
    }

    // ── 5. an alias pointing at nothing ─────────────────────────────────────
    // The quietest failure in the file: the alias emits a utility, the utility emits a rule, and the
    // rule resolves to an undefined variable, so the property is dropped at computed-value time.
    const allDeclared = new Set([...rootNames, ...themeNames, ...perTheme]);
    for (const block of themeBlocks) {
        for (const [name, value] of declared(block)) {
            for (const m of value.matchAll(/var\(\s*(--[\w-]+)/g)) {
                if (allDeclared.has(m[1])) continue;
                const index = raw.indexOf(`${name}:`);
                report('broken-alias', file, raw, index === -1 ? 0 : index,
                    `${name} aliases ${m[1]}, which nothing declares`);
            }
        }
    }
}

// ── 6. arbitrary values that restate a scale ────────────────────────────────
// Geometry that computes a shape (max-h-[calc(100vh-4rem)], grid-cols-[…], w-[280px] for a fixed
// panel) is legitimate and is not matched. The families below are the ones backed by a scale —
// colour, radius, shadow, and the padding/margin/gap set — and only a literal inside the bracket
// counts; a variable reference is how a token is spelled when no alias exists.
const ARBITRARY = new RegExp(
    String.raw`\b(?:bg|text|border|ring|fill|stroke|shadow|rounded|outline|decoration|divide|from|via|to` +
        String.raw`|p|px|py|pt|pr|pb|pl|m|mx|my|mt|mr|mb|ml|gap|gap-x|gap-y|space-x|space-y)-\[([^\]]+)\]`,
    'g',
);
for (const [file, raw] of read) {
    if (tokenFiles.includes(file)) continue;
    for (const m of strippedComments(raw).matchAll(ARBITRARY)) {
        const inner = m[1];
        if (inner.startsWith('--') || inner.includes('var(')) continue;
        const isColor = new RegExp(COLOR_LITERAL.source).test(inner);
        const isStep = /^-?[\d.]+(?:px|rem|em)$/.test(inner) || /\d+px\s/.test(inner);
        if (!isColor && !isStep) continue;
        report('arbitrary-value', file, raw, m.index,
            `\`${m[0]}\` restates a decision the scale already made — use the token`);
    }
}

const cwd = process.cwd();
const rel = (f) => relative(cwd, f) || f;

if (asJson) {
    console.log(JSON.stringify({ tokenFiles: tokenFiles.map(rel), findings: findings.map((f) => ({ ...f, file: rel(f.file) })) }, null, 2));
} else {
    console.log(`token file: ${tokenFiles.map(rel).join(', ')}`);
    console.log(`scanned ${read.size} file(s)`);
    if (!findings.length) console.log('no findings');
    else {
        const byCheck = new Map();
        for (const f of findings) byCheck.set(f.check, [...(byCheck.get(f.check) ?? []), f]);
        for (const [check, list] of byCheck) {
            console.error(`\n${check} — ${list.length}`);
            for (const f of list) console.error(`  ${rel(f.file)}:${f.line}  ${f.message}\n      ${f.source}`);
        }
        console.error(`\n${findings.length} finding(s). Suppress a deliberate one with a \`ds-ok: <reason>\` comment.`);
    }
}

process.exit(findings.length ? 2 : 0);
