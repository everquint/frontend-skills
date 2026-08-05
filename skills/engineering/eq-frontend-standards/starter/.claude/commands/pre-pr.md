---
description: Run the pre-push gate in order, stopping at the first failure, then report which steps ran and what each returned.
---

# Pre-PR gate

Run the steps below **in this order** and **stop at the first failure**. A type error makes every
later signal noise: lint output, test failures and build errors downstream of a bad type are
symptoms, not findings. Fix the failure, then restart from step 1.

## 0. Locate the standard — before steps 5 and 6

Steps 5 and 6 run scripts that ship with the `eq-frontend-standards` skill. The skill is vendored
into the repo only when someone opted into it; the default install puts it under `$HOME`. Resolve
the directory once and reuse it — do not hardcode one of the three paths:

```bash
EQ_STANDARD=""
for d in .claude/skills/eq-frontend-standards "$HOME/.claude/skills/eq-frontend-standards" "$HOME/.agents/skills/eq-frontend-standards"; do
  [ -d "$d" ] && { EQ_STANDARD="$d"; break; }
done
echo "${EQ_STANDARD:-NOT FOUND}"
```

If it resolves, steps 5 and 6 run against `$EQ_STANDARD`. If it prints `NOT FOUND`, **steps 5 and 6
did not run** — report that as a missing standard, not as a failed check:

> The `eq-frontend-standards` skill could not be located, so the structure check (step 5) and the
> standard-version gate (step 6) did not run. This is not a check failure — the checks never
> executed. Tried, in order: `.claude/skills/eq-frontend-standards`,
> `~/.claude/skills/eq-frontend-standards`, `~/.agents/skills/eq-frontend-standards`. Install it
> with `npx skills add everquint/frontend-skills`, then re-run this gate.

A `MODULE_NOT_FOUND` from `node` is the same condition surfacing as noise. Resolve first so it
cannot happen.

## 1. Typecheck — always

```bash
npm run typecheck
```

## 2. Lint — always

```bash
npm run lint
```

## 3. Tests for what changed — always

Run the test files touched by this change, not the whole suite:

```bash
git diff --name-only origin/HEAD...HEAD
npx vitest run <the test files covering those paths>
```

A changed source file with no test file covering it is a gap to report, not a step to skip.

## 4. Build — when UI, behaviour, or build config changed

```bash
npm run build
```

## 5. Structure

```bash
node "$EQ_STANDARD/scripts/check-structure.mjs"
```

## 6. Standard version

```bash
node "$EQ_STANDARD/scripts/standard-check.mjs" --check
```

Exit 1 means this repo is behind the installed standard, or was never migrated. It prints the named
migration steps between the recorded version and the installed one.

## 7. Feature docs — when the diff changes what the product can do

```bash
git diff --name-only origin/HEAD...HEAD
```

A diff that adds a user-facing capability — a new route, screen, or feature directory is the
usual shape — must also add its feature doc under `docs/features/` (format:
`docs/features/README.md`); a diff that changes or removes one must update or delete that doc.
If it does not, report the missing doc as a failure and name the capability it should record. A
diff of bug fixes, refactors, styling, or performance work inside existing behaviour owes nothing
here.

## Report

Name every step, whether it ran, and what it returned.

**Never report "all green" for a step that did not run.** "Typecheck, lint and structure pass;
build not run because no UI or build config changed; no test file covers the changed module" is a
correct report. "All green" with tests skipped is not. A step 0 that printed `NOT FOUND` makes steps
5 and 6 unrun steps, reported in the words of step 0 — neither passing nor failing.

Paste real command output for anything that failed. The PR body's "How it was verified" section
gets the same output, unedited.
