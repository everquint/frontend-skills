#!/usr/bin/env bash
# PreToolUse hook: refuse writes to the files that ARE the quality gate.
#
# WHY: every file listed below can be edited to make a failing check pass, and the resulting diff
# reads as housekeeping. Relaxing a lint rule, deleting a hook line, dropping a CI step, or
# hand-editing the recorded standard version all turn a red gate green without fixing anything.
# Those edits must be deliberate and attributable, so this hook stops them from happening as a
# side effect of some other task.
#
# Exit 2 blocks the tool call and returns stderr to the agent as feedback.
#
# WHY node and not jq: jq is not installed everywhere. node is already a hard requirement of any
# repo this standard applies to.
set -uo pipefail

command -v node >/dev/null 2>&1 || exit 0

project_dir=${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." 2>/dev/null && pwd)}
project_dir=${project_dir%/}

file_path=$(node -e '
let s = "";
process.stdin.on("data", (d) => { s += d; });
process.stdin.on("end", () => {
    try {
        const p = JSON.parse(s);
        process.stdout.write(String(p?.tool_input?.file_path ?? ""));
    } catch {
        // Not JSON, or no file_path: emit nothing and let the shell no-op.
    }
});
') || exit 0

[ -n "$file_path" ] || exit 0

case "$file_path" in
    /*) ;;
    *) file_path="$project_dir/$file_path" ;;
esac

# Scoped to this repo. A same-named file elsewhere on disk — a personal ~/.nvmrc, another
# checkout's .oxlintrc.json — is none of this hook's business.
case "$file_path" in
    "$project_dir"/*) ;;
    *) exit 0 ;;
esac

rel=${file_path#"$project_dir"/}

deny() {
    cat >&2 <<EOF
Blocked by guard-protected-files: $rel is a gate file ($1).

Editing it changes what the quality gate enforces, which is never an incidental part of another
change. A deliberate change here is made by the human owner directly, or by an agent only on an
explicit instruction that names this file. State what you wanted to change and why, and stop.
EOF
    exit 2
}

case "$rel" in
    # Both lint configs, because they are one gate: .oxlintrc.strict.json is what `npm run lint` and CI
    # run, and it extends .oxlintrc.json, so weakening either weakens the gate.
    .oxlintrc.json|.oxlintrc.strict.json)
        deny 'the lint rule set' ;;
    .oxfmtrc.json)
        deny 'the formatting rules every file in the repo is written to' ;;
    # All three tsconfigs, because they are one gate: the leaf configs carry the checking flags and
    # the root is what `tsc -b` enters through. Nothing in CI asserts that `strict` is effective, so
    # unlike the lint gate there is no rule-count assertion to catch a weakened one.
    tsconfig.json|tsconfig.app.json|tsconfig.node.json)
        deny 'the TypeScript checking flag set — drop strict from any of the three and typecheck, lint, tests and build all stay green while undefined flows through the app unchecked' ;;
    # The ratchet is the pair: the project tsc measures, and the number it is measured against.
    tsconfig.strict.json|tsconfig.strict.baseline)
        deny 'the noUncheckedIndexedAccess ratchet — raising the baseline number turns it into a rubber stamp that passes with no CI signal at all, since a count at or under the baseline is exactly what green means' ;;
    .husky/*)
        deny 'a git hook' ;;
    .github/workflows/*)
        deny 'the CI gate' ;;
    commitlint.config.mjs|commitlint.config.js|commitlint.config.ts)
        deny 'the commit-message rules' ;;
    .nvmrc)
        deny 'the pinned Node version, which must agree with engines, packageManager and CI' ;;
    .eq-frontend-skills.json)
        deny 'the recorded standard version — it is written by standard-check.mjs --record, never by hand' ;;
    .claude/settings.json)
        deny 'the hook wiring itself' ;;
esac

exit 0
