# 0003 — English-only strings by decision, not by omission

Date: 2026-08-04
Status: Accepted

## Context

The standard ships no i18n rules. There is no "no hardcoded user-facing strings" rule, no message-catalogue
convention, no pluralisation or date/number-formatting rule, and no lint gate that would find a literal
string rendered into JSX.

Read from this repo on 2026-08-04: `starter/package.fragment.json` lists no i18n runtime and no i18n lint
plugin, and no rule in `.oxlintrc.json` or `.oxlintrc.strict.json` inspects string literals for
localizability. The omission is total, and until now it was undocumented — which made it indistinguishable
from a gap nobody had got to.

**No localization requirement has been recorded to date.** That is the whole factual basis. It is not a
claim that products are single-locale, and not a claim about what any roadmap will contain.

The cost of adopting the rule anyway is paid per pull request, by every author, forever: a
`no-literal-string`-class rule fires on every button label, every `aria-label`, every toast, every empty
state, and every one of those findings needs either a catalogue key or a suppression. The cost of the
rule is incurred whether or not a second locale ever ships. The catalogue it produces is also unexercised
— a message file that no translator has ever read, with pluralisation forms nobody has checked against a
language that has more than two.

## Decision

The standard treats English-only user-facing strings as a recorded decision rather than an unstated
default. No i18n rule is added, and this ADR is the artefact that makes the absence auditable: a reviewer
who notices there is no i18n rule finds a decision instead of a gap, and the `README.md` "Deliberately out
of scope" row points here.

**Supersede this when a localization requirement is recorded for any consuming product.** That is the
trigger — a written requirement, not a hallway conversation and not a guess about demand. When it appears,
the successor ADR chooses the runtime, the catalogue format, and the lint rule, and it is written before
the first translated string lands.

## Consequences

- Every user-facing string in every consuming repo is an English literal at its render site. That is now
  the documented state, so a reviewer does not file it as a finding.
- **The retrofit cost is real and grows with the codebase.** Extracting strings is mechanical but
  unbounded: the work scales with the number of render sites, and every site touched is a diff a reviewer
  reads. A repo that doubles in size before the trigger fires doubles the extraction. Nothing about
  deferring reduces the total; it moves the whole of it later and makes it larger.
- Retrofitting also reaches past the strings. Layout that assumed English word lengths, sort orders that
  assumed ASCII, and dates and numbers formatted by hand all surface at the same time, and those are not
  found by an extraction pass.
- Concatenated strings are the specific debt this permits. `'Deleted ' + n + ' files'` is legal under the
  standard today and cannot be translated without being rewritten, because word order and plural forms are
  not substitutable across languages. Expect that shape to be widespread by the time the trigger fires.
- The decision is cheap to reverse in the sense that matters for a standard — it adds a rule rather than
  removing one, so no repo has to undo work it already did to comply.

## Alternatives rejected

- **Adopt a no-hardcoded-strings rule now.** Taxes every pull request from today for a capability with no
  recorded requirement, and produces a catalogue no translator has read. The rule's cost is certain; its
  benefit is not.
- **Say nothing and leave the omission implicit.** This is the option the ADR replaces. An undocumented
  omission reads as an oversight, gets re-raised in every audit, and gives no trigger for reconsidering it.
- **A lighter half-measure — ban only string concatenation in user-facing text.** Pays part of the cost for
  a fraction of the benefit: it produces no catalogue and no extraction, and it still fires on code that
  would never need translating. It also needs the same judgement about which strings are user-facing, which
  is the expensive part of the rule.
