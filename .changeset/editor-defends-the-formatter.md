---
"frontend-skills": patch
---

The starter ships `.vscode/extensions.json` and `.vscode/settings.json`, with `.gitignore` rules
that commit exactly those two and ignore the rest of `.vscode/*`. extensions.json recommends
`oxc.oxc-vscode` and `editorconfig.editorconfig` (Cursor does not read `.editorconfig` without it)
and marks the three Prettier extensions unwanted for the workspace — all three format to double
quotes at printWidth 80, against `.oxfmtrc.json`'s single quotes at 200, so a save under Prettier
fails `format:check` on every file. settings.json is what actually routes ts/tsx saves to oxfmt:
per-language `editor.defaultFormatter` blocks with `formatOnSave`, per-language because a
workspace-level default loses to a user-level `[language]` block. Pointing the editor's oxc language
server at the strict config (`oxc.configPath` / `oxc.typeAware`) stays a commented per-machine
opt-in, since type-aware analysis per keystroke is a cost judgement by repo size, not repo policy.
