/* The `/vitest` entry point matters: plain '@testing-library/jest-dom' registers nothing under
 * Vitest and throws no error. Why: eq-frontend-standards references/starter-rationale.md. */
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

/* Required because `test.globals` is off: without it a second render() in one file reports
 * "found multiple elements". */
afterEach(cleanup);
