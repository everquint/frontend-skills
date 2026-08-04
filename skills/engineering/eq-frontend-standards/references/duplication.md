# Duplication and abstraction

DRY is about **knowledge**, not characters. A duplicated *decision* is a defect; duplicated *code* is
frequently not. Repos get this backwards, delete the characters, and end up with an abstraction that
is harder to change than the duplication it replaced.

## 1. The test

Ask one question of any repetition:

> **If this fact changed, how many places would have to change together — and would a reader find
> all of them?**

- One place → not duplication. Leave it.
- Two or more that must move **in lockstep** → that is the defect, regardless of how different the
  surrounding code looks.
- Two or more that can move independently → not duplication. Coupling them creates a defect.

The failure mode of duplicated knowledge is always the same: someone fixes one copy, ships, and the
other copies keep the old behaviour. Nothing tells them the other copies exist.

## 2. Three classes, three verdicts

| Class | What repeats | Verdict | Action |
|---|---|---|---|
| **Duplicated decision** | a fact the product decided once — allowlist, threshold, format, policy, key | **Always a defect**, at two copies | One owning module, imported |
| **Duplicated logic** | the same steps in the same order | **Defect at the third copy** | Extract at three, not at two |
| **Duplicated shape** | similar skeleton, unrelated reasons to change | **Not a defect** | Leave it duplicated |

### Duplicated decision — always a defect

The canonical case, real and repeatedly observed: three inline sanitizer configs for
`dangerouslySetInnerHTML` in one app. Fix one allowlist and the other two call sites stay
exploitable, and the fix looks complete in review because the diff is green. This is why
`../../eq-frontend-quality-bar/SKILL.md` §5 states the rule as *one sanitizer module, one place* — the security
consequence is only the loudest instance of a general rule.

Same class, same verdict: a validation rule, a currency or date format, a retry/backoff policy, a
query key, a permission check, a magic threshold, a feature-flag name. Each gets **one owning
module** that exports it, and every consumer imports it. Two copies is already the defect — there is
no rule of three here, because the second copy is already a place the next fix will miss.

#### One module instance per library

Two entry points for one library are two copies of that dependency. The duplicated decision is *which
module instance the app talks to*, and it is a defect at the second import specifier.

**Failure:** a component imports `useNavigate` from `react-router`; its test renders that component
inside a `<MemoryRouter>` imported from `react-router-dom`. The resolver treats the two specifiers as
two modules, so there are two copies of the router and two distinct React contexts — the hook looks in
the copy that has no provider and throws `useNavigate() may be used only in the context of a <Router>`
**in the test only**. The browser build resolves one copy and is green. From a browser-green, test-red
split the conclusion drawn is "Testing Library cannot do routing here", and the test is deleted rather
than the import corrected: the coverage is gone and the defect that removed it is still in the source.
One specifier per library, in source and in tests alike.

Same class, wider blast radius — a **duplicated peer dependency**. A package that declares React as a
direct dependency instead of a peer installs its own copy beside the consumer's, and every hook in
every consumer throws `Invalid hook call. Hooks can only be called inside of the body of a function
component`, with no wrong line of code anywhere to point at. Declare a shared runtime library as a peer
dependency, never a direct one, and check the resolution with `npm ls react` — exactly one version, and
`npm ls` is a manual check, not a gate. §6 applies: no lint rule in the starter config detects either
case.

### Duplicated logic — the Rule of Three

Two similar blocks may be coincidence, and the shared abstraction is a guess about which parts vary.
The third occurrence is the first real evidence of the shape, because it shows which parts vary
across three independent callers rather than two.

Extracting at two produces the recognisable failure: a helper with a boolean parameter that both
callers must now understand, where the boolean *is* the difference the extraction was supposed to
hide. Every future reader pays to learn a parameter that exists only because the author extracted
too early.

### Duplicated shape — incidental duplication

Two components with a similar JSX skeleton, two tests with a similar arrange block, two reducers
with a similar `switch`. These look alike **today** and change for independent reasons tomorrow.
Name this **incidental duplication** and leave it.

Forcing incidental duplication into one component is how a repo grows a component with nine boolean
props: each caller's divergence arrives as one more flag, the render body becomes a decision tree
over flags no single caller understands, and every change to one screen now risks the other four.

## 3. The asymmetry that drives all of the above

**Inlining a wrong abstraction back out requires understanding every caller. Extracting a duplicate
later requires understanding only the duplicates.**

Duplication is cheap to fix later and the cost is bounded by the number of copies. A wrong
abstraction is expensive to fix later and the cost is bounded by the number of call sites, which
grows. The two errors are not symmetric, so the default is not symmetric either:

**When uncertain, duplicate, and revisit at the third occurrence.**

## 4. Where the line is, concretely

The abstract rule does not decide real cases. These are decided.

| Case | Rule |
|---|---|
| **API request** | One module per backend resource. Two call sites issuing the same request is a defect at two — the URL, method and error mapping are a decision |
| **Query / cache key** | Inline in the hook that owns it. Extract to one exported const the moment a **second file** must invalidate it. No central key-factory module |
| **`zod` schema for a payload** | One schema, TS type inferred from it. A hand-written `interface` alongside the schema is two copies of one decision that drift silently |
| **Formatter** (currency, date, bytes, relative time) | One module. A second `toLocaleString` call with its own options object is a duplicated decision |
| **Validation rule** (max length, allowed chars, password policy) | One schema, shared by the form and the boundary parser |
| **Tailwind class string** | Extract when the string encodes a decision — a design token, a semantic variant, a brand colour. Leave when it is layout (`flex items-center gap-2`); that is shape |
| **Test fixture** | A factory function per shape. **Never** a shared mutable object — see `correctness-rules.md` §17: a module-level object mutated by one test leaks into whichever test runs second |
| **Env / config value** | Read once, in one schema-validated config module. A second `import.meta.env.VITE_X` read is a second place to update |
| **Error message text** | Duplicated strings are shape. Duplicated *mapping* from an error code to a message is a decision — one module |
| **Library entry point** | One specifier per library, source and tests alike. A second entry point (`react-router` beside `react-router-dom`) is a second module instance with its own React context — §2 |

## 5. What is not deduplicated

The rule above is not a cudgel for review. These are explicitly out of scope:

- **Tests.** A test that shares setup with another test is coupled to it. F.I.R.S.T. *Independent*
  outranks brevity (`../../eq-frontend-quality-bar/SKILL.md` §1), and a shared arrange block is exactly how a suite
  acquires order-dependent failures. Share **factories**, never state.
- **Type definitions for different domain concepts.** `CreateUserRequest` and `UserRow` having the
  same five fields today is a coincidence of the current schema. Aliasing them means the next field
  added to one silently appears on the other.
- **Anything across a package or surface boundary** where sharing would create a dependency that
  did not previously exist. Two copies in two packages beats a new coupling between them.
- **A helper with one consumer.** It is not promoted to a shared location until a **second** consumer
  exists — the promotion rule in `structure.md` §3 beside this file, which governs component and hook
  placement identically. A helper moved to `src/utils/` on speculation is an abstraction guessed
  from one example.

## 6. Enforcement

**Reviewer-enforced — everything in §1–§5.** No linter can distinguish a duplicated decision from
incidental shape, because the distinction is *why the code would change*, which is not in the tokens.

**Machine signal, never a gate — `jscpd`.** It detects duplicated **tokens**, which is duplicated
*shape* — the class that is usually not the defect.

```bash
npx jscpd@5 src --min-tokens 70 --format typescript,tsx --reporters console
```

Measured on one mature repo (1,614 files, 244k lines): 680 clones, 5.70% duplicated lines. The split
is the point — `.tsx` reports **6.80%** duplicated lines against `.ts`'s **2.66%**, because JSX
skeletons are the most shape-heavy code in the repo and the least worth merging. The counts also
overlap: the worst single region (`agents.tsx:356`) is reported **15 times** as sliding windows with
different end offsets, and 107 of the 585 `.tsx` clones are two regions of the same file.

So: `jscpd` output is a **list of leads to read**, never a CI failure. Wiring `--exit-code` or
`--threshold` as a blocking gate applies pressure toward merging JSX skeletons — precisely the wrong
extractions — and the pressure is strongest on the highest-percentage files, which are the ones where
merging is most harmful.

**Partly machine-enforced — two rules with no judgement in them.** Neither can mistake incidental
shape for a duplicated decision, so neither needs a reviewer. Both are set to `error` in the starter's
oxlint config; **neither is in oxlint's `correctness` category**, so a repo that has not named them
explicitly is not running them and its violation count is unknown. Verified: a fixture holding both
defects exits 0 under a bare `npx oxlint`.

| Rule | Catches | Status |
|---|---|---|
| `import/no-duplicates` | two `import` statements from the same module specifier | Native to oxlint under the `import` plugin — no `eslint-plugin-import` dependency, and the plugin is in the base config's `plugins` list. Named in `.oxlintrc.json`, so it runs in the fast path and in the editor |
| `typescript/no-duplicate-type-constituents` | a repeated member in a union or intersection (`A \| B \| A`) | Type-aware, so it lives in `.oxlintrc.strict.json` and needs `--type-aware` plus the `oxlint-tsgolint` package — the same prerequisite as `no-floating-promises` (`../SKILL.md` §2). Without the flag it is skipped in silence: verified, the same fixture reports the duplicate import and says nothing about the duplicate union member |

Both were verified by execution against a fixture on the starter's rule names. Two `react` imports
report `import(no-duplicates)` **once** for the file, not once per import; `string | number | string`
reports `typescript(no-duplicate-type-constituents)` when `--type-aware` is passed; and a file with
neither exits 0.

## 7. Wording a duplication finding

A duplication finding names **the fact that would have to change in two places, and where both are**.

- Not a finding: "this is duplicated", "extract a shared helper", "DRY this up".
- A finding: "the max upload size 25 MB is declared at `upload-form.tsx:41` and again at
  `files-api.ts:88`; raising the limit in one leaves the other rejecting valid files."

This is the same bar every other finding in this standard clears: name the inputs and the wrong
output. A duplication report with no named fact is a style preference and is dropped.
