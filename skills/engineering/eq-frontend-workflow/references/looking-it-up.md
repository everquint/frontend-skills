# Looking it up before writing it

Two questions come before the first edit, and both are cheap relative to what they prevent.

## 1. Does it already exist?

Search the package registry, then the org's own repos, before writing a utility, a hook, or a wrapper.

- Prefer a maintained dependency to a hand-rolled equivalent, and an existing internal module to a
  second one that does the same thing — `../eq-frontend-standards/references/duplication.md` treats a
  duplicated *decision* as the defect, and two utilities solving one problem is that.
- **A new dependency needs a reason the search produced, stated in the PR body**: what it replaces, why
  the platform or an existing dependency does not already cover it, and its install footprint. The
  registry search is what makes that sentence writable.
- The inverse is also a finding. Adding a dependency for something the platform now does — a date
  format, a deep clone, `structuredClone`, an `AbortController` — is worth catching in review.

## 2. Does the API behave the way you are about to assume?

Resolve the library's own documentation **at the version this repo pins**. Not from memory, and not
from a general web result that may describe a different major.

| Mechanism | When to reach for it |
|---|---|
| A docs-retrieval tool such as **Context7**, when the agent has one mounted | First choice: it resolves a package name to its versioned documentation, which is exactly the question |
| The installed package itself — `README`, `.d.ts`, `CHANGELOG` under `node_modules/` | Always available, always matches the pinned version, and **outranks any external source when they disagree** |
| The vendor's docs site or source repo | When the packaged docs are thin, or the question is about intent rather than signature |
| A general web search | Last, and only to *find* the primary source — never as the source |

**No mechanism is assumed to exist.** An agent with no docs tool uses the installed package; the rule is
the lookup, not the tool. A skill that says "call Context7" is dead text for an agent without it, and
dead text reads as an instruction that was ignored.

**Say which source answered the question** whenever the answer decided a design. "The `.d.ts` says the
callback is sync" is checkable; "I believe it's sync" is not.

## 3. Measure rather than reason, whenever the runtime can answer

A probe outranks every document, including this one. Run the command, read the exit code, print the
value.

This rule is written from losses, not from principle. Each of these was reasoned confidently, was
wrong, and had a probe available that would have taken under a minute:

| The assumption | What a probe showed |
|---|---|
| A lint rule "doesn't exist in oxlint" | It exists and fires; a `--print-config` grep had missed it |
| `paths` without a bundler alias "type-checks, then fails the build" | Vite resolves `paths` natively; the real casualty was the test runner |
| `ignorePatterns` is inherited through `extends` | It is not — 124 lint errors for every consumer that vendored the skill |
| A formatter would reformat a lockfile | It excludes lockfiles by filename; identical bytes under another name are reformatted |

**Write the probe so it can fail.** A check whose failure is indistinguishable from success is worse
than no check: run it once in the state where it should pass and once in the state where it should fail,
and confirm the two differ. Most of the entries above were found precisely that way.

**Watch the shell as much as the tool.** A measurement is only as good as the command that produced it,
and two harness mistakes have produced confidently wrong numbers here:

- `cmd | tail -3; echo $?` reports **`tail`'s** exit code, not the command's. Capture first
  (`out=$(cmd 2>&1); code=$?`), or use `PIPESTATUS`.
- **zsh does not word-split unquoted parameter expansions**; bash does. `npx vitest $args` with
  `args="run --coverage"` passes *one* argument in zsh, so the tool sees a nonsense filename and fails
  for a reason that has nothing to do with what was being measured. CI runs bash and a developer's
  terminal is often zsh, so a loop that measures correctly in one can lie in the other. Prefer an array,
  or write the arguments literally.
