#!/usr/bin/env node
// Token-system audit. Seven checks, all of them things a linter in this stack cannot see: oxlint
// reads no stylesheet and inspects no class string, and oxfmt asserts nothing about values.
//
//   1 color-literal        a hex/rgb()/hsl()/`white`/`black` outside the token file
//   2 var-fallback         var(--x, <literal>) — pins one theme's value, silently
//   3 dark-only-token      a name declared in the dark block and not in :root
//   4 derived-literal      a semantic token or a dark override valued with a literal
//   5 broken-alias         a @theme alias pointing at a custom property nobody declares
//   6 arbitrary-value      bg-[#…], rounded-[10px], shadow-[…] — a scale step, restated
//   7 contrast             a token pair below its WCAG floor, in either theme
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

// ── colour maths, for check 7 ───────────────────────────────────────────────
// sRGB → linear, and OKLCH → linear sRGB (Ottosson's OKLab matrices). WCAG relative luminance
// weights linear channels, which is what both paths produce. Verified against an independent
// hex-only implementation: the two agree to 4 decimal places on the starter's whole palette.
const toLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);

const oklchToLinear = (L, C, H) => {
    const a = C * Math.cos((H * Math.PI) / 180);
    const b = C * Math.sin((H * Math.PI) / 180);
    const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
    const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
    const s = (L - 0.0894841775 * a - 1.2914855480 * b) ** 3;
    return [
        4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
        -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
        -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s,
    ].map((c) => Math.min(1, Math.max(0, c)));
};

const luminance = ([r, g, b]) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

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

    // ── 7. contrast ─────────────────────────────────────────────────────────
    // The pair list is DERIVED, never written down. A hand-maintained list is the failure mode this
    // check exists to avoid: adding `--warning`/`--warning-foreground` to the token file and having
    // the audit still print "no findings" is a false green, which is worse than no audit. Every
    // `-foreground` token must land in a pair, and one that cannot is itself a finding.
    const light = Object.fromEntries(rootBlocks.flatMap(declared));
    const darkTheme = { ...light, ...Object.fromEntries(darkBlocks.flatMap(declared)) };

    const resolveToken = (name, scope, depth = 0) => {
        if (depth > 16) throw new Error(`var() cycle at ${name}`);
        const value = scope[name];
        if (value === undefined) throw new Error(`${name} is not declared`);
        const ref = value.match(/^var\(\s*(--[\w-]+)\s*\)$/);
        return ref ? resolveToken(ref[1], scope, depth + 1) : value;
    };

    // Only the two literal forms a token file writes. color-mix() and gradients are deliberately not
    // evaluated — the pair fails closed and says why, rather than being silently skipped.
    const srgb = (value) => {
        const hex = value.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
        if (hex) {
            const h = hex[1].length === 3 ? [...hex[1]].map((c) => c + c).join('') : hex[1];
            return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map(toLinear);
        }
        const ok = value.match(/^oklch\(\s*([\d.]+%?)\s+([\d.]+)\s+([\d.]+)\s*\)$/i);
        if (ok) return oklchToLinear(ok[1].endsWith('%') ? parseFloat(ok[1]) / 100 : +ok[1], +ok[2], +ok[3]);
        throw new Error(`cannot evaluate \`${value.slice(0, 40)}\``);
    };

    const pairs = [];
    const add = (surface, fg, min, why) => {
        if (light[surface] === undefined || light[fg] === undefined) return false;
        pairs.push({ surface, fg, min, why });
        return true;
    };

    const SUFFIX = '-foreground';
    for (const name of Object.keys(light)) {
        // `--foreground` itself ends in the suffix but names no base — it is the page text, paired
        // with `--background` below. Without this guard it derives a base of `--` and self-reports.
        if (!name.endsWith(SUFFIX) || name === '--foreground') continue;
        const base = name.slice(0, -SUFFIX.length);
        if (add(base, name, 4.5, 'text on its own surface')) continue;
        const index = raw.indexOf(`${name}:`);
        report('contrast', file, raw, index === -1 ? 0 : index,
            `${name} has no matching \`${base}\` surface, so nothing checks its contrast`);
    }
    // The page text, and muted text where it is actually written — on the page and on cards far more
    // often than on `--muted` itself.
    add('--background', '--foreground', 4.5, 'page text');
    add('--background', '--muted-foreground', 4.5, 'muted text on the page');
    add('--card', '--muted-foreground', 4.5, 'muted text on a card');
    // WCAG 1.4.11: 3:1 for the boundary of a control and for a focus indicator. `--border` is a
    // decorative separator and is deliberately NOT held to it — holding it to 3:1 fails every
    // mainstream design system and would get the whole check switched off.
    for (const line of ['--input', '--ring']) {
        add('--background', line, 3, 'control boundary against the page');
        add('--card', line, 3, 'control boundary on a card');
    }

    for (const [theme, scope] of [['light', light], ['dark', darkTheme]]) {
        for (const { surface, fg, min, why } of pairs) {
            const index = raw.indexOf(`${fg}:`);
            let ratio;
            try {
                const [x, y] = [surface, fg].map((n) => luminance(srgb(resolveToken(n, scope))));
                ratio = (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
            } catch (e) {
                report('contrast', file, raw, index === -1 ? 0 : index,
                    `${fg} on ${surface} (${theme}) could not be evaluated — ${e.message}`);
                continue;
            }
            if (ratio >= min) continue;
            report('contrast', file, raw, index === -1 ? 0 : index,
                `${fg} on ${surface} is ${ratio.toFixed(2)}:1 in ${theme}, below ${min} — ${why}`);
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
