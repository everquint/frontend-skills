import type { UserConfigFn } from 'vite';
/* The coverage ratchet: `thresholds.autoUpdate` rewrites the floors upward in THIS file, so the
 * file is the gate — delete it and `npm run test:coverage` measures nothing. Full rationale:
 * eq-frontend-standards references/starter-rationale.md. */
import { defineConfig, mergeConfig } from 'vitest/config';

/* autoUpdate is gated behind COVERAGE_RATCHET because vitest rewrites the floors even on a FAILED
 * run (measured, vitest 4.1.10: a zero-test run exits 1 and still writes floors, including a
 * vacuous branches:100). With the flag unset, every ordinary run — `npm run test:coverage` locally
 * red or green, and CI — ENFORCES the recorded floors and never mutates this file. Only
 * `npm run test:coverage:ratchet` may move them, run deliberately after a green suite. Any
 * non-empty value enables it; the ratchet script's inline `COVERAGE_RATCHET=1` assignment is
 * unix-shell syntax — no cross-env dependency is worth carrying for a script humans run on
 * purpose. */
const ratchet = !!process.env.COVERAGE_RATCHET;

/* The `.ts` extension is required: Vite's native config loader will not resolve it extensionless. */
import viteConfig from './vite.config.ts';

/* Vitest loads this file INSTEAD of vite.config.ts, so the base config must be merged in here —
 * without it every `@/…` import in every test breaks while typecheck, lint and build stay green.
 * `UserConfigFn` is the widest of vite's three function-config signatures; passing through a
 * parameter of that type is a sound widening where a cast would hide a wrong config shape. */
const callConfigFn = (fn: UserConfigFn) => fn({ command: 'serve', mode: 'test' });

const base = typeof viteConfig === 'function' ? callConfigFn(viteConfig) : viteConfig;

export default mergeConfig(
    base,
    defineConfig({
        test: {
            environment: 'jsdom',
            setupFiles: ['./src/test/setup.ts'],
            coverage: {
                provider: 'v8',
                reporter: ['text-summary', 'json-summary'],
                /* Coverage must see the whole codebase: widen when source moves out of src/, never narrow
                 * to raise the percentage — the ratchet would lock the flattering number in. */
                include: ['src/**/*.{ts,tsx,js,jsx}'],
                exclude: ['src/**/*.test.{ts,tsx,js,jsx}', 'src/**/*.d.ts', 'src/test/**'],
                /* Floors are rewritten upward only by the ratchet script (filtered runs and
                 * ordinary runs leave them alone — see the gate above). Lowering one by hand is
                 * how the ratchet stops being one. */
                thresholds: {
                    autoUpdate: ratchet,
                    lines: 0,
                    functions: 0,
                    branches: 0,
                    statements: 0,
                },
            },
        },
    }),
);
