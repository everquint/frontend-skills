/* The E2E config prescribed by `eq-frontend-quality-bar` references/e2e.md §2. Every value below is
 * that section's, and the reasoning for each lives there rather than being restated here.
 *
 * `baseURL` and the `webServer` command are the two values a real app must revisit: they assume the
 * Vite `preview` server on port 4173. `webServer` runs the PRODUCTION BUILD, never the dev server —
 * a dev server resolves modules differently, skips minification and skips production env
 * substitution, so a failure that exists only in the build escapes the suite entirely.
 */
import { defineConfig } from '@playwright/test';

const isCI = !!process.env.CI;

export default defineConfig({
    /* Specs are `<journey>.test.ts` here. Playwright's default testMatch collects `.test.ts`, so the
     * repo-wide ban on `.spec.*` costs no config. */
    testDir: 'e2e',
    fullyParallel: true,
    /* Pinned in CI: the default scales to the runner's core count, and an oversubscribed 2-core runner
     * produces timeouts that read as product flakiness. */
    workers: isCI ? 2 : undefined,
    /* A `test.only` reaching CI otherwise silently reduces the suite to one spec and reports green. */
    forbidOnly: isCI,
    /* Retries in CI only. A retry locally hides a flake from the person who just wrote it. */
    retries: isCI ? 2 : 0,
    reporter: isCI ? [['html'], ['github']] : [['list']],
    use: {
        baseURL: 'http://localhost:4173',
        /* Set explicitly so `getByTestId` matches the attribute the codebase writes. Defaulted, half a
         * team writes `data-test-id` and gets silent misses. */
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
