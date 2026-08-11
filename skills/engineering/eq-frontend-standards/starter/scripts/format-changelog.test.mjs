// Tests format-changelog.mjs, which runs unattended as the second half of `npm run version` and
// rewrites CHANGELOG.md. A regression there corrupts the changelog inside the version PR, where the
// diff is large and machine-generated and therefore skimmed — so the invariants the script's own
// comments assert are pinned here instead of trusted.
//
// The script is a top-level program: it reads `process.cwd()`, writes the file, and exits with a
// code. It is exercised the way the release job runs it — as a child process in a throwaway git
// repo — because mocking `cwd` and `execFileSync` would test the mocks rather than the behaviour.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), 'format-changelog.mjs');
const REMOTE = 'git@github.com:acme/widget.git';

let dir;

/**
 * The fixture repo must not inherit the host's git config. A global `commit.gpgsign`, a
 * `user.signingkey` with no key present, or a `core.hooksPath` aimed at someone's husky directory all
 * make `git commit` fail here for reasons that have nothing to do with the script — on their machine
 * and not on yours, which is the worst shape a failure can take.
 */
const gitEnv = () => ({
    ...process.env,
    GIT_CONFIG_GLOBAL: '/dev/null',
    GIT_CONFIG_SYSTEM: '/dev/null',
    GIT_CONFIG_NOSYSTEM: '1',
    HOME: dir,
});

/** Runs the script in `dir` and returns its stdout. Throws on a non-zero exit, per execFileSync. */
const run = () => execFileSync(process.execPath, [SCRIPT], { cwd: dir, encoding: 'utf8', env: gitEnv() });

/** The stderr of a failing run. `execFileSync` attaches it to the thrown error when stdio is piped. */
const runExpectingFailure = () => {
    try {
        run();
    } catch (error) {
        return { status: error.status, stderr: String(error.stderr) };
    }
    throw new Error('expected format-changelog to exit non-zero, but it succeeded');
};

const write = (text) => writeFileSync(join(dir, 'CHANGELOG.md'), text);
const read = () => readFileSync(join(dir, 'CHANGELOG.md'), 'utf8');
const git = (...args) => execFileSync('git', args, { cwd: dir, stdio: 'ignore', env: gitEnv() });

/**
 * A commit is needed before a tag can point at anything. The author and committer dates are set
 * DIFFERENTLY on purpose: the script reads `%as`, the author date, and identical values would let a
 * script that read the committer date pass this suite unnoticed.
 */
const commit = (message, authorDate, committerDate) => {
    writeFileSync(join(dir, 'file.txt'), message);
    git('add', '-A');
    execFileSync('git', ['commit', '-m', message], {
        cwd: dir,
        stdio: 'ignore',
        env: { ...gitEnv(), GIT_AUTHOR_DATE: authorDate, GIT_COMMITTER_DATE: committerDate },
    });
};

beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'format-changelog-'));
    // `-b main` needs git >= 2.28; the standard's .nvmrc-era toolchains are well past it.
    git('init', '-q', '-b', 'main');
    git('config', 'user.email', 'test@example.com');
    git('config', 'user.name', 'Test');
    git('remote', 'add', 'origin', REMOTE);
});

afterEach(() => rmSync(dir, { recursive: true, force: true }));

// Exactly what `changeset version` leaves behind on a first release: H1, version heading with no
// date and no brackets, and a section named after the SEMVER IMPACT.
const RAW_CHANGESETS_OUTPUT = `# @acme/widget

## 1.0.0

### Major Changes

- The dashboard now loads the current month by default.
`;

describe('format-changelog', () => {
    it('rewrites raw changesets output into Keep a Changelog form', () => {
        write(RAW_CHANGESETS_OUTPUT);

        run();
        const out = read();

        expect(out).toContain('# @acme/widget');
        expect(out).toContain('All notable changes to this project are documented in this file.');
        expect(out).toContain('[Keep a Changelog](https://keepachangelog.com/en/1.1.0/)');
        expect(out).toContain('## [Unreleased]');
        // Dated, bracketed, and the entry text survives verbatim.
        expect(out).toMatch(/^## \[1\.0\.0\] - \d{4}-\d{2}-\d{2}$/m);
        expect(out).toContain('- The dashboard now loads the current month by default.');
    });

    it('maps changesets semver sections onto change types', () => {
        write(`# @acme/widget

## 1.2.0

### Minor Changes

- Added a thing.

### Patch Changes

- Fixed a thing.

## 1.1.0

### Major Changes

- Changed a thing.
`);

        run();
        const out = read();

        expect(out).toContain('### Added');
        expect(out).toContain('### Fixed');
        expect(out).toContain('### Changed');
        // The raw names must be gone, or a re-run would map them twice.
        expect(out).not.toContain('Minor Changes');
        expect(out).not.toContain('Patch Changes');
        expect(out).not.toContain('Major Changes');
    });

    it("passes through Keep a Changelog's own sections untouched", () => {
        write(`# @acme/widget

## 1.0.0

### Security

- Session cookies are now scoped to the tenant.

### Removed

- The legacy export button is gone.
`);

        run();
        const out = read();

        expect(out).toContain('### Security');
        expect(out).toContain('### Removed');
    });

    it('is idempotent — a second run changes nothing', () => {
        write(RAW_CHANGESETS_OUTPUT);

        run();
        const first = read();
        run();

        expect(read()).toBe(first);
    });

    // The measured regression this script was fixed for: `changeset version` prepends the new
    // version heading directly under the H1, pushing the previous run's preamble INSIDE that
    // version's body. Retaining it there duplicates the preamble once per release.
    it('does not duplicate its preamble when changesets prepends above it', () => {
        write(RAW_CHANGESETS_OUTPUT);
        run();

        // Simulate the next release: a new version heading inserted directly under the H1.
        const formatted = read();
        write(
            formatted.replace(
                '# @acme/widget\n',
                '# @acme/widget\n\n## 1.1.0\n\n### Patch Changes\n\n- Fixed the date picker.\n',
            ),
        );
        run();
        const out = read();

        const preambleCount = out.split('All notable changes to this project are documented in this file.').length - 1;
        expect(preambleCount).toBe(1);
        expect(out).toContain('- Fixed the date picker.');
    });

    it('orders versions newest first regardless of input order', () => {
        write(`# @acme/widget

## 1.9.0

### Minor Changes

- Nine.

## 1.10.0

### Minor Changes

- Ten.
`);

        run();
        const out = read();

        // 1.10.0 above 1.9.0 — a string sort would invert these, which is why the script compares
        // segments numerically.
        expect(out.indexOf('## [1.10.0]')).toBeLessThan(out.indexOf('## [1.9.0]'));
    });

    it('dates a version from its git tag, so re-running never shifts history', () => {
        // Both dates are far enough from today that "today" cannot pass by coincidence, and they
        // differ from each other so that only the AUTHOR date satisfies the assertion.
        commit('release', '2020-01-02T00:00:00Z', '2021-06-07T00:00:00Z');
        git('tag', 'v1.0.0');
        write(RAW_CHANGESETS_OUTPUT);

        run();

        expect(read()).toContain('## [1.0.0] - 2020-01-02');
    });

    // The third branch of the date fallback: tag date, else the date already on the heading, else
    // today. A regression collapsing this to `today` would silently rewrite historical dates on every
    // release — and because the release job runs unattended, nobody would see it happen.
    it('keeps a date already on the heading when no tag matches', () => {
        write(`# @acme/widget

## [1.0.0] - 2019-05-05

### Changed

- Something old.
`);

        run();

        expect(read()).toContain('## [1.0.0] - 2019-05-05');
    });

    it('dates the version being released now — which has no tag yet — as today', () => {
        write(RAW_CHANGESETS_OUTPUT);

        run();

        const today = new Date().toISOString().slice(0, 10);
        expect(read()).toContain(`## [1.0.0] - ${today}`);
    });

    it('builds compare links from the origin remote', () => {
        write(`# @acme/widget

## 1.1.0

### Minor Changes

- Two.

## 1.0.0

### Minor Changes

- One.
`);

        run();
        const out = read();

        expect(out).toContain('[Unreleased]: https://github.com/acme/widget/compare/v1.1.0...HEAD');
        expect(out).toContain('[1.1.0]: https://github.com/acme/widget/compare/v1.0.0...v1.1.0');
        // The oldest version has nothing to compare against, so it links to its own tag.
        expect(out).toContain('[1.0.0]: https://github.com/acme/widget/releases/tag/v1.0.0');
    });

    it('still produces a valid document when there is no parseable remote', () => {
        git('remote', 'remove', 'origin');
        write(RAW_CHANGESETS_OUTPUT);

        const stdout = run();

        expect(stdout).toContain('no remote — links skipped');
        expect(read()).toContain('## [1.0.0]');
        expect(read()).not.toContain('[Unreleased]: http');
    });

    // Both failure paths assert the message, not just the exit code: this script's only channel to a
    // human is the release log, so an exit 1 that explains nothing is barely better than a hang.
    it('fails loudly when there is no CHANGELOG.md', () => {
        const { status, stderr } = runExpectingFailure();

        expect(status).toBe(1);
        expect(stderr).toContain('no CHANGELOG.md here');
    });

    // A file the script cannot parse must not be silently rewritten into an empty changelog.
    it('fails rather than emit a changelog with no versions', () => {
        write('# @acme/widget\n\nSome prose and no version headings.\n');

        const { status, stderr } = runExpectingFailure();

        expect(status).toBe(1);
        expect(stderr).toContain('nothing to format');
        expect(read()).toContain('Some prose and no version headings.');
    });
});
