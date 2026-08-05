import type { UserConfigFn } from 'vite';
/* The coverage ratchet. `eq-frontend-quality-bar` SKILL.md §1 makes `coverage.thresholds.autoUpdate`
 * the coverage gate, and autoUpdate needs a real config FILE because it rewrites that file — without
 * one it throws. So this file is the gate: delete it and `npm run test:coverage` measures nothing.
 *
 * The floors start at 0 and are rewritten upward by every full run. A repo with almost no tests
 * therefore adopts at its own number on day one and cannot regress, which is the same shape as the
 * noUncheckedIndexedAccess baseline in tsconfig.strict.baseline. Lowering a floor by hand is how the
 * ratchet stops being one.
 */
import { defineConfig, mergeConfig } from 'vitest/config';

/* The `.ts` extension is required, not decorative: Vite's `configLoader: 'native'` — planned to become
 * the default — warns on an extensionless relative import of a TS config and will not resolve it. */
import viteConfig from './vite.config.ts';

/* VITEST LOADS THIS FILE INSTEAD OF vite.config.ts — it does not merge the two. So `resolve.alias`
 * and the Tailwind plugin declared over there are absent from a test run unless the base config is
 * merged in here explicitly. A plain `defineConfig({ test: … })` in this file breaks every `@/…`
 * import in every test while typecheck, lint and build all stay green, because those three read the
 * tsconfig `paths` and the vite config directly.
 *
 * A vite.config.ts exporting a FUNCTION is called; one exporting a Promise makes `mergeConfig` throw
 * on a Promise, which is the loud failure and not the silent one.
 */

/* Narrowing on `typeof … === 'function'` leaves a union of vite's THREE function config types
 * (UserConfigFnObject | UserConfigFnPromise | UserConfigFn), and TS cannot call a union of
 * signatures whose return types differ — TS2349, which surfaces only once this file is inside a
 * tsconfig `include`. UserConfigFn is the widest of the three, so passing through a parameter of
 * that type is a sound widening and NOT an `as`: a cast here would also suppress a genuinely wrong
 * config shape. Calling via a helper keeps the narrowing on both branches, so the else branch stays
 * non-function and a Promise export still reaches `mergeConfig` and throws loudly. */
const callConfigFn = (fn: UserConfigFn) => fn({ command: 'serve', mode: 'test' });

const base = typeof viteConfig === 'function' ? callConfigFn(viteConfig) : viteConfig;

export default mergeConfig(
  base,
  defineConfig({
    test: {
      environment: 'jsdom',
      /* Registers @testing-library/jest-dom's matchers. Without it `toBeInTheDocument()` is not a
       * function, which reads as a broken test rather than a missing setup file. MSW's server is
       * NOT started here: its handlers are repo-specific, so the request-interception harness
       * lives in src/test/ beside this file's setup module. */
      setupFiles: ['./src/test/setup.ts'],
      coverage: {
        provider: 'v8',
        /* text-summary is what a human reads in the job log; json-summary is the machine-readable
         * artifact a diff-coverage step or a badge reads. */
        reporter: ['text-summary', 'json-summary'],
        /* COVERAGE MUST SEE THE WHOLE CODEBASE. Scoped to one directory it reports a healthy
         * percentage for a slice while the rest of the app is unmeasured — and the ratchet then
         * locks in that flattering number, so adding an untested feature outside the scope never
         * moves it (`eq-frontend-quality-bar` SKILL.md §1). Widen this when source moves out of
         * src/; never narrow it to raise the percentage. */
        include: ['src/**/*.{ts,tsx,js,jsx}'],
        exclude: [
          'src/**/*.test.{ts,tsx,js,jsx}',
          'src/**/*.d.ts',
          /* The test harness itself — fixtures, MSW handlers, this config's setup module. It is
           * test code, so counting it inflates the number with lines no production path runs. */
          'src/test/**',
        ],
        thresholds: {
          /* Rewritten by every full run. A FILTERED run (`-t`, a path argument, `--changed`)
           * leaves them alone, so a local narrow run cannot silently lower the floor.
           *
           * A metric with nothing to measure records as 100, not 0: a codebase with no
           * branches yet gets `branches: 100` written here on its first run, so the first
           * partially-covered `if` fails the gate. That is the ratchet working — cover the
           * branch, do not lower the number. */
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
