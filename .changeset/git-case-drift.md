---
'frontend-skills': patch
---

check-structure gains rule 6: git index vs filesystem case drift. On macOS/Windows a case-only
rename (App.tsx → app.tsx) changes the disk but not the git index unless staged as a rename, so
the structure gate passed locally while every fresh clone — CI included — got the old name back
and failed rule 1. Found in the wild on the first greenfield adoption; the finding names the
exact `git mv` fix. Not a git repo → vacuously clean.
