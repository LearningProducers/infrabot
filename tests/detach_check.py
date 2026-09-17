#!/usr/bin/env python3
"""detach_check.py: the launcher starts the server detached, the stop command
ends it, and three edits made with the server down survive its return
(infrabot v0.7.0).

Runs the REAL open-infrabot.command and stop-infrabot.command (never a
re-implementation) against a FIXTURE app directory holding this repo's
serve.py and an invented infrabot.html, on a FREE loopback port through the
INFRABOT_PORT seam so a live server on 8119 is never touched, with HOME,
LPI_STATE_DIR and LPI_EXPORT_DIR pointed at a throwaway directory (so no
env file is sourced and the real state, exports and heartbeat never enter),
and `open` shadowed on PATH by a shim that records each call instead of
opening a browser. The launcher is started in its own session so a hangup
to that whole group can be measured.

The cases, in order:
  A  START: the launcher exits on its own (it blocks nothing), the door
     answers, serve.pid names a live python running serve.py, serve.log
     carries the serving line, the launcher printed its pull line first and
     its detached line after, `open` was called once.
  B  HANGUP: no process is left in the launcher's session, and a SIGHUP sent
     straight to the server's PID leaves it answering.
  C  SECOND START: the launcher says already running, calls `open` again,
     and the PID on record is unchanged.
  D  THE OUTAGE AND THE RETURN: a state with one comm, one event and one
     artifact is synced (rev 1); the stop command ends the server; the
     three records are edited in a local copy the way the page's storage
     holds them (new text, a later stamp); the launcher starts the server
     again; the page's merge (the real recordTouch and mergeRecordSlice,
     driven through tests/state_merge_check.js --merge under node) runs the
     local copy against the file; the merged state is POSTed on the file's
     rev and read back: each edited record byte-identical to the local
     edit, rev 2. node is resolved from INFRABOT_NODE, then PATH, then the
     newest ~/.nvm/versions/node/*/bin/node; with none this case reports
     SKIPPED and the check exits 1, because a case that measured nothing is
     not a pass.
  E  STOP: the stop command reports stopped, the door closes, the PID file
     is gone, the process is gone.
  F  STOP AGAIN: not running, exit 0.
  G  STOP WITH NO PID FILE: a server started, its PID file removed (the
     shape of a server an older launcher started in the foreground), the
     stop command finds the listener on the port and ends it.

Stdlib only; needs zsh, lsof and ps, present on the Mac the launcher runs on.
The fixture's records are invented. Run from the repo root:
    python3 tests/detach_check.py
Optional first argument: a path to a different repo root to measure.
Exit 0 on pass, 1 on any failure or a skip.
"""
import glob
import json
import os
import pathlib
import shutil
import signal
import socket
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request

ROOT = pathlib.Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else pathlib.Path(__file__).resolve().parent.parent
START = ROOT / "open-infrabot.command"
STOP = ROOT / "stop-infrabot.command"
MERGE_CHECK = ROOT / "tests" / "state_merge_check.js"
FAILURES = []


def check(name, ok, detail=""):
    print("%-72s %s" % (name, "PASS" if ok else "FAIL " + str(detail)[:300]))
    if not ok:
        FAILURES.append(name)


def free_port():
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def door_answers(port):
    with socket.socket() as s:
        s.settimeout(0.5)
        return s.connect_ex(("127.0.0.1", port)) == 0


def wait_door(port, up, seconds=10):
    end = time.time() + seconds
    while time.time() < end:
        if door_answers(port) == up:
            return True
        time.sleep(0.1)
    return False


def http(port, path, body=None):
    req = urllib.request.Request("http://127.0.0.1:%d%s" % (port, path), data=body,
                                 headers={"Content-Type": "application/json"} if body else {})
    try:
        with urllib.request.urlopen(req, timeout=5) as r:
            return r.status, r.read()
    except urllib.error.HTTPError as e:
        return e.code, e.read()


def pid_alive_serve(pid):
    try:
        os.kill(pid, 0)
    except OSError:
        return False
    out = subprocess.run(["ps", "-o", "command=", "-p", str(pid)], capture_output=True, text=True).stdout
    return "serve.py" in out


def find_node():
    env = os.environ.get("INFRABOT_NODE")
    if env and os.access(env, os.X_OK):
        return env
    on_path = shutil.which("node")
    if on_path:
        return on_path
    cands = sorted(glob.glob(os.path.expanduser("~/.nvm/versions/node/*/bin/node")))
    return cands[-1] if cands else None


class Fixture:
    def __init__(self):
        self.tmp = pathlib.Path(tempfile.mkdtemp(prefix="detach_check_"))
        self.app = self.tmp / "app"
        self.app.mkdir()
        shutil.copy(ROOT / "serve.py", self.app / "serve.py")
        (self.app / "infrabot.html").write_text("<!DOCTYPE html><html><body>detach fixture vTEST</body></html>\n")
        self.state = self.tmp / "state"
        shim = self.tmp / "shim"
        shim.mkdir()
        self.open_calls = self.tmp / "open.calls"
        fake_open = shim / "open"
        fake_open.write_text("#!/bin/sh\necho \"$@\" >> \"%s\"\nexit 0\n" % self.open_calls)
        fake_open.chmod(0o755)
        self.port = free_port()
        self.env = dict(os.environ)
        self.env["PATH"] = str(shim) + os.pathsep + self.env.get("PATH", "")
        self.env["HOME"] = str(self.tmp)  # no env file is sourced from here
        self.env["INFRABOT_DIR"] = str(self.app)
        self.env["INFRABOT_PORT"] = str(self.port)
        self.env["LPI_STATE_DIR"] = str(self.state)
        self.env["LPI_EXPORT_DIR"] = str(self.tmp / "exports")

    def run(self, script, timeout=20):
        """Run a .command in its own session; return (exit code, output, pgid)."""
        p = subprocess.Popen(["zsh", str(script)], cwd=str(self.app), env=self.env,
                             stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True,
                             start_new_session=True)
        pgid = os.getpgid(p.pid)
        try:
            out, _ = p.communicate(timeout=timeout)
        except subprocess.TimeoutExpired:
            p.kill()
            out, _ = p.communicate()
            return None, out, pgid
        return p.returncode, out, pgid

    def open_count(self):
        try:
            return len(self.open_calls.read_text().splitlines())
        except OSError:
            return 0

    def pid(self):
        try:
            return int((self.state / "serve.pid").read_text().strip())
        except (OSError, ValueError):
            return None

    def cleanup(self):
        pid = self.pid()
        if pid and pid_alive_serve(pid):
            os.kill(pid, signal.SIGKILL)
        shutil.rmtree(self.tmp, ignore_errors=True)


def main():
    for f in (START, STOP, MERGE_CHECK):
        if not f.is_file():
            print("FAIL: %s not found" % f)
            return 1
    fx = Fixture()
    port = fx.port
    try:
        # A. START
        code, out, pgid = fx.run(START)
        lines = [l for l in out.strip().splitlines() if l.strip()]
        check("A start: the launcher exited on its own", code == 0, "exit %r, output %r" % (code, out[-300:]))
        check("A start: the door answers", wait_door(port, True))
        pid = fx.pid()
        check("A start: serve.pid names a live serve.py process", pid is not None and pid_alive_serve(pid), pid)
        log = (fx.state / "serve.log").read_text() if (fx.state / "serve.log").is_file() else ""
        check("A start: serve.log carries the serving line", "infrabot serving" in log, log[-200:])
        check("A start: the pull line comes first", lines and lines[0].startswith("infrabot: serving what is on disk"), lines[:1])
        check("A start: the detached line names the pid and the log", any("detached: pid %d" % (pid or -1) in l and "serve.log" in l for l in lines), lines)
        check("A start: open called once", fx.open_count() == 1, fx.open_count())

        # B. HANGUP
        left = True
        try:
            os.killpg(pgid, signal.SIGHUP)
        except ProcessLookupError:
            left = False
        check("B hangup: no process left in the launcher's session", not left)
        if pid:
            os.kill(pid, signal.SIGHUP)
        time.sleep(0.5)
        check("B hangup: a SIGHUP to the server's pid leaves it answering", door_answers(port) and pid_alive_serve(pid or -1))

        # C. SECOND START
        code, out, _ = fx.run(START)
        first = out.strip().splitlines()[0] if out.strip() else ""
        check("C second start: says already running", code == 0 and "already running" in first, first)
        check("C second start: open called again", fx.open_count() == 2, fx.open_count())
        check("C second start: the pid on record is unchanged", fx.pid() == pid, (fx.pid(), pid))

        # D. THE OUTAGE AND THE RETURN
        T = lambda h, m: "2026-04-01T%02d:%02d:00.000Z" % (h, m)
        seed = {
            "comms": [{"id": "c1", "title": "Fixture comm", "body": "body before the outage", "status": "draft",
                       "createdAt": T(9, 0), "updatedAt": T(9, 0), "statusHistory": [{"status": "draft", "timestamp": T(9, 0)}]}],
            "network": [],
            "events": [{"id": "e1", "title": "Fixture event", "whyThisRoom": "why before the outage", "status": "candidate",
                        "createdAt": T(9, 0), "updatedAt": T(9, 0), "statusHistory": [{"status": "candidate", "timestamp": T(9, 0)}]}],
            "artifacts": [{"id": "a1", "title": "Fixture artifact", "whyItEarned": "earned before the outage", "status": "planned",
                           "created": T(9, 0), "updated": T(9, 0), "statusHistory": [{"status": "planned", "timestamp": T(9, 0)}]}],
        }
        st, body = http(port, "/state", json.dumps({"baseRev": 0, "state": seed}).encode())
        check("D outage: the seed synced as rev 1", st == 200 and json.loads(body).get("rev") == 1, (st, body[:100]))
        code, out, _ = fx.run(STOP)
        check("D outage: the stop command ended the server (the outage begins)", code == 0 and "infrabot stopped" in out and wait_door(port, False), out[-200:])
        local = json.loads(json.dumps(seed))  # what the page's storage holds, then the three edits
        local["comms"][0]["body"] = "body EDITED DURING THE OUTAGE"; local["comms"][0]["updatedAt"] = T(10, 30)
        local["events"][0]["whyThisRoom"] = "why EDITED DURING THE OUTAGE"; local["events"][0]["updatedAt"] = T(10, 31)
        local["artifacts"][0]["whyItEarned"] = "earned EDITED DURING THE OUTAGE"; local["artifacts"][0]["updated"] = T(10, 32)
        code, out, _ = fx.run(START)
        check("D return: the launcher started the server again", code == 0 and wait_door(port, True), out[-200:])
        st, body = http(port, "/state")
        filestate = json.loads(body)
        check("D return: the file still reads the pre-outage text at rev 1",
              st == 200 and filestate.get("rev") == 1 and filestate["comms"][0]["body"] == "body before the outage")
        node = find_node()
        if not node:
            check("D return: node found for the page's merge (SKIPPED: no node on this machine)", False, "set INFRABOT_NODE")
        else:
            (fx.tmp / "local.json").write_text(json.dumps(local))
            (fx.tmp / "file.json").write_text(json.dumps(filestate))
            r = subprocess.run([node, str(MERGE_CHECK), "--merge", str(fx.tmp / "local.json"), str(fx.tmp / "file.json"), str(ROOT / "infrabot.html")],
                               capture_output=True, text=True)
            check("D return: the page's merge ran (the real functions, under node)", r.returncode == 0, r.stdout[-200:] + r.stderr[-200:])
            merged = json.loads(r.stdout.strip().splitlines()[-1]) if r.returncode == 0 else {}
            st, body = http(port, "/state", json.dumps({"baseRev": filestate["rev"], "state": merged}).encode())
            check("D return: the owed sync landed as rev 2", st == 200 and json.loads(body).get("rev") == 2, (st, body[:100]))
            st, body = http(port, "/state")
            back = json.loads(body)
            canon = lambda o: json.dumps(o, sort_keys=True)
            for key, idx in (("comms", 0), ("events", 0), ("artifacts", 0)):
                check("D return: the %s edit survived byte-identical" % key[:-1],
                      canon(back[key][idx]) == canon(local[key][idx]), canon(back[key][idx])[:200])
            check("D return: the file reads rev 2", back.get("rev") == 2, back.get("rev"))

        # E. STOP
        pid = fx.pid()
        code, out, _ = fx.run(STOP)
        check("E stop: reports stopped", code == 0 and "infrabot stopped (pid %d)" % (pid or -1) in out, out[-200:])
        check("E stop: the door closed", wait_door(port, False))
        check("E stop: the pid file is gone", not (fx.state / "serve.pid").exists())
        check("E stop: the process is gone", pid is not None and not pid_alive_serve(pid))

        # F. STOP AGAIN
        code, out, _ = fx.run(STOP)
        check("F stop again: not running, exit 0", code == 0 and "not running" in out, (code, out[-200:]))

        # G. STOP WITH NO PID FILE
        code, out, _ = fx.run(START)
        check("G no pid file: a server started", code == 0 and wait_door(port, True), out[-200:])
        pid = fx.pid()
        (fx.state / "serve.pid").unlink()
        code, out, _ = fx.run(STOP)
        check("G no pid file: the stop command found the listener and stopped it",
              code == 0 and "infrabot stopped (pid %d)" % (pid or -1) in out and wait_door(port, False), out[-200:])
    finally:
        fx.cleanup()
    print("\n%d failure(s)" % len(FAILURES))
    return 1 if FAILURES else 0


if __name__ == "__main__":
    sys.exit(main())
