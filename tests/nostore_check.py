#!/usr/bin/env python3
"""nostore_check.py: every response serve.py sends carries
Cache-Control: no-store (infrabot v0.5.3).

Starts the REAL serve.py handler (imported, never re-implemented) on an
ephemeral loopback port with LPI_STATE_DIR and LPI_EXPORT_DIR pointed at a
throwaway temp directory, so nothing here reads or writes the real
state, exports or heartbeat. Fetches the three response shapes the server
has (the static file, the JSON /state path, a 404) and fails on any of
them arriving without the header. Stdlib only; the repo is public and the
check carries no names.

Run from the repo root:   python3 tests/nostore_check.py
Optional first argument: a path to a different serve.py to measure.
Exit 0 on pass, 1 on any failure.
"""
import importlib.util
import os
import pathlib
import sys
import tempfile
import threading
import urllib.error
import urllib.request

here = pathlib.Path(__file__).resolve().parent
serve_path = pathlib.Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else here.parent / "serve.py"
tmp = tempfile.mkdtemp(prefix="infrabot-nostore-")
os.environ["LPI_STATE_DIR"] = os.path.join(tmp, "state")
os.environ["LPI_EXPORT_DIR"] = os.path.join(tmp, "exports")

spec = importlib.util.spec_from_file_location("serve_under_test", str(serve_path))
serve = importlib.util.module_from_spec(spec)
spec.loader.exec_module(serve)
# Quiet the handler's per-request log line: the verdict lines below are the output.
serve.InfrabotHandler.log_message = lambda *args, **kwargs: None

httpd = serve.LoopbackOnlyServer(("127.0.0.1", 0), serve.InfrabotHandler)
port = httpd.server_address[1]
threading.Thread(target=httpd.serve_forever, daemon=True).start()

failures = []
def fetch(path):
    url = "http://127.0.0.1:%d%s" % (port, path)
    try:
        with urllib.request.urlopen(url, timeout=5) as r:
            r.read()  # drain the body so the server never sees a broken pipe
            return r.status, r.headers
    except urllib.error.HTTPError as e:
        e.read()
        return e.code, e.headers

def expect(label, path, want_status):
    status, headers = fetch(path)
    cc = headers.get("Cache-Control")
    ok = status == want_status and cc == "no-store"
    print("%s %s: HTTP %d, Cache-Control: %s" % ("PASS" if ok else "FAIL", label, status, cc))
    if not ok:
        failures.append(label)

expect("static file (infrabot.html)", "/infrabot.html", 200)
expect("JSON path (/state with no file)", serve.STATE_ENDPOINT_PATH, 404)
expect("404 path", "/no-such-file-%d.txt" % port, 404)
httpd.shutdown()

if failures:
    print("nostore_check: FAIL (%d failure(s))" % len(failures))
    sys.exit(1)
print("nostore_check: PASS (%s)" % serve_path)
