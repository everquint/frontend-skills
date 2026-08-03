---
name: frontend-quality-bar
description: Enforces the non-lintable half of frontend quality — test-driven development and coverage ratchets, error reporting and observability, performance budgets, accessibility verification, and client-side security. Use when adding a feature or fixing a bug (tests come first), setting up or auditing a repo's test strategy, deciding what must be tested, wiring coverage gates, adding error reporting, setting bundle budgets, verifying accessibility, or reviewing code that renders untrusted HTML or handles secrets.
---

# Frontend Quality Bar

Lint catches syntax-shaped defects. This covers the rest, where the failure is invisible until
production. Every item here has an enforcement mechanism — where one does not exist, that is stated
rather than hidden behind "should".

## 1. Test-driven development — enforced

Write the failing test first. Three laws, for **new production code**:

1. Write a failing test before the production code that satisfies it.
2. Write no more of that test than is sufficient to fail.
3. Write no more production code than is sufficient to pass it.

Tests are **F.I.R.S.T.** — Fast, Independent, Repeatable, Self-Validating, Timely. *Independent* is
the one that bites: a test that only passes after another test has run is broken, not order-sensitive.

### You cannot mechanically prove a test came first

Any claim to enforce test-first via git history is gameable and brittle. So enforce the **observable
consequence** instead — changed code is covered:

| Mechanism | Enforces | How |
|---|---|---|
| **Diff coverage** | new/changed lines are tested | CI fails when changed lines fall below the floor |
| **Coverage ratchet** | total coverage never drops | `coverage.thresholds.autoUpdate` |
| **Test-file presence** | every new source module has a test | structure check |
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

## 2. Observability — enforced

Banning `console.log` while having nowhere to send errors means production failures are invisible.

- **An error reporter is required** — errors reach a service, not just the console. Product analytics
  is not error reporting; they answer different questions.
- **Error boundaries at route level and around any independently-failing widget.** Without them one
  throw blanks the whole app. Gated in part by `react-hooks/error-boundaries`.
- **Every caught error does two things**: a user-facing message that says what to do next, and a
  reported event with enough context to debug. A swallowed error is a defect.
- **Never surface transport text to users.** "Request failed with status code 403" is not a message;
  map it.
- **Scrub before sending** — no tokens, emails, or message bodies in error payloads.

Reviewer-enforced: no linter knows whether an error went anywhere.

## 3. Performance budgets — enforced

Measured-but-not-gated is not enforced. A bundle analyzer nobody runs catches nothing.

- **Bundle budget in CI** — `size-limit` with a per-entry byte ceiling. Exceeding it fails the build.
- **Route-level code splitting is a deliberate choice, not a default.** Instant navigation is a
  legitimate reason to skip it; record the decision either way.
- **Heavy dependencies load on demand** — PDF renderers, chart libraries, editors, diagram engines.
  A dependency in the initial bundle that 5% of sessions use is a budget bug.
- Long lists virtualize. Reviewer-enforced.

## 4. Accessibility — partly enforced

`eslint-plugin-jsx-a11y` ships ~35 rules; most configs enable a handful. Enable the recommended set.

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

Run an automated audit (axe) on primary flows in CI or before release. Automated tools catch roughly
a third of real issues — the checklist covers the rest.

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

## 6. Architecture decision records — enforced

Every non-obvious decision gets a short ADR: context, decision, consequences, date.

This exists because rationale and facts rot at different speeds. When they live in the same document,
a code change silently invalidates the prose around it — the observed result is a conventions doc
confidently stating things that are no longer true. Keep *what the rule is* in the standard and *why
it was chosen* in an ADR, and the standard stays checkable.

Write one when: a dependency is chosen over an alternative; a rule is deliberately disabled; a
mechanism is rejected as overengineering; a known-standard practice is skipped. One page. Never
delete one — supersede it.
