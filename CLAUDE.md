# CLAUDE.md: the law of this repo, for any contributor's coding agent

## What the product is
infrabot is ONE file: `infrabot.html`. No build step, no server required to
open it, no dependencies. `serve.py` is an optional loopback helper for the
state file; the page must work without it. Read the header banner of
`infrabot.html` first: it is the file map, with line ranges per section.

## The syntax gate
Before any pull request:
- `node --check` passes on the script the tests extract from the page
  (`tests/file_map_check.js` and the other checks extract it the same way).
- Every check in `tests/` is green: `node tests/<name>.js` and
  `python3 tests/<name>.py`, run from the repo root.
- `node tests/file_map_check.js --write` recomputes the banner's line ranges
  after any edit that moves lines; then run it again without `--write`.
- GitHub runs this gate on every pull request and every push to main: the
  `checks` job in `.github/workflows/checks.yml`. On a pull request the job
  also measures the title of every non-merge commit the pull request carries
  and fails, naming the commit and its length, on a title over 72 characters.

## One change, one pull request
- One change per PR. Open every PR as a DRAFT. Never merge; a human merges.
- Open an issue for the change first; the PR body says `Closes #N`.

## Where the version is bumped
Every ship that touches `infrabot.html` moves all of these together:
- `APP_VERSION` in the JS of `infrabot.html`
- the version pill in the page header (`.version-pill`)
- the drawer footer line (`INFRABOT vX.Y.Z · ...`)
- the FILE MAP banner's header line, plus a history line in the banner
- a ship entry in `README.md` under "What changed since v0.7.0"

A ship that does not touch `infrabot.html` (the server, the launcher, a
check, the CI job, a doc) moves none of them.

## The PR body
Four sections, in this order: WHAT CHANGED; WHY (with `Closes #N`);
HOW IT WAS TESTED; WHAT COULD BREAK.

## The commit shape
A title of at most 72 characters, a body, and the last line exactly
`Co-Authored-By: Claude`. No session link and no session URL anywhere in a
commit message or a PR body. The route a cloud session posts through can
append a footer carrying a session link after the body it was given, so a
session that opens a pull request reads the body back and deletes any
appended footer carrying a session link before it reports.

## Privacy
- Fixtures are invented: example.com, `.invalid` hosts, made-up companies
  and people, 555 numbers. No real person, company, phone number or address
  anywhere in code, tests, README, commit messages or PR bodies.
- `state/`, `exports/`, `dossier.txt`, `WOODSHOP.md` and `CLAUDE.local.md`
  are gitignored and stay that way. Never commit them, never un-ignore them.

## The API key
The Groq key lives in the browser only (localStorage, stripped from every
export). It is never written to a file, never pasted into a shell command,
never put in a test, a fixture or a commit.

## Models are data
Model configuration is data: the budget and family tables (`VENDOR_BUDGET`,
`SLOT_FAMILIES`; `MODEL_BUDGET` was their earlier name, retired in v0.8.0).
No code branches on a model name; a new model is a data row, never a
conditional.
