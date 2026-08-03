---
description: Run the pre-push gate in order, stopping at the first failure, then report which steps ran and what each returned.
---

# Pre-PR gate

Run the steps below **in this order** and **stop at the first failure**. A type error makes every
later signal noise: lint output, test failures and build errors downstream of a bad type are
symptoms, not findings. Fix the failure, then restart from step 1.

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
node .claude/skills/eq-frontend-standards/scripts/check-structure.mjs
```

## 6. Standard version

```bash
node .claude/skills/eq-frontend-standards/scripts/standard-check.mjs --check
```

Exit 1 means this repo is behind the installed standard, or was never migrated. It prints the named
migration steps between the recorded version and the installed one.

## Report

Name every step, whether it ran, and what it returned.

**Never report "all green" for a step that did not run.** "Typecheck, lint and structure pass;
build not run because no UI or build config changed; no test file covers the changed module" is a
correct report. "All green" with tests skipped is not.

Paste real command output for anything that failed. The PR body's "How it was verified" section
gets the same output, unedited.
