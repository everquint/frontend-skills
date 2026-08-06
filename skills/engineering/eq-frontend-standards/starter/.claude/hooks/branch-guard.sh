#!/usr/bin/env bash
# Guards the one git failure the other hooks do not: HEAD moving underneath a session. Two
# interactive sessions in one checkout share HEAD, so session B's `git checkout` retargets
# session A between the moment A reads its branch and the moment A commits — the commit lands on
# B's branch with no error anywhere (measured: a fix-branch commit reached main and pushed past
# its required checks). Files are not lost, so guard-protected-files.sh and the stash denial
# never fire; this hook closes exactly that gap.
#
# One script, three events, wired in .claude/settings.json:
#   SessionStart          — record the branch this session starts on
#   PostToolUse  Bash     — this session's OWN checkout/switch/worktree updates the record, so
#                           deliberate branch changes never false-positive
#   PreToolUse   Bash     — a `git commit` is blocked (exit 2) when the current branch differs
#                           from the session's record (another session moved HEAD), when it is
#                           the default branch (never commit to the default branch — workflow
#                           SKILL.md), or when the branch name violates the naming format
#                           (measured: a session adopted Linear's suggested
#                           <username>/<id>-<full-title> name wholesale). All else passes.
#
# Escape hatch, deliberate and greppable: prefix the command with CLAUDE_BRANCH_GUARD_ALLOW=1.
# State lives under the checkout's real git dir (rev-parse --git-dir, so worktrees each get their
# own), one tiny file per session, pruned after 7 days.
#
# WHY node for the JSON and not jq: jq is not installed everywhere; node is already a hard
# requirement of any repo this standard applies to.
set -uo pipefail

command -v node >/dev/null 2>&1 || exit 0
command -v git >/dev/null 2>&1 || exit 0

payload=$(cat)

# One parse, four fields, newline-separated. A command's own newlines would desync the reads, so
# the command is emitted JSON-encoded on a single line and only ever pattern-matched, never
# executed. The commit detection lives HERE, not in a shell glob: `*git*commit*` blocked
# `gh pr create --title "feat: git commit hygiene"` and `git log | grep commit` whenever HEAD sat
# on the default branch (found in review) — so a command counts as a commit only when some
# shell segment actually INVOKES `git … commit`: first token git (env assignments and wrappers
# stripped), `commit` as its subcommand after git's own global flags.
parsed=$(node -e '
let s = "";
process.stdin.on("data", (d) => { s += d; });
process.stdin.on("end", () => {
    try {
        const p = JSON.parse(s);
        const cmd = String(p?.tool_input?.command ?? "");
        const FLAG_WITH_VALUE = new Set(["-C", "-c", "--git-dir", "--work-tree", "--namespace", "--exec-path"]);
        // Segments split on GROUPING characters too: `(git commit)`, `{ git commit; }` and
        // `if …; then git commit; fi` glued the grouping token onto `git`, and the parser read
        // "not git" — a silent bypass on the default branch (found in review). Shell keywords
        // strip like wrappers for the same reason. Quoted spans are removed FIRST so a paren
        // inside a string (`echo "(git commit)"`) cannot fabricate a segment; the flip side —
        // `bash -c "git commit"` is not seen — is accepted and documented: this hook is
        // defense-in-depth against accidents, not a security boundary against evasion.
        // \u0027 is a single quote, spelled as an escape because this whole program sits
        // inside a single-quoted shell string, where a literal one would terminate it.
        const bare = cmd.replace(/"(?:[^"\\]|\\.)*"|\u0027[^\u0027]*\u0027/g, " ");
        const WRAPPERS = new Set(["command", "env", "nohup", "time", "then", "do", "else", "elif", "if", "while", "until"]);
        const invokes = (sub) => bare.split(/[;&|(){}]+/).some((segment) => {
            let t = segment.trim().split(/\s+/).filter(Boolean);
            while (t.length && (/^[A-Za-z_][A-Za-z0-9_]*=/.test(t[0]) || WRAPPERS.has(t[0]))) t.shift();
            const bin = t[0] ?? "";
            if (bin !== "git" && !bin.endsWith("/git")) return false;
            let i = 1;
            while (i < t.length && t[i].startsWith("-")) {
                const eq = t[i].includes("=");
                const needsValue = FLAG_WITH_VALUE.has(t[i]) && !eq;
                i += needsValue ? 2 : 1;
            }
            return sub.includes(t[i] ?? "") && (t[i] ?? "") !== "";
        });
        const line = (v) => String(v ?? "").replace(/\n/g, " ");
        process.stdout.write(line(p?.hook_event_name) + "\n");
        process.stdout.write(line(p?.session_id) + "\n");
        process.stdout.write((invokes(["commit"]) ? "1" : "0") + (invokes(["checkout", "switch", "worktree"]) ? "1" : "0") + "\n");
        process.stdout.write(JSON.stringify(cmd));
    } catch { /* not JSON: emit nothing, the shell no-ops */ }
});
' <<<"$payload") || exit 0
[ -n "$parsed" ] || exit 0

event=$(printf '%s\n' "$parsed" | sed -n 1p)
session=$(printf '%s\n' "$parsed" | sed -n 2p)
flags=$(printf '%s\n' "$parsed" | sed -n 3p)
cmd=$(printf '%s\n' "$parsed" | sed -n 4p)
is_commit=${flags:0:1}
is_branch_move=${flags:1:1}
[ -n "$session" ] || exit 0

git_dir=$(git rev-parse --git-dir 2>/dev/null) || exit 0
state_dir="$git_dir/claude-branch-guard"
state_file="$state_dir/$session"

current=$(git branch --show-current 2>/dev/null || printf '')

record() {
    mkdir -p "$state_dir" 2>/dev/null || return 0
    printf '%s' "$current" > "$state_file" 2>/dev/null || true
    find "$state_dir" -type f -mtime +7 -delete 2>/dev/null || true
}

case "$event" in
    SessionStart)
        record
        exit 0
        ;;
    PostToolUse)
        # The session's own branch moves keep the record honest. A re-record after a FAILED
        # checkout is harmless: it stores the CURRENT branch, which is the truth.
        [ "$is_branch_move" = "1" ] && record
        exit 0
        ;;
    PreToolUse)
        ;;
    *)
        exit 0
        ;;
esac

# PreToolUse below. Only real `git … commit` invocations are guarded (detected in the node parse
# above), so `gh pr create --title "…commit…"` and `git log | grep commit` pass untouched.
case "$cmd" in
    *CLAUDE_BRANCH_GUARD_ALLOW=1*) exit 0 ;;
esac
[ "$is_commit" = "1" ] || exit 0

# Detached HEAD: --show-current prints nothing. A rebase or bisect commit is not this hook's
# business, and blocking it would break operations git itself is mid-way through.
[ -n "$current" ] || exit 0

# origin/HEAD is unset on unfetched remotes, some CI checkouts, and mirrors; the fallback treats
# BOTH conventional default names as the default rather than guessing one — a work branch
# literally named master is rarer than a master-default repo (residual risk: hygiene.md).
default_branch=$(git symbolic-ref --short refs/remotes/origin/HEAD 2>/dev/null)
default_branch=${default_branch#origin/}
on_default=0
if [ -n "$default_branch" ]; then
    [ "$current" = "$default_branch" ] && on_default=1
else
    case "$current" in main|master) on_default=1; default_branch=$current ;; esac
fi

if [ "$on_default" = "1" ]; then
    cat >&2 <<EOF
Blocked by branch-guard: HEAD is on '$current', the default branch, and commits never land there
directly (delivery workflow: never commit to the default branch). If you created a work branch
this session, another session has since moved HEAD — your branch still has your staged work's
place; switch back to it and re-stage. Otherwise create the branch now:
    git switch -c <type>/<slug>
Deliberate override (rare, must be explicit): prefix the command with CLAUDE_BRANCH_GUARD_ALLOW=1.
EOF
    exit 2
fi

recorded=$(cat "$state_file" 2>/dev/null || printf '')
if [ -n "$recorded" ] && [ "$recorded" != "$current" ]; then
    cat >&2 <<EOF
Blocked by branch-guard: this session last set or observed branch '$recorded', but HEAD is now on
'$current' — another session sharing this checkout has moved it. Committing now would land the
work on '$current' silently. Decide which branch this commit belongs on, switch to it explicitly
(git switch <branch> — that updates this guard's record), and re-run.
Deliberate override (rare, must be explicit): prefix the command with CLAUDE_BRANCH_GUARD_ALLOW=1.
EOF
    exit 2
fi

# The naming rule is machine-checked here because the measured failure is silent: trackers hand
# agents a ready-made branch name (Linear: <username>/<id>-<full-title-slug>) and it wins over a
# rule that is not in context. Types mirror the workflow SKILL.md commit-type table; the ticket
# ID keeps its tracker case (EQ-142).
if ! printf '%s' "$current" | grep -Eq '^(feat|fix|refactor|perf|docs|test|build|ci|chore|style|revert)/[A-Za-z0-9._-]+$'; then
    cat >&2 <<EOF
Blocked by branch-guard: branch '$current' does not match the standard's branch format
<type>/<ticket>-<short-slug> (workflow SKILL.md, Branch naming). A tracker's suggested name —
Linear's <username>/<id>-<full-title> — is NOT the format. Rename, then re-run:
    git branch -m <type>/<TICKET>-<three-word-slug>
Deliberate override (rare, must be explicit): prefix the command with CLAUDE_BRANCH_GUARD_ALLOW=1.
EOF
    exit 2
fi

# No record yet (hook installed mid-session, or state pruned): adopt the current branch as the
# session's branch, so the NEXT drift is caught even though this one could not be judged.
[ -z "$recorded" ] && record

exit 0
