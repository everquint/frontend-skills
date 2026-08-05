---
"frontend-skills": patch
---

Fixes from a five-reviewer whole-repo audit. check-structure no longer reports a mis-cased symlinked directory as clean (it is recorded as a directory entry for the naming rule, never descended into); `/pre-pr` step 5 and the conventions-reviewer now pass `--dir .` to the structure check, matching CI — without it an `e2e/*.spec.ts` violation was locally green and CI-red; eq-take-issue's verification step and the workflow gate table now route through `/pre-pr` where present, so the structure/standard-version/feature-doc gates are no longer skippable by following the thinner table; structure.md's enforcement table documents rules 6 and 7; hygiene.md's hook count corrected to three; ADR 0006 gains a dormancy note (the changesets step it describes is commented out pending RELEASE_TOKEN) and ADR 0014 the forward pointer to 0015 its own convention requires.
