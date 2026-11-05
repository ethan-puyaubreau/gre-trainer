#!/usr/bin/env bash
# Stop hook: when src/ or tests/ changed since the last clean typecheck, run `tsc -b` once before the turn ends.
# On errors it exits 2 so Claude sees them and fixes them; it never blocks twice in a row (stop_hook_active).
# Adapted from everything-claude-code (scripts/hooks/stop-format-typecheck.js), MIT, see .claude/THIRD_PARTY.md.
set -u
input=$(cat)
case "$input" in *'"stop_hook_active":true'* | *'"stop_hook_active": true'*) exit 0 ;; esac

root=${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null)} || exit 0
cd "$root" || exit 0
[ -d node_modules ] || exit 0

changes=$( { git diff HEAD -- src tests tsconfig*.json; git ls-files --others --exclude-standard -- src tests | xargs -r cat; } 2>/dev/null)
[ -n "$changes" ] || exit 0
stamp_file=.claude/.typecheck-stamp
stamp=$(printf '%s' "$changes" | sha1sum | cut -d' ' -f1)
[ "$(cat "$stamp_file" 2>/dev/null)" = "$stamp" ] && exit 0

if out=$(timeout 180 npx --no-install tsc -b 2>&1); then
  echo "$stamp" > "$stamp_file"
  exit 0
fi
echo "Typecheck failed (npx tsc -b). Fix these before finishing:" >&2
echo "$out" | head -40 >&2
exit 2
