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

As a Claude Code plugin — **both** commands, in order. The first only registers the catalogue; the
second is what installs the skills:

```
/plugin marketplace add everquint/frontend-skills
/plugin install eq@frontend-skills
```

The first argument is a GitHub `owner/repo`; the second is `<plugin>@<marketplace>` as declared in
`.claude-plugin/`, which is why the order looks inverted.

**Plugin-installed skills are invoked with the plugin as a prefix** — `/eq:eq-frontend-standards`,
not `/eq-frontend-standards`. That is what namespaces them against your own skills, and it is why the
plugin is named `eq`: the slash-command picker clips long names from the left, so a wordier prefix
would hide the part that says which skill it is. **Restart the session** (or `/reload-plugins`) after
installing — plugin components load at session start, so a fresh install is invisible until then.

Pick one route, not both. The two install to different places — `npx skills add` writes
`~/.agents/skills/`, the plugin loads from `~/.claude/plugins/` — and running both lists every skill
twice, prefixed and not.

For maintainers of this repo, `npm run link` symlinks every skill into `~/.claude/skills` and
`~/.agents/skills`, so a `git pull` updates them in place.

## The skills

| Skill | Loads when |
|---|---|
| `eq-frontend-standards` | writing or reviewing code; setting up lint; auditing a repo against the standard; judging whether a finding is a real defect |
| `eq-design-system` | scaffolding a project's theme file; rebranding; adding dark mode; adding or renaming a token; auditing for hardcoded colours, radii and shadows |
| `eq-frontend-workflow` | starting a feature; choosing branch vs worktree; writing commits; opening a PR; merging; releasing; reverting |
| `eq-frontend-quality-bar` | writing tests; wiring coverage gates; adding error reporting; setting bundle budgets; verifying accessibility; reviewing code that renders untrusted HTML |
| `eq-create-issue` | filing a Linear issue for work about to start, or for work already shipped that has no ticket; writing acceptance criteria |
| `eq-take-issue` | picking up a Linear issue — reading it against the codebase, settling the approach with a human, then building it |

`eq-design-system` is the boilerplate half of styling — the token file itself, its names, and the
procedures that change it. `eq-frontend-standards` keeps the rules for *using* a token from a
component; the two cross-reference rather than restate.

The last two close the loop: a ticket's ID is what `eq-frontend-workflow` names the branch after, and
implementing one finishes by filing the deferred work back as new tickets. `docs/adr/0005-*` records
why Linear is named rather than abstracted.

## Repo layout

```
skills/<category>/<skill>/
  SKILL.md        always in context — the harness loads it from its frontmatter description
  references/     loaded on demand, when SKILL.md names the file
  scripts/        executed by the agent, never auto-loaded
  starter/        config files copied into a repo being migrated
docs/adr/         decision records — rationale, kept out of the skills
scripts/          this repo's own tooling: validate-skills.mjs, link-skills.sh
```

The three layers are the point: a `SKILL.md` costs context on every turn, a `references/` file
costs context only when the procedure sends the agent to it, and a script costs none. `npm run
validate` stats every path a `SKILL.md` names — including `../<sibling-skill>/references/…`, which
works only because skills install flat — so a rename breaks CI instead of breaking silently.

## Updating

```bash
npx skills update -g                    # refresh the GLOBAL install — what `skills add … -g` wrote
npx skills update -g eq-frontend-standards # just one
npx skills update                       # PROJECT-local skills only (./.claude/skills)
```

**`-g` is not optional if the install was global**, and its absence is silent. Bare `npx skills
update` scans only `./.claude/skills`; with nothing there it prints `No project skills to update` and
exits **0**, which reads as "checked, already current". Verified on `skills@1.5.21`, where the global
lock lives at `~/.agents/.skill-lock.json`.

On the plugin route it is two commands instead, and the first is the one people skip:

```
/plugin marketplace update frontend-skills    # re-pulls the repo — without this, install finds the old copy
/plugin update eq@frontend-skills             # restart required to apply
```

Two more things `npx skills update` will not tell you. It tracks the **default branch**, so work sitting on a
feature branch is legitimately "up to date". And it compares a per-skill folder hash, so edits
outside a skill's own directory — this `README.md`, `scripts/`, `docs/adr/` — are not an update.

**Update after a release, not mid-window.** Between a feature PR merging and its "Version Packages"
PR merging, `main` carries new skill text with the *previous* version constant — that is where the
version bump lives in the changesets flow. A copy installed from that window reports "up to date"
at the old version while holding the new content, and the new migration entries are unreachable
until the constant catches up. If `standard-check` and the skill text seem to disagree, re-run
`npx skills update -g` after the version PR lands.

That refreshes the skill **text**. It changes no repo's lint config, hooks, or CI — so a repo
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

**Adopt, don't rebuild.** Everything enforceable here is enforced by existing tools — oxlint and
oxfmt, `eslint-plugin-react-hooks` v7 loaded through oxlint's `jsPlugins` bridge (it bundles the
React Compiler lint suite), husky, lint-staged, commitlint, Vitest coverage thresholds, changesets.
These skills contribute the part no package ships: **which rules to turn on, in what order, and what
each one actually means.** Custom rules and bespoke tooling are a last resort — every one is
maintenance you inherit, and the ecosystem outlives any internal library.

**Ratchet, never big-bang.** No repo passes a new standard on day one. Every gate adopts at the
repo's current level and only allows improvement: Vitest `thresholds.autoUpdate` for coverage, a
committed error-count baseline for the strict-typing flags, and — on the one migration branch that
still runs ESLint — its bulk suppressions. New code complies immediately; existing debt ratchets
down. A standard that requires a week of cleanup before it can be installed never gets installed.

**A rule parked at `warn` can never be ratcheted** and will sit green forever, so nothing is staged
at `warn`. The corollary is tool-specific: ESLint's suppressions apply only to `error`-severity
violations, and oxlint has no suppressions mechanism at all
([`oxc#10549`](https://github.com/oxc-project/oxc/issues/10549) is open), which is why the migration
ladder branches on violation count rather than parking rules — see `docs/adr/0002-*`.

**Generate every measured claim, or delete it.** Auditing one mature codebase produced four false
statements in its own conventions document: a git hook documented as absent that existed, a violation
count off by eight, a complexity limit described as "lint-enforced" that was never configured, and an
oversized-file count three times reality because the named offenders had been split. Every one was a
hand-typed number. Numbers belong in generated reports; documents state rules.

**Keep the rationale separate from the rule.** Facts and reasoning rot at different speeds. Rules
live in the standard, reasoning lives in `docs/adr/`. Mixing them is how a document ends up
confidently asserting things that stopped being true.

## Deliberately out of scope

Recorded rather than left to drift, so a reviewer reads a decision instead of finding a gap. Each
becomes in scope the moment a consuming repo needs it.

| Excluded | Why |
|---|---|
| Storybook / component documentation | the starter ships no Storybook dependency and no component-library build target; supersede when one is added |
| Feature-flag lifecycle | no repo-level flag tooling adopted to date — the starter ships no flag SDK; supersede when one enters its dependency set |
| SEO and meta tags | **unverified assumption — confirm before relying on it:** that no consuming app has an unauthenticated, crawlable surface. Nothing in this repo can check that |
| SSR / RSC-specific rules | **unverified assumption — confirm before relying on it:** that consuming apps render on the client. `init-greenfield.mjs` supports Next.js, webpack and Rspack, so the standard does not require it |
| i18n | no localization requirement recorded to date; supersede when one appears |

## Contributing

- Every `SKILL.md` stays under **200 lines**, with `name` and `description` frontmatter. `npm run
  validate` gates this, plus the 1,024-character description cap and the installer's name rules,
  name/directory agreement, hedging phrases, and the existence of every referenced file.
- `npm i` installs a husky `pre-commit` running `npm run validate` and a `commit-msg` running
  commitlint. Both have a CI counterpart, which is the rule the standard itself states.
- Procedures go in a skill. Reference material goes in that skill's `references/`, loaded on demand.
- No repo-specific names, paths, or measured numbers in a skill — those belong in the repo being
  audited, not in the published standard.
- A rule needs a concrete failure scenario: specific inputs or state leading to wrong output, a
  crash, or data loss. "This is unconventional" is not a rule.

MIT.
