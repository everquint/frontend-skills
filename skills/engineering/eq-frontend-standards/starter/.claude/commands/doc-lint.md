---
description: Audit docs/features/ and docs/product/ against the code — stale claims, contradictions, orphans — and fix what a doc gets wrong.
---

# Doc lint

The mechanical half runs in CI (cited paths must exist). This command is the judgement half: read
each file under `docs/features/` and `docs/product/` and check it against the code it describes.

Report, per file, findings in three classes:

1. **Stale claim** — the doc states behaviour the code no longer has. Quote the claim, cite the
   code that contradicts it, and fix the doc in place.
2. **Contradiction** — two docs disagree (a feature doc vs constraints.md, or two feature docs).
   Name both, decide which is right by reading the code, fix the loser.
3. **Orphan** — a feature doc whose capability was removed from the code, or a shipped capability
   visible in the routes/screens tree with no feature doc. Delete the former; draft the latter and
   flag it for human review.

Fix findings in place as part of this run — a lint that only reports gets ignored. Findings that
need a human ruling (a `NOT SUPPORTED` line that seems violated on purpose, a constraint the code
now breaks) are reported, not fixed.

Clean is a real result: say "N files read, no stale claims" — never skip files to finish faster;
name any file not read and why.
