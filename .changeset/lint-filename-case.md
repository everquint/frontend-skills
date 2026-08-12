---
'frontend-skills': minor
---

Kebab-case filenames are now enforced by the linter, not only by review and a whole-repo scan.

The standard has always required kebab-case names, but the starter's oxlint config never listed the
`unicorn` plugin, so the rule that checks it was never loaded. A badly named file is now flagged in
the editor as it is created, with the rename spelled out, instead of at the pre-PR gate.

This does not replace the structure check, which still owns directory names and stylesheets — oxlint
reads neither.
