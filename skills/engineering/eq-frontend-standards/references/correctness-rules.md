# Correctness rules that always apply

These hold in **every** component-based frontend TypeScript repo, regardless of local convention. Each has a mechanical
failure mode — specific inputs or state that produce wrong output, a crash, or lost data — and a rule
earns a place here only if you can write that scenario down.

| # | Rule | Gate |
|---|---|---|
| 1 | No components defined inside another component's body — a `render*` helper is **called**, never mounted | `react-hooks/static-components`; `no-unstable-nested-components` partly; prop-passed shape **reviewer** |
| 2 | No index keys in lists that reorder, filter, or poll | `react/no-array-index-key` (**off by default**) |
| 3 | No state-writing effect keyed on an unstable identity | `exhaustive-deps` partly; identity half **reviewer** |
| 4 | `useEffect` callbacks are never `async` | `react-hooks/exhaustive-deps` |
| 5 | Every promise awaited, caught, or explicitly `void`ed | `@typescript-eslint/no-floating-promises` (type-aware) |
| 6 | No `setState` synchronously in an effect body | `react-hooks/set-state-in-effect` |
| 7 | Never index into an unfiltered array with a filtered index | **reviewer** |
| 8 | Every id-keyed fetch has an abort or a stale-response guard | **reviewer** |
| 9 | No `setState` after `await` without a cancelled guard | **reviewer** |
| 10 | Every resource released on every path | **reviewer** |
| 11 | Every optimistic update rolls back, and failure reaches the user | **reviewer** |
| 12 | External data parsed at the boundary, never cast | **reviewer** |
| 13 | Cache keys include every input the query depends on | **reviewer** |
| 14 | Debounced work is flushed on unmount, not cancelled | **reviewer** |
| 15 | Hooks never called conditionally, including via `?.` | `rules-of-hooks` + `react-hooks/hooks` |
| 16 | No in-place mutation of state | `react-hooks/immutability` partly; **reviewer** |
| 17 | No module-level mutable defaults shared across instances | **reviewer** |

---

## 1. Components defined inside a component body

A component declared inside another component's body and mounted as JSX is a **new component type on
every render**. React cannot match it to the previous tree, so it unmounts the old subtree and mounts a fresh one.

**Failure:** a panel defines `const RenderForm = () => <input value={draft} .../>` and renders
`<RenderForm />`. The parent re-renders on each keystroke of an unrelated field, and every re-render
destroys the input's DOM node: focus is lost, the caret jumps to position 0, and uncontrolled child state
(scroll offset, `<details>` open, video position) resets. Extract to module scope and pass props; calling
it as a function — `{renderForm()}` — is also correct, since that creates no new component type.

### `render*` helpers are called, never mounted

A local `render*` helper — the standard's answer to a multi-element branch, `SKILL.md` §1 — returns JSX,
which puts it one keystroke from this bug. The two spellings are not interchangeable:

```tsx
const renderHeader = () => <input value={draft} onChange={onChange} />;

{renderHeader()}       // right: a function call. Its elements are inlined into the parent's tree.
<RenderHeader />       // wrong: a new component type every render. React remounts the subtree.
```

The call produces no component identity, so there is nothing for React to mismatch. The mount declares a
type whose function reference is fresh on every parent render, so React's reconciler treats it as a
*different* type each time and takes the unmount-and-remount path: the DOM node is destroyed, its state
and focus go with it, and every effect inside re-runs on every parent render — including the fetches and
subscriptions those effects own.

Lint coverage, measured by running the starter config (both rules at `error`) over three shapes:

| Shape | `no-unstable-nested-components` | `static-components` |
|---|---|---|
| `const RenderForm = () => …` mounted as `<RenderForm />` | fires | fires |
| `const renderHeader = …; const Header = renderHeader;` mounted as `<Header />` | silent | fires |
| `const renderBody = …` passed to another component that mounts it | silent | silent |

`react/no-unstable-nested-components` keys off the declaration, so it misses a helper renamed into a
capitalised binding before it is mounted. `react-hooks/static-components` keys off the mount site and
catches both in-file spellings. **The third shape — a locally-defined `render*` helper handed to another
component as a prop and mounted there — is reviewer-only**: neither rule crosses the component boundary,
and it carries the identical remount failure. Neither rule fires on `{renderHeader()}`.

## 2. Index keys in lists that reorder, filter, or poll

`key={i}` ties identity to position, so when positions shift React reuses the wrong instance.

**Failure:** three rows, each with a checkbox. Delete row 0. React still sees keys `0,1`, unmounts only
the last row, and now shows row 1's checkbox state on what used to be row 2. On a polled list, a
server-side reorder silently swaps two rows' local edits. Index keys are safe only in a list that is
append-only and never filtered, sorted, or refetched. The rule is not in the plugin's recommended set,
so a repo that never enabled it has zero reported violations and an unknown real count.

## 3. State-writing effect keyed on an unstable identity

An effect whose dependency array holds a value with a fresh reference every render runs every render.
If it also writes state, it re-renders, producing a new reference — a loop. Unstable sources: inline
object/array literals, `.map()`/`.filter()`/`.sort()` results, a context value built inline in the
provider, and any object or callback the caller rebuilds per render.

**Failure:** `useEffect(() => { save(bridge.state); }, [bridge])` where `bridge` is `{ state, send }`
rebuilt each render. Mount fires one PUT; the response updates state; the parent re-renders; `bridge`
is new; the effect fires again. The observed shape is a burst of identical no-op writes, several of
which race the record's own creation and 404. `exhaustive-deps` demands the dependency but cannot tell
you it is unstable — memoize at the source, or depend on the primitives the effect reads (`[count]`).

## 4. `async` `useEffect` callbacks

`useEffect` treats the callback's return value as cleanup. An `async` function returns a promise, so
React stores a promise where it expects a function and never calls it.

**Failure:** `useEffect(async () => { const c = new AbortController(); ... }, [id])` never aborts, never
clears a timer, never unsubscribes; every id change leaks a live request. Declare the async function
inside and call it: `useEffect(() => { void run(); return cleanup; })`.

The gate is `react-hooks/exhaustive-deps` — measured by running all 29 `react-hooks` rules against
`useEffect(async () => { await Promise.resolve(); }, [])`, where it was the only rule that fired.
`@typescript-eslint/no-misused-promises` with `checksVoidReturn.arguments` **cannot** catch it:
`@types/react` declares `type EffectCallback = () => void | Destructor`, a union rather than plain
`void`, so the void-return check never engages on the argument.

## 5. Unhandled promises

A promise with no `await`, no `.catch()`, and no `void` becomes an unhandled rejection — logged to a
console the user never opens, invisible in the UI. **Failure:** `deleteItem(id); closeDialog();` and
the delete rejects with a 403. The dialog has closed,
the row is gone from the optimistic list, and the user believes the delete succeeded; on next load the
row is back and nobody knows why. `no-floating-promises` needs type-aware linting
(`parserOptions.projectService`), which is why it is silently absent on the cheaper non-typed config.

## 6. `setState` synchronously in an effect body

**Failure:** `useEffect(() => setRows(props.rows.filter(isActive)))` with no dependency array. Render →
effect → setState → render → effect. React bails out only on reference equality and `.filter()` never
is, so this is an infinite loop that freezes the tab. With a dependency array it is still a guaranteed
extra render pass before paint. Derive during render instead; state copied from props is not state.

## 7. Filtered index into an unfiltered array

```ts
const visible = items.filter(i => !i.hidden);    // items: [A(hidden), B, C]
const onRemove = (index: number) => {            // user clicks B → index 0
    setItems(prev => prev.toSpliced(index, 1));  // removes A, not B
};
```

The user deletes the wrong record. The companion mistake is calling `.sort()` or `.splice()` on the
original array rather than on a copy: both mutate in place, so the reorder or removal leaks to every
other holder of that array — props, state, a cache entry — with no reference change for React to
observe. Pass the item's id, never its position, across any boundary where the list has been filtered,
sorted, paginated, or virtualised, and reorder through `toSorted` / `toSpliced` / a spread copy.

## 8. Id-keyed fetch with no abort or stale guard

Ask one question of every fetching effect: **if request A resolves after request B, what renders?**
**Failure:** a detail pane fetches `/items/:id`. The user clicks A (slow, 800 ms) then B (fast, 50 ms).
B renders, then A's response overwrites it — header says B, body shows A's fields. The user edits and
saves, writing A's data onto B. Abort the previous request in cleanup, or capture the id in the closure
and discard a response whose id no longer matches. Doing neither is data corruption, not a flicker.

## 9. `setState` after `await` with no cancelled guard

Between the `await` and the `setState`, the component can unmount or its inputs can change.
**Failure:** a dialog fetches on open, the user closes it mid-flight, the response lands and calls
`setData`. React 18+ removed the warning, and the write on an unmounted component is a no-op — so the
update is dropped in total silence, with a remount getting fresh state. The harm is diagnostic: nothing
distinguishes a lost update from a request that never returned, so the bug is investigated as a network
fault. The dangerous sibling case is the **still-mounted** one, where a late response overwrites current
state — rule 8 above. Guard with the effect's own `cancelled` flag set in cleanup, or with an
`AbortSignal`.

## 10. Resources not released on every path

Every acquisition needs a release on **all** exits: happy path, early returns, error path.

| Acquired | Released with |
|---|---|
| `setTimeout` / `setInterval` | `clearTimeout` / `clearInterval` |
| `addEventListener` | `removeEventListener` — the *same* function reference |
| `requestAnimationFrame` | `cancelAnimationFrame` |
| `ResizeObserver` / `IntersectionObserver` / `MutationObserver` | `.disconnect()` |
| `URL.createObjectURL` | `URL.revokeObjectURL` |
| `new AbortController()` | `.abort()` |
| media element / `MediaStream` | `.pause()`, `srcObject = null`, `track.stop()` |
| subscription / socket | `unsubscribe()` / `close()` |

**Failure:** an image grid creates an object URL per thumbnail and never revokes. Each blob is pinned
for the page's lifetime; scrolling a few thousand items exhausts memory and the tab crashes. An early
`if (!ref.current) return;` placed *after* an `addEventListener` leaves a listener on `window` per
mount, so one resize fires N handlers and each calls `setState`.

## 11. Optimistic updates with no rollback

**Failure:** a toggle flips locally, the PATCH returns 500, the `catch` calls `console.error`. The
switch stays on; the user closes the tab believing the setting saved and on next load it is off. No
error state, no toast, no trace outside a console nobody reads. Every optimistic write captures the
previous value before the mutation, restores it in the error path, and surfaces the failure. A `catch`
whose only statement is `console.error` is a swallowed error.

## 12. External data used without validation

`as T` is a **cast**. TypeScript deletes it at build time and trusts you; nothing checks the value.
Boundaries that lie: HTTP responses, `localStorage`/`sessionStorage`, URL and query params,
`postMessage`, `BroadcastChannel`, WebSocket frames, MCP/tool output, CMS payloads.

**Failure:** `JSON.parse(localStorage.getItem('prefs')!) as Prefs`. A previous release stored
`{ theme: 'dark' }`; the current `Prefs` has `columns: string[]`. The first `prefs.columns.map(...)`
throws `Cannot read properties of undefined (reading 'map')` during render, and the app is a blank
screen for exactly the users who ran the old version — which no test covers. Declare a `zod` schema,
`safeParse` at the boundary, infer the TS type from the schema, and default on the failure branch.

## 13. Cache key missing an input

Any input the request depends on that is absent from the key makes two different requests share one
cache entry.

```ts
useQuery({ queryKey: ['invoices'], queryFn: () => get(`/orgs/${orgId}/invoices`) });
```

**Failure:** the user switches org, or a second user logs in on a shared machine without a full reload.
The cache hits on `['invoices']` and renders the previous org's invoices — a data-leak class bug, not a
staleness bug. The key includes every variable the query function closes over: id, tenant, filters,
sort, page, locale. Same rule for a hand-rolled `Map` cache and for `useMemo`.

## 14. Debounced work cancelled instead of flushed

**Failure:** autosave debounced at 800 ms. The user types the last word of a note and immediately
navigates away; unmount cleanup calls `debounced.cancel()`, so the final 800 ms of typing is never
sent. The user returns to a note missing its last sentence, with no error anywhere. Cleanup calls
`flush()` for work the user expects to persist, and `cancel()` only for pure reads (search-as-you-type,
suggestion fetches).

## 15. Conditionally called hooks

React matches hooks to state slots by call order, so a hook that is sometimes called shifts every later
hook by one slot. **Failure:** `slots?.useSidePanel?.()`. On the route that provides `slots` the
component calls five hooks; where it is `undefined`, four. The next `useState` gets the wrong slot — a
boolean lands where a string was, reads come back wrong, and React throws `Rendered fewer hooks than
expected` on the transition. This shape looks like a legitimate library seam and is not one: a hook
passed through an object is still a hook. Call it unconditionally, or move it into a child rendered
only when the slot exists.

## 16. In-place mutation of state

React re-renders on reference change; mutating the existing object changes nothing it can observe.
**Failure:** `rows.push(newRow); setRows(rows);` — same reference, `Object.is` returns true, React bails
out and the row never appears. The user clicks Add three times, sees nothing, then an unrelated
re-render flushes all three at once. `sort()` and `reverse()` mutate in place with the same effect;
`splice` additionally corrupts every other holder of that array. Return a new value: spread, `map`,
`toSorted`, `toSpliced`, `with`.

## 17. Module-level mutable defaults

A `let`, array, object, or `Map` at module scope is one instance shared by every importer — across
routes, across mounts, and across tests in the same file. **Failure:**
`const DEFAULT_FILTERS = { tags: [] };` used as `useState(DEFAULT_FILTERS)`. One component
pushes to `filters.tags`, mutating the shared literal, and an unrelated list mounts with the first
one's tags applied. In a suite the leak is order-dependent, so the failure appears in whichever test
runs second. Use a factory (`makeDefaultFilters()`), or freeze the constant and only copy from it.

---

## Why these and not a longer list

Every rule above names a mechanical failure: an input sequence, a state transition, or a lifecycle event
producing wrong output, a crash, or lost data. That is the entry criterion.

Deliberately omitted: file layout, naming, where helpers live, hooks versus render props,
folder-per-component, CSS strategy. Those are real decisions a repo makes once and enforces, but a repo
that decides them differently is not broken — it is different. Mixing them in is how a correctness
standard becomes an aesthetic one and gets argued away. So the test for adding a rule here is: **write
the failure scenario first.** If you cannot state the inputs and the wrong output, it belongs in the
local conventions doc, not in this file.
