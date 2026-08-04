# E2E tests — Playwright

The specifics behind `../SKILL.md` §1's third test level. E2E is the most expensive test in the repo per
assertion, so every rule here exists to keep the suite small, fast, and believed.

## 1. What earns an E2E test

**Entry criterion: a journey that loses money or trust when it breaks.** In practice that is a short
list, and it stays short:

| Journey | Why it qualifies |
|---|---|
| Sign in, sign out, session expiry | nobody reaches any other journey without it |
| The primary create path, end to end | the product's reason to exist |
| The primary read path — list, open, render | a blank screen is indistinguishable from an outage |
| Payment and checkout | money |
| Permissions and tenancy boundaries | one user seeing another's data is the worst bug the app has |

**Exit criterion: an E2E test whose assertions an integration test already makes is deleted.** Its
only added coverage is browser-level — real navigation, real network, real rendering engine — and its
cost is minutes of CI on every run. When the added coverage is nothing, the cost buys nothing. This
is a deletion, not a `test.skip`: a skipped spec still has to be read and maintained.

### Naming, and the `@smoke` tag

**A spec is `<journey>.test.ts` in `e2e/`** — `sign-in.test.ts`, `checkout.test.ts`,
`invoice-create.test.ts`. `.spec.*` is banned at every level, E2E included (`../SKILL.md` §1), and
that costs nothing here: Playwright's default `testMatch` collects `.test.ts` with no config change,
verified on `@playwright/test@1.62.1`.

**A spec that must gate a PR is tagged `@smoke`.** Two forms both match `--grep @smoke` on 1.62.1,
verified by listing a file containing one of each:

```ts
test('sign in with a password @smoke', async ({ page }) => { /* … */ });
test('sign in with a password', { tag: '@smoke' }, async ({ page }) => { /* … */ });
```

Prefer the `{ tag }` option. The tag is then metadata rather than part of the title, so it stays out
of reporter output and out of the test's identity — renaming a tag does not rename the test.

The smoke set is a **subset**, and the two scripts split on it: `npm run test:e2e:smoke`
(`--grep @smoke`) is the blocking job on every PR, `npm run test:e2e` is the full run on merge to the
default branch or on a schedule. An untagged spec therefore never gates a PR, which is the point —
tag only the journeys worth blocking a merge for, and let the rest cost merge-time minutes instead.

## 2. Playwright config that matters

```ts
// playwright.config.ts
import { defineConfig } from '@playwright/test';

const isCI = !!process.env.CI;

export default defineConfig({
    testDir: 'e2e',
    fullyParallel: true,
    workers: isCI ? 2 : undefined,
    forbidOnly: isCI,
    retries: isCI ? 2 : 0,
    reporter: isCI ? [['html'], ['github']] : [['list']],
    use: {
        baseURL: 'http://localhost:4173',
        testIdAttribute: 'data-testid',
        trace: 'on-first-retry',
        screenshot: 'only-on-failure',
        video: 'retain-on-failure',
    },
    webServer: {
        command: 'npm run build && npm run preview -- --port 4173',
        url: 'http://localhost:4173',
        reuseExistingServer: !isCI,
        timeout: 120_000,
    },
});
```

**`webServer` runs the production build, never the dev server.** The dev server resolves modules
differently, serves unminified code, and skips the production define/env substitution — so a failure
that only exists in the build escapes a dev-server E2E suite entirely, and the first person to see it
is a user. Common shapes: a dependency that only resolves through the dev server's optimizer, code
stripped by minification that something depended on, a `NODE_ENV`-gated branch, an asset path that is
hashed in the build.

**Parallelism.** `fullyParallel` runs specs *and* the tests inside them concurrently, which is what
makes the suite affordable — and what makes §5's isolation rule mandatory rather than tidy. Pin
`workers` in CI: the default scales to the runner's core count, and an oversubscribed 2-core runner
produces timeouts that look like product flakiness.

**`retries` in CI only, zero locally.** A retry in CI converts a transient infrastructure fault into
a slower green rather than a false red. A retry locally hides a flake from the person who just wrote
it, at the exact moment it is cheapest to fix. `trace: 'on-first-retry'` pairs with it: tracing every
attempt is slow, so trace only the attempt that already failed once — that trace is the one anybody
opens.

**`testIdAttribute`** is configured explicitly so `getByTestId` matches the attribute the codebase
actually writes. Default it, and half the team writes `data-test-id` and gets silent misses.

`forbidOnly` fails the run when a `test.only` reaches CI, which otherwise silently reduces the suite
to one spec while reporting green.

## 3. Selectors

Preference order, strictest first:

1. **Role plus accessible name** — `getByRole('button', { name: 'Publish' })`. This queries the
   accessibility tree, so one assertion covers two requirements: the control works, and it is
   reachable by assistive technology. A missing label fails the test rather than shipping.
2. **A stable explicit test id** — `getByTestId('invoice-row')`. For anything with no meaningful
   role or name: rows, containers, canvases. It is explicit, so a refactor that renames it is a
   deliberate edit, not an accident.
3. **CSS or text selectors** — last resort.

**A CSS-class selector is a flake by construction.** Classes exist to describe presentation, so a
styling refactor renames them while the application still behaves correctly — and the test fails for
a reason unrelated to behaviour. Every such failure trains the team to distrust the suite. Utility-class
frameworks make this worse: the class string is generated markup, and it changes when spacing changes.

Raw text selectors have the same defect one step removed: copy changes, and an i18n rollout changes
all of it at once.

## 4. Waiting

**Never a fixed sleep.** No `waitForTimeout`, no `sleep(500)`.

Assert on the observable state you want and let auto-waiting retry until it holds:

```ts
await expect(page.getByRole('heading', { name: 'Invoice INV-1042' })).toBeVisible();
await expect(page.getByRole('status')).toHaveText('Saved');
```

A fixed sleep is calibrated against one machine on one day. It is too short on a loaded CI runner —
a flake — and too long on a fast one — a slow suite — and across a fleet of differently-sized runners
it is both at once. The number that fixes the flake is the number that makes the suite unaffordable.

Where the thing being waited for is not visible in the DOM, wait on the specific event:
`page.waitForResponse`, `page.waitForURL`, or an explicit expectation on a network-driven state
change. Those are conditions; a sleep is a guess.

## 5. Test data and isolation

**Each spec creates what it needs and cleans up after itself.** No spec depends on another spec's
residue, and no spec depends on a hand-maintained shared seeded account.

This is not tidiness. `fullyParallel` plus a worker pool means execution order is not the file order,
is not stable between runs, and is not stable between a local machine and CI. A spec that only passes
when it runs second is broken — the same F.I.R.S.T. *Independent* rule as `../SKILL.md` §1, with the
failure mode made routine by parallelism instead of rare.

Practical shape:

- Create fixtures through the API or a seed endpoint, not by driving the UI of another journey. Using
  the create-journey UI to set up the read-journey spec makes one failure fail two specs and hides
  which one is broken.
- Namespace every created record with a unique per-run token so parallel workers cannot collide, and
  so leaked data is identifiable later.
- Authenticate once into a stored state and reuse it, rather than logging in through the form in every
  spec — except in the auth spec itself, which is the one place the form is under test.

## 6. Artifacts on failure

Traces, screenshots and videos are uploaded from CI as job artifacts, retained long enough to be read
after a weekend.

**A red E2E job with no artifact is unactionable**, and an unactionable red job gets re-run rather
than read — which is exactly the failure mode §2's retry policy is trying to avoid. The trace viewer
turns a one-line timeout into a reproducible timeline; without it the only debugging tool is
re-running the suite locally and hoping.

## 7. Quarantine

A spec that fails intermittently is **quarantined with a named owner and a date**. It is never left
retrying silently: a permanently-retried test asserts nothing, because the recorded outcome is "green
eventually", which is also what a broken feature produces.

Mechanically, quarantine means:

- The spec is excluded from the blocking job, so it cannot fail a PR.
- It **still runs, and is still reported**, in a non-blocking job. A quarantined spec nobody runs is a
  deleted spec with extra steps.
- The exclusion carries an owner and the date it was added, in the code.
- An unclaimed quarantine older than **30 days** is deleted, not inherited. The 30 days is a policy
  chosen here, not a measured threshold — but a spec nobody has fixed in a month is not being fixed,
  and keeping it means keeping a permanently-red signal everyone has already learned to ignore.

Quarantine is a scheduling decision, not a verdict. It buys time to diagnose without holding the whole
team's merges hostage to one flake.

## 8. What E2E must not be used for

Not E2E — these are integration tests:

- Exhaustive form validation. Every required field, every format rule, every boundary length.
- Every error state. 400, 403, 409, 500, timeout, malformed payload.
- Every empty, loading and partial state.
- Permission matrices across roles, beyond the one boundary case that qualifies under §1.
- Component-level behaviour: sorting, filtering, pagination controls, keyboard interaction.

**E2E covers the journey. Integration covers the matrix.** The same case costs seconds in an
integration test and a minute in a browser, and multiplying the matrix by a browser is how a suite
reaches an hour and stops running on PRs.

<!-- `playwright.config.ts` and an empty `e2e/` DO ship in the eq-frontend-standards starter; no E2E CI
job does, deliberately. With zero specs a job is a green check asserting nothing, while its
`webServer` pays for a production build on every PR — so the job arrives with the first real journey,
and `test:e2e:smoke` has no caller until then. The shipped config's `baseURL` and `webServer` command
are scaffold defaults; a real app sets its own. Both scripts pass `--pass-with-no-tests`, so they
exit 0 on a repo with no specs instead of `Error: No tests found` — verified on 1.62.1, where the same
command without the flag exits 1, and re-verified against the shipped config with an empty `e2e/`:
exit 0 in 4.8s, with the `webServer` production build never starting. -->
