# Games consolidation — 2026-11-05

Remaining: two eligible pilot imports, all release gates and live checks, remaining-game imports, two new games. Infrastructure preparation is not a shipped migration. Owner accepts taste after coordinator review.

The owner authorized public `adam0white/games`, MIT code, required `ci`, signed commits, `play.adamwhite.work` on the existing `adamwhite.work` zone and old-host redirects after each new path is verified. The public repo exists. Main requires `ci` and signed commits, enforces protection for administrators and disallows force pushes/deletion. The signed bootstrap is on main. No game import or deploy has occurred.

"Losing saves and progress is totally fine. That's a good direction, keep going."

Old-origin saves are not migrated. New-origin games start fresh without an error. Existing original repositories are retained. Archival requires a separate owner decision; none has been archived here.

## Hosting

`wrangler.jsonc` prepares the inherited static-assets workflow for Worker `games-static` and custom domain `play.adamwhite.work`, under the same account as the existing games. Compatibility date is 2026-11-05. It has no R2, AI, telemetry or other server bindings. Central shelf, identity and lab telemetry remain in HF; no game code enters HF.

Cloudflare zone state read-only: `play.adamwhite.work` DNS query returned an empty list. No route, DNS record, Worker or old-host redirect has been changed by MONO. The domain configuration is prepared, not deployed. Verify the binding and release manifests after the gated deployment, then record actual API/deploy receipts here and in HF HANDOFF.md.

Keep the games' existing Wrangler stack for consolidation. HF's standing cf trial gate requires upload equivalence before adopting cf. Current cf 1.0.0-beta.16 authenticates, but its assets build requires another build integration; converting deployment tooling at cutover would add an unrelated change. The root config inherits the existing asset-only game configuration. No existing Worker binding is overwritten before a verified new bundle.

## Coordination and acceptance

The inventory found 20 listed games plus Island, with 18 independent source repositories and three central hosts. All currently belong to UPKEEP or CLARITY. Murmur and Rope are provisional pilots only; do not snapshot over active changes. Import exact merged refs after confirming no open UPKEEP/CLARITY PR and source readiness. Recheck those directors' STATUS immediately before each import. Subtree imports retain original objects without squash and new signed merge commits.

The owner requested two new shipped games after consolidation, then COMPLETE for coordinator taste review. Drafts are Mooring Hour and Copper Afternoon, based on the top two ideas. They have no implemented game code. Astra wildcard review is pending. Owner taste acceptance and technical release are separate.
