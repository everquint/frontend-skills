---
'frontend-skills': patch
---

`standard-check` now asserts a CI workflow exists (`.github/workflows/*.yml`) in `--check` and
`--record`, alongside the `.claude/` policy files. Found violated in the wild: an adopting repo
carried hooks with no `.github` directory at all, so every gate was bypassable with `--no-verify`
while the repo read as compliant.
