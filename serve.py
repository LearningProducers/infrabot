#!/usr/bin/env python3
"""infrabot launcher (born v0.4.0, Door E; export destination seam added
2026-07-29): serves the app AND owns the export write.

Replaces the bare `python3 -m http.server 8119 --bind 127.0.0.1` line in the
Desktop launcher (~/Desktop/open-infrabot.command, founder-hand). Two jobs:

  1. SERVE: static files from this script's own directory (the repo clone),
     exactly the door the app has opened at since the OPERATING ERA:
     http://127.0.0.1:8119/infrabot.html
     Every response carries Cache-Control: no-store (v0.5.3), so a plain
     reload shows the newest build; tests/nostore_check.py pins it.
  2. EXPORT: POST /export receives the app's boot auto-export payload (the
     existing names-only buildStateExport JSON, serializer untouched) and
     writes it to EXPORTS_DIR as infrabot_state_YYYY-MM-DD.json. Same-day
     re-boot OVERWRITES the file (founder overwrite ruling 2026-07-21), which
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
instead of hunting literals; sync itself is OUT OF SCOPE by ruling
2026-07-21):
  BIND_HOST / PORT           the one door (127.0.0.1:8119)
  EXPORT_ENDPOINT_PATH       must match the app's EXPORT_ENDPOINT_PATH const
  EXPORTS_DIR                the write target, resolved by the destination
                             seam (2026-07-29): LPI_EXPORT_DIR when set,
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
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

BIND_HOST = "127.0.0.1"
PORT = 8119
EXPORT_ENDPOINT_PATH = "/export"
EXPORT_FILENAME = "infrabot_state_%s.json"  # %s = YYYY-MM-DD, local date
MAX_PAYLOAD_BYTES = 10 * 1024 * 1024  # a state export is ~KBs; 10 MB is a sanity wall, not a quota
APP_ROOT = pathlib.Path(__file__).resolve().parent

# ---------------------------------------------------------------------------
# FILE-BACKED NARROW STATE (v0.5.0, founder fork rulings 2026-08-10).
# The comms+network slice (exactly the buildStateExport schema, never
# profile/models/groqKey) lives in ONE server-authoritative file so an
# external writer (the lpi-ops post-send close) can flip a card to sent and
# the page trues itself on next load. PRIVATE ARTIFACT: real prospect names,
# so STATE_DIR is gitignored and never tracked in this public repo.
# Three fences ride every write (founder ruling, all three in one build):
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
    """Same destination seam shape as exports (2026-07-29): LPI_STATE_DIR
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
    """The destination seam (2026-07-29): LPI_EXPORT_DIR wins when set (the
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
        # v0.5.3 NO-STORE (founder STEP 0, 2026-09-06): every response this
        # launcher sends carries Cache-Control: no-store, so a plain reload
        # always fetches the newest build and the cache-empty ritual on
        # every bump (TROUBLESHOOTING.md DEPLOY CHAIN) dies. Measured
        # 2026-09-06 00:55: the served file read v0.5.2 while the founder's
        # tab read v0.5.1, because SimpleHTTP sends no Cache-Control at all
        # and the browser reused its copy. One override, one seam: the
        # static GET path, the JSON paths and the error paths all finish
        # through end_headers, so nothing this server sends escapes it.
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

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


def main():
    ensure_exports_dir()
    STATE_DIR.mkdir(parents=True, exist_ok=True)
    httpd = LoopbackOnlyServer((BIND_HOST, PORT), InfrabotHandler)
    print("infrabot serving http://%s:%d/infrabot.html" % (BIND_HOST, PORT))
    print("export endpoint POST %s -> %s (%s)" % (
        EXPORT_ENDPOINT_PATH, EXPORTS_DIR,
        "LPI_EXPORT_DIR" if os.environ.get("LPI_EXPORT_DIR") else "repo-local default"))
    print("state endpoint GET/POST %s -> %s (%s); heartbeat POST %s" % (
        STATE_ENDPOINT_PATH, STATE_FILE,
        "LPI_STATE_DIR" if os.environ.get("LPI_STATE_DIR") else "repo-local default",
        HEARTBEAT_ENDPOINT_PATH))
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
