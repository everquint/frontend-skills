---
"frontend-skills": patch
---

ADR citations inside shipped skill files are now full GitHub URLs. `docs/adr/` does not ship with
an installed skill, so `docs/adr/0007`-style references dangled for every consumer — found by the
first migrated repo. The README's Updating section also documents the mid-release window: between a
feature merge and its "Version Packages" PR, `main` carries new skill text with the previous
version constant, so a copy installed from that window reports "up to date" at the old version;
re-run `npx skills update -g` after the version PR lands.
