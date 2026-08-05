---
'frontend-skills': minor
---

The standard now travels inside the repo, so any agent host — CI runners, cloud sandboxes, Cyrus,
Claude Tag, Codex — enforces it with nothing installed:

- `init-greenfield.mjs` vendors the three skills by default (`--no-vendor-skills` opts out).
- `standard-check --check`/`--record` assert the vendored skill via content sentinels — an
  unvendored repo no longer reads as compliant, because AGENTS.md would point at nothing and the
  CI structure gate would have no script.
- `starter/AGENTS.md` declares itself the entry point for every environment and instructs agents
  to read the vendored SKILL.md before writing code, with a hook-free fallback for the pre-PR gate.
- `starter/CLAUDE.md` (one line) covers hosts that load CLAUDE.md but not AGENTS.md.
- Migration entry `1.6.0` names the two consumer steps.
