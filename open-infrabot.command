#!/bin/zsh
if lsof -ti tcp:8119 >/dev/null 2>&1; then
  echo "infrabot server already running - opening the app"
  open "http://127.0.0.1:8119/infrabot.html"
  exit 0
fi
# Machine-local config seam: the env file lives OUTSIDE the repo
# and is never committed; it is where LPI_EXPORT_DIR points exports at a
# private handoff dir. Absent file = repo-local exports/ default in serve.py.
[ -f "$HOME/lpi/infrabot.local.env" ] && source "$HOME/lpi/infrabot.local.env"
( sleep 1 && open "http://127.0.0.1:8119/infrabot.html" ) &
exec python3 "$HOME/lpi/infrabot/serve.py"
