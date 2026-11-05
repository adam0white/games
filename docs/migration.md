# Migration and cutover

The original repository remains authoritative until its merged source is imported and the new path is verified. Retain the original repository and deployment. Ask the owner before archiving a repository.

## Source gate

1. Read UPKEEP and CLARITY STATUS and the game's worker status. Record their explicit completion or release evidence. An empty PR list alone does not establish readiness.
2. Query the original repository's open PRs immediately before importing. Wait for any UPKEEP or CLARITY PR to close and merge. Confirm the final tutorial is included in main.
3. Record the full source SHA and published HF version. Import with `git subtree add -S --prefix=games/<slug> <repository> <sha>` without squash. Use `git subtree pull -S` for a later source update.
4. Verify the source SHA is an ancestor of the monorepo head. Check the initial imported tree against the source tree before adapting it. Keep the source SHA in `games.json`.
5. Port assets, manifests, direct routes, browser harness, storage, service worker and lab client. Pin the registry's exact HF version. Existing old-origin saves stay at the old origin; a fresh new-origin start must show no import error.

## Release gate

Run the affected game's checks and the root lane before signing. Shared configuration changes require all game checks. The complete bundle must build, even when only one game changed. Resolve a hosted Codex review at the final PR head and obtain exact-head green CI before normal merge. Recheck the coordination ledger for a later HOLD. Wait for successful main CI at the actual merge commit, then use the root deployment command.

The root deployment command builds a fresh detached checkout and verifies every game's live manifest. A dry run is packaging evidence only. Record the actual Worker version, custom domain or route receipt, merge SHA and each direct release URL in HANDOFF.md and the corresponding HF handoff. Do not redirect an old host yet.

## Live game checks

Use an isolated project test browser. Record which checks used a new profile and which reused that profile. Test desktop and phone layouts. Keep synthetic telemetry bounded and label it synthetic.

| Check | Required evidence |
| --- | --- |
| Direct release | HTTPS 200 without redirect; exact deployed commit; `dirty:false`; expected game, source, HF, app and lab stamps |
| Fresh start | No imported save or error; first meaningful action reachable; first recording notice visible |
| Return visit | New-origin progress restores; notice follows the documented once-per-origin policy |
| Consent off | Ordinary play works; no recording upload before consent |
| Consent on | A bounded synthetic run reaches the central lab; verify the receipt or stored run identifier, not only a request being sent |
| Privacy | Opt-out persists; DNT and GPC follow the lab policy; stop recording when consent is withdrawn |
| Shelf | Open the central shelf and return to the new game path; any persona transfer is accepted by the actual client and central origin rules |
| Replay | Export a current run; replay reproduces the pinned result without a model or live telemetry dependency |
| Analytics | One configured beacon; successful live RUM receipt; no CSP rejection |
| Isolation | Visiting a second game does not share a game save or worker controller; direct file routes keep the correct prefix |

## Redirect gate

Record the verified live commit before enabling an old-host alias. The redirect preflight must validate the old origin, source ancestry, live release and route configuration. A new alias must still point at the unchanged game that was verified live. Retain that verification lineage when later normal releases update an already active alias.

Update the central site listing and `game-releases.json` to the verified path in the combined HF PR. Add the old-host route only after the new path is verified. Verify the old root, a direct route and a query string. For games with an old service worker, verify the update script unregisters it and moves existing windows to the correct new path. Check a returning browser with the old worker installed.

Keep redirects temporary during cutover. For rollback, remove the old-host Worker route before disabling the alias handler. Restore the retained original deployment if needed. Record actual rollback results. Do not delete the old repository or its deployment as part of migration.
