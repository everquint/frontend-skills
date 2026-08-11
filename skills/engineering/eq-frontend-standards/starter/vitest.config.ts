import type { UserConfigFn } from 'vite';
/* The floors here are a BACKSTOP against wholesale regression, not the gate. "Are the lines this change
 * adds tested?" is asked per change by `diff-cover` in CI (`npm run coverage:diff`) — a global
 * percentage cannot answer it, and pinning the floors to achieved coverage silently demands ~100% of all
 * new code. Reasoning: eq-frontend-quality-bar SKILL.md.
 *
 * `lcov` must stay in `reporter`: it writes coverage/lcov.info, which is what diff-cover reads.
 *
 * `thresholds.autoUpdate` is deliberately absent. Set each floor once, to achieved rounded down minus 1,
 * then leave it; a new repo starts at 0 and relies on diff coverage from the first commit. */
import { defineConfig, mergeConfig } from 'vitest/config';

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
                reporter: ['text-summary', 'json-summary', 'lcov'],
                /* Must see the whole codebase: widen when source moves out of src/, never narrow to
                 * raise the percentage. Also the diff gate's exclusion list — a file absent from the
                 * report is skipped there too. */
                include: ['src/**/*.{ts,tsx,js,jsx}'],
                exclude: ['src/**/*.test.{ts,tsx,js,jsx}', 'src/**/*.d.ts', 'src/test/**'],
                thresholds: {
                    lines: 0,
                    functions: 0,
                    branches: 0,
                    statements: 0,
                },
            },
        },
    }),
);
