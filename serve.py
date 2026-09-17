#!/usr/bin/env python3
"""infrabot launcher (born v0.4.0; export destination seam added in
v0.4.6; detached start and stop added in v0.7.0): serves the app AND owns
the export write.

v0.7.0 DETACHED SERVE. `serve.py --detach` starts the server as its own
session with stdout and stderr in STATE_DIR/serve.log and its PID in
STATE_DIR/serve.pid, prints the door, the log path and the PID, and returns
once the door answers; no terminal has to stay open, and closing the window
that started it does not stop it. `serve.py --stop` reads the PID file (or,
with no file, the listener on the port) and stops the process if it is this
script, then removes the file. `serve.py --detach` with the door already
answering starts nothing and says so. Plain `serve.py` still serves in the
foreground, Ctrl-C to stop, exactly as before.

Replaces the bare `python3 -m http.server 8119 --bind 127.0.0.1` line in the
Desktop launcher (~/Desktop/open-infrabot.command, installed by hand). Two jobs:

  1. SERVE: static files from this script's own directory (the repo clone),
     exactly the door the app has opened at since the OPERATING ERA:
     http://127.0.0.1:8119/infrabot.html
     Every response carries Cache-Control: no-store (v0.5.3), so a plain
     reload shows the newest build; tests/nostore_check.py pins it.
  2. EXPORT: POST /export receives the app's boot auto-export payload (the
     existing names-only buildStateExport JSON, serializer untouched) and
     writes it to EXPORTS_DIR as infrabot_state_YYYY-MM-DD.json. Same-day
     re-boot OVERWRITES the file (the same-day overwrite rule), which
     keeps the exports/ handoff compatible with crm_reconcile.py's
     newest-by-mtime glob: one dated file per day, mtime always the latest
     write. The write is atomic (temp file + os.replace), so the reconcile
     can never read a half-written export.

Loopback is structural, twice over: the socket binds 127.0.0.1 ONLY, and
verify_request()/the POST handler both refuse any non-loopback peer address.
No network-facing door exists.

Stdlib only, zero dependencies, by law (the app repo ships no build step and
no requirements file, and this launcher inherits that).

CONFIG (named constants so a future multi-machine sync build extends these
instead of hunting literals; sync itself is out of scope for this
seam):
  BIND_HOST / PORT           the one door (127.0.0.1:8119)
  EXPORT_ENDPOINT_PATH       must match the app's EXPORT_ENDPOINT_PATH const
  EXPORTS_DIR                the write target, resolved by the destination
                             seam: LPI_EXPORT_DIR when set,
                             else repo-local exports/ beside this script

If the app is served any other way (plain http.server, a fresh public-repo
clone with no launcher), POST /export simply fails and the app falls back to
its browser-download path unchanged. Nothing here is load-bearing for a
stranger's clone.
"""
import datetime
import json
import os
import pathlib
import signal
import socket
import subprocess
import sys
import time
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

BIND_HOST = "127.0.0.1"
# INFRABOT_PORT is a harness seam (v0.7.0): a check binds a free port beside
# a live server instead of asking for the one door. Unset, the door is 8119.
PORT = int(os.environ.get("INFRABOT_PORT") or 8119)
EXPORT_ENDPOINT_PATH = "/export"
EXPORT_FILENAME = "infrabot_state_%s.json"  # %s = YYYY-MM-DD, local date
MAX_PAYLOAD_BYTES = 10 * 1024 * 1024  # a state export is ~KBs; 10 MB is a sanity wall, not a quota
APP_ROOT = pathlib.Path(__file__).resolve().parent

# ---------------------------------------------------------------------------
# FILE-BACKED NARROW STATE (v0.5.0).
# The comms+network slice (exactly the buildStateExport schema, never
# profile/models/groqKey) lives in ONE server-authoritative file so an
# external writer (the post-send close tool) can flip a card to sent and
# the page trues itself on next load. PRIVATE ARTIFACT: real prospect names,
# so STATE_DIR is gitignored and never tracked in this public repo.
# Three fences ride every write (all three shipped in one build):
#   C  WRITER FENCING : the page heartbeats STATE_HEARTBEAT_FILE while open;
#      an external writer refuses while the beat is fresh.
#   A  REV REFUSAL    : the file carries a monotonic "rev"; a POST whose
#      baseRev does not match draws 409 + the current rev, never a write.
#   B  DATED SNAPSHOT : every accepted write snapshots the prior file into
#      STATE_BACKUPS_DIR first, so a lost race is recoverable, never gone.
# ---------------------------------------------------------------------------
STATE_ENDPOINT_PATH = "/state"
HEARTBEAT_ENDPOINT_PATH = "/heartbeat"


def resolve_state_dir():
    """Same destination seam shape as exports: LPI_STATE_DIR
    wins when set; unset falls back to a repo-local state/ beside this
    script, gitignored, so a fresh clone works with no private path literal
    in the tracked tree."""
    env = os.environ.get("LPI_STATE_DIR")
    if env:
        return pathlib.Path(env).expanduser()
    return APP_ROOT / "state"


STATE_DIR = resolve_state_dir()
STATE_FILE = STATE_DIR / "infrabot_state.json"
STATE_BACKUPS_DIR = STATE_DIR / "backups"
STATE_HEARTBEAT_FILE = STATE_DIR / "heartbeat"
# v0.7.0: the detached server's log and PID, beside the state (gitignored).
SERVE_LOG_FILE = STATE_DIR / "serve.log"
SERVE_PID_FILE = STATE_DIR / "serve.pid"
SERVE_START_WAIT_S = 10
SERVE_STOP_WAIT_S = 10


def read_state_file():
    """-> (rev, raw bytes) of the current state file; (0, None) when absent
    or unreadable-as-JSON (a corrupt file reads as rev 0 so the next write
    snapshots it aside rather than silently building on it)."""
    try:
        raw = STATE_FILE.read_bytes()
        rev = json.loads(raw).get("rev", 0)
        return (rev if isinstance(rev, int) and rev >= 0 else 0), raw
    except (OSError, ValueError):
        return 0, None


def resolve_exports_dir():
    """The destination seam: LPI_EXPORT_DIR wins when set (the
    launcher sources ~/lpi/infrabot.local.env when present, which is where a
    machine points exports at a private handoff dir outside this tree);
    unset falls back to a repo-local exports/ beside this script, gitignored,
    so a fresh clone works with no private path literal anywhere in the
    tracked tree."""
    env = os.environ.get("LPI_EXPORT_DIR")
    if env:
        return pathlib.Path(env).expanduser()
    return APP_ROOT / "exports"


EXPORTS_DIR = resolve_exports_dir()


def ensure_exports_dir():
    """Startup half of the seam: the resolved dir exists before the first
    POST, so a fresh clone's first boot cannot fail on a missing default."""
    EXPORTS_DIR.mkdir(parents=True, exist_ok=True)
    return EXPORTS_DIR


def is_loopback(host):
    """True only for a loopback peer address. The bind already guarantees
    this; the guard exists so the guarantee is asserted where the write
    happens, not only where the socket was opened."""
    return host in ("127.0.0.1", "::1")


class LoopbackOnlyServer(ThreadingHTTPServer):
    def verify_request(self, request, client_address):
        return is_loopback(client_address[0])


class InfrabotHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(APP_ROOT), **kwargs)

    def end_headers(self):
        # v0.5.3 NO-STORE: every response this launcher sends carries
        # Cache-Control: no-store, so a plain reload always fetches the
        # newest build and the cache-empty ritual on every bump dies.
        # Measured: the served file read v0.5.2 while the browser's tab
        # read v0.5.1, because SimpleHTTP sends no Cache-Control at all
        # and the browser reused its copy. One override, one seam: the
        # static GET path, the JSON paths and the error paths all finish
        # through end_headers, so nothing this server sends escapes it.
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, fmt, *args):
        # v0.7.0: the heartbeat lands every 30 s while a tab is open; in a
        # log file that is a line every half minute saying nothing. Every
        # other request logs as SimpleHTTP always has.
        if self.path == HEARTBEAT_ENDPOINT_PATH:
            return
        super().log_message(fmt, *args)

    def _send_json(self, code, obj):
        body = json.dumps(obj).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        # GET /state serves the authoritative narrow file; 404 as JSON so the
        # page's bootstrap path (absent file -> POST local state as rev 1)
        # can tell "no file yet" from "no server". Everything else stays the
        # inherited static file service.
        if self.path == STATE_ENDPOINT_PATH:
            rev, raw = read_state_file()
            if raw is None:
                self._send_json(404, {"error": "no state file", "rev": 0})
                return
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(raw)))
            self.end_headers()
            self.wfile.write(raw)
            return
        super().do_GET()

    def _handle_state_post(self, raw):
        try:
            payload = json.loads(raw)
        except ValueError:
            self.send_error(400, "payload is not JSON")
            return
        if (not isinstance(payload, dict)
                or not isinstance(payload.get("baseRev"), int)
                or not isinstance(payload.get("state"), dict)
                or not isinstance(payload["state"].get("comms"), list)
                or not isinstance(payload["state"].get("network"), list)):
            self.send_error(400, "not a state sync payload")
            return
        current_rev, current_raw = read_state_file()
        if payload["baseRev"] != current_rev:
            # Fence A: a writer building on a stale base never writes. The
            # current rev rides back so the loser can refetch and re-merge.
            self._send_json(409, {"error": "stale baseRev", "rev": current_rev})
            return
        new_rev = current_rev + 1
        stored = dict(payload["state"])
        stored["rev"] = new_rev
        try:
            STATE_DIR.mkdir(parents=True, exist_ok=True)
            if current_raw is not None:
                # Fence B: the prior truth is snapshotted before it is
                # replaced, UTC-stamped, so a lost race is recoverable.
                STATE_BACKUPS_DIR.mkdir(parents=True, exist_ok=True)
                stamp = datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%d-%H%M%S-%f")
                (STATE_BACKUPS_DIR / ("infrabot_state_%s.json" % stamp)).write_bytes(current_raw)
            tmp = STATE_FILE.with_name(STATE_FILE.name + ".tmp")
            tmp.write_text(json.dumps(stored, indent=2, sort_keys=True), encoding="utf-8")
            os.replace(tmp, STATE_FILE)
        except OSError as e:
            self.send_error(500, "state write failed: %s" % e)
            return
        self._send_json(200, {"rev": new_rev})

    def _handle_heartbeat_post(self):
        # Fence C's beacon: the page beats while a tab is open; the external
        # writer reads this file's mtime and refuses while it is fresh.
        try:
            STATE_DIR.mkdir(parents=True, exist_ok=True)
            STATE_HEARTBEAT_FILE.write_text(
                str(datetime.datetime.now(datetime.timezone.utc).isoformat()), encoding="utf-8")
        except OSError as e:
            self.send_error(500, "heartbeat write failed: %s" % e)
            return
        self._send_json(200, {})

    def do_POST(self):
        if not is_loopback(self.client_address[0]):
            self.send_error(403, "loopback only")
            return
        if self.path == HEARTBEAT_ENDPOINT_PATH:
            self._handle_heartbeat_post()
            return
        if self.path not in (EXPORT_ENDPOINT_PATH, STATE_ENDPOINT_PATH):
            self.send_error(404, "unknown endpoint")
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            self.send_error(400, "bad Content-Length")
            return
        if length <= 0 or length > MAX_PAYLOAD_BYTES:
            self.send_error(400, "payload length out of range")
            return
        raw = self.rfile.read(length)
        if self.path == STATE_ENDPOINT_PATH:
            self._handle_state_post(raw)
            return
        try:
            payload = json.loads(raw)
        except ValueError:
            self.send_error(400, "payload is not JSON")
            return
        # The same shape check the app's own importStateFile runs: a dict
        # carrying a comms list. Anything else is not an infrabot state
        # export and never touches the exports/ handoff.
        if not isinstance(payload, dict) or not isinstance(payload.get("comms"), list):
            self.send_error(400, "not an infrabot state export")
            return
        stamp = datetime.date.today().isoformat()
        target = EXPORTS_DIR / (EXPORT_FILENAME % stamp)
        try:
            EXPORTS_DIR.mkdir(parents=True, exist_ok=True)
            tmp = target.with_name(target.name + ".tmp")
            tmp.write_bytes(raw)
            os.replace(tmp, target)  # atomic; same-day overwrite by design
        except OSError as e:
            self.send_error(500, "export write failed: %s" % e)
            return
        body = json.dumps({"written": str(target)}).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


DOOR = "http://%s:%d/infrabot.html" % (BIND_HOST, PORT)


def door_answers():
    """True when something accepts a connection on the door."""
    try:
        with socket.create_connection((BIND_HOST, PORT), timeout=0.5):
            return True
    except OSError:
        return False


def read_pid_file():
    """-> the PID in SERVE_PID_FILE, or None when absent or not a number."""
    try:
        return int(SERVE_PID_FILE.read_text(encoding="utf-8").strip())
    except (OSError, ValueError):
        return None


def is_serve_process(pid):
    """True when PID is alive and its command line names this script. A
    PID file can outlive its process and the number can be reused, so the
    stop path never signals a PID it has not read back as serve.py."""
    if not pid or pid <= 0:
        return False
    try:
        os.kill(pid, 0)
    except OSError:
        return False
    try:
        out = subprocess.run(["ps", "-o", "command=", "-p", str(pid)],
                             capture_output=True, text=True, check=False).stdout
    except OSError:
        return False
    return "serve.py" in out


def port_listener_pid():
    """-> the PID listening on the door per lsof, or None. The fallback for
    a server started with no PID file (a foreground start, or an older
    launcher); lsof ships with macOS."""
    try:
        out = subprocess.run(["lsof", "-ti", "tcp:%d" % PORT, "-sTCP:LISTEN"],
                             capture_output=True, text=True, check=False).stdout
    except OSError:
        return None
    for line in out.split():
        if line.strip().isdigit():
            return int(line.strip())
    return None


def _clear_pid_file(pid=None):
    """Remove the PID file when it names PID (or unconditionally)."""
    if pid is None or read_pid_file() == pid:
        try:
            SERVE_PID_FILE.unlink()
        except OSError:
            pass


def serve():
    """Serve until Ctrl-C or SIGTERM (what --stop sends). Returns 0."""
    ensure_exports_dir()
    STATE_DIR.mkdir(parents=True, exist_ok=True)
    httpd = LoopbackOnlyServer((BIND_HOST, PORT), InfrabotHandler)
    print("infrabot serving %s (pid %d)" % (DOOR, os.getpid()), flush=True)
    print("export endpoint POST %s -> %s (%s)" % (
        EXPORT_ENDPOINT_PATH, EXPORTS_DIR,
        "LPI_EXPORT_DIR" if os.environ.get("LPI_EXPORT_DIR") else "repo-local default"), flush=True)
    print("state endpoint GET/POST %s -> %s (%s); heartbeat POST %s" % (
        STATE_ENDPOINT_PATH, STATE_FILE,
        "LPI_STATE_DIR" if os.environ.get("LPI_STATE_DIR") else "repo-local default",
        HEARTBEAT_ENDPOINT_PATH), flush=True)

    def on_term(signum, frame):
        # SIGTERM lands where Ctrl-C does, so the stop path below runs once.
        raise KeyboardInterrupt
    signal.signal(signal.SIGTERM, on_term)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        httpd.server_close()
        _clear_pid_file(os.getpid())
        print("infrabot stopped (pid %d)" % os.getpid(), flush=True)
    return 0


def detach():
    """--detach: start the server as its own session, stdio to the log,
    PID to the PID file; print the door, the log and the PID once the door
    answers. Idempotent: a door already answering starts nothing."""
    if door_answers():
        pid = read_pid_file()
        who = ("pid %d" % pid) if is_serve_process(pid) else "pid not on record"
        print("infrabot already serving %s (%s); nothing started" % (DOOR, who), flush=True)
        return 0
    STATE_DIR.mkdir(parents=True, exist_ok=True)
    child = os.fork()
    if child == 0:
        # The child: a new session (no controlling terminal, so a closed
        # window's hangup never reaches it), stdio into the log, the PID on
        # record, then the same serve() the foreground path runs.
        os.setsid()
        # A window's hangup never reaches a new session; an explicit
        # SIGHUP is ignored too, so only --stop, SIGTERM or SIGKILL ends it.
        signal.signal(signal.SIGHUP, signal.SIG_IGN)
        log_fd = os.open(str(SERVE_LOG_FILE), os.O_WRONLY | os.O_CREAT | os.O_APPEND, 0o644)
        os.dup2(log_fd, 1)
        os.dup2(log_fd, 2)
        os.close(log_fd)
        sys.stdout.reconfigure(line_buffering=True)
        sys.stderr.reconfigure(line_buffering=True)
        devnull = os.open(os.devnull, os.O_RDONLY)
        os.dup2(devnull, 0)
        os.close(devnull)
        SERVE_PID_FILE.write_text("%d\n" % os.getpid(), encoding="utf-8")
        print("infrabot detached start %s" % datetime.datetime.now().isoformat(timespec="seconds"), flush=True)
        try:
            code = serve()
        except Exception as e:  # the log is the only place a detached failure can land
            print("infrabot failed: %s" % e, flush=True)
            _clear_pid_file(os.getpid())
            code = 1
        os._exit(code)
    # The parent: wait for the door or for the child to die, whichever first.
    end = time.time() + SERVE_START_WAIT_S
    while time.time() < end:
        done, status = os.waitpid(child, os.WNOHANG)
        if done:
            break
        if door_answers():
            print("infrabot serving %s detached: pid %d, log %s" % (DOOR, child, SERVE_LOG_FILE), flush=True)
            print("stop it with: python3 %s --stop  (or stop-infrabot.command)" % pathlib.Path(__file__).name, flush=True)
            return 0
        time.sleep(0.1)
    try:
        tail = SERVE_LOG_FILE.read_text(encoding="utf-8", errors="replace").splitlines()[-5:]
    except OSError:
        tail = []
    print("infrabot did not come up within %ds; log %s" % (SERVE_START_WAIT_S, SERVE_LOG_FILE), flush=True)
    for line in tail:
        print("  " + line, flush=True)
    return 1


def stop():
    """--stop: end the server named by the PID file, or the listener on the
    door when no file names one; wait for the door to close; clear the
    file. Not running is not an error."""
    pid = read_pid_file()
    if pid is not None and not is_serve_process(pid):
        _clear_pid_file()
        print("infrabot: stale pid file cleared (pid %d is not serve.py)" % pid, flush=True)
        pid = None
    if pid is None:
        pid = port_listener_pid()
        if pid is not None and not is_serve_process(pid):
            print("infrabot: something else listens on port %d (pid %d, not serve.py); not touched" % (PORT, pid), flush=True)
            return 1
    if pid is None:
        print("infrabot is not running", flush=True)
        return 0
    try:
        os.kill(pid, signal.SIGTERM)
    except OSError as e:
        print("infrabot: could not signal pid %d: %s" % (pid, e), flush=True)
        return 1
    end = time.time() + SERVE_STOP_WAIT_S
    while time.time() < end:
        if not is_serve_process(pid) and not door_answers():
            _clear_pid_file()
            print("infrabot stopped (pid %d)" % pid, flush=True)
            return 0
        time.sleep(0.1)
    print("infrabot: pid %d did not stop within %ds; not killed harder" % (pid, SERVE_STOP_WAIT_S), flush=True)
    return 1


def main(argv):
    if "--stop" in argv:
        return stop()
    if "--detach" in argv:
        return detach()
    return serve()


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
