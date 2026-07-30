#!/bin/zsh
# reconcile launcher (born v0.4.6): the double-click surface for reconcile.py.
# Same machine-local env seam as open-infrabot.command: the env file lives
# OUTSIDE the repo and is where LPI_EXPORT_DIR points exports at a private
# handoff dir. Absent file = repo-local exports/ default, so a fresh clone
# works with zero setup. Resolves its own directory, never a hardcoded path,
# so a stranger's clone double-clicks the same file.
[ -f "$HOME/lpi/infrabot.local.env" ] && source "$HOME/lpi/infrabot.local.env"
cd "$(dirname "$0")" || exit 1
python3 reconcile.py "$@"
rc=$?
if [ $rc -ne 0 ]; then
  echo ""
  echo "RECONCILE FAILED (exit $rc). The reason is printed above."
  read -k 1 -s "?Press any key to close."
fi
exit $rc
