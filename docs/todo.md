# The todo list (beads)

One list of open work for the game lab: this repo, human-framework (label `hf`) and the agents' own setup (label `agents`). It was first filled on 2026-11-25 from every project thread, the repo docs and the open pull requests.

It lives in this repo because every thread already clones it. human-framework items carry the `hf` label instead of a second database, so one command shows everything.

## Where the data is

The tracker is [beads](https://github.com/steveyegge/beads), `bd` 1.3 or later (`brew install beads`). Its database is Dolt, stored on the Git remote under `refs/dolt/data` (and a helper branch `__dolt_remote_info__`), not in the files on `main`. So adding or closing an item needs no pull request and no CI run.

`.beads/issues.jsonl` on `main` is a snapshot for reading on GitHub and a fallback for `bd bootstrap`. It can be behind. Refresh it in any pull request with `bd export -o .beads/issues.jsonl`.

`games/neighbours/.beads/` is an older, separate tracker that came with that game's history. Leave it alone.

## Use

```sh
bd bootstrap --yes        # once per fresh clone: fetches the database
bd dolt pull              # before reading
bd ready                  # open items with nothing blocking them
bd list --label needs-adam
bd show lab-xxx
bd create "Title" -p 2 -l lantern -d "What, done when, Source: <thread title or file>"
bd update lab-xxx --claim # take an item
bd close lab-xxx -r "what happened, with the PR number"
bd dolt push              # after any change
```

Set `BEADS_ACTOR=lab-agent` (or the thread's name) so the audit trail does not carry a personal identity.

## Labels

- `needs-adam`: a decision only the owner can make. Keep this list short.
- `needs-person`: someone has to play, listen or read. An agent cannot close it alone.
- Area: `lantern`, `ant-promotion`, `cinderhill`, `crumbwar`, `exile`, `small-games`, `new-games`, `tester`, `infra`, `hf`, `agents`, `ideas`.
- `agent-idea`: proposed by an agent, not asked for.

Priority 1 is next, 4 is someday. Status `in_progress` means a thread owns it now.

## Rules

- Every item names its source: a thread title, a file, or a pull request.
- Say what done looks like when it is not obvious.
- Before filing, search (`bd search <word>`) and add to an existing item when one fits.
- This repo is public. No tester names (use `t1`), no personal details, no credentials. Items that cannot be public stay in the project's private memory.
