# Frontend Standards

One canonical frontend engineering standard, packaged as installable agent skills.

Repos migrate to it once, then maintain it. The standard does not vary per repo — only the
*migration path* does, because violation counts differ.

## Install

```bash
npx skills add everquint/frontend-skills
```

Works in any harness that supports [Agent Skills](https://agentskills.io) — Claude Code, Cursor,
Codex, Gemini CLI, VS Code, Copilot, OpenCode and others.

As a Claude Code plugin:

```
/plugin marketplace add everquint/frontend-skills
```

For maintainers of this repo, `npm run link` symlinks every skill into `~/.claude/skills` and
`~/.agents/skills`, so a `git pull` updates them in place.

## The skills

| Skill | Loads when |
|---|---|
| `eq-frontend-standards` | writing or reviewing code; setting up lint; auditing a repo against the standard; judging whether a finding is a real defect |
| `eq-frontend-workflow` | starting a feature; choosing branch vs worktree; writing commits; opening a PR; merging; releasing; reverting |
| `eq-frontend-quality-bar` | writing tests; wiring coverage gates; adding error reporting; setting bundle budgets; verifying accessibility; reviewing code that renders untrusted HTML |

## Updating

```bash
npx skills update                    # refresh all installed skills
npx skills update eq-frontend-standards # just one
```

That refreshes the skill **text**. It changes no repo's ESLint config, hooks, or CI — so a repo
silently stops complying the moment the standard moves. Each migrated repo therefore records its
version in `.eq-frontend-skills.json`, and CI checks it:

```bash
# the scripts live beside the installed skill, not in the repo being audited
node ~/.claude/skills/eq-frontend-standards/scripts/standard-check.mjs --check     # exit 1 if behind or never migrated
node ~/.claude/skills/eq-frontend-standards/scripts/standard-check.mjs --record    # after migrating
```

When a repo is behind, the check prints the named migration steps between its recorded version and
the installed one — actions to take, not a changelog to interpret.

The pattern is [copier](https://copier.readthedocs.io/en/stable/updating/)'s (and
[cruft](https://cruft.github.io/cruft/)'s `check`), reduced to what a JS repo needs. Neither has a
mature JS equivalent, so the design is borrowed rather than the tool: store the answers alongside the
version, keep named migrations per version, and refuse to write on a dirty worktree.

## The one rule that shapes everything

**Detect facts. Enforce standards. Never derive standards from existing code.**

A repo's stack is a fact worth detecting — framework, bundler, package manager, test runner. Its
current habits are not a standard. A codebase with index keys everywhere and the rule disabled has a
bug, not a convention. Detection tells you the migration cost; it never sets the target.

## Design principles

**Adopt, don't rebuild.** Everything enforceable here is enforced by mature, widely-adopted tools —
ESLint and its plugin ecosystem, `eslint-plugin-react-hooks` v7 (which bundles the React Compiler
lint suite), husky, lint-staged, commitlint, Vitest coverage thresholds, changesets. These skills
contribute the part no package ships: **which rules to turn on, in what order, and what each one
actually means.** Custom rules and bespoke tooling are a last resort — every one is maintenance you
inherit, and the ecosystem outlives any internal library.

**Ratchet, never big-bang.** No repo passes a new standard on day one. Every gate adopts at the
repo's current level and only allows improvement: ESLint bulk suppressions for lint, Vitest
`thresholds.autoUpdate` for coverage. New code complies immediately; existing debt ratchets down.
A standard that requires a week of cleanup before it can be installed never gets installed.

**Suppress at `error`, never park at `warn`.** ESLint suppressions apply only to `error`-severity
violations. A rule left at `warn` can never be ratcheted and will sit green forever.

**Generate every measured claim, or delete it.** Auditing one mature codebase produced four false
statements in its own conventions document: a git hook documented as absent that existed, a violation
count off by eight, a complexity limit described as "lint-enforced" that was never configured, and an
oversized-file count three times reality because the named offenders had been split. Every one was a
hand-typed number. Numbers belong in generated reports; documents state rules.

**Keep the rationale separate from the rule.** Facts and reasoning rot at different speeds. Rules
live in the standard, reasoning lives in `docs/adr/`. Mixing them is how a document ends up
confidently asserting things that stopped being true.

## Contributing

- Every `SKILL.md` stays under **200 lines**, with `name` and `description` frontmatter. `npm run
  validate` gates this, plus the 1,536-character description cap, name/directory agreement, and
  hedging phrases.
- Procedures go in a skill. Reference material goes in that skill's `references/`, loaded on demand.
- No repo-specific names, paths, or measured numbers in a skill — those belong in the repo being
  audited, not in the published standard.
- A rule needs a concrete failure scenario: specific inputs or state leading to wrong output, a
  crash, or data loss. "This is unconventional" is not a rule.

MIT.
