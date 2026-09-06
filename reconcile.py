#!/usr/bin/env python3
"""reconcile.py (born v0.4.6): write the app's exported truth into tracker.csv.

THE LANE. The app's boot auto-export lands infrabot_state_YYYY-MM-DD.json in
the resolved export dir (LPI_EXPORT_DIR when set, else repo-local exports/
beside this script; the same destination seam serve.py resolves).
This tool reads the NEWEST export by modification time, never writes or
deletes anything in that dir, and upserts one tracker row per comm card.

OWNERSHIP LAW (the agreed mapping philosophy, generic form). Every column
except Notes is APP-OWNED and mechanically rewritten on every run, verbatim
from the export. Notes is HUMAN-OWNED: this tool never writes it, and an
existing Notes cell survives every run byte-for-byte. A private
reconcile needs an agreed translation table because its tracker already
speaks a human status vocabulary; this tracker is born app-vocabulary, so
the philosophy degenerates to verbatim pass-through with zero translation
and therefore zero conflict class. Narrative stays human-authored; the tool
writes state, not story.

FIELD DERIVATIONS, the two that are not verbatim:
  App Sent        local date of the FIRST statusHistory entry with status
                  'sent'. Derived from statusHistory, never the sentDate
                  field (the founding rot case: a card whose sentDate was
                  empty though it had been sent). Local means THIS machine's
                  timezone, the generic analogue of the private reconcile's
                  fixed home zone; the stored timestamp is a UTC instant.
  App Went Quiet  local date of the ghosted statusHistory entry (the
                  auto-flagged one where present, else any ghosted entry).
                  Blank when the card never went quiet.

RECORD LAW. A tracker row whose App ID no longer appears in the export is
CARRIED UNTOUCHED, never deleted: the live app view is not the record, and a
wiped or deleted card must not erase its trail here.

IDEMPOTENT. Two runs on identical inputs write identical bytes (the second
run reports 0 added / 0 updated). No clock, no run-time metadata in any
output; the write is atomic (temp file + os.replace).

FAIL-VISIBLE. No export dir, no export file, unparseable JSON, a payload
that is not a state export, a tracker header this tool does not recognize,
or a duplicate App ID already in the tracker: loud stderr, exit 2, nothing
written. A missing tracker.csv is the one forgiven absence: it is a tracked
template whose only content is the header, so it is recreated and the report
says so.

THE ENVIRONMENT GUARD. When LPI_EXPORT_DIR is set AND resolves
outside this repo, the tool REFUSES before reading anything: this tool
writes the tracked template tracker.csv, so reconciling a private export
dir would write real rows into a publishable repo. The refusal names the
resolved dir and the override flag, exits 2, and touches no file. The
repo-local exports/ default is unaffected, and an LPI_EXPORT_DIR that
resolves inside the repo runs normally. Override is explicit and off by
default: --allow-outside-export-dir.
"""
import csv
import datetime
import json
import os
import pathlib
import sys

APP_ROOT = pathlib.Path(__file__).resolve().parent
TRACKER = APP_ROOT / "tracker.csv"
EXPORT_GLOB = "infrabot_state_*.json"

HEADER = ["App ID", "Person", "Company", "Target", "City",
          "App Status", "App Section", "App Sent", "App Went Quiet", "Notes"]
HUMAN_FIELDS = ("Notes",)  # never written by this tool
ALLOW_OUTSIDE_FLAG = "--allow-outside-export-dir"


def resolve_exports_dir():
    """Same seam as serve.py: LPI_EXPORT_DIR wins, else repo-local exports/."""
    env = os.environ.get("LPI_EXPORT_DIR")
    if env:
        return pathlib.Path(env).expanduser()
    return APP_ROOT / "exports"


def fail(msg):
    sys.stderr.write("RECONCILE FAILED: %s\n" % msg)
    sys.exit(2)


def guard_outside_export_dir(exports_dir, argv):
    """The environment guard: refuse an env-set export dir outside
    the repo unless the override flag is explicit. Runs BEFORE any read, so
    a refusal proves nothing was opened and nothing was written."""
    if not os.environ.get("LPI_EXPORT_DIR"):
        return
    if ALLOW_OUTSIDE_FLAG in argv:
        return
    resolved = exports_dir.resolve()
    try:
        resolved.relative_to(APP_ROOT)
        return
    except ValueError:
        pass
    sys.stderr.write(
        "RECONCILE REFUSED: LPI_EXPORT_DIR resolves outside this repo:\n"
        "  %s\n"
        "This tool writes the tracked template tracker.csv; reconciling a\n"
        "private export dir would write real rows into a publishable repo.\n"
        "Nothing was read and nothing was written. To do it anyway, re-run\n"
        "with %s.\n" % (resolved, ALLOW_OUTSIDE_FLAG))
    sys.exit(2)


def newest_export(exports_dir):
    if not exports_dir.is_dir():
        fail("export dir does not exist: %s "
             "(boot the app once so it exports, or set LPI_EXPORT_DIR)" % exports_dir)
    candidates = sorted(exports_dir.glob(EXPORT_GLOB), key=lambda p: p.stat().st_mtime)
    if not candidates:
        fail("no %s in %s "
             "(boot the app once so it exports, or set LPI_EXPORT_DIR)"
             % (EXPORT_GLOB, exports_dir))
    return candidates[-1]


def load_export(path):
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except ValueError as e:
        fail("export is not valid JSON: %s (%s)" % (path.name, e))
    # The same shape check the app's importStateFile and serve.py run.
    if not isinstance(payload, dict) or not isinstance(payload.get("comms"), list):
        fail("not an infrabot state export (no comms list): %s" % path.name)
    return payload


def local_date(iso_utc):
    """UTC instant string -> this machine's local YYYY-MM-DD. '' on garbage."""
    if not iso_utc or not isinstance(iso_utc, str):
        return ""
    try:
        dt = datetime.datetime.fromisoformat(iso_utc.replace("Z", "+00:00"))
    except ValueError:
        return ""
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=datetime.timezone.utc)
    return dt.astimezone().date().isoformat()


def derive_sent(history):
    for entry in history:
        if isinstance(entry, dict) and entry.get("status") == "sent":
            return local_date(entry.get("timestamp"))
    return ""


def derive_went_quiet(history):
    ghosted = [e for e in history
               if isinstance(e, dict) and e.get("status") == "ghosted"]
    for entry in ghosted:
        if entry.get("auto"):
            return local_date(entry.get("timestamp"))
    return local_date(ghosted[0].get("timestamp")) if ghosted else ""


def mechanical_row(comm):
    history = comm.get("statusHistory")
    history = history if isinstance(history, list) else []
    return {
        "App ID": str(comm.get("id", "")),
        "Person": comm.get("person", "") or "",
        "Company": comm.get("company", "") or "",
        "Target": comm.get("target", "") or "",
        "City": comm.get("city", "") or "",
        "App Status": comm.get("status", "") or "",
        "App Section": comm.get("section", "") or "",
        "App Sent": derive_sent(history),
        "App Went Quiet": derive_went_quiet(history),
    }


def read_tracker():
    """Existing rows in file order, plus an App ID index. Fail on any header
    drift or duplicate key: a surprising tracker is a thing to report, never
    to guess through."""
    if not TRACKER.exists():
        return [], {}, False
    with open(TRACKER, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        if reader.fieldnames != HEADER:
            fail("tracker.csv header is not the template header; refusing to "
                 "guess through a hand-restructured tracker. Expected: %s"
                 % ",".join(HEADER))
        rows = [dict(r) for r in reader]
    index = {}
    for i, row in enumerate(rows):
        key = row.get("App ID", "")
        if key in index:
            fail("duplicate App ID %r in tracker.csv; fix the tracker by hand "
                 "before reconciling" % key)
        index[key] = i
    return rows, index, True


def main():
    exports_dir = resolve_exports_dir()
    guard_outside_export_dir(exports_dir, sys.argv[1:])
    export_path = newest_export(exports_dir)
    payload = load_export(export_path)
    rows, index, existed = read_tracker()

    comms = sorted(payload["comms"], key=lambda c: str(c.get("id", "")))
    added = updated = unchanged = 0
    for comm in comms:
        mech = mechanical_row(comm)
        key = mech["App ID"]
        if key in index:
            row = rows[index[key]]
            before = {k: row.get(k, "") for k in mech}
            if before == mech:
                unchanged += 1
            else:
                row.update(mech)  # human fields untouched by construction
                updated += 1
        else:
            new_row = dict(mech)
            for h in HUMAN_FIELDS:
                new_row[h] = ""
            rows.append(new_row)
            index[key] = len(rows) - 1
            added += 1

    carried = len(rows) - added - updated - unchanged

    tmp = TRACKER.with_name(TRACKER.name + ".tmp")
    with open(tmp, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=HEADER, lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)
    os.replace(tmp, TRACKER)

    print("reconciled %s -> %s" % (export_path.name, TRACKER.name))
    print("export dir: %s (%s)" % (
        exports_dir,
        "LPI_EXPORT_DIR" if os.environ.get("LPI_EXPORT_DIR") else "repo-local default"))
    if not existed:
        print("tracker.csv was missing; recreated from the template header")
    print("cards in export: %d | rows added: %d | updated: %d | unchanged: %d "
          "| carried (in tracker, not in export): %d"
          % (len(comms), added, updated, unchanged, carried))


if __name__ == "__main__":
    main()
