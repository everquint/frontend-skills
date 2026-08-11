---
name: eq-frontend-quality-bar
description: The non-lintable half of frontend quality — tests and diff-coverage gates, error reporting, performance budgets, accessibility, client-side security. Use when writing tests, wiring a coverage gate, adding error reporting, setting a bundle budget, verifying accessibility, or reviewing untrusted HTML or secret handling.
---

# Frontend Quality Bar

Lint catches syntax-shaped defects. This covers the rest, where the failure is invisible until
production. Every item here has an enforcement mechanism — where one does not exist, that is stated
rather than hidden behind "should".

## 1. Test-driven development — partly enforced

Write the failing test first. Three laws, for **new production code**:

1. Write a failing test before the production code that satisfies it.
2. Write no more of that test than is sufficient to fail.
3. Write no more production code than is sufficient to pass it.

Tests are **F.I.R.S.T.** — Fast, Independent, Repeatable, Self-Validating, Timely. *Independent* is
the one that bites: a test that only passes after another test has run is broken, not order-sensitive.

### The three test levels

| Level | Tests | May touch | Must not touch | Tool | Runs |
|---|---|---|---|---|---|
| **Unit** | pure logic — reducers, selectors, formatters, parsers, date/money maths — and hooks with real state transitions | in-memory state, fake timers | network, router, real timers | Vitest | every commit, and CI |
| **Integration** | a component tree with its real providers — router, query client, store — against an intercepted HTTP boundary | providers, the DOM, an HTTP interceptor | a real server, a real browser | Vitest + Testing Library + MSW | CI |
| **E2E** | critical user journeys, in a real browser against a real production build | the whole stack, as a user does | nothing — that is the point | Playwright | CI — a fast smoke set on every PR, the full set on merge to the default branch or on a schedule |

**Integration is where most frontend value lives.** It exercises the wiring unit tests mock away —
provider composition, cache keys, route params, loading and error transitions — and it covers that
wiring exhaustively at a cost per case E2E cannot pay.

**Ordering rule: more unit tests than integration tests, more integration tests than E2E tests.**
Never invert it. An inverted pyramid produces a suite slow and flaky enough that a red build gets
re-run instead of read, which is the moment a test suite stops being a gate. No percentage split is
quoted here because none has been measured here; the ordering is the rule.

### Test file naming and placement

- Unit and integration: `<name>.test.ts(x)`, co-located beside the file under test.
- E2E: `<journey>.test.ts`, in one dedicated top-level directory (`e2e/`) — a spec belongs to a
  journey, not to a module, so there is no source file for it to sit beside.
- No `__tests__/` directories. No `.spec.*` suffix, **at every level including E2E**: one suffix
  repo-wide, and Playwright's default `testMatch` collects `.test.ts` (verified on 1.62.1), so a
  carve-out for E2E would cost a second convention and buy nothing.

The full naming and placement rules are not restated here: they live in
`../eq-frontend-standards/references/structure.md` — skills install flat in one directory, so a
sibling skill is one level up — and rule 4 of that skill's `scripts/check-structure.mjs` reports
both prohibitions above, uniformly, with no per-level exception.

E2E specifics — what earns a spec, Playwright config, selectors, waiting, isolation, artifacts and
quarantine — are in `references/e2e.md` beside this file.

### You cannot mechanically prove a test came first

Any claim to enforce test-first via git history is gameable and brittle. So enforce the **observable
consequence** instead — changed code is covered:

| Mechanism | Enforces | How |
|---|---|---|
| **Diff coverage** — the gate | the lines this change ADDS are tested | `diff-cover coverage/lcov.info --fail-under=90` |
| **Project floors** — a backstop | no wholesale collapse | `coverage.thresholds`, set once by a human and frozen |
| **Test-file presence** | every new source module has a test | reviewer-enforced, unless the repo supplies its own checker script — nothing off the shelf does this |
| **Local loop** | fast feedback while writing | `vitest --changed` / `vitest related <files>` |

Honest framing: test-first is a **practice**, reviewer-enforced; "changed code is covered" is the
**gate**, machine-enforced. Do not claim the gate proves the practice.

### Diff coverage is the gate; a global percentage cannot be

`diff-cover` fails a branch whose ADDED lines are under **90%** covered — Google's stated lower bound for
per-commit coverage (upper 99%); SonarQube's built-in gate uses 80% on new code, Chromium's per-CL check
70%. So 90% is at the strict end of normal, not beyond it. A global percentage cannot: depending on how far the floor lags actual coverage it demands ~100% of a
large diff or waves hundreds of uncovered lines through a big repo, its grip loosening as the repo grows.
Measured with floors pinned at achieved coverage — a change adding 19 lines with one uncovered defensive
branch was rejected on three metrics, while `diff-cover` scored it 94.7% and passed.

**Use the tool, do not write one.** A hand-rolled equivalent was built and deleted: 391 lines, and a review
found four ways it reported green on untested code (renames, quoted paths, a non-root cwd, a stale report).
`diff-cover` gave identical numbers from one command. Codecov's hosted `patch` status is the other standard
answer, defaulted against only because it sends a private repo's coverage offsite.

`lcov` must be in `coverage.reporter`, and the run must be **unfiltered** — a filtered run marks unimported
modules uncovered and fails an innocent branch, which is why `coverage:diff` runs the whole suite.
`coverage.include` must span the codebase; it doubles as this gate's exclusion list. Known limit:
diff-cover measures LINES, so an untested `else` on an executed line passes.

### The project floors are a backstop, and they no longer move themselves

Set each floor **once**, to achieved rounded down minus 1, then leave it; a new repo starts at 0.
`thresholds.autoUpdate` is gone — it also rewrote floors on a **failed** run (vitest 4.1.10: a zero-test
run exits 1 and still writes them, including a vacuous `branches: 100`) and rewrote them in the discarded
CI working tree. A floor that edits itself is not a decision anyone made. What the floors do catch is what
diff coverage cannot: tests deleted for untouched code. A large enough deletion fits inside the headroom,
so that hole stays reviewer-enforced — deleted test files are conspicuous in a diff.

**Coverage cannot tell whether a test asserts anything**, now the main gap: an agent writing tests to
satisfy a gate produces assertion-free tests at a rate no human would. Mutation testing is the only tool
that measures it — `references/mutation-testing.md`.

### What to test, and what not to

| Test | Do not test |
|---|---|
| Pure logic: reducers, selectors, formatters, parsers, date/money maths | Third-party library internals |
| Hooks with real state transitions and effects | Exact class strings or DOM structure |
| Behaviour a user can observe — what renders, what happens on interaction | Implementation details that change on every refactor |
| Error and empty states, not only the happy path | Snapshot-everything tests nobody reads |
| Boundary parsing — malformed API payloads, missing fields | Getters with no branching |

**Mock at the network boundary, not at the module boundary.** Intercept HTTP; do not stub your own
modules. Module mocks encode the implementation into the test, so the test passes after a refactor
that broke the app. This is the single highest-leverage testing decision in a frontend repo.

## 2. Observability — reviewer-enforced

Banning `console.log` while having nowhere to send errors means production failures are invisible.

- **An error reporter is required** — errors reach a service, not just the console. Product analytics
  is not error reporting; they answer different questions.
- **Error boundaries at route level and around any independently-failing widget.** Without them one
  throw blanks the whole app. Reviewer-enforced: no lint rule detects an **absent** boundary.
  `react-hooks-js/error-boundaries` catches misuse of a boundary that already exists — the alias is
  `../eq-frontend-standards/references/react-hooks-v7.md`.
- **Every caught error does two things**: a user-facing message that says what to do next, and a
  reported event with enough context to debug. A swallowed error is a defect.
- **Never surface transport text to users.** "Request failed with status code 403" is not a message;
  map it.
- **Scrub before sending** — no tokens, emails, or message bodies in error payloads.

Reviewer-enforced: no linter knows whether an error went anywhere.

## 3. Performance budgets — partly enforced

Measured-but-not-gated is not enforced. A bundle analyzer nobody runs catches nothing.

- **Bundle budget in CI** — `size-limit` with a per-entry byte ceiling. Exceeding it fails the build.
- **Route-level code splitting is a deliberate choice, not a default.** Instant navigation is a
  legitimate reason to skip it; record the decision either way.
- **Heavy dependencies load on demand** — PDF renderers, chart libraries, editors, diagram engines.
  A dependency in the initial bundle that 5% of sessions use is a budget bug.
- Long lists virtualize. Reviewer-enforced.

## 4. Accessibility — partly enforced

The standard pins **31 `jsx_a11y/*` rules by name** in the standards skill's
`starter/.oxlintrc.json` — pinned rather than enabled by category, because oxlint sorts a11y rules
across categories and one category silently leaves the rest off at exit 0.

But the failures that matter are **not lintable**, so they are reviewer-enforced with a checklist:

| Check | Failure it prevents |
|---|---|
| Every interactive element reachable by keyboard, in a sensible order | keyboard users cannot use the feature |
| Focus moves into a modal on open and returns to the trigger on close | focus lost to the page behind the overlay |
| No focus trap without an Escape route | user stuck |
| Async results announced via a live region | screen-reader users never learn the result |
| Icon-only controls have an accessible label | control announced as "button" |
| Visible focus indicator, never removed without replacement | cannot tell where you are |
| Contrast meets WCAG AA in **both** light and dark themes | dark mode is where contrast regressions hide |

Which element to write — landmarks, heading outline, lists, form labelling, tables, ARIA, live
regions — is `references/semantic-html.md` beside this file, with the lint-vs-reviewer split verified.

Run an automated audit (axe) on primary flows in CI or before release. **A clean automated audit does
not certify accessibility** — every rule it ships is a rule that can be decided from static markup, and
none of the checks above can be. Published hit-rate figures for automated tooling conflict and are not
worth quoting; the checklist covers what the audit structurally cannot reach.

## 5. Client-side security — enforced

- **One sanitizer module, one place.** Route every `dangerouslySetInnerHTML` through a single
  module with purpose-scoped configs. Duplicated inline sanitizer configs are the defect: fix one
  allowlist and the other call sites stay vulnerable. This is a real, repeatedly-observed pattern in
  apps that render third-party HTML such as email.
- **No secrets in client code.** Anything in the bundle is public, including every
  build-time-inlined env var. Secrets belong server-side.
- **Validate env at startup with a schema** so a missing variable fails immediately at boot rather
  than at first use, in a code path nobody exercises until a customer does.
- **Dependency vulnerability scanning in CI** — an advisory scanner broader than the package
  manager's own audit.
- **Automated dependency updates.** Unpatched transitive dependencies are the common breach path.
- Tokens are never persisted where any script can read them without a deliberate, recorded decision.

## 6. Architecture decision records — reviewer-enforced

Every non-obvious decision gets a short ADR: context, decision, consequences, date.

This exists because rationale and facts rot at different speeds. When they live in the same document,
a code change silently invalidates the prose around it — the observed result is a conventions doc
confidently stating things that are no longer true. Keep *what the rule is* in the standard and *why
it was chosen* in an ADR, and the standard stays checkable.

Write one when: a dependency is chosen over an alternative; a rule is deliberately disabled; a
mechanism is rejected as overengineering; a known-standard practice is skipped. One page. Never
delete one — supersede it.
