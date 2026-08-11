# Mutation testing

The one measurement that answers "does this test assert anything?" — and the only reason it earns a
place here is that coverage cannot answer it, while the failure it catches has become cheap to cause.

## Why it is now worth the cost

A coverage gate asks whether a line ran. A test that calls a function and asserts nothing satisfies
that completely:

```ts
it('formats a size', () => {
    formatFileSize(2048);   // 100% coverage of the function, zero assertions
});
```

The historical safeguard against this was human reluctance: someone told to reach an arbitrary
coverage number feels the pointlessness and pushes back. That safeguard is gone when the tests are
written by an agent, which will produce forty such cases without complaint. The published pattern is
consistent — suites that get larger, greener, and less useful at once.

Mutation testing measures the thing directly. It edits the source (`>` becomes `>=`, a `return true`
becomes `return false`, a branch is removed), reruns the tests that cover that code, and asks whether
any test noticed. A mutant that survives is a line your suite executes but does not check.

## How to run it

Two runs, and the split matters — a scheduled-only setup catches a vacuous test *after* it has merged,
which is exactly the failure this is meant to prevent.

**Per PR, incremental, non-blocking.** Stryker's incremental mode exists for this: it reuses the last
run's results and re-tests only what changed, which is what makes CI affordable. Stryker's own guidance
is that for a PR "you probably don't need an entire mutation testing run; you are just interested in
changes since the last run on the main branch." Report the surviving mutants as a comment; do not fail
the build on them yet.

**Weekly, full, scheduled.** A complete run executes the relevant tests once per mutant, so on a suite
already taking minutes on a 2-core runner it is measured in hours. That is why it is not the PR job.
Stryker recommends a full run "now and then" regardless, because incremental state drifts.

Read the output as a **list, not a score**: the specific lines the suite runs and never checks.

## Where to point it

Do not run it over the whole codebase. Mutation testing pays best on **pure logic with branches** and
worst on rendering code, where a surviving mutant is usually a real judgement call about what is worth
asserting rather than a defect. Start with `src/utils/`, reducers, selectors, formatters, parsers, and
money or date arithmetic — the same list the SKILL's "what to test" table puts first.

## Reading the result

Three outcomes, and only one of them is a finding:

| Outcome | Meaning | Action |
|---|---|---|
| Killed | a test failed when the code changed | nothing — this is the good case |
| **Survived** | the code changed and every test still passed | read it: either add the missing assertion, or delete the test that was pretending |
| No coverage | no test exercises the line at all | that is diff coverage's job, not this one |

A surviving mutant is not automatically a bug to fix. Some are equivalent mutants — a change that
cannot alter observable behaviour — and chasing those is the same mistake as chasing the last three
points of line coverage. Judge each one; do not set a mutation-score threshold and grind toward it.

## Adopting it

Stryker for TypeScript, with the Vitest runner. Deliberately not in the starter: it is an optional
diagnostic, not a gate, and shipping a scheduled job to every repo whether or not anyone reads its
output is how a repo accumulates workflows nobody understands. Add it when someone will act on the
report — and the honest test of that is whether the last report was read.

Two configuration points worth knowing before the first run. Point `mutate` at the narrow directory
list above rather than `src/**`, or the first run will not finish. And set `concurrency` explicitly:
the default assumes a developer machine, and on a 2-core CI runner an unbounded run competes with
itself and looks like a hang.
