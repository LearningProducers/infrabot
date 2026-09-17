#!/bin/zsh
# STOP. Double-click: the detached server started by open-infrabot.command
# ends (serve.py --stop reads state/serve.pid, or the listener on the port
# when no file names one, stops it only if it is serve.py, and clears the
# file). Not running is not an error. The app keeps working in the browser
# from its own storage; edits sync to the state file when the server is
# back, the newer record winning per record. INFRABOT_PORT: the harness seam.
APP_DIR="${INFRABOT_DIR:-$HOME/lpi/infrabot}"
[ -f "$HOME/lpi/infrabot.local.env" ] && source "$HOME/lpi/infrabot.local.env"
exec python3 "$APP_DIR/serve.py" --stop
