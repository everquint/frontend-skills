import type { UserConfigFn } from 'vite';
/* The coverage ratchet: `thresholds.autoUpdate` rewrites the floors upward in THIS file, so the
 * file is the gate — delete it and `npm run test:coverage` measures nothing. Full rationale:
 * eq-frontend-standards references/starter-rationale.md. */
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
                reporter: ['text-summary', 'json-summary'],
                /* Coverage must see the whole codebase: widen when source moves out of src/, never narrow
                 * to raise the percentage — the ratchet would lock the flattering number in. */
                include: ['src/**/*.{ts,tsx,js,jsx}'],
                exclude: ['src/**/*.test.{ts,tsx,js,jsx}', 'src/**/*.d.ts', 'src/test/**'],
                /* Floors are rewritten upward by every FULL run (filtered runs leave them alone).
                 * Lowering one by hand is how the ratchet stops being one. */
                thresholds: {
                    autoUpdate: true,
                    lines: 0,
                    functions: 0,
                    branches: 0,
                    statements: 0,
                },
            },
        },
    }),
);
