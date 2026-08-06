# Agent instructions — frontend-skills

This repo IS the everquint frontend standard: six installable skills under `skills/`, their
starter files, and the docs that argue the decisions. Editing them is the normal work here; the
gates below are what protect the machinery around them.

- **Validate before every commit**: `npm run validate` — skill frontmatter, the 200-line SKILL.md
  budget, referenced-path existence, claim drift against the starter configs, the plugin manifest.
  The pre-commit hook runs it too; do not race it.
- **Conventions**: Conventional Commits (commitlint enforces; lowercase subject), branch
  `<type>/<slug>`, merge commits never squash. A user-visible change needs a changeset
  (`.changeset/*.md`); CHANGELOG.md is generated — edit changesets, never the changelog.
- **Releases** follow the manual loop in the repo's history until RELEASE_TOKEN exists: version
  branch → `GITHUB_TOKEN=$(gh auth token) npm run version` → PR → merge green → verify main's
  version BEFORE `npx changeset tag` → push tags → GitHub release.
- **Protected files** (the guard hook blocks incidental writes): `scripts/validate-*.mjs`,
  `scripts/sync-standard-version.mjs`, `.changeset/config.json`, `.github/workflows/*`,
  `.husky/*`, `commitlint.config.mjs`, `.git-blame-ignore-revs`, `.claude/settings.json`.
- **Multi-session hazard**: another interactive session may share this checkout. Work in a
  worktree, and re-check `git branch --show-current` immediately before every commit — HEAD moving
  between sessions lands commits on the wrong branch silently
  (`skills/engineering/eq-frontend-workflow/SKILL.md`, Branch vs worktree).
- Decisions live in `docs/adr/`; a change that reverses one gets a new ADR superseding it, never a
  silent edit.
