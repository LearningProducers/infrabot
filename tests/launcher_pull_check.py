#!/usr/bin/env python3
"""launcher_pull_check.py: a restarted launcher serves the latest main
(infrabot v0.6.0).

Runs the REAL open-infrabot.command (never a re-implementation) against a
FIXTURE clone whose remote main is one commit ahead, with INFRABOT_DIR
pointed at the clone, `open` shadowed by a no-op on PATH so no browser tab
opens, and LPI_STATE_DIR / LPI_EXPORT_DIR pointed at a throwaway directory
so the real state, exports and heartbeat are never touched. Three starts:

  1. a clean checkout on main, behind origin: the launcher fast-forwards
     it, says so in one line, and the served page carries the NEWER
     version line;
  2. a checkout with a tracked change: no pull, one plain line naming it,
     the OLDER version line served;
  3. a remote that cannot be reached: no pull, one plain line, the OLDER
     line served; never a force.

Since infrabot v0.7.0 the launcher starts the server DETACHED and exits, so
each case stops the server through the real stop path (serve.py --stop, what
stop-infrabot.command runs) rather than by ending the launcher, and the
check binds a FREE port through the INFRABOT_PORT seam, so a live server on
8119 is never touched and never blocks the check. The fixture's version
strings are invented. Stdlib only; needs git and zsh, present on the Mac
the launcher runs on.

Run from the repo root:   python3 tests/launcher_pull_check.py
Optional first argument: a path to a different repo root to measure.
Exit 0 on pass, 1 on any failure or a skip.
"""
import os
import pathlib
import shutil
import socket
import subprocess
import sys
import tempfile
import time
import urllib.request

ROOT = pathlib.Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else pathlib.Path(__file__).resolve().parent.parent
LAUNCHER = ROOT / "open-infrabot.command"


def free_port():
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


PORT = free_port()
FAILURES = []


def check(name, ok, detail=""):
    print("%-70s %s" % (name, "PASS" if ok else "FAIL " + str(detail)[:200]))
    if not ok:
        FAILURES.append(name)


def sh(cwd, *args):
    return subprocess.run(list(args), cwd=str(cwd), capture_output=True, text=True, check=False)


def port_busy():
    with socket.socket() as s:
        return s.connect_ex(("127.0.0.1", PORT)) == 0


def fetch():
    with urllib.request.urlopen("http://127.0.0.1:%d/infrabot.html" % PORT, timeout=3) as r:
        return r.read().decode("utf-8", "replace")


def wait_port(up, seconds=10):
    end = time.time() + seconds
    while time.time() < end:
        if port_busy() == up:
            return True
        time.sleep(0.2)
    return False


def build_fixture(tmp):
    remote = tmp / "remote"
    remote.mkdir()
    sh(remote, "git", "init", "-q", "-b", "main")
    sh(remote, "git", "config", "user.email", "fixture@example.invalid")
    sh(remote, "git", "config", "user.name", "Fixture")
    shutil.copy(ROOT / "serve.py", remote / "serve.py")
    (remote / "infrabot.html").write_text("<!DOCTYPE html><html><body>launcher fixture vTEST.OLD</body></html>\n")
    sh(remote, "git", "add", "-A")
    sh(remote, "git", "commit", "-q", "-m", "old")
    (remote / "infrabot.html").write_text("<!DOCTYPE html><html><body>launcher fixture vTEST.NEW</body></html>\n")
    sh(remote, "git", "commit", "-q", "-am", "new")
    clone = tmp / "clone"
    sh(tmp, "git", "clone", "-q", str(remote), str(clone))
    sh(clone, "git", "config", "user.email", "fixture@example.invalid")
    sh(clone, "git", "config", "user.name", "Fixture")
    # main moved back one commit, upstream kept: the checkout is behind origin
    sh(clone, "git", "checkout", "-q", "-B", "main", "HEAD~1")
    sh(clone, "git", "branch", "-q", "--set-upstream-to=origin/main", "main")
    return remote, clone


def start_launcher(clone, tmp):
    shim = tmp / "shim"
    shim.mkdir(exist_ok=True)
    fake_open = shim / "open"
    fake_open.write_text("#!/bin/sh\nexit 0\n")
    fake_open.chmod(0o755)
    env = dict(os.environ)
    env["PATH"] = str(shim) + os.pathsep + env.get("PATH", "")
    env["INFRABOT_DIR"] = str(clone)
    env["INFRABOT_PORT"] = str(PORT)
    env["HOME"] = str(tmp)  # no machine env file is sourced from here
    env["LPI_STATE_DIR"] = str(tmp / "state")
    env["LPI_EXPORT_DIR"] = str(tmp / "exports")
    env.pop("LPI_EXPORT_DIR_OVERRIDE", None)
    log = open(tmp / "launcher.log", "w")
    proc = subprocess.Popen(["zsh", str(LAUNCHER)], cwd=str(clone), env=env,
                            stdout=log, stderr=subprocess.STDOUT)
    return proc, log


def stop(proc, log, clone, tmp):
    # The launcher exits on its own once the server is up (v0.7.0); the
    # server is ended through the real stop path with the same seams.
    try:
        proc.wait(timeout=15)
    except subprocess.TimeoutExpired:
        proc.kill()
        proc.wait()
    log.close()
    env = dict(os.environ)
    env["INFRABOT_PORT"] = str(PORT)
    env["LPI_STATE_DIR"] = str(tmp / "state")
    subprocess.run(["python3", str(clone / "serve.py"), "--stop"], env=env, capture_output=True, check=False)
    wait_port(False)


def run_case(tmp, clone, name, expect_line, expect_version):
    proc, log = start_launcher(clone, tmp)
    try:
        up = wait_port(True)
        body = fetch() if up else ""
    finally:
        stop(proc, log, clone, tmp)
    out = (tmp / "launcher.log").read_text()
    first = out.strip().splitlines()[0] if out.strip() else ""
    check("%s: server came up" % name, up, out[-200:])
    check("%s: the launcher's one line reads as expected" % name, expect_line in first, first)
    check("%s: served page carries %s" % (name, expect_version), expect_version in body, body[:120])
    return out


def main():
    if not LAUNCHER.is_file():
        print("FAIL: launcher not found at %s" % LAUNCHER)
        return 1
    tmp = pathlib.Path(tempfile.mkdtemp(prefix="launcher_pull_"))
    try:
        remote, clone = build_fixture(tmp)
        behind = sh(clone, "git", "rev-list", "--count", "main..origin/main").stdout.strip()
        check("fixture: the clone sits one commit behind origin main", behind == "1", behind)

        run_case(tmp, clone, "clean behind", "fast-forwarded to origin main", "vTEST.NEW")
        head_now = sh(clone, "git", "rev-parse", "HEAD").stdout.strip()
        head_remote = sh(remote, "git", "rev-parse", "HEAD").stdout.strip()
        check("clean behind: the checkout is at origin main after the start", head_now == head_remote)

        # a tracked change: no pull
        sh(clone, "git", "checkout", "-q", "-B", "main", "HEAD~1")
        (clone / "serve.py").write_text((clone / "serve.py").read_text() + "\n# local edit\n")
        run_case(tmp, clone, "dirty tree", "tracked changes in the checkout; no pull", "vTEST.OLD")
        check("dirty tree: the local edit survived (never a force)", "# local edit" in (clone / "serve.py").read_text())
        sh(clone, "git", "checkout", "-q", "--", "serve.py")

        # an unreachable remote: no pull, no force
        sh(clone, "git", "remote", "set-url", "origin", str(tmp / "nowhere"))
        run_case(tmp, clone, "offline", "could not fast-forward main to origin", "vTEST.OLD")
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
    print("\n%d failure(s)" % len(FAILURES))
    return 1 if FAILURES else 0


if __name__ == "__main__":
    sys.exit(main())
