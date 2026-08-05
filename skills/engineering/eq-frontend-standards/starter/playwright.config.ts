/* Every value is `eq-frontend-quality-bar` references/e2e.md §2's; reasoning lives there and in
 * eq-frontend-standards references/starter-rationale.md. `baseURL` and `webServer` are the two
 * values a real app revisits — webServer runs the PRODUCTION BUILD on purpose, never the dev
 * server. */
import { defineConfig } from '@playwright/test';

const isCI = !!process.env.CI;

export default defineConfig({
  /* Specs are `<journey>.test.ts` — the repo-wide .spec.* ban costs no config here. */
  testDir: 'e2e',
  fullyParallel: true,
  /* Pinned in CI: the default oversubscribes a 2-core runner and reads as product flakiness. */
  workers: isCI ? 2 : undefined,
  /* A test.only reaching CI otherwise silently shrinks the suite to one green spec. */
  forbidOnly: isCI,
  /* CI only — a local retry hides a flake from the person who just wrote it. */
  retries: isCI ? 2 : 0,
  reporter: isCI ? [['html'], ['github']] : [['list']],
  use: {
    baseURL: 'http://localhost:4173',
    /* Explicit so getByTestId matches the attribute the codebase writes. */
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
