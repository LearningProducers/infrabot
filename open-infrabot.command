#!/bin/zsh
# START. Double-click: the server starts detached (no window to keep open),
# the app opens in the browser, this window is done and can be closed. A
# server already on the port serves the file it started on; this start
# only opens the browser. To serve a newer build: stop-infrabot.command,
# then this. The server's log: state/serve.log beside the state file; its
# PID: state/serve.pid. INFRABOT_PORT is the harness seam (unset: 8119).
PORT="${INFRABOT_PORT:-8119}"
URL="http://127.0.0.1:$PORT/infrabot.html"
if lsof -ti tcp:$PORT >/dev/null 2>&1; then
  echo "infrabot server already running - opening the app (it serves the file it started on; stop-infrabot.command, then this, to serve a newer build)"
  open "$URL"
  exit 0
fi
# Serve the latest main. Fast-forward only: a dirty tree, a diverged branch,
# a branch other than main, or no network leaves the checkout as it is and
# says so in one line. Never a force, never a reset, never a stash.
# INFRABOT_DIR is the test seam (tests/launcher_pull_check.py points it at a
# fixture clone); unset, the launcher serves the standing checkout.
APP_DIR="${INFRABOT_DIR:-$HOME/lpi/infrabot}"
if git -C "$APP_DIR" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  branch="$(git -C "$APP_DIR" branch --show-current 2>/dev/null)"
  if [ "$branch" != "main" ]; then
    echo "infrabot: serving what is on disk (checkout on '${branch:-detached}', not main; no pull)"
  elif [ -n "$(git -C "$APP_DIR" status --porcelain --untracked-files=no 2>/dev/null)" ]; then
    echo "infrabot: serving what is on disk (tracked changes in the checkout; no pull)"
  elif git -C "$APP_DIR" pull --ff-only --quiet origin main >/dev/null 2>&1; then
    echo "infrabot: checkout on main at $(git -C "$APP_DIR" rev-parse --short HEAD), fast-forwarded to origin main"
  else
    echo "infrabot: serving what is on disk (could not fast-forward main to origin: diverged or offline; no force)"
  fi
else
  echo "infrabot: serving what is on disk (not a git checkout; no pull)"
fi
# Machine-local config seam: the env file lives OUTSIDE the repo
# and is never committed; it is where LPI_EXPORT_DIR points exports at a
# private handoff dir. Absent file = repo-local exports/ default in serve.py.
[ -f "$HOME/lpi/infrabot.local.env" ] && source "$HOME/lpi/infrabot.local.env"
# Detached: serve.py forks the server into its own session, logs to the state
# dir, records the PID, and returns once the door answers (exit 1 with the
# log's tail when it does not). This window owes the server nothing after.
python3 "$APP_DIR/serve.py" --detach || { echo "infrabot: the server did not start (see the lines above)"; exit 1; }
open "$URL"
