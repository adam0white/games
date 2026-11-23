#!/bin/bash
# Looks for tester notes nobody has acted on. It is a plain script: when there is no new note it makes
# one HTTPS request and exits, and starts no model. Only a new open note starts Claude, with handle-notes.md.
# Run it from launchd (see ../README.md). It logs counts and ids, never note text.
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
STATE="${GAMES_FEEDBACK_STATE:-$HOME/Library/Application Support/games-feedback}"
NODE="${GAMES_FEEDBACK_NODE:-/opt/homebrew/bin/node}"
CLAUDE="${GAMES_FEEDBACK_CLAUDE:-$HOME/.local/bin/claude}"
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$HOME/.local/bin"
mkdir -p "$STATE/work"
LOG="$STATE/watch.log"
log() { echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) $*" >> "$LOG"; }
# One macOS notification per subject, so a failure nobody would read in the log is seen. It never carries note text.
tell() {
  touch "$STATE/told"
  grep -qxF "$1" "$STATE/told" && return
  echo "$1" >> "$STATE/told"
  osascript -e "display notification \"$2\" with title \"Game notes watcher\"" >/dev/null 2>&1
}

# One run at a time. A lock older than three hours belongs to a run that died.
LOCK="$STATE/lock"
if ! mkdir "$LOCK" 2>/dev/null; then
  [ -n "$(find "$LOCK" -maxdepth 0 -mmin +180 2>/dev/null)" ] && rmdir "$LOCK" 2>/dev/null
  exit 0
fi
trap 'rmdir "$LOCK" 2>/dev/null' EXIT

EXCEPT="${GAMES_FEEDBACK_EXCEPT:-t0}"
line="$("$NODE" "$HERE/../notes.mjs" count --except "$EXCEPT" 2>&1)" || { log "check failed: ${line:0:200}"; exit 1; }
# A note whose transcription stalled is tried again; the output is discarded so nothing is logged.
stuck="$(printf '%s' "$line" | sed -n 's/.* stuck=\([0-9,]*\)$/\1/p')"
[ -n "$stuck" ] && "$NODE" "$HERE/../notes.mjs" retry "$stuck" > /dev/null 2>&1
ids="$(printf '%s' "$line" | sed -n 's/.* ids=\([0-9,]*\) .*/\1/p')"
[ -z "$ids" ] && exit 0

# Start Claude only for ids it has not been started for. A failed run is tried three times, then left for a person.
touch "$STATE/fired" "$STATE/failed"
new=""
for id in ${ids//,/ }; do
  grep -qx "$id" "$STATE/fired" && continue
  [ "$(grep -cx "$id" "$STATE/failed")" -ge 3 ] && continue
  new="$new $id"
done
for id in ${ids//,/ }; do
  [ "$(grep -cx "$id" "$STATE/failed")" -ge 3 ] && tell "gave-up-$id" "Note $id was tried three times and still waits. See watch.log."
done
[ -z "$new" ] && exit 0
[ "${GAMES_FEEDBACK_DRY_RUN:-}" = 1 ] && { log "dry run: would start for$new"; exit 0; }

# Prepare a clone for the run here, so a stalled network clone costs no model time.
login="$(gh api user -q .login 2>/dev/null)"
if [ "$login" != "adam0white" ]; then
  log "gh is signed in as '${login:-nobody}', not adam0white; not starting"
  tell "gh-login" "GitHub login is not adam0white. Notes are waiting."
  exit 1
fi
find "$STATE/work" -mindepth 1 -maxdepth 1 -type d -mtime +7 -exec rm -rf {} + 2>/dev/null
RUN="$STATE/work/games-$(date +%s)"
SOURCE="$(git -C "$HERE" rev-parse --show-toplevel)"
if ! { git clone -q --no-hardlinks "$SOURCE" "$RUN" && git -C "$RUN" remote set-url origin git@github.com:adam0white/games.git \
  && perl -e 'alarm 120; exec @ARGV' git -C "$RUN" fetch -q origin main && git -C "$RUN" checkout -q -B main origin/main; }; then
  log "could not prepare a clone; will try again"
  rm -rf "$RUN"
  exit 1
fi
log "starting for$new ($line)"
cd "$RUN" || exit 1
# No connectors and only file and shell tools: the run reads text written by an outsider.
"$CLAUDE" -p "$(cat "$HERE/handle-notes.md")" --strict-mcp-config --tools "Bash,Read,Edit,Write,Glob,Grep" \
  --allowedTools "Bash Read Edit Write Glob Grep" --permission-mode dontAsk > "$STATE/last-run.txt" 2>&1 &
pid=$!
( sleep 7200; kill "$pid" 2>/dev/null ) & timer=$!
wait "$pid"; status=$?
kill "$timer" 2>/dev/null
result="$(grep -E '^RESULT ' "$STATE/last-run.txt" | tail -1)"
if [ "$status" -eq 0 ] && [ "${result:0:9}" = "RESULT ok" ]; then
  for id in $new; do echo "$id" >> "$STATE/fired"; done
  log "done for$new: ${result:0:200}"
elif grep -q 'Failed to authenticate' "$STATE/last-run.txt"; then
  # The command-line Claude on this computer is signed out. Not counted as a try; the next run tries again.
  log "claude is signed out; run 'claude' in a terminal and sign in. Waiting:$new"
  tell "signed-out-$(date +%Y-%m-%d)" "Claude on this Mac is signed out. Run claude in a terminal and sign in. Notes are waiting."
  rm -rf "$RUN"
else
  for id in $new; do echo "$id" >> "$STATE/failed"; done
  log "failed for$new (exit $status): ${result:0:200}"
fi
