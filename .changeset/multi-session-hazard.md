---
"frontend-skills": patch
---

The delivery workflow names multi-session-one-checkout as its own hazard: two interactive sessions sharing a checkout fail silently because HEAD is shared — a `git checkout` in one session retargets the other between reading its branch and committing, landing the commit on the wrong branch with no error (measured: a commit meant for a fix branch reached main past its required checks). The worktree table row now points at this failure mode, and the section states what a worktree does NOT isolate: `~/.claude/settings.json`, plugin registrations, and anything else outside the repo, plus the per-worktree install cost.
