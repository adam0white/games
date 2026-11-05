# Games consolidation — 2026-11-05

Remaining: published path-aware lab artifacts, exact pilot CI/review and live checks; remaining-game imports; two new games. Pilot source and tutorial synchronization is complete locally. Infrastructure preparation is not a shipped migration. Owner accepts taste after coordinator review.

The owner authorized public `adam0white/games`, MIT code, required `ci`, signed commits, `play.adamwhite.work` on the existing `adamwhite.work` zone and old-host redirects after each new path is verified. The public repo exists. Main requires `ci` and signed commits, enforces protection for administrators and disallows force pushes/deletion. The signed bootstrap is on main. Rope and Hearsay histories are imported without squash on draft PR #1. Both game engines pin HF 4.17.0. No production deployment has occurred.

"Losing saves and progress is totally fine. That's a good direction, keep going."

Old-origin saves are not migrated. New-origin games start fresh without an error. Existing original repositories are retained. Archival requires a separate owner decision; none has been archived here.

## Hosting

`wrangler.jsonc` prepares the inherited static-assets workflow for Worker `games-static` and custom domain `play.adamwhite.work`, under the same account as the existing games. Compatibility date is 2026-11-05. It has no R2, AI, telemetry or other server bindings. Central shelf, identity and lab telemetry remain in HF; no game code enters HF.

Cloudflare zone state read-only: `play.adamwhite.work` DNS query returned an empty list. No route, DNS record, Worker or old-host redirect has been changed by MONO. The domain configuration is prepared, not deployed. Verify the binding and release manifests after the gated deployment, then record actual API/deploy receipts here and in HF HANDOFF.md.

Keep the games' existing Wrangler stack for consolidation. HF's standing cf trial gate requires upload equivalence before adopting cf. Current cf 1.0.0-beta.16 authenticates, but its assets build requires another build integration; converting deployment tooling at cutover would add an unrelated change. The root config inherits the existing asset-only game configuration. No existing Worker binding is overwritten before a verified new bundle.

## Coordination and acceptance

The inventory found 20 listed games plus Island, with 18 independent source repositories and three central hosts. All currently belong to UPKEEP or CLARITY. Rope and Hearsay were imported from exact refs while neither had an open PR. Their later UPKEEP and CLARITY work must be merged and synchronized before cutover. Import exact merged refs after confirming no open UPKEEP/CLARITY PR and source readiness. Recheck those directors' STATUS immediately before each import. Subtree imports retain original objects without squash and new signed merge commits.

The owner requested two new shipped games after consolidation, then COMPLETE for coordinator taste review. Drafts are Mooring Hour and Copper Afternoon, based on the top two ideas. They have no implemented game code. Astra wildcard review conditionally retained both concepts; the required physical rules are now in their design documents. The physical loop and supported HF traces remain unproven. Owner taste acceptance and technical release are separate.

## Pilot validation checkpoint

The assembled build passed; a Wrangler dry run packaged 35 assets and the thin shelf/redirect handler with only the ASSETS binding. Redirect activation remains disabled in code and configuration. Play root will open the existing central shelf. No route has been applied.

Both games opened in isolated Chromium at desktop and phone sizes with scoped assets, manifests and CSP. Rope’s worker did not control Hearsay. Central traffic was blocked during this engineering check, so connected recording, shelf and successful analytics receipt remain unverified. The old lab artifacts request the root release manifest and reject the new play origin; client 0.5.16 with the reviewed HF source is required before release.

The first full CI run exposed missing browser installation and stale test-fixture paths/versions. The browser runtime step is now declared per game. Rope’s preparation controls use a matching current portable source; Hearsay’s browser harness uses the new base and origin. The latter has 29 of 31 affected local browser controls passing; two preserved shelf controls still require the new client. This is not a green complete CI claim.

At PR head `8c8638d`, Rope's complete hosted game suite passed. Hearsay passed 111 of 113 tests; only those two shelf controls failed. Both subsequently passed in an isolated check using a hashed local snapshot of the updated client source. That candidate is not a released artifact. The old Hearsay kit excludes the new client from its peer range; adopt the actual immutable client 0.5.16 and kit 0.5.33 together after publication. Keep the two controls intact.

Signed subtree merge `a85a01a` includes merged Rope source `9989ee495f40e371ec20e3c3d83a068b2783fe57` from upstream PR #21. Conflicts retained the root lockfile, path ports, shared deployment gate and dynamic fixture-version checks. Its frozen install, both game lint/types, 23 affected Rope tests, 19 root controls and full bundle build passed. The shared package manager and Wrangler now match that source's 12.16.1 and 4.157.0 pins. Rope's CLARITY tutorial and explicit source handoff remain pending.

Redirect preflight now validates live manifests, ancestry, initial activation and later upgrades. Independent review changed legacy routes to exact `host/*` zone routes, retaining the original custom-domain bindings. The raw upload package shortcut was removed. A local Chromium fixture verified unregister and cross-origin navigation. All redirect flags remain false, configuration remains play-only, and the 35-asset Wrangler dry run made no route change.

## Hearsay source synchronization checkpoint

Hearsay UPKEEP source `2fb948bbb6d3ea779e31e93b6dadc32d032085a7` is being imported without squash. The original repository remains authoritative until CLARITY explicitly releases the tutorial. This is preparation, not cutover. The merge retains shared deployment, path and storage isolation, the current browser harness, and the HF3 archive. The upstream game-level HF3 alias is omitted under the root alias gate; the game engine remains pinned to HF 4.17.0. The root owns the lockfile and workspace configuration.

With Node 26.12.0 and pnpm 12.16.1, the frozen workspace install, root lane (19 tests), both game lint/typecheck lanes, and Hearsay current-adapter/guidance tests (14 tests) passed. Both game lanes emitted lint warnings. The full Hearsay suite was not run: two preserved shelf controls await published client 0.5.16 and kit 0.5.33. No deployment or redirect change is authorized by this checkpoint.

## Final pilot source synchronization

The signed subtree merges now preserve Hearsay source `f6737badd333a7e889a8a9abb91653aae04b370a` and Rope source `c69a43cd9237d397ed6ea21031f783932c86046e`, including their merged CLARITY tutorials. Neither source had an open PR at synchronization. Independent public manifest reads confirm both exact source releases on their original hosts with HF 4.17.0 and `dirty:false`.

The complete local bundle and 19 root controls passed after synchronization. Rope's eight tutorial controls and two prefixed practice paths passed; Hearsay's prefixed first-minute paths passed. Rope's preserved native new-origin start still fails because its old client rejects the play persona origin. Practice mode does not establish native start, shelf or recording. Keep that failure and Hearsay's preserved shelf controls until actual immutable client 0.5.16 and kit 0.5.33 are adopted. A local candidate pair is not publication.

HF's first combined PR contains the exact dated owner approval and approved direction. Its qualified local checkpoint passed 1,802 tests, but source CI, review, immutable artifact publication and central deployment remain separate gates. The later cast-role/private-ingest preparation is excluded from that first release. No play route, redirect or repository archival has been applied by MONO.
