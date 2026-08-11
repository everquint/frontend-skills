/* This repo is a library of documents, not an application, and it deliberately has no test suite for
 * its own scripts — `npm run validate` is the gate for those. Vitest exists here for one reason: the
 * starter tree ships executable scripts that THIS repo also runs for real. `npm run version` executes
 * starter/scripts/format-changelog.mjs on every release, so a regression in it corrupts this repo's
 * own CHANGELOG.md, and shipping the test only for consumers to run would mean the safety net fires
 * downstream of the damage.
 *
 * The include glob is therefore narrow on purpose: starter scripts only. Add nothing else here
 * without a reason of the same kind. */
import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        include: ['skills/**/starter/scripts/*.test.mjs'],
        environment: 'node',
    },
});
