infrabot is a single-file HTML console for founders prospecting like-minded professionals, built so your AI agents do the researching and you do the sending.

## Quick start

1. Get the files  
   Green **Code** button → **Download ZIP**  
   (or use the `git clone` below)

2. Unzip → double-click `open-infrabot.command`  
   *or* run these commands:

```bash
git clone https://github.com/LearningProducers/infrabot.git
cd infrabot
python3 serve.py
```

Open http://127.0.0.1:8119/infrabot.html, or just double-click `open-infrabot.command`. No dependencies beyond Python 3. Everything runs on your machine and stays there; the only network calls are the Groq API calls you configure.

State exports land in a repo-local `exports/` folder by default. To send them somewhere else, set `LPI_EXPORT_DIR` in a local env file that the launcher sources. Note: if `LPI_EXPORT_DIR` points outside this repo, `reconcile.command` refuses to run by default. This keeps private data out of the tracked tracker.csv. The refusal message names the override flag if you truly want it.

## Onboard your agent
Paste this into your coding agent (Claude Code or similar) from
the repo root:

> You are my agent for infrabot, a single-file local-first
> outreach console in this repo. Read the header banner of
> infrabot.html first; it is the file map and the law of the
> codebase. The loop: you research prospects and write them into
> my browser dashboard as cards via the import format described
> in the banner; I review and send every message by hand; nothing
> auto-sends, ever. reconcile.py turns my exports into
> tracker.csv, the master CRM. If a WOODSHOP.md exists in this
> clone, treat it as my queue: when I ask for improvements, work
> from it. Confirm you have read the banner, then ask me for my
> first prospecting criteria.

## The workshop pattern
Keep a WOODSHOP.md in your clone. It is gitignored, so it never
leaves your machine. Queue what you want the app to do next, and
point your agent at it when you ask for improvements. The public
repo shows shipped results; the workshop stays yours. You will
notice WOODSHOP.md already listed in this repo's .gitignore: the
slot is reserved for you.

## How the loop runs

1. **Your agent researches and drafts.** A coding-agent session (Claude Code, in LPI's case) prospects, writes the outreach drafts, and feeds them into the app. The communication boxes are filled before you ever open it.
2. **You open the app and judge.** Double-click `open-infrabot.command`. The council fires on each draft, and you revise until it's send-worthy.
3. **You send by hand.** From your own email client. The app never auto-sends; there is no send button to press. That's a design decision, not a missing feature.
4. **One double-click closes the books.** Flip the card's status, reload, and the app exports its full state as JSON. Double-click `reconcile.command` and `tracker.csv` updates to match: statuses, dates, nothing stale. The Notes column is yours; the tool never writes it.

## Three things to know

**The build is governed.** Every version of this app ships against a QA runbook: gates, harnesses, and a change ledger. The runbook is private; the discipline is in the code.

**Models get retired without your permission.** The AI council runs on Groq's free tier, and free-tier models get deprecated whenever Groq decides. When a council seat dies, check your active models in the Groq console and swap it, or tell your agent to swap it.

**The heuristics are yours to overwrite.** The council judges drafts by LPI's outreach heuristics, encoded in the council prompt inside `infrabot.html`. That prompt is your tunable surface: edit it, or have your agent edit it, to impose your own definition of send-worthy.
