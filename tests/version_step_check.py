#!/usr/bin/env python3
"""version_step_check.py: the checks job's version step fails a pull request
that changes the page and keeps the version, and passes one that owes none or moved it.

Reads the step named below out of .github/workflows/checks.yml (the `run: |`
block, found by the step's name, never re-implemented here) and runs that
script with bash inside throwaway git repositories that stand in for a pull
request: a bare "origin" holding a base branch and a head commit, and a
repository that knows that origin as the runner's checkout. The cases:

  V1  the page unchanged on the pull request         the step passes
  V2  the page changed, APP_VERSION kept             the step fails, naming it
  V3  the page changed, APP_VERSION moved            the step passes
  V4  the base shipped after the fork, the pull
      request left the page alone                    the step passes
  V5  the pull request moved to a version the base
      has since taken                                the step fails
  V6  the head's page carries no APP_VERSION line    the step fails
  V7  the page changed, APP_VERSION kept, and the
      base shipped after the fork (the head differs
      from the base's tip without having moved)      the step fails

The script runs under `bash -e`, the shell GitHub gives a step that names
none. Stdlib only; needs git and bash. Nothing here reads or writes the
real repository.

Run from the repo root:   python3 tests/version_step_check.py
Exit 0 on pass, 1 on any failure.
"""
import os
import pathlib
import subprocess
import sys
import tempfile

STEP = "A pull request that changes the page moves APP_VERSION"
here = pathlib.Path(__file__).resolve().parent
workflow = here.parent / ".github" / "workflows" / "checks.yml"


def step_script():
    """The step's `run: |` block, dedented, read from the workflow by name."""
    lines = workflow.read_text(encoding="utf-8").split("\n")
    starts = [i for i, l in enumerate(lines) if l.strip() == "- name: " + STEP]
    if len(starts) != 1:
        sys.exit("FAIL: checks.yml must carry exactly one step named %r, found %d" % (STEP, len(starts)))
    i = starts[0] + 1
    while i < len(lines) and lines[i].strip() != "run: |":
        if lines[i].lstrip().startswith("- name:"):
            sys.exit("FAIL: the step %r has no `run: |` block" % STEP)
        i += 1
    if i >= len(lines):
        sys.exit("FAIL: the step %r has no `run: |` block" % STEP)
    indent = len(lines[i]) - len(lines[i].lstrip()) + 2
    body = []
    for l in lines[i + 1:]:
        if l.strip() and len(l) - len(l.lstrip()) < indent:
            break
        body.append(l[indent:])
    return "\n".join(body) + "\n"


def git(cwd, *args):
    out = subprocess.run(
        ["git", "-c", "user.name=check", "-c", "user.email=check@example.com",
         "-c", "commit.gpgsign=false", "-c", "init.defaultBranch=main"] + list(args),
        cwd=str(cwd), capture_output=True, text=True)
    if out.returncode != 0:
        sys.exit("FAIL: git %s: %s" % (" ".join(args), out.stderr.strip()))
    return out.stdout.strip()


def page(version, body):
    return "<html>\n<script>\nconst APP_VERSION='%s';\n// %s\n</script>\n</html>\n" % (version, body)


def case(root, name, head_page, base_page_after_fork=None):
    """Build origin + checkout for one pull request and run the step in it."""
    d = pathlib.Path(root) / name
    work = d / "work"
    work.mkdir(parents=True)
    git(work, "init", "-q")
    (work / "infrabot.html").write_text(page("infrabot-v1.0.0", "the page"), encoding="utf-8")
    (work / "serve.py").write_text("# the server\n", encoding="utf-8")
    git(work, "add", "-A")
    git(work, "commit", "-q", "-m", "base")
    git(work, "branch", "-M", "main")
    git(work, "checkout", "-q", "-b", "pr")
    (work / "serve.py").write_text("# the server, changed\n", encoding="utf-8")
    if head_page is not None:
        (work / "infrabot.html").write_text(head_page, encoding="utf-8")
    git(work, "add", "-A")
    git(work, "commit", "-q", "-m", "the pull request")
    head = git(work, "rev-parse", "HEAD")
    if base_page_after_fork is not None:
        git(work, "checkout", "-q", "main")
        (work / "infrabot.html").write_text(base_page_after_fork, encoding="utf-8")
        git(work, "add", "-A")
        git(work, "commit", "-q", "-m", "a later ship on the base")
    origin = d / "origin.git"
    git(d, "clone", "-q", "--bare", str(work), str(origin))
    git(origin, "config", "uploadpack.allowAnySHA1InWant", "true")
    # The runner's checkout: a repository that knows origin and holds no history yet.
    runner = d / "runner"
    runner.mkdir()
    git(runner, "init", "-q")
    git(runner, "remote", "add", "origin", str(origin))
    env = dict(os.environ, BASE_REF="main", HEAD_SHA=head)
    out = subprocess.run(["bash", "-e", "-c", step_script()],
                         cwd=str(runner), env=env, capture_output=True, text=True)
    return out.returncode, out.stdout + out.stderr


failures = 0


def check(label, ok, detail=""):
    global failures
    print(("ok   " if ok else "FAIL ") + label + ("" if ok else "\n     " + detail.strip().replace("\n", "\n     ")))
    if not ok:
        failures += 1


with tempfile.TemporaryDirectory(prefix="infrabot-version-step-") as root:
    rc, out = case(root, "unchanged", None)
    check("V1 the page unchanged: the step passes and says no version is owed",
          rc == 0 and "no version is owed" in out, out)

    rc, out = case(root, "kept", page("infrabot-v1.0.0", "the page, changed"))
    check("V2 the page changed, APP_VERSION kept: the step fails and names the version",
          rc == 1 and "::error::" in out and "still reads infrabot-v1.0.0, the value it forked from" in out, out)

    rc, out = case(root, "moved", page("infrabot-v1.0.1", "the page, changed"))
    check("V3 the page changed, APP_VERSION moved: the step passes and prints both",
          rc == 0 and "infrabot-v1.0.0 -> infrabot-v1.0.1 (main reads infrabot-v1.0.0)" in out, out)

    rc, out = case(root, "base-moved", None, page("infrabot-v1.1.0", "a later ship"))
    check("V4 the base shipped a page change after the fork, the pull request none: the step passes",
          rc == 0 and "no version is owed" in out, out)

    rc, out = case(root, "collides", page("infrabot-v1.1.0", "the page, changed"),
                   page("infrabot-v1.1.0", "a later ship"))
    check("V5 the pull request moved to a version the base has since taken: the step fails",
          rc == 1 and "reads infrabot-v1.1.0, the value main already carries" in out, out)

    rc, out = case(root, "no-constant", "<html>\n<script>\n// no version line\n</script>\n</html>\n")
    check("V6 the head's page carries no APP_VERSION line: the step fails and says so",
          rc == 1 and "exactly one" in out, out)

    rc, out = case(root, "kept-behind", page("infrabot-v1.0.0", "the page, changed"),
                   page("infrabot-v1.0.1", "a later ship"))
    check("V7 the page changed, APP_VERSION kept, the base shipped after the fork: the step fails",
          rc == 1 and "still reads infrabot-v1.0.0, the value it forked from" in out, out)

print("version_step_check: %s" % ("PASS" if failures == 0 else "%d FAILED" % failures))
sys.exit(1 if failures else 0)
