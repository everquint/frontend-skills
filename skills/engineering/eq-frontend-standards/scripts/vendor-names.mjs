// Naming of the VENDORED copies of this skill set, shared by every script that writes or resolves
// them: init-greenfield.mjs (vendors), rename-vendor-prefix.mjs (re-prefixes), standard-check.mjs
// (asserts they are there), and the consumer-side resolvers in starter/.
//
// WHY a shared module and not four copies of two regexes: a vendored set is a directory name, a
// frontmatter `name:` that must match it, and every `../<sibling-skill>/…` link in the bodies. Those
// three have to move together — a rename that misses one produces a skill a host silently declines
// to load (name/directory mismatch), or a cross-reference that resolves to nothing. Three rules in
// one file is the only version of this that cannot drift.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

// The vendored tree records what it is. Without it a later script cannot tell `eq-cc-frontend-standards`
// (vendored, prefix `cc`) from a skill someone happens to have named that way, and re-prefixing would
// have to guess which directories are ours.
export const MANIFEST_REL = join('.claude', 'skills', '.eq-vendor.json');

// The Agent Skills name rule, plus a length cap: the prefix goes in front of every vendored skill
// name, and the slash-command picker clips long names from the left.
export const PREFIX_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
export const PREFIX_MAX = 12;

export const prefixError = (prefix) => {
    if (typeof prefix !== 'string' || !PREFIX_PATTERN.test(prefix)) return 'lowercase letters, digits and single hyphens only';
    if (prefix.length > PREFIX_MAX) return `${PREFIX_MAX} characters or fewer`;
    return null;
};

// eq-frontend-standards + cc -> eq-cc-frontend-standards. The `eq-` head is preserved where it
// exists so one team's skills still sort together across repos; a name without it just gets the
// prefix in front. `null` prefix means the plain, unprefixed name.
export const vendoredName = (name, prefix) => {
    if (prefix === null || prefix === undefined || prefix === '') return name;
    return name.startsWith('eq-') ? `eq-${prefix}-${name.slice(3)}` : `${prefix}-${name}`;
};

export const nameMap = (names, prefix) => new Map(names.map((n) => [n, vendoredName(n, prefix)]));

// Rewrites one markdown file's OWN name and every reference it makes to a sibling in the same
// vendored set. Three shapes, all of which appear in these bodies:
//   name: <skill>                     the frontmatter, which a host requires to match the directory
//   ../<sibling>/references/x.md      cross-skill links, resolved by hosts as flat siblings
//   `<sibling>`  / bare prose         the skills refer to each other by name in the text
//
// Ordering matters: the longest source name is replaced first, so a set containing both
// `eq-frontend-standards` and `eq-frontend-standards-extra` cannot have the shorter one eat the
// longer one's prefix. Word boundaries are enforced by hand rather than with \b, because `-` is a
// non-word character and \b would fire in the middle of a hyphenated name.
// A file under a skill's `starter/` is a TEMPLATE for a consumer repo, not part of the skill, and it
// names the PERSONAL install paths (`$HOME/.claude/skills/eq-frontend-standards`) that are never
// prefixed. Rewriting those turns working fallbacks into dead paths — measured on
// starter/.claude/agents/code-reviewer.md, whose resolver lost both of its non-repo candidates.
export const isStarterPath = (relPath) => /(^|[\\/])starter([\\/]|$)/.test(relPath);

export const rewriteMarkdown = (text, mapping) => {
    let out = text;
    for (const [from, to] of [...mapping].sort((a, b) => b[0].length - a[0].length)) {
        if (from === to) continue;
        out = out.replaceAll(new RegExp(`(^|[^a-z0-9-])${from}(?![a-z0-9-])`, 'g'), (_m, lead) => `${lead}${to}`);
    }
    return out;
};

export const readManifest = (cwd) => {
    const path = join(cwd, MANIFEST_REL);
    if (!existsSync(path)) return null;
    // Unparseable OR not an object is "cannot say", never "no prefix": treating either as absent would
    // make every resolver look for the plain names and report a correctly vendored repo as bare. A
    // half-written file parses to `null`, a number, or a string, so the shape is checked too.
    try {
        const parsed = JSON.parse(readFileSync(path, 'utf8'));
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return { corrupt: true };
        return parsed;
    } catch {
        return { corrupt: true };
    }
};

export const writeManifest = (cwd, { prefix, skills, standardVersion }) => {
    const body = {
        prefix: prefix ?? null,
        // Source name -> vendored directory name, so a resolver never has to re-derive the rule and a
        // later rename knows exactly which directories belong to this set.
        skills: Object.fromEntries(skills),
        standardVersion,
        writtenAt: new Date().toISOString().slice(0, 10),
    };
    writeFileSync(join(cwd, MANIFEST_REL), `${JSON.stringify(body, null, 4)}\n`);
    return body;
};

// Where a vendored skill lives in a consumer repo: the manifest's answer when there is one, the
// plain name otherwise. Every resolver in every script goes through this.
export const vendoredDir = (cwd, sourceName) => {
    const manifest = readManifest(cwd);
    const mapped = manifest && !manifest.corrupt ? manifest.skills?.[sourceName] : null;
    return join('.claude', 'skills', mapped ?? sourceName);
};
