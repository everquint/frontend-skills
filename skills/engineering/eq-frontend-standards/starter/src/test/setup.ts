/* Loaded by `setupFiles` in vitest.config.ts, once per test environment.
 *
 * The `/vitest` entry point is the one that matters: `@testing-library/jest-dom` on its own extends
 * Jest's `expect`, and importing that form under Vitest registers nothing while throwing no error —
 * so `toBeInTheDocument()` is undefined and the failure reads as a broken test.
 */
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

/* @testing-library/react auto-unmounts between tests ONLY by registering a global `afterEach`, which
 * it can find only when `test.globals` is true. This config deliberately leaves globals off so tests
 * import from 'vitest' explicitly, so the hook is registered here instead. Without it, a second
 * `render()` in one file leaves the first tree mounted and every `getByRole` throws
 * "found multiple elements" — a failure that reads as a broken assertion, not a missing teardown. */
afterEach(cleanup);
