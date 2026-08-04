# Code quality — comments, naming, and how much belongs in one file

Three rules the standard reviews against but has never written down. `eq-frontend-workflow`'s Review
table routes comments, identifier semantics and per-file budgets to this file by name; this file is
what those three resolve to. **Almost everything here is reviewer-enforced** — no linter judges
whether a comment carries information, whether a name lies, or how many concerns a file holds. The one
mechanical gate is `SKILL.md` §1's lint budgets, which own the numbers; this file references them and
restates none.

## 1. Comments

### The test

> **Is this comment true and useful to a reader coming to the file cold, who does not know a change
> was ever made?**

"Why, not what" is too loose. It green-lights `// using void here to satisfy no-floating-promises`,
which is a why and still worthless: it addresses the reviewer of one diff, not a reader of the file.
The cold-reader test kills it.

### Write a comment when

1. **An external thing forces the code** — a browser quirk, a library's documented behaviour, a
   vendor bug, a protocol requirement. Name the thing.

   ```ts
   // touchmove must be non-passive: passive listeners cannot preventDefault, so the page scrolls mid-drag.
   // Do NOT set Content-Type on FormData — the browser must add the multipart boundary itself.
   ```

2. **An obvious-looking simpler approach was rejected.** Otherwise the next reader "simplifies" it back
   and reintroduces the bug — `// Not flush() on unmount: this is a search query, and flushing fires a
   request for a screen that is gone.`

3. **A dependency is deliberately omitted** from an effect array. Without the comment the omission is
   indistinguishable from an oversight, and the next `exhaustive-deps` fix adds it back.

4. **An ordering or an invariant is load-bearing** — two writes that must happen in this order, or an
   invariant spanning files that cannot be seen from this one:
   `// Revoke after the load handler runs; revoking first leaves Safari with a blank <img>.`

5. **A non-obvious regex or piece of arithmetic.** Say what it matches, not that it matches.

### Do not write one when

- **It narrates the diff** — `// Added null check`, `// Changed to bg-card`, `// New: handles empty
  state`, `// Now gated behind confirmation`.
- **It restates the line below it** in prose, or labels the obvious (`// increment the counter`).
- **It is a commented-out block.** Version control holds the old code; a commented block is code
  nobody type-checks, lints, or updates, and the reader cannot tell a spare part from a leftover.
- **It is addressed to a reviewer** rather than to a reader.

**Why diff narration is a defect and not merely noise.** It describes a change. Once merged there is no
change — the comment becomes a claim about history that the code no longer supports, and nobody updates
it, because updating it requires knowing which past state it referred to. `// Added null check` survives
the deletion of the null check. That content belongs in the PR body, which `eq-frontend-workflow`
already requires. Grep openers for a sweep: `Added|Changed|Updated|Fixed|Removed|Now |Note that we`.

This is not "strip every comment" — applied literally, that deletes the most valuable comments in a
codebase, the ones naming the external constraint. Delete the narration; keep the constraint.

### Extract a named function instead of explaining unclear code

If the comment you are about to write is `// check whether the user can edit`, the fix is a `canEdit()`
helper. A name is checked by every call site and survives refactoring; a comment is checked by nobody.
§2 covers what makes the name good.

```ts
// Before — the comment carries the intent
// only owners and admins can edit, and never on archived projects
if ((u.role === 'owner' || u.role === 'admin') && !p.archivedAt) { … }

// After — the name carries it
const canEdit = (u: User, p: Project) => (u.role === 'owner' || u.role === 'admin') && !p.archivedAt;
if (canEdit(u, p)) { … }
```

### JSDoc — scoped by whether the consumer can read the implementation

- **Required** on the public API of a published package: every exported function, type, and prop
  shipped to a registry or consumed across a package boundary. The consumer reads a tooltip in their
  editor and cannot jump to the source.
- **Not required** on internal application code. There the reader is one keystroke from the
  implementation, and the block decays into a restatement of the signature the types already carry —
  `@param userId The user id` is a maintenance cost with no information in it.

The boundary is the package boundary, never a judgement about importance.

### Section banner comments

A `// ─── Types ───` divider is allowed and never required. **A banner dividing a file into labelled
regions is evidence the file holds more than one concern** — the labels name the concerns. Read it as
a signal to apply §3's extraction remedy rather than as a thing to ban: a banner in a long shared file
is harmless, and adding banners to new code is a way of deferring the split.

**Enforcement:** the conventions review, and nothing else. Do not describe any of §1 as gated.

## 2. Naming and abstraction

These are the parts of general clean-code guidance that survive contact with this standard. Much of
that canon is deliberately rejected here and answered in `SKILL.md` §1 — most importantly **there is
no function-length limit**, because hooks, reducers and `render*` helpers are legitimately long. Read
§1 rather than re-arguing it. Nothing below is linted.

- **Names reveal intent.** `elapsedDays`, not `d`. `isPasswordValid`, not `check`. The second
  argument is greppability: a name you cannot search for is a name the next refactor misses, because
  the refactor starts with `rg`, and `d` matches everything.

- **Names must not lie.** A `*Ids` variable holds ids, not objects. A `*List` is an array — not a
  `Map`, not a `Record`.

  ```ts
  const agentList: Map<string, Agent> = …;   // lies twice
  const agentsById: Map<string, Agent> = …;  // states the shape and the key
  ```

- **Distinctions must mean something.** `AgentData` beside `AgentInfo` tells the reader nothing about
  which to use. If two names differ, the things they name must differ — `AgentSummary` (list row) and
  `AgentDetail` (full record) are a real distinction.

- **One level of abstraction per function.** A handler decides *what* happens. It does not also
  contain the regex, the date arithmetic, or the storage-key format.

  ```ts
  // Before — three levels in one handler
  const onSubmit = (v: Form) => {
      if (!/^[\w.+-]+@[\w-]+\.[a-z]{2,}$/i.test(v.email)) return setError('Bad email');
      localStorage.setItem(`draft:${tenantId}:${formId}`, JSON.stringify(v));
      save(v);
  };

  // After — the handler reads as policy
  const onSubmit = (v: Form) => {
      if (!isEmail(v.email)) return setError('Bad email');
      saveDraft(draftKey(tenantId, formId), v);
      save(v);
  };
  ```

  `isEmail`, `draftKey` and `saveDraft` are pure helpers; `structure.md` §5 says which `utils/` they
  go in.

- **Declare near use.** A variable defined forty lines above its only reader is a reading cost with no
  benefit — the reader carries it through forty lines that never touch it.

- **Newspaper order.** The exported unit first, then the helpers it calls, in call order. A reader who
  stops after the first screen has the summary; one who keeps going gets the detail. `render*` helpers
  follow the order of their call sites.

**Identifier *casing* — `PascalCase` for a component, `useCamelCase` for a hook — and every filename
form are `structure.md` §1.** This section owns identifier *semantics*: whether a name states intent,
whether it lies about a shape, whether a distinction means anything — and function shape.

## 3. How much belongs in one file

`SKILL.md` §1 owns `max-lines`, `complexity` and `max-depth` and the values they are set to;
`structure.md` §8 defers to it. This section is the judgment half those numbers do not decide.

**One exported unit of behaviour per file** — one component, one hook, or one API resource module,
plus the private helpers it alone uses. A second exported component is a second file. This is the rule
the numbers cannot express: a file can sit far inside every budget and still export three unrelated
things.

**A raw functions-per-file limit would be the wrong rule.** Twelve three-line helpers read better than
three branchy ones, so counting functions punishes exactly the decomposition §2 asks for. No
mainstream JS/TS linter implements such a limit, and that is not an oversight. Budget by complexity.

| Cyclomatic complexity of the helper | How many of that class belong in one file |
|---|---|
| 1–2 — formatters, type guards, small `render*` | unbounded |
| 3–5 | up to about six |
| 6 up to the `complexity` ceiling `SKILL.md` §1 configures | up to two |
| over that ceiling — the lint budget already rejects it | none — extract it, or push it down into `utils/` |

**Summed complexity across a file: ≤ 80.** A file inside the line budget can still be over this one,
and that is the signal it holds more than one concern. Reviewer-enforced: no linter sums per file, so
never describe this number as gated.

### Reading the numbers

With `complexity` set to a maximum of `0`, the rule reports **every** function's complexity instead of
only the ones over budget — no extra dependency. **oxlint has no `--rule` flag**, so the override cannot
be passed on the command line; it goes in a throwaway config, which is also what silences every other
rule so the output is complexity and nothing else:

```json
// cx.json — throwaway, never committed
{
    "categories": { "correctness": "off" },
    "rules": { "complexity": ["warn", 0] }
}
```

```
$ npx oxlint -c cx.json src/invoice-row.ts

src/invoice-row.ts:1:29: warning eslint(complexity): function has a complexity of 1. Maximum allowed is 0.
src/invoice-row.ts:3:23: warning eslint(complexity): function has a complexity of 1. Maximum allowed is 0.
src/invoice-row.ts:5:22: warning eslint(complexity): function has a complexity of 4. Maximum allowed is 0.
src/invoice-row.ts:12:25: warning eslint(complexity): function has a complexity of 10. Maximum allowed is 0.
```

Real output from oxlint 1.77.0 against a four-function fixture. The `eslint(complexity)` code is oxlint's
own naming for a rule it ported from ESLint's core set, not a second linter running. `categories` is the
load-bearing line:
without it the run also reports `no-unused-vars` and `no-debugger` from the default `correctness`
category, and the numbers you want are buried. Warnings do not set the exit code, so the run exits 0.

Sum for the file total:

```bash
npx oxlint -c cx.json src/invoice-row.ts 2>&1 | grep -oE 'complexity of [0-9]+' | awk '{ s += $3 } END { print s + 0 }'
# 16
```

`grep` and `awk` rather than `ripgrep`: this pipeline runs on whatever machine the reviewer is on,
and `rg` is not part of a Node toolchain — the same reason `.claude/hooks/lint-fix.sh` parses its
input with `node` instead of `jq`. `print s + 0` keeps the output a number when nothing matched,
so a config that failed to enable `complexity` reports `0` rather than an empty line.

`-f json` emits the same numbers inside each diagnostic's `message`, for a script that needs to walk
more than one file. There is no reporter field holding the complexity as a number — it exists only in
the message text, so any total is parsed out of prose either way.

### Over budget is fixed by extraction

Into the folder shapes `structure.md` defines — subcomponents into `components/` and hooks into
`hooks/use-*` (§2), pure helpers into `utils/` as named modules (§5). It is **not** fixed by inlining
helpers to bring a count down, by merging two branchy functions into one, or by an `oxlint-disable`.
Each of those keeps the concerns in the file and hides the measurement.

### The limit of the metric

Cyclomatic complexity counts branches — `if`, `&&`, `?:`, `case`, `catch`. It is blind to naming, to
coupling, and to how many concerns a file touches. A file can sit inside every number on this page and
still be wrong, and a file one over a threshold can be perfectly clear. The numbers bound the argument;
they do not end it. `duplication.md` §3 names the asymmetry that makes this the right default: undoing
a wrong structural decision costs more than the duplication it was meant to prevent, so the metric is
evidence for the reviewer, never the verdict.
