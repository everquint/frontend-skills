# Graduating a prototype to the full standard

Read this when a prototype's expiry date has arrived and the answer is "keep it", or when it has
gained a user, a dependent repo, or a deployment. Deleting it instead needs no procedure: delete
the repo and copy the findings out of `PROTOTYPE.md` first.

**Do it in one sitting, in this order.** Half-graduated is the worst state a repo reaches:
production traffic against prototype gates, with a `PROTOTYPE.md` that says the gates are missing
on purpose. The ordering matters — steps 2 and 3 both produce large diffs, and doing them after
the tests exist means re-running the tests, not writing them twice.

## 0. Decide what is graduating

A prototype answered a question. Some of it is scaffolding for the *answer*, not the answer: fake
data providers, a hardcoded route, a component that renders three variants side by side to compare
them. Delete that first. Migrating it costs the same as migrating real code and it has no future.

Write down, in the first PR's body, which parts you kept and which you deleted. That is the only
record of the decision, because the prototype's own git history is not audit material.

## 1. Give the repo a branch and a PR from now on

Prototype mode commits to the default branch. From this point that is over: create
`refactor/graduate-to-standard`, do all of the below on it, and open a real PR with the four-heading
body (`../eq-frontend-workflow/SKILL.md`, PR body). The graduation PR is the first one anyone
reviews, and it is the largest — schedule the review, do not sneak it in.

## 2. Run the greenfield installer

`$STD` below is the installed `eq-frontend-standards` skill directory — `~/.claude/skills/eq-frontend-standards`
on a personal install, `.claude/skills/eq-frontend-standards` where the standard is vendored. The
paths are written as a variable because the prototype repo's own root is the working directory.

```bash
STD=~/.claude/skills/eq-frontend-standards      # or .claude/skills/eq-frontend-standards
node "$STD"/scripts/init-greenfield.mjs --dry-run   # read the plan first
node "$STD"/scripts/init-greenfield.mjs
npm install && npm run format
```

It never overwrites, so it tops the repo up: the CI workflows, changesets, husky and lint-staged,
commitlint, Playwright, the product docs, the reviewer agents, the strict lint config, and the
standards `.claude/settings.json` all land. The files prototype mode already put there are skipped
and reported.

**Two prototype-mode files must be removed by hand — the installer will not touch them:**

| File | What to do |
|---|---|
| `.claude/settings.json` | Prototype mode wrote its own, so the installer skipped the standards copy. **Delete it and re-run the installer**, or the repo keeps a settings file with no `branch-guard.sh` and no protected-files guard, and commits keep landing on the default branch |
| `.claude/hooks/prototype-expiry.sh` | Delete. It has nothing left to warn about |

Then `npm run lint:fix && npm run format` before reading any of the output below: the strict config
that just landed reports formatting and fixable violations together, and the unfixable ones are the
only interesting list.

## 3. Clear what the strict gates now report

Three lists, in this order. Each is expected to be long — a prototype was written without them.

1. **`npm run typecheck`** — should already be clean; prototype mode kept it green. If it is not,
   the prototype was being run with a broken gate, and that is the first thing to fix.
2. **`npm run lint`** — the type-aware pass runs for the first time. Fix, never suppress: a
   suppression added during graduation is permanent and nobody revisits it. If the count is high
   enough that fixing it in one sitting is not real, the repo is no longer a prototype-sized
   migration — switch to the existing-repo path (`../eq-frontend-standards/SKILL.md` §1, measure
   and ratchet) and say so in the PR.
3. **`node "$STD"/scripts/check-structure.mjs`** — placement and naming. A
   prototype puts everything in `src/`; this is where that gets sorted.

## 4. Backfill tests to the gate, not to a number

The coverage gate is diff coverage at 90% (`../eq-frontend-quality-bar/SKILL.md` §1), and after
graduation it applies to every future change. The graduation PR itself is the exception nobody can
meet honestly by writing tests for the whole prototype — so:

- Write tests for the logic the product now depends on: calculations, reducers, parsers, anything
  whose wrongness would be invisible.
- Set the `vitest.config.ts` global floors to achieved-rounded-down-minus-one, once. Do not set
  `thresholds.autoUpdate`.
- State the achieved figure in the PR body under *Deliberately left out*, with what is untested.

Untested code that arrived via a prototype is the most common source of a silent regression six
months later, because it looks like it was reviewed.

## 5. Product documentation

`docs/product/` and `docs/features/` landed empty from the installer. Fill in `INDEX.md`,
`constraints.md` and `current-focus.md` now, from the prototype's findings — this is the moment
that knowledge exists and is not yet forgotten (`../eq-frontend-standards/references/product-knowledge.md`).

The prototype's question and its answer belong in the first ADR: it is the decision the product is
now built on. `PROTOTYPE.md`'s Findings section is the draft.

## 6. Remove the markers, record the migration

```bash
rm PROTOTYPE.md
node -e "const f='package.json',p=require('./'+f);delete p.eqPrototype;require('node:fs').writeFileSync(f,JSON.stringify(p,null,4)+'\n')"
node "$STD"/scripts/standard-check.mjs --record
```

Removing the marker is what makes the repo answerable to the standard: until then
`standard-check.mjs --check` reports it as deliberately unmigrated and every gate you just wired
is advisory. `--record` stamps the version it migrated to.

## 7. Verify, then merge

Run the full pre-push gate (`../eq-frontend-workflow/SKILL.md`, The gate before pushing) and both
reviewer passes over the whole diff, not just the last commits. Paste the real output into the PR.

A graduation PR that merges with a red CI run teaches the team that the gates are optional, and the
prototype's relaxations outlive the prototype. That is the failure this whole document exists to
prevent.
