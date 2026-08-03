# `eslint-plugin-react-hooks` v7 — all 29 rules, classified

From v7, this package bundles the **React Compiler lint suite**. Most repos still enable only
`rules-of-hooks` and `exhaustive-deps`, leaving 27 rules switched off in a dependency they already
have installed. That is usually the largest available quality win in a React codebase, and it costs
no new dependency.

**But do not enable all 29.** Three of them report React Compiler *limitations*, not defects in your
code. This classification was produced by reading findings at source across two production
codebases; the counts are illustrative of scale, not targets.

Verified against `eslint-plugin-react-hooks@7.1.1`.

---

## Enable — real rules

Adopt via the ladder: zero-violation rules to `error` immediately, the rest to `error` + suppressions.

| Rule | Catches |
|---|---|
| `rules-of-hooks` | the classic hook-order rule |
| `hooks` | the compiler's stricter hook checker — **finds violations `rules-of-hooks` misses** |
| `set-state-in-effect` | `setState` called synchronously in an effect body → cascading renders |
| `set-state-in-render` | `setState` during render |
| `static-components` | components created during render → subtree remounts, state destroyed |
| `exhaustive-deps` | missing/extra effect dependencies |
| `refs` | reading or writing a ref during render |
| `immutability` | mutating values the compiler assumes immutable; access-before-declaration |
| `globals` | reassigning module-scope variables during render |
| `purity` | side effects during render |
| `memo-dependencies` | missing/extra memo dependencies |
| `memoized-effect-dependencies` | effect deps that must be memoized |
| `exhaustive-effect-dependencies` | the compiler's effect-dependency check |
| `no-deriving-state-in-effects` | state derived in an effect that should be computed in render |
| `preserve-manual-memoization` | manual `useMemo`/`useCallback` the compiler cannot preserve |
| `use-memo` / `void-use-memo` | `useMemo` misuse; `useMemo` whose result is discarded |
| `error-boundaries` | error-boundary misuse |
| `capitalized-calls` | capitalized function called directly instead of rendered as JSX |
| `component-hook-factories` | factories that produce components or hooks |

### `hooks` deserves special attention

`rules-of-hooks` can report **zero** while `hooks` reports real violations in the same codebase.
Observed: a repo believed clean on hook rules had genuine findings — hooks referenced as values,
conditional hook calls, and hooks called inside function expressions. Enable `hooks` even if
`rules-of-hooks` is green.

---

## Never enable — compiler diagnostics, not code defects

| Rule | What it actually reports |
|---|---|
| `todo` | *"Todo: (BuildHIR::lowerStatement) Handle TryStatement with a finalizer"* — the compiler cannot lower this syntax **yet**. Fires on ordinary correct `try/finally`. Observed at 154 findings in one repo, ~1 in 5 files. |
| `invariant` | An internal compiler crash (`[InferMutationAliasingEffects] Expected value kind to be initialized`). Bug-report material for the React team, not an action for you. |
| `incompatible-library` | *"Compilation Skipped: Use of incompatible library"* — informational. Tells you the compiler bailed on a file; your code is fine. |

Enabling `todo` alone will bury a team in findings that cannot be fixed, which is how a whole rule
set gets switched back off. This is the single most important line in this document.

## Never enable — infrastructure only

`syntax` · `unsupported-syntax` · `config` · `gating` · `rule-suppression` · `fbt`

Internal plumbing, Meta-specific tooling, or configuration self-checks. No value outside the React
Compiler's own build.

---

## Measurement method

Do not edit the live ESLint config to measure. Copy it, flip rules in the copy, delete the copy:

```js
// probe.eslint.config.mjs
import base from './eslint.config.js';
import reactHooks from 'eslint-plugin-react-hooks';

const ALL = Object.fromEntries(
    Object.keys(reactHooks.rules).map(r => [`react-hooks/${r}`, 'error'])
);

export default [
    ...base,
    { files: ['src/**/*.{ts,tsx}'], plugins: { 'react-hooks': reactHooks }, rules: ALL },
];
```

```bash
npx eslint --no-config-lookup -c probe.eslint.config.mjs src --format json > out.json
rm probe.eslint.config.mjs out.json   # always clean up
```

Two practical notes:

- **Scope it on large repos.** A full pass with all rules enabled invokes the React Compiler on every
  file and can exceed two minutes on ~1,500 files. Measure directory by directory.
- **Confirm the rules are live.** A misspelled rule name in flat config fails **silently** — a green
  run may mean nothing ran. Verify with:
  ```bash
  npx eslint --print-config path/to/a/real/file.tsx | grep react-hooks
  ```
  Severity `2` means active.

## Expect wide variance between repos

Two React 19 + Vite + TypeScript codebases by the same author, measured the same day:

| | Repo A (~1,500 files) | Repo B (~334 files) |
|---|---|---|
| total violations | 890 | 74 |
| rules at zero violations, all 29 counted | 13 | 22 |
| of those, **real rules adoptable for free** — excluding the infra-only and compiler-diagnostic rules above, and rules already enabled | **6** | **14** |

The two rows measure different things and the second is the actionable one: a rule at zero that must
never be enabled buys nothing. **A fixed tier list shipped in a package would have been wrong for
both.** Measure per repo; the standard stays the same, the sequence does not.
