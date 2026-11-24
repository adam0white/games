#!/bin/bash
# Looks for Cloudflare Issues on this project's Workers that no run has been started for.
# It is a plain script: with nothing new it makes one API call and exits, and starts no model.
# A new issue starts Claude with handle-issue.md. Run it from launchd (see ../../OBSERVABILITY.md).
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
STATE="${WORKER_ISSUES_STATE:-$HOME/Library/Application Support/worker-issues}"
NODE="${WORKER_ISSUES_NODE:-/opt/homebrew/bin/node}"
CLAUDE="${WORKER_ISSUES_CLAUDE:-$HOME/.local/bin/claude}"
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$HOME/.local/bin"
mkdir -p "$STATE/work"
LOG="$STATE/watch.log"
log() { echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) $*" >> "$LOG"; }
# One macOS notification per subject, so a failure nobody would read in the log is seen.
tell() {
  touch "$STATE/told"
  grep -qxF "$1" "$STATE/told" && return
  echo "$1" >> "$STATE/told"
  osascript -e "display notification \"$2\" with title \"Worker issues watcher\"" >/dev/null 2>&1
}

# One run at a time. A lock older than three hours belongs to a run that died.
LOCK="$STATE/lock"
if ! mkdir "$LOCK" 2>/dev/null; then
  [ -n "$(find "$LOCK" -maxdepth 0 -mmin +180 2>/dev/null)" ] && rmdir "$LOCK" 2>/dev/null
  exit 0
fi
trap 'rmdir "$LOCK" 2>/dev/null' EXIT

lines="$("$NODE" "$HERE/issues.mjs" 2>&1)" || {
  log "check failed: ${lines:0:200}"
  # Told once a day: a signed-out cf would otherwise hide every issue.
  tell "check-failed-$(date +%Y-%m-%d)" "Could not list Cloudflare issues. See worker-issues/watch.log."
  exit 1
}
[ -z "$lines" ] && exit 0

# Start Claude only for keys it has not been started for. A failed run is tried three times, then left for a person.
touch "$STATE/fired" "$STATE/failed"
new=""; services=""
while read -r key service _; do
  [ -z "$key" ] && continue
  grep -qxF "$key" "$STATE/fired" && continue
  if [ "$(grep -cxF "$key" "$STATE/failed")" -ge 3 ]; then
    tell "gave-up-$key" "A $service issue was tried three times and is still open. See watch.log."
    continue
  fi
  new="$new $key"; services="$services $service"
done <<< "$lines"
[ -z "$new" ] && exit 0
[ "${WORKER_ISSUES_DRY_RUN:-}" = 1 ] && { log "dry run: would start for$new ($services )"; exit 0; }

login="$(gh api user -q .login 2>/dev/null)"
if [ "$login" != "adam0white" ]; then
  log "gh is signed in as '${login:-nobody}', not adam0white; not starting"
  tell "gh-login" "GitHub login is not adam0white. Worker issues are waiting."
  exit 1
fi
find "$STATE/work" -mindepth 1 -maxdepth 1 -type d -mtime +7 -exec rm -rf {} + 2>/dev/null
RUN="$STATE/work/games-$(date +%s)"
SOURCE="$(git -C "$HERE" rev-parse --show-toplevel)"
if ! { git clone -q --no-hardlinks "$SOURCE" "$RUN" && git -C "$RUN" remote set-url origin https://github.com/adam0white/games.git \
  && perl -e 'alarm 120; exec @ARGV' git -C "$RUN" fetch -q origin main && git -C "$RUN" checkout -q -B main origin/main; }; then
  log "could not prepare a clone; will try again"
  rm -rf "$RUN"
  exit 1
fi
log "starting for$new ($services )"
cd "$RUN" || exit 1
ids=""; for key in $new; do ids="$ids ${key%%:*}"; done
# No connectors and only file and shell tools: an issue carries text an outsider can influence (URLs, error messages).
"$CLAUDE" -p "$(cat "$HERE/handle-issue.md")

Issue ids for this run:$ids" --strict-mcp-config --tools "Bash,Read,Edit,Write,Glob,Grep" \
  --allowedTools "Bash Read Edit Write Glob Grep" --permission-mode dontAsk > "$STATE/last-run.txt" 2>&1 &
pid=$!
( sleep 7200; kill "$pid" 2>/dev/null ) & timer=$!
wait "$pid"; status=$?
kill "$timer" 2>/dev/null; wait "$timer" 2>/dev/null
result="$(grep -E '^RESULT ' "$STATE/last-run.txt" | tail -1)"
if [ "$status" -eq 0 ] && [ "${result:0:6}" = "RESULT" ] && [ "${result:0:11}" != "RESULT fail" ]; then
  for key in $new; do echo "$key" >> "$STATE/fired"; done
  log "done for$new: ${result:0:300}"
  case "$result" in *"needs owner"*) tell "owner-$(date +%s)" "A Worker issue needs the owner. See worker-issues/watch.log.";; esac
elif grep -q 'Failed to authenticate' "$STATE/last-run.txt"; then
  log "claude is signed out; run 'claude' in a terminal and sign in. Waiting:$new"
  tell "signed-out-$(date +%Y-%m-%d)" "Claude on this Mac is signed out. Worker issues are waiting."
  rm -rf "$RUN"
else
  for key in $new; do echo "$key" >> "$STATE/failed"; done
  log "failed for$new (exit $status): ${result:0:200}"
fi
