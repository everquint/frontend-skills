---
'frontend-skills': patch
---

Starter files no longer overwhelm adopters with maintainer-facing commentary. Every file under
`starter/` is trimmed to a short header plus the one-line footgun warnings that must be seen at
edit time; the full rationale and measured failure modes move to the new
`references/starter-rationale.md`, updated in the same commit as any future starter change.
Behavior-neutral: the trimmed lint configs load the identical 226/168 rule counts with identical
diagnostics on a real adopted repo. Consumer repos can re-pull the files for the slimmer comments;
nothing forces it.
