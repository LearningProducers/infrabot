#!/bin/zsh
if lsof -ti tcp:8119 >/dev/null 2>&1; then
  echo "infrabot server already running - opening the app (it serves the file it started on; restart it to serve a newer build)"
  open "http://127.0.0.1:8119/infrabot.html"
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
( sleep 1 && open "http://127.0.0.1:8119/infrabot.html" ) &
exec python3 "$APP_DIR/serve.py"
