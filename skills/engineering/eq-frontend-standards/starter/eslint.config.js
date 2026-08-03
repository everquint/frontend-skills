// Implements the frontend standard for a NEW repo. A greenfield repo has no debt, so every rule
// below is at 'error' from the first commit — there is nothing to ratchet and no baseline to bake in.
//
// Migrating an EXISTING repo? Do not copy this file. Measure first
// (scripts/measure-rules.mjs), enable only the rules at zero violations, and put the rest behind
// an eslint-suppressions.json baseline. Dropping this into a mature repo produces hundreds of
// errors at once, which is how a whole rule set gets switched back off.

import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import importPlugin from 'eslint-plugin-import';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import stylistic from '@stylistic/eslint-plugin';
import { defineConfig, globalIgnores } from 'eslint/config';

export default defineConfig([
    // '.agents' and '.claude/skills' hold installed agent skills, not source. Linting them
    // reports no-undef against the skills' own Node scripts.
    globalIgnores(['dist', 'build', 'coverage', '.agents', '.claude/skills']),

    js.configs.recommended,
    ...tseslint.configs.recommended,

    {
        files: ['**/*.{ts,tsx}'],
        languageOptions: {
            parser: tseslint.parser,
            parserOptions: {
                // Type-aware linting, required by no-floating-promises. Costs a slower lint run.
                projectService: true,
                tsconfigRootDir: import.meta.dirname,
                ecmaFeatures: { jsx: true },
            },
            globals: { ...globals.browser, ...globals.es2025 },
        },
        settings: { react: { version: 'detect' } },
        plugins: {
            import: importPlugin,
            react,
            'react-hooks': reactHooks,
            'jsx-a11y': jsxA11y,
            '@stylistic': stylistic,
        },
        rules: {
            // ── §1 formatting. @stylistic rules are the formatter; there is no Prettier.
            '@stylistic/indent': ['error', 4, { SwitchCase: 1, flatTernaryExpressions: false }],
            '@stylistic/quotes': ['error', 'single', { avoidEscape: true }],
            '@stylistic/semi': ['error', 'always'],
            'max-len': ['error', 200],
            'no-console': ['error', { allow: ['error'] }],
            '@typescript-eslint/no-explicit-any': 'error',

            // ── §1 budgets. No function-length limit: hooks, reducers and render* helpers
            // are legitimately long.
            'max-lines': ['error', { max: 500, skipBlankLines: true, skipComments: true }],
            'max-depth': ['error', 4],
            complexity: ['error', 15],
            'max-lines-per-function': 'off',

            // ── §2 correctness, lint-gated. All at 'error': a new repo has no debt.
            'react-hooks/rules-of-hooks': 'error',
            'react-hooks/exhaustive-deps': 'error',
            'react/no-array-index-key': 'error',
            'react/no-unstable-nested-components': 'error',
            '@typescript-eslint/no-floating-promises': 'error',
            '@typescript-eslint/no-misused-promises': ['error', {
                // JSX event handlers are accepted: onClick={async …} is idiomatic React.
                checksVoidReturn: { attributes: false },
            }],

            // React Compiler rules, bundled into eslint-plugin-react-hooks from v7.
            // Deliberately absent: 'todo', 'invariant' and 'incompatible-library' report compiler
            // limitations rather than defects in your code — 'todo' fires on ordinary try/finally.
            'react-hooks/hooks': 'error',
            'react-hooks/static-components': 'error',
            'react-hooks/set-state-in-effect': 'error',
            'react-hooks/set-state-in-render': 'error',
            'react-hooks/no-deriving-state-in-effects': 'error',
            'react-hooks/memoized-effect-dependencies': 'error',
            'react-hooks/exhaustive-effect-dependencies': 'error',
            'react-hooks/preserve-manual-memoization': 'error',
            'react-hooks/memo-dependencies': 'error',
            'react-hooks/use-memo': 'error',
            'react-hooks/void-use-memo': 'error',
            'react-hooks/immutability': 'error',
            'react-hooks/globals': 'error',
            'react-hooks/purity': 'error',
            'react-hooks/refs': 'error',
            'react-hooks/error-boundaries': 'error',
            'react-hooks/capitalized-calls': 'error',
            'react-hooks/component-hook-factories': 'error',

            // ── §6 duplication, the two mechanical cases. Both are judgement-free: neither can
            // mistake incidental shape for a duplicated decision, so neither needs a reviewer.
            // no-duplicate-type-constituents is type-aware and rides the projectService above.
            'import/no-duplicates': 'error',
            '@typescript-eslint/no-duplicate-type-constituents': 'error',

            // ── a11y: the recommended set, not a hand-picked subset.
            ...jsxA11y.flatConfigs.recommended.rules,

            'react/react-in-jsx-scope': 'off',
            'react/prop-types': 'off',
        },
    },

    // Tests are exempt from the size budget: a long flat list of cases is the right shape.
    {
        files: ['**/*.test.{ts,tsx}', 'src/test/**/*.{ts,tsx}'],
        rules: { 'max-lines': 'off', 'max-lines-per-function': 'off' },
    },

    // Config files run in Node and are not part of the app's type-checked project.
    {
        files: ['*.config.{js,ts,mjs}', 'eslint.config.js'],
        languageOptions: { globals: globals.node },
        rules: { '@typescript-eslint/no-floating-promises': 'off' },
    },
]);
