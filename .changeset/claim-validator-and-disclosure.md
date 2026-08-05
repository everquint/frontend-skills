---
'frontend-skills': patch
---

Two writing-for-agents alignment fixes. A claim validator now gates the build: every prefixed rule
name mentioned in skill prose must exist in the starter lint configs or be allowlisted with a
reason, and stale allowlist entries fail too — the sediment check the docs lacked. And a disclosure
pass moved maintainer-grade reference out of the three engineering SKILL.md files (rule-identifier
mapping and lost rules → hygiene.md §11, hook false-positive shapes → react-hooks-v7.md, CHANGELOG
enforcement mechanics → release-tooling.md, the ratchet config restatement → a pointer at the
starter file), freeing headroom under the 200-line cap: 199→189, 198→182, 198→197.
