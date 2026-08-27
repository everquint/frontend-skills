# 0022 — a vendored skill set is named for the project that owns it

Date: 2026-08-27

## Context

The standard is enforceable from a repo alone only if the repo carries the skills: a CI runner, a
cloud sandbox, and agent hosts like Cyrus or Claude Tag have no `~/.claude` and no `~/.agents`, so
`init-greenfield.mjs` vendors copies into `.claude/skills/`.

Those copies had the same names as a personal install — `eq-frontend-standards` in both places. Every
host that reads both locations then lists each skill twice, and the two entries are *different
versions of the same standard*: the repo's copy is pinned to whatever it was vendored at, the
personal one moves with `npx skills update`. Which of the two answers a question is unspecified, and
nothing in either copy says which one was used. A consumer working across several repos has one
personal install and several pinned copies, all named identically.

This was reported by a consumer, not found by a gate, which is the tell: nothing detects it. A
duplicate skill name is not an error in any host we target — it is a silent precedence decision.

## Decision

**Vendored sets are prefixed with a short project name, chosen by the consumer:**
`init-greenfield.mjs --prefix cc` writes `.claude/skills/eq-cc-frontend-standards`,
`eq-cc-frontend-workflow`, `eq-cc-frontend-quality-bar`.

`eq-` stays in front so one team's skills still sort together across repos, and the project segment
sits inside the name rather than in front of it. `<project>-eq-…` was the alternative and was
rejected on that ground alone: the vendor marker is what a reader recognises first.

Three properties make it safe:

1. **Deciding is mandatory; the prefix is not.** Vendoring requires `--prefix <short>` or an explicit
   `--no-prefix`. Silently vendoring under the shared names is the failure being fixed, so it cannot
   remain the default. `--no-prefix` stays fully supported for a repo that wants the plain names.
2. **The prefix is recorded, not inferred.** `.claude/skills/.eq-vendor.json` maps each source skill
   name to its vendored directory. `standard-check.mjs` reads it, so a prefixed repo reports as
   vendored rather than as bare, and a corrupt manifest is reported rather than read as "no prefix".
3. **It is changeable, and it adopts what is already there.** `rename-vendor-prefix.mjs --to <short>`
   (or `--to ""`) moves the directories with `git mv` and rewrites the coupled names. Every repo
   vendored before this change has plain names and no manifest, so a missing manifest is not "nothing
   to rename": the script adopts the directories it finds. Without that, the migration step itself
   sent people to `init-greenfield --prefix`, which vendored a second copy beside the first — the
   exact double-load this decision exists to prevent.

**The copies are no longer byte-identical, and cannot be.** A host loads a skill only when its
frontmatter `name` equals its directory, and these skills link to each other as flat siblings
(`../eq-frontend-workflow/references/…`). So vendoring rewrites exactly three things in the `.md`
files — the frontmatter name, sibling links, and prose mentions of a sibling's name — and nothing
else. Files under a skill's `starter/` are excluded: they are templates for the consumer repo and they
name the PERSONAL install paths, which carry no prefix, so rewriting them turned two working resolver
fallbacks into dead paths. The rule lives in one shared module, `scripts/vendor-names.mjs`, used by the vendoring script,
the rename script and every resolver: a rename that moves the directory but misses the frontmatter
produces a skill that never loads, with no error anywhere.

The consumer-side resolvers in `starter/` (CI, `pre-pr`, both reviewer agents) now glob
`.claude/skills/*frontend-standards` instead of naming the directory, so they survive any prefix and
any later rename.

## Consequences

- Minor version, with a migration step: an already-vendored repo runs `rename-vendor-prefix.mjs`
  once. Staying unprefixed remains conformant, and nothing flags it.
- The "byte-identical vendored copy" claim is retired and replaced by "identical except the names".
  That is weaker, and the weakening is the price of a name a host will load. A diff of a vendored
  tree against the source now shows the name lines; a reviewer must know that is expected.
- A repo can still end up with two copies — one prefixed, one not — if someone vendors twice.
  `init-greenfield.mjs` refuses when the DISK holds a vendored set under other names, not only when a
  manifest says so: the manifest-less repo is the one every current consumer has, and a manifest-only
  guard would never fire for them.
- Any repo file that hardcodes `.claude/skills/eq-frontend-standards/…` breaks on rename. The rename
  script reports those files and exits 2 rather than editing them: they are the repo's own, and a
  script that rewrites a consumer's CI config is a script nobody runs twice.
- The prefix is cosmetic to the standard's content. Nothing about which rules are enforced depends on
  it, so a wrong or ugly prefix costs one rename and no re-migration.
