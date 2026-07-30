#!/usr/bin/env python3
"""infrabot launcher (born v0.4.0, Door E; export destination seam added
2026-07-29): serves the app AND owns the export write.

Replaces the bare `python3 -m http.server 8119 --bind 127.0.0.1` line in the
Desktop launcher (~/Desktop/open-infrabot.command, founder-hand). Two jobs:

  1. SERVE: static files from this script's own directory (the repo clone),
     exactly the door the app has opened at since the OPERATING ERA:
     http://127.0.0.1:8119/infrabot.html
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

    def do_POST(self):
        if not is_loopback(self.client_address[0]):
            self.send_error(403, "loopback only")
            return
        if self.path != EXPORT_ENDPOINT_PATH:
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
    httpd = LoopbackOnlyServer((BIND_HOST, PORT), InfrabotHandler)
    print("infrabot serving http://%s:%d/infrabot.html" % (BIND_HOST, PORT))
    print("export endpoint POST %s -> %s (%s)" % (
        EXPORT_ENDPOINT_PATH, EXPORTS_DIR,
        "LPI_EXPORT_DIR" if os.environ.get("LPI_EXPORT_DIR") else "repo-local default"))
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
