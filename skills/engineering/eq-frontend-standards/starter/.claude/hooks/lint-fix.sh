#!/usr/bin/env bash
# PostToolUse hook: run `oxfmt` then `oxlint --fix` on the single file that was just written or
# edited — the same pair, in the same order, that lint-staged runs on commit.
#
# WHY a clean run exits 0: a formatter that can block an edit gets switched off within a week, and
# then nothing formats at all. Unfixable violations are reported on stderr as feedback; the gate
# that actually rejects them is the pre-push hook and CI, not this.
#
# The one thing that is NOT a quiet exit 0 is a missing binary — see the diagnostic below.
#
# WHY node and not jq: jq is not installed everywhere, and a hook whose dependency is missing
# fails in the worst way — silently, while looking wired. node is already a hard requirement of
# any repo this standard applies to.
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

# A relative path is resolved against the repo root so the containment test below stays meaningful.
case "$file_path" in
    /*) ;;
    *) file_path="$project_dir/$file_path" ;;
esac

# Outside the repo: not ours to format.
case "$file_path" in
    "$project_dir"/*) ;;
    *) exit 0 ;;
esac

[ -f "$file_path" ] || exit 0

case "$file_path" in
    *.ts|*.tsx|*.js|*.jsx|*.mjs|*.cjs) ;;
    *) exit 0 ;;
esac

oxfmt_bin="$project_dir/node_modules/.bin/oxfmt"
oxlint_bin="$project_dir/node_modules/.bin/oxlint"

missing=
[ -x "$oxfmt_bin" ] || missing="$missing oxfmt"
[ -x "$oxlint_bin" ] || missing="$missing oxlint"

if [ -n "$missing" ]; then
    # Exit 1, not 0 and not 2: exit 0 hides stderr, so a hook whose binary is gone reports success
    # while formatting nothing, forever — and exit 2 blocks the edit, so a repo mid-`npm install`
    # could not be touched. Exit 1 is Claude Code's non-blocking error: stderr is shown, edit stands.
    echo "lint-fix hook: missing${missing} in $project_dir/node_modules/.bin — $file_path was NOT formatted." >&2
    echo "lint-fix hook: run \`npm install\` in $project_dir. Until then this hook formats nothing." >&2
    exit 1
fi

# oxfmt writes in place by default; --write is passed explicitly so the intent survives a default change.
if ! output=$("$oxfmt_bin" --write "$file_path" 2>&1); then
    echo "oxfmt could not format $file_path:" >&2
    echo "$output" >&2
fi

if ! output=$("$oxlint_bin" --fix "$file_path" 2>&1); then
    echo "oxlint could not auto-fix everything in $file_path:" >&2
    echo "$output" >&2
fi

exit 0
