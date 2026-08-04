# Semantic HTML — which element to write

`../SKILL.md` §4 owns accessibility *behaviour*: keyboard reachability and order, focus movement in
and out of an overlay, escape from a trap, a visible focus indicator, contrast in both themes. It
states nothing about **which element you write**, so that question is answered per developer, per
component. This file is that answer.

The element carries the meaning. Every rule below is here because a wrong element produces a
specific failure for a specific person — not because a tag list says so. §4's behaviour checklist is
cited from here and never restated: a rule about keyboard order or focus return belongs there, and a
second copy of it here is the thing this repo calls sediment.

## 1. Landmarks

**One `<main>` per route.** `<header>`, `<footer>`, `<aside>`, `<nav>` for their real roles, and
nothing else wearing them for layout.

- **Failure without `<main>`:** a screen-reader user's first move on a new page is the jump-to-main
  shortcut (`D`/`M` in NVDA, rotor landmark in VoiceOver). With no `<main>`, that jump does nothing,
  so every page visit starts by arrowing through the sidebar and the top bar again — on a data table
  behind 40 nav links, that is 40 keystrokes per navigation.
- **Failure with two `<main>` elements:** the shortcut cycles between them and the user cannot tell
  which is the page. This happens when a route shell renders `<main>` and a feature screen inside it
  renders another.

**A page with more than one `<nav>` gives each an `aria-label`.** Unlabelled, the landmark list reads
"navigation, navigation, navigation" and a user looking for the breadcrumb has to enter each in turn
to find out which is which.

**`<section>` needs an accessible name, or it is a `div`.** A `<section>` maps to the `region` role
only when it has one — `aria-labelledby` pointing at its own heading, or `aria-label`. Write the name
or write a `div`.

- **Failure:** an unnamed `<section>` is announced as a plain group with no name, so it adds a
  boundary the user must step over and tells them nothing when they land on it. Nesting six of them
  produces six anonymous boundaries around content that would have read continuously.

## 2. Headings follow the document outline, not the type scale

Pick `h1`–`h6` by depth in the document. Do not skip a level. Size comes from a utility class or a
type-scale token, never from reaching for a bigger tag.

- **Failure from picking by size:** a card title styled large is written `<h1>`. The page now has
  nine `h1`s. A screen-reader user navigating by heading (`H`, or the rotor heading list) reads a flat
  list of nine peers with no structure, and cannot tell the page title from a card.
- **Failure from picking by size, the other direction:** the section heading needs to look small, so
  it is written `<h5>` under an `h2`. The outline jumps `h2` → `h5`, and the user hears three levels
  of nesting that do not exist, then cannot find the sibling section because it is two levels deeper
  than where they are searching.
- **Failure from styling with a heading tag:** a bold label above an input is written `<h3>` for its
  weight. It now appears in the heading list as a navigable landmark, so the heading outline of the
  page is half form labels.

## 3. Lists

Repeated items go in `<ul>`/`<ol>` with `<li>`. Key–value pairs go in `<dl>` with `<dt>`/`<dd>`.

- **Failure:** a result list built from stacked `div`s announces nothing about its size or position.
  With `<ul>`, the user hears "list, 12 items" on entry and "item 4 of 12" as they move, so they know
  whether to keep going. With `div`s they hear the text and nothing else, and cannot tell a
  three-result search from a truncated one.
- **Failure for key–value pairs:** a details panel of `<div><span>Owner</span><span>Ana</span></div>`
  rows reads as "Owner Ana Status Active Created 4 March" — one run of words with no pairing. A `<dl>`
  binds each `<dd>` to its `<dt>`, so a user landing mid-panel knows which value belongs to which key.

## 4. Forms

**Every control is associated with a label** — `htmlFor` + `id`, or the `<label>` wrapping the
control. A `placeholder` is not a label and neither is adjacent text.

- **Failure:** an unlabelled search input is announced as "edit, blank". The user has no way to learn
  what it filters. Clicking the visible text does not focus the field either, which costs a
  motor-impaired user the label's whole click target.
- **Failure of the `placeholder`-as-label shortcut:** the placeholder disappears on first keystroke,
  so a user who pauses mid-entry has lost the only statement of what the field is, and voice-control
  software cannot target the field by its visible text at all.

**Group related inputs in a `<fieldset>` with a `<legend>`** — radio groups and checkbox groups
specifically.

- **Failure:** four radios labelled Daily / Weekly / Monthly / Never with the question "Email
  frequency" rendered as a sibling heading. Focus lands on "Weekly, radio button, 2 of 4" with the
  question never spoken, so the user is choosing between four adverbs and does not know the question.
  A `<legend>` is announced with each option in the group.

**On an invalid field, set `aria-invalid` and point `aria-describedby` at the error node.**

- **Failure:** submit fails, an error message renders in red under the field, focus is returned to
  the field, and the user hears only "Email, edit, ana@" — no error, no indication anything is wrong.
  Colour is the only channel carrying the failure, so it reaches neither a screen-reader user nor a
  red-green colour-blind sighted user. With both attributes the field announces as invalid and reads
  its own error text.

## 5. Tables

Tabular data uses `<table>`/`<thead>`/`<tbody>` with `<th scope="col">` or `scope="row"`. Do not
rebuild a table from grid `div`s.

- **Failure:** a 9-column grid of `div`s is read cell by cell as bare values — "4,182 · 12% · Ana ·
  Active". Nothing associates a cell with its column, so a user in row 40 has no way to learn which
  number is which. In a real `<table>` with `scope`, each cell is announced with its header, and
  table-navigation keys move by row and column instead of by text run.
- **Failure from omitting `scope` on an ambiguous table:** a table with both a header row and a
  header column is guessed at by the browser's heuristic, and the guess differs between engines, so
  cells announce the wrong header on one platform only — a bug nobody reproduces.

## 6. Interactive elements

**Use the primitive library's button, where the repo has one.** This standard prescribes no primitive
library and the starter installs none (`../../eq-frontend-standards/references/styling.md` §1.1); a
repo with an empty layer 1 writes a plain `<button>`. Either way, the element is a `<button>`
underneath.

**`<a>` is for navigation.** An `<a href="#">` or `<a>` with no `href` that runs an action is a
button.

- **Failure:** an action written as an anchor is announced as "link", so the user expects to leave
  the page and gets a mutation instead. It also lands in the link list of the rotor, and it does not
  fire on `Space` the way a button does — a keyboard user pressing `Space` on it scrolls the page.

**A `<button>` inside a form gets `type="button"` unless it submits.**

- **Failure:** `<button>` defaults to `type="submit"`. A "Add another row" button inside a `<form>`
  therefore submits the half-filled form, and the user loses their entry. The same default makes
  `Enter` anywhere in the form fire whichever untyped button comes first in the DOM. No rule in the
  pinned lint set catches this — see §9.

**A `div` that must be interactive follows §4's keyboard contract.** That path is permitted, never
preferred: the contract is `role`, `tabIndex`, `Enter` and `Space` handlers, and a focus indicator,
all of which a `<button>` supplies for free and none of which survive a refactor unattended.

## 7. ARIA supplements, never substitutes

**Do not add a role a semantic element already implies.** `role="list"` on a `<ul>`, `role="button"`
on a `<button>`, `role="navigation"` on a `<nav>`.

- **Failure:** the redundant role is noise at best. At worst it is wrong after an edit — the element
  changes to a `<nav>` and the stale `role="region"` now overrides the real landmark, so the
  navigation stops appearing in the landmark list while the markup reads as if it should.

**Decorative icons get `aria-hidden="true"`.**

- **Failure:** an icon font or inline SVG with a `<title>` inside a button that already has a text
  label produces "chevron down button Filters" — the user hears a shape name before every control.
  Multiply that by a 20-row toolbar.

**Icon-only controls get an `aria-label`.**

- **Failure:** a trash-icon button with no text is announced as "button", with nothing else. In a
  table of 40 rows the user hears "button" 40 times and cannot tell delete from download. This is the
  same requirement as §4's checklist row; it is listed here because the *fix* is markup.

**`aria-label` on a non-interactive, non-landmark element is dropped.** A `<div aria-label="Total">`
with no role announces nothing — the label needs a role that supports naming, or it needs to be real
text.

## 8. Async regions announce themselves

Content that arrives after render lives in a container that is present in the DOM **before** the
content, marked `role="status"` (or `aria-live="polite"`), with `aria-busy="true"` while loading.

- **Failure:** search results replace a spinner. Visually the page changed; for a screen-reader user
  focus never moved and nothing was announced, so they sit on the search box believing the request is
  still running. They discover the results by arrowing forward on a hunch.
- **Failure from creating the live region with its content:** a live region only announces changes
  observed *after* it is registered. Mounting `<div role="status">12 results</div>` in the same commit
  as the results means the region and the text appear together, and most screen readers announce
  nothing. Render the empty container first, then fill it.
- **Failure from omitting `aria-busy`:** a table that re-fetches on every filter keystroke announces
  each intermediate result set. `aria-busy="true"` during the fetch suppresses the partial
  announcements, so the user hears one final count instead of six.
- **`role="alert"` is not the polite default.** It interrupts whatever is being spoken. Reserve it
  for an error the user must act on, and use `role="status"` for a result count, a save confirmation,
  or a step change.

## 9. What lint decides, and what stays reviewer-enforced

The standard pins 31 `jsx_a11y/*` rules — verified by reading
`../../eq-frontend-standards/starter/.oxlintrc.json`, which lists exactly 31 and records that the
three the upstream recommended set ships off (`anchor-ambiguous-text`,
`control-has-associated-label`, `label-has-for`) stay off here. That list is what the table below is
checked against; no coverage is claimed that is not a named rule in that file.

| Rule in this file | Mechanically decided? | By what, and what it misses |
|---|---|---|
| §1 landmarks — one `<main>`, `<nav>` labelling, named `<section>` | No | No rule among the 31 counts landmarks or requires a name on one. Reviewer-only |
| §2 heading level follows the outline | No | `jsx_a11y/heading-has-content` only rejects an **empty** heading. A skipped level and a heading picked for its size both pass. Reviewer-only |
| §3 `<ul>`/`<li>` and `<dl>` instead of stacked `div`s | No | Nothing in the 31 inspects list structure. Reviewer-only |
| §4 label association | **Partly** | `jsx_a11y/label-has-associated-control` fires on a `<label>` with no control in it. An `<input>` with **no label anywhere** is not flagged — `control-has-associated-label` is the rule for that and is off. `jsx_a11y/autocomplete-valid` covers only `autoComplete` values |
| §4 `<fieldset>` + `<legend>` for groups | No | No rule. Reviewer-only |
| §4 `aria-invalid` + `aria-describedby` present on an invalid field | No | `aria-props`, `aria-proptypes` and `role-supports-aria-props` validate an attribute you **wrote** — its name, its value type, and whether the element's role accepts it. None detect an absent one. Reviewer-only |
| §5 `<table>` with `<th scope>` | **Partly** | `jsx_a11y/scope` rejects `scope` on a non-`<th>` element. It does not require `scope` on a `<th>`, and no rule sees a table rebuilt from `div`s. Reviewer-only for both |
| §6 `<a>` for navigation only | **Partly** | `jsx_a11y/anchor-is-valid` rejects a missing `href`, `href="#"`, and `href="javascript:void(0)"`; `anchor-has-content` rejects an empty one. An anchor with a real `href` that also mutates on click passes |
| §6 `type="button"` inside a form | **No** | Not in the 31, and `react/button-has-type` is **not** enabled in that config — verified by grep. Reviewer-only |
| §6 interactive `div` follows §4's contract | **Yes, largely** | `click-events-have-key-events`, `no-static-element-interactions`, `no-noninteractive-element-interactions`, `interactive-supports-focus`, `no-noninteractive-tabindex`, `tabindex-no-positive`, `mouse-events-have-key-events`. This is the best-covered rule in the file |
| §7 no redundant role | **Yes** | `jsx_a11y/no-redundant-roles`. `aria-role` rejects an invalid role name; the two `no-*-element-to-*-role` rules reject a role that contradicts the element |
| §7 `aria-hidden` on decorative icons | No | Presence is not checkable from markup — the linter cannot know an icon is decorative. Reviewer-only |
| §7 `aria-label` on an icon-only control | No | `alt-text` covers `<img>`, `<area>` and `<input type="image">` only. A `<button>` whose only child is an SVG passes every one of the 31. Reviewer-only |
| §8 live region, `aria-busy`, register-before-fill | No | Nothing static can see that a region was mounted with its content, or that a result arrives with no announcement. Reviewer-only, and the highest-value review item in this file |

Nine of the fourteen rules above are reviewer-only, and they include every rule whose failure a user
actually reports. A clean lint run says the markup is well-formed; `../SKILL.md` §4 already states
the same thing about a clean axe run.
