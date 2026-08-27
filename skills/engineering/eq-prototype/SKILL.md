---
name: eq-prototype
description: Prototype mode — the reduced gate set for a throwaway repo that answers one question and then gets deleted, plus the expiry and graduation path back to the full standard. Use when starting a prototype, POC, spike or demo that has an expiry date and no users, when deciding which gates such a repo may skip, or when a prototype has gained users and must graduate.
---

# Prototype Mode

A prototype answers **one question** and is then deleted or graduated. This skill is the only
sanctioned way to run with fewer gates, and it exists so that "the standard is slow for POCs" is
answered by a bounded mode rather than by a second standard nobody maintains.

**This is a mode of the standard, not an alternative to it.** Every relaxation below is listed in
one place — this file — so no rule is restated in the four production skills and none can drift. The
only change on their side is `standard-check.mjs` reading this mode's marker.

## 1. The entry test

All four must hold. If any one fails, this mode does not apply and
`eq-frontend-standards` §1 does.

| Condition | Why it gates |
|---|---|
| It answers one named question | "Does this API shape work", "can we render 50k rows". A prototype with no question is a product being built without gates |
| It has an expiry date | The date it is deleted or graduated. No date means it becomes production by default, and the relaxations ship with it |
| Nobody outside the team depends on it | No users, no other repo importing it, no scheduled job |
| It holds no production data and no live credentials | Real data in a repo with no review is an incident, not a prototype |

A prototype that gains users has failed the entry test *retroactively*. Graduate it (§6) the day
that happens — not at the next planning cycle.

## 2. Declare it

```bash
node <skill>/scripts/init-prototype.mjs --question "does virtualised rendering hold at 50k rows" --expires 2026-09-30
```

This writes `PROTOTYPE.md` (the question, the expiry, what is off) and `"eqPrototype"` into
`package.json`. Both are the marker: any agent or person opening the repo sees the mode in the
first file they read, and `standard-check.mjs --check` treats the marker as "deliberately not
migrated" rather than "behind".

Run it from the root of the new repo, after `npm create vite@latest . -- --template react-ts` or
the equivalent. `--dry-run` prints the file plan first. It never overwrites.

**Exit 2 means a kept gate is hollow — fix it before writing code.** The script never overwrites, so
a scaffold that ships its own `.oxlintrc.json` or its own leaf tsconfigs keeps them, and both cases
exit 0 while enforcing almost nothing. Measured on a clean `npm create vite@latest -- --template
react-ts` on 2026-08-27 (Vite 8.2.2): the template ships a two-rule `.oxlintrc.json` and leaf
tsconfigs that set none of the three checking flags. The script prints the exact copy or edit for
each, including the `@/` alias when only its tsc half is wired. Re-run until it exits 0.

The first lint run on that scaffold then reports `unicorn/filename-case` on `App.tsx`. That is real —
rename it to `app.tsx` (`../eq-frontend-standards/references/hygiene.md`).

## 3. What is off, what stays on

The script lands the second column and nothing from the first.

| Off in prototype mode | Why it is safe to drop |
|---|---|
| Coverage gate, `coverage:diff`, the 90% floor | Coverage on code whose shape changes hourly measures churn, not risk |
| Playwright and the e2e scaffold | An e2e suite outlives the question it was written against |
| CI workflows (`ci.yml`, `release.yml`) | Nothing is deployed and nothing is released, so a pipeline gates nobody |
| Changesets, `CHANGELOG.md`, release tags | Release notes with no reader (`eq-frontend-workflow`, Release) |
| commitlint, husky, lint-staged | Accepted gap, not a covered one: nothing checks commit-message shape here, and the formatter runs only on agent edits (one file, on `Edit`/`Write`). A prototype's commit log has no reader |
| Branch naming, PR bodies, reviewer fan-out, merge rules | §4 |
| `docs/product/`, `docs/features/`, ADRs | The question is the documentation. Findings go in `PROTOTYPE.md` |
| Type-aware lint (`.oxlintrc.strict.json`) | It needs a full type build per run. The base config still catches the correctness rules |
| The reviewer-enforced conventions — duplication, structure, naming, comment policy | Nobody reviews a prototype, and a rule with no checker behind it is not a gate |

| On in prototype mode | Why it survives |
|---|---|
| `typecheck` | The cheapest possible defence against a prototype that "works" because a value is `any` |
| Base lint (`.oxlintrc.json`, `npm run lint`) | Native rules only, no type build — the half of the gate that is cheap on every run, and it catches the runtime bugs (hook rules, index keys, floating promises) that make a prototype's *answer* wrong. The file budgets ride along in the same run |
| `oxfmt` via the PostToolUse hook | One file per edit, and it means graduation is not a whole-repo formatting diff |
| `Bash(git stash:*)` denied | Invisible state lost between sessions is not a production-only failure |
| The §5 non-negotiables | They are about harm, not quality |

## 4. The loop

| Step | Prototype mode | Full standard |
|---|---|---|
| Branch | Commit straight to the default branch of the prototype repo | `<type>/<slug>`, never the default branch |
| Isolation | A worktree only when a second agent runs concurrently | Same |
| Commit message | Conventional Commits **subject only**, no body required, no commitlint | Full convention, enforced |
| Before pushing | `npm run typecheck && npm run lint` | The four-step gate |
| PR | None | Required, with the four-heading body |
| Review | None. Read the diff yourself before you trust the answer | Two reviewer passes, fanned out |
| Tests | Only where the *answer* depends on logic being right — a rate calculation, a reducer, a parser. Not on UI wiring | Diff coverage at 90% |

**Delete freely.** The prototype's git history has no audit value. A dead-end branch is deleted,
not documented.

**Subagent briefs stay self-contained** (`../eq-frontend-workflow/SKILL.md`, Execution model). That
rule is about a subagent starting with no context; it costs nothing and its absence wastes a whole
agent run. State "prototype mode, gates per `PROTOTYPE.md`" in the brief so the subagent does not
re-introduce the machinery.

## 5. Non-negotiables

These do not relax, at any speed, in any prototype.

| Rule | The failure it prevents |
|---|---|
| No secrets, tokens or keys in client code or committed files (`../eq-frontend-quality-bar/SKILL.md`, Client-side security) | A key in a throwaway repo is a live key. Deleting the repo does not rotate it |
| No production or customer data — synthetic fixtures only | Copying a real export into an unreviewed repo is a data incident with the word "prototype" in front of it |
| Fabricated data is labelled as fabricated in the UI | A demo screenshot outlives the demo. Unlabelled fake numbers get quoted as real |
| `dangerouslySetInnerHTML` is sanitised, or absent | `../eq-frontend-quality-bar/SKILL.md`, Client-side security |
| Dependencies are the ones the standard already names | A prototype is not the place to trial a library the production repos will inherit by copy-paste |
| It is never deployed to a shared or public URL | A URL is a user. A user fails the §1 entry test |

## 6. Expiry and graduation

`PROTOTYPE.md` carries the expiry date, and the SessionStart hook prints a warning once it passes.
On that date there are exactly two moves — **delete the repo**, or **graduate it**.

Graduation is a single ordered procedure, not a gradual tightening. Half-graduated is the worst
state: production traffic against prototype gates. Run it in one sitting, from
`references/graduation.md` — that file is the procedure, and it is not summarised here.

A prototype under a few thousand lines graduates in an afternoon; one that has been running for
months does not, which is what the expiry date is for.

## 7. What this mode is not

**Not a starting point for a real project.** A repo with users starts at
`eq-frontend-standards` §1 — `init-greenfield.mjs` on a new repo is minutes, and the per-change
gates are the point of the standard, not overhead to be earned later.

**Not a way to skip review on production code.** If the code is going to production, it is
production code today, whatever the directory is called.

**Not permanent.** A prototype with no expiry, or one past its expiry, is out of compliance with
the standard exactly as a repo that never migrated is.
