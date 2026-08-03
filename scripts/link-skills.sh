#!/usr/bin/env bash
set -euo pipefail

# Symlinks every skill in this repo into the local skill directories each agent
# harness reads. Symlinks rather than copies, so `git pull` is all that is needed
# to update installed skills.
#
# Dev convenience for maintainers. The supported install path for everyone else is
#   npx skills add <owner>/<repo>

REPO="$(cd "$(dirname "$0")/.." && pwd)"
DESTS=("$HOME/.claude/skills" "$HOME/.agents/skills")

while IFS= read -r -d '' skill_md; do
    src="$(dirname "$skill_md")"
    name="$(basename "$src")"
    for dest in "${DESTS[@]}"; do
        mkdir -p "$dest"
        target="$dest/$name"
        # Replace only symlinks that already point into THIS repo. `rm` on any symlink would
        # silently repoint a link someone aimed at a different skills repo.
        if [ -L "$target" ]; then
            current="$(readlink "$target")"
            if [ "$current" != "$src" ]; then
                echo "skip  $target (symlink points elsewhere: $current)" >&2
                continue
            fi
            rm "$target"
        elif [ -e "$target" ]; then
            echo "skip  $target (exists and is not a symlink)" >&2
            continue
        fi
        ln -s "$src" "$target"
        echo "link  $target -> $src"
    done
done < <(find "$REPO/skills" -name SKILL.md -not -path '*/node_modules/*' -print0)
