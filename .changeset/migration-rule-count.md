---
'frontend-skills': patch
---

Corrects the 2.14.0 migration step for the oxlint rule-count constant.

It said to set `EXPECTED_OXLINT_RULES` to 227, the starter's number. A repo whose lint config adds
rules of its own has a higher count, and that constant is a floor — pasting 227 into such a repo
would lower the floor and silently weaken its lint gate. The step now says to re-measure with
`measure-rules.mjs` and use the reported number.
