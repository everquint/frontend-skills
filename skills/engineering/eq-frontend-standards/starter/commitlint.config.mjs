// .mjs because commitlint loads a .js config as CommonJS unless package.json sets "type": "module".
export default {
    extends: ['@commitlint/config-conventional'],
    rules: {
        // config-conventional caps body lines at 100 characters. A machine-written body cannot
        // comply — Dependabot and Renovate emit long release-notes URLs, and a URL has no wrap
        // point — so with a required commit-message check every bot PR is unmergeable (measured on
        // a consumer repo's first Dependabot run: 4 of 5 PRs red on this rule alone, with lint,
        // tests and build green). A human pasting a stack trace or a URL hits the same wall.
        // Turning off THIS rule, rather than skipping commitlint for bot commits, keeps every
        // other rule on every commit: `ignores` would exempt the whole rule set. Body readability
        // is judged in /pre-pr step 8, where judgement belongs — a wrap cap never measured it.
        'body-max-line-length': [0, 'always', Infinity],
    },
};
