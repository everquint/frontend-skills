#!/usr/bin/env bash
# PostToolUse hook: run `eslint --fix` on the single file that was just written or edited.
#
# WHY it always exits 0: a formatter that can block an edit gets switched off within a week, and
# then nothing formats at all. Unfixable violations are reported on stderr as feedback; the gate
# that actually rejects them is the pre-push hook and CI, not this.
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

eslint_bin="$project_dir/node_modules/.bin/eslint"
[ -x "$eslint_bin" ] || exit 0

if ! output=$("$eslint_bin" --fix "$file_path" 2>&1); then
    echo "eslint could not auto-fix everything in $file_path:" >&2
    echo "$output" >&2
fi

exit 0
