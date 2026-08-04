---
name: eq-frontend-quality-bar
description: The non-lintable half of frontend quality — tests and coverage ratchets, error reporting, performance budgets, accessibility, client-side security. Use when writing tests, wiring a coverage gate, adding error reporting, setting a bundle budget, verifying accessibility, or reviewing untrusted HTML or secret handling.
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
| **Diff coverage** | new/changed lines are tested | CI fails when changed lines fall below the floor |
| **Coverage ratchet** | total coverage never drops | `coverage.thresholds.autoUpdate` |
| **Test-file presence** | every new source module has a test | reviewer-enforced, unless the repo supplies its own checker script — nothing off the shelf does this |
| **Local loop** | fast feedback while writing | `vitest --changed` / `vitest related <files>` |

This is the honest framing: test-first is a **practice**, reviewer-enforced; "changed code is
covered" is the **gate**, machine-enforced. Do not claim the gate proves the practice.

### The ratchet

Vitest writes current coverage back into the config as the new floor:

```ts
// vitest.config.ts
coverage: {
    provider: 'v8',
    reporter: ['text-summary', 'json-summary'],
    thresholds: { autoUpdate: true, lines: 0, functions: 0, branches: 0, statements: 0 },
}
```

```bash
npx vitest run --coverage          # fails if coverage drops below the recorded floor
```

Two constraints, both real:

- `autoUpdate` only applies when **all** tests ran. A filtered run will not update thresholds.
- It requires a real config **file** — it throws without one, because it rewrites that file.

Same shape as the lint suppressions baseline: record where you are, then only allow improvement. A
repo with almost no tests adopts the ratchet at its current floor on day one and cannot regress.

### `include` must cover the whole codebase

A coverage config scoped to one directory reports a healthy number while the rest of the app is
unmeasured. Check what `coverage.include` actually covers before trusting any percentage.

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
  `react-hooks/error-boundaries` catches misuse of a boundary that already exists.
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

`eslint-plugin-jsx-a11y@6.10.2` ships 39 rules and its `configs.recommended` enables 34; most repos
enable a handful. Enable the recommended set.

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
