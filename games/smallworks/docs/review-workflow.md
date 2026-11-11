# Reviews

Game work gets a game-design expert review and an independent technical/critical review. Review actual source and a runnable experience. Fix verified findings before asking Adam to play. Reviewers do not accept the player's taste on his behalf.

## Asynchronous Gemini

The personal computer has the Gemini CLI. Run a bounded read-only review from this repository through a retained execution session; continue independent work while it runs. Use `--approval-mode plan`, `--skip-trust`, a scoped prompt and `--output-format text`. Redirect review output and diagnostic stderr into ignored `.review/` files. Never include credentials in arguments, source or reports.

Example:

```sh
gemini --skip-trust --approval-mode plan --model gemini-2.5-flash \
  -p 'Read src/game/engine.ts and src/App.tsx. Review only; no edits or agents. Identify concrete issues in information boundaries, progressive discovery and repair flow. Return at most five prioritized findings.' \
  --output-format text > .review/gemini-code.txt 2> .review/gemini-code.err
```

The orchestration tool launches this with a short initial yield and retains its process session. Inspect its eventual exit and actual output. Dispatch is not a completed review. A quota, authentication or empty-output failure is recorded honestly; do not repeatedly retry unchanged quota failures or block all work on them. Delegate an additional independent reviewer as fallback.

The first default-model attempt on 2026-10-09 failed with zero free-tier quota for gemini-3.1-pro. The gemini-2.5-flash design review completed with exit zero and substantive output; availability can change. Current completion/failure is recorded in HANDOFF.md.

## Review record

Summarize verified findings, repairs and unresolved limits in HANDOFF.md. Keep raw external outputs ignored locally, and keep private PKM originals out of review prompts. No recurring review automation is configured.
