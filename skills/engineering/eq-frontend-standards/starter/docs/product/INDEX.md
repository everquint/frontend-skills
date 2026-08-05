# Product knowledge — start here, load only what the task needs

- `../features/` — the feature docs, one file per shipped capability (`<ticket>-<slug>.md`, or
  `<slug>.md` for a backfilled legacy feature). "Does this already exist?" is answered by listing
  this directory; the file answers what the feature does and why. Format: `../features/README.md`.
- `constraints.md` — "is this feasible?" Hard limits and the deliberate `NOT SUPPORTED` list;
  check before accepting an issue or an approach.
- `current-focus.md` — "does this fit the current priorities?"

Issues link to these files instead of restating them: the ticket is ephemeral, this is the record.
Misled by a doc here? Fix it in the same session — that moment is when docs get corrected.
