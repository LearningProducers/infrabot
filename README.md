# infrabot

infrabot is a single-file HTML console for outreach, built so your AI agent
does the researching and drafting and you do the sending. It runs on your
machine: one HTML file, one small Python server, no build step, no
dependencies beyond Python 3 and a browser. This README describes v0.13.1.

## What it does

The app has four tabs.

- **OVERVIEW.** A world map with your cities pinned, live clocks, today's
  counters, and your profile (used in the messages you share).
- **NETWORK.** The people you know and the in-person events you are
  considering, behind five pills: CONTACTS, ACQUAINTANCES, CANDIDATES,
  SELECTED and ATTENDED, each with its count; SKIPPED rooms sit folded at
  the foot of CANDIDATES, and a city filter narrows every events pill.
  Every person carries a tier. A CONTACT is someone you have had a live
  conversation with: the full card (company, website, email, CHANNEL,
  city, intel), the gold mark, a COUNCIL button and an ACQUAINTANCE
  button that moves them to that tier. An ACQUAINTANCE is someone you
  met in a room: a name, a CHANNEL, the rooms you met them at and notes,
  with a CONTACT button that moves them up; the people you type into an
  event's MET box (one name per line or comma separated; saving links
  each name to the person of that name or creates one) start as
  acquaintances, and every tier change is recorded with its time. ATTENDED
  shows the rooms whose date falls in the current month and ACQUAINTANCES
  the people met this month; earlier ones leave their pill untouched and
  appear under ROOMS and MET in that month's report.
- **COMMUNICATIONS.** Draft cards, one per message. A card carries the
  person, the company, the address, the discovery trail (how they showed
  up), a one-line hook (why they would care and what you are handing them),
  the subject and the body. The hook is written by your agent or typed in
  the card's form; the page never generates it. Cards move DRAFT to
  SCHEDULED to SENT (and REPLIED); a sent card with no reply after five days
  is marked WENT QUIET automatically; CLOSED is your call. A filter row
  switches between drafts, the pipeline, the archive and monthly reports,
  and EXPORT STATE / IMPORT STATE buttons sit under the same tab.
- **VAULT.** Insights you want to keep, and an artifact ledger of the things
  you made.

There is no send button. You copy a message into your own email client and
send it yourself, then flip the card's status.

**The crew.** Optional. Save a Groq API key in the COMMUNICATIONS tab and two
model slots come alive. Click COUNCIL on a card and the slots read the draft
and revise it; each slot keeps a short memory of its last exchanges. With a
key present the page reads Groq's model catalog at load, after a key save, and
whenever a model id stops answering, then fills each slot from a model family
(an OpenAI open-weight model for slot A, a Qwen model for slot B): slot A's
preferred id if it is live, else the newest live model in the family, else the
newest from a vendor other than the other slot's, else the slot reads NO
SECOND VOICE. No model id is pinned in the code, so a retired model never
strands a slot. The labels say what is actually running. The prompt the crew
judges by lives inside `infrabot.html`; edit it to impose your own definition
of send-worthy. The key stays in your browser's storage and is never exported.

**Data.** The settings drawer has EXPORT JSON (the whole state), IMPORT JSON
(a full replace), IMPORT DRAFTS (adds draft cards from a text file of
prospect blocks, never replaces), STATUS MIRROR (a text summary of your
SENT and SCHEDULED decisions), and WIPE ALL DATA.

## How to run it

```bash
git clone https://github.com/LearningProducers/infrabot.git
cd infrabot
python3 serve.py
```

Then open http://127.0.0.1:8119/infrabot.html. `python3 serve.py --detach`
starts the server in the background (no terminal window has to stay open)
and `python3 serve.py --stop` ends it; the log and PID sit under `state/`.

The two double-click launchers, `open-infrabot.command` (start detached,
open the browser, exit) and `stop-infrabot.command`, expect the clone at
`~/lpi/infrabot`; they read the `INFRABOT_DIR` environment variable when it
is set, and otherwise serve that path. From a clone anywhere else, use the
`serve.py` commands above. A second launcher start while the server runs
only opens the browser; a second `--detach` says it is already serving and
starts nothing.

The server keeps your state in `state/infrabot_state.json` and the browser
keeps its own copy. With the server down the app keeps working from browser
storage; when the server returns, each record syncs by whichever copy is
newer, and a record the server file no longer carries is dropped from the
tab unless the tab created it in the meantime or has it open for editing.

Network calls, all of them: Groq's API, only when you use the crew; and
GitHub, only when the launcher fast-forwards a clean `main` checkout to the
newest build before serving (it says so in one line when it cannot, and
never forces). Everything else is loopback on your machine.

On open, when the state changed since the last export, the app writes a
state export through the server into a repo-local `exports/` folder (with
the server down it falls back to a browser download). To send exports
somewhere else, set `LPI_EXPORT_DIR` in the env file the launcher sources,
`~/lpi/infrabot.local.env`; `reconcile.command` refuses an export dir
outside the repo by default and names the override flag.

## Onboard your agent

Paste this into your coding agent from the repo root:

> You are my agent for infrabot, a single-file local-first outreach console
> in this repo. Read the header banner of infrabot.html first; it is the
> file map and the law of the codebase. The loop: you research prospects and
> write them into my browser dashboard as cards; I review and send every
> message by hand; nothing auto-sends, ever. reconcile.py turns my exports
> into tracker.csv, the master record. If a WOODSHOP.md exists in this
> clone, treat it as my queue: when I ask for improvements, work from it.
> Confirm you have read the banner, then ask me for my first prospecting
> criteria.

**The block format your agent writes.** IMPORT DRAFTS reads a plain text
file. Each prospect is a block that opens with a `PROSPECT <n>` header line
(the text after the separator becomes the card's city), then labeled lines,
then the body under a `Body:` label:

```
PROSPECT 1 - <city>
Company: <company>
Target: <person>
Email: <address>
Source URL: <where you found them>
Website: <their site>
Subject: <subject line>
Hook: <one line: why they would care, what you are handing them>
Body: <the message, as many lines as it takes>
```

A block with no body, or with neither an address nor a URL, is skipped and
counted, never carded. A `dossier.txt` placed beside the page is read the
same way at load; it is gitignored.

**The state door, for an agent that reads and writes cards itself.** While
`serve.py` runs, the whole state is one JSON document behind two loopback
calls, the same two the page uses. `GET http://127.0.0.1:8119/state`
returns it with a `rev` number (404 with `"rev": 0` before the first sync).
`POST /state` with a body of `{"baseRev": <that rev>, "state": <the whole
document, comms and network lists included>}` replaces it and answers
`{"rev": <rev + 1>}`; a `baseRev` that is no longer current answers 409 with
the current `rev` and writes nothing, so read again, re-apply your change,
and post again. Every accepted write first copies the prior file under
`state/backups/`. Change only the records you mean to change, keep every
other key as read, and stamp each changed record's `updatedAt` with the
current time, because an open tab merges the file back per record and the
newer copy wins. A note onto one card, end to end:

```bash
curl -s http://127.0.0.1:8119/state > s.json
python3 - <<'EOF'
import json, datetime
d = json.load(open("s.json")); rev = d.pop("rev")
for p in d["network"]:
    if p["name"] == "Ada Example":
        p["notes"] = "met at the demo night; wants the deck"
        p["updatedAt"] = datetime.datetime.utcnow().isoformat(timespec="milliseconds") + "Z"
json.dump({"baseRev": rev, "state": d}, open("post.json", "w"))
EOF
curl -s -X POST http://127.0.0.1:8119/state --data @post.json
```

## The loop

1. **Your agent researches and drafts.** It writes the blocks; you import
   them, or it drops them in `dossier.txt`. The cards are filled before you
   open the app.
2. **You open the app and judge.** Fire the crew on a draft if you want a
   second opinion, and revise until it is send-worthy.
3. **You send by hand**, from your own email client, and flip the status.
4. **One double-click closes the books.** Reload (the app exports its
   changed state, key stripped), then double-click `reconcile.command`:
   `tracker.csv` updates to match, statuses and dates, nothing stale. The
   Notes column is yours; the tool never writes it.

## The workshop pattern

Keep a `WOODSHOP.md` in your clone. It is gitignored, so it never leaves your
machine. Queue what you want the app to do next and point your agent at it.

## Tests

Every check in `tests/` runs standalone from the repo root against the real
`infrabot.html` and the real launcher scripts, with invented fixtures:
`node tests/<name>.js` or `python3 tests/<name>.py`.

## What changed since v0.7.0

- **v0.8.0.** Crew slots resolve from Groq's live catalog; no model id is
  pinned in the code; labels derive from the running id.
- **v0.9.0.** The hook line: a card carries one line saying why the person
  would care and what you are handing them, written by your agent or typed
  in the form, never generated in the browser.
- **v0.10.0.** The drop rule: a record the server file no longer carries is
  dropped from the tab unless the tab created it since its last sync, so a
  restored state file holds.
- **v0.11.0.** The met links: an event's MET box takes names and links or
  creates contacts; contacts carry a CHANNEL field and the rooms they were
  met at; one status act behind the event form's select and the card's
  buttons.
- **v0.12.0.** The room pills: CONTACTS, CANDIDATES, SELECTED and ATTENDED
  on the NETWORK bar, SKIPPED folded, the city filter on every events pill;
  ATTENDED shows this month's rooms and earlier rooms print in their
  month's report under ROOMS.
- **v0.13.0.** The tier: every person is an ACQUAINTANCE or a CONTACT
  (the gold mark is the contact mark), a tier move on each card, a TIER
  select on the contact form, the ACQUAINTANCES pill through the same
  month window, people met printing in the month report under MET.
- **v0.13.1.** The tier words: an acquaintance card carries no tier
  label; the tier move on a card reads CONTACT or ACQUAINTANCE, the tier
  it moves the person to; the TIER select's note follows.

## Licenses

This repository is MIT licensed (see `LICENSE`). Groq's API and the models
served through it belong to their providers under their own terms; nothing
here claims otherwise.
