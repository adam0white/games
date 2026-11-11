# MIGRATE — current owner goal, 2026-11-10

Remaining: obtain fresh exact-head PR review and CI, deploy the merged Glance fix and all eighteen games, activate and verify old-host redirects, update the central shelf, and finish archive/storage evidence. Automatic Actions deployment also needs the owner-provided secret; its exact setup is in README. New-game prototypes wait. The migration pace is no longer one step per day.

Owner direction dated 2026-11-11, verbatim: "I need you to prioritize the migration to monorepo, which will allow me to move this workload entirely to cloud, freeing us from storage concerns here, and freeing storage for other things here."

Cloud workflow is prepared in `.github/workflows/deploy.yml`; it is not evidence of a successful Actions deployment. The owner must add `CLOUDFLARE_API_TOKEN` as described in README. The agent must not handle credentials. `docs/cloud-readiness.md` lists remaining HF Mac assumptions and proposed replacements. No original repository has been archived by MIGRATE and no original checkout has been deleted.

The completion target is each requested game live with a clean exact green-main release, current replay, retained history and notices, one npm HF version, path CI, and working old-host redirects. The owner retains archive decisions and secret entry. Record each game's actual outcome; imported source and a passing build are preparation. Earlier prototype and pending-pilot entries below are historical and do not override this goal.


## SDK publication and final integration — 2026-11-11

HF PR126 merged as `7605561564998230d2632fb8209f7c6a902d9e09` after exact-head clear review and green CI; merged-main CI42976945997, Bench and CodeQL passed. Signed public client0.5.18 and kit0.5.35 releases retain the qualified source tree. All eight assets and 68 tar members were verified; separate root public downloads and signed-tag checks agree. Games now pin this pair, including the active nested Neighbours app. Signed file-adapter candidate `205a81fb` passed 45 facade controls, nine typechecks/scoped lint checks, nine actual-route queue controls and Word unshared-note/explicit-recording controls against the public packages. Root integration independently passed the same 45 facade controls and all 32 infrastructure controls. The clean complete build, hosted review/CI, deployment and cutover remain pending. Client18 requires preservation mode for deferred recording and scopes remembered feedback names by game. The nine lazy file facades preserve zero Lab initialization on idle file pages; the SDK deferred mode separately protects feedback after a client is created. An unshared file note must not deliver old recordings. The Neighbours copy guard refuses mismatched outer/nested HF/client/kit pins before replacing build output. Game engines remain npm HF4.17.0; the SDK's existing npm HF3.0 coarse-life dependency is separate and disclosed.

The initial draft6152c234 complete Linux build, both required Lefthand Linux/macOS browser jobs and all four Neighbours browser shards passed. These are preliminary platform receipts, not final integrated-head review or deployment.

## Final CI repairs — 2026-11-11

Word browser controls now explicitly opt in before recording assertions. Days tests recorded restart on an isolated non-local origin, since localhost intentionally disables recording. Neighbours orders the SDK pagehide listener before host retirement after deferred opt-in. Its real-navigation control proves request ordering; the pending-export control compares a new complete upload to a changed full replay, and the pending-reply control retains its original cancellation and structural assertions plus a distinct upload. Independent review is clear within those bounds. Snapshots overlapping a busy SDK request and asynchronous delivery after actual unload remain unqualified. The six cloud lock helpers and all 33 root controls pass; all eighteen games still need final exact-head hosted gates and production checks.

A later hosted run exposed a Days WebKit route-teardown race and a Smoke held-pointer race. Days now waits for its owned routes before teardown, with manifest assertions and caps unchanged. Smoke keeps neighbour label/status nodes connected while updating their text; a real held-pointer control requires a rendered update between press and release and passes across four browser/layout profiles. Scoped checks and the 33 root controls pass; fresh exact-head hosted review and CI remain required.

## Migration batch preparation — 2026-11-10

Glance PR4 merged normally as `e581cc0`; its exact-main CI passed. The five-second test cap and exact assertions remain. This branch adds full histories for Small Works, Valley, Murmur, Stairwell and Pass. Current local suites passed 420, 31, 162, 227 and 141 tests respectively; Murmur has three disclosed gated skips. Pass's locked Node26 timing controls passed 17 tests at unchanged five-second caps. Retired engine-specific tests remain identifiable as historical; long-week/performance, actual-death and peer-journey gaps are not newly qualified by this migration.

All nine imported games now pin client0.5.17/kit0.5.34 public GitHub artifacts from signed green HF main `33ed47e`. All eight public release assets and 68 tar members were hash-verified. The queue fix binds retries to their original game, preserves foreign bytes and retains the shared capacity bound. Kit only admits the corrected peer version. No npm publication, central update, live game deployment or existing-tab refresh follows from publication alone.

The first hosted batch run passed build, tools, Hearsay, Rope, Stairwell, Valley and Glance, but Pass hit eight five-second timeouts. Its test command now uses one worker to avoid competing CPU-bound files; all 33 tests in the six affected files pass locally with unchanged assertions and caps. The current synthetic feedback export correctly labels its freshly created HF4 run as 4.17.0. Hosted requalification is required. Public ancestry checks for all five new source heads are recorded in `docs/migration-lineage.md`.

Root lane passed 23 tests and the clean nine-game assembled build passed with these SDK pins. Exact-head hosted review/CI, merged-main CI, deployment and direct live release/replay/redirect checks remain. All registry redirects are still disabled. Original source repositories and checkouts remain; unique local evidence and the Mac daily scheduler are additional retention conditions. Other requested imports continue in separate worker branches.

---

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

## Rope final viewport release synchronization

CLARITY released Rope PR23 after normal merge to `c563ac3c03b0798ca69dc12711fa1469b31aadad`, exact main CI42129167429 success, normal deployment e02ab4a2-f52c-4799-bdaa-9b942f420d5c and matching clean HF4.17 live release. The final owner matrix covered phone portrait480/500/501/520/690, compact landscape, desktop, default/DNT, actual reply/Skip/replay and enlarged headers. No open source PR was returned at synchronization.

This unsquashed subtree sync preserves the final CSS, public evidence and complete upstream first-minute script. The script is adapted only to the prefixed play origin/local path, including its real replay popup. The registry records the exact source. Root19 controls, Rope lint/types and script syntax passed; existing lint warnings remain. Full final game checks and native new-origin matrix still await actual immutable client16/kit33 adoption. No pilot deployment, redirect or archival is implied.

## Published SDK adoption, 2026-11-05

Both pilots now pin the actual public lab-client0.5.16 and lab-kit0.5.33 GitHub artifacts from signed HF843f76fcd6ce6dd1a579ddcb01e316b8e2623964. Downloaded tarball SHA256 values are c8a4162f48aa9ecd96933f80bc985c369e597434ce76492613c092ec4e1e66b9 and50a37c231dcee44c7eb6c9ca6544f1d742434b776e6eb8215702c8e9ffce7f30. Strict frozen installation passes. Every public release member was independently verified. Games still use exactly HF4.17.0; the SDK's legacy decoder alias is separate.

Hearsay controls now test the qualified Voice reader as available, and retain an explicit blocked-preparation/skip preservation negative. Production admission and ownership gates are unchanged. Redirect preflight can reconstruct a historical lab version from either the original committed vendor archive or the exact public artifact URL. It rejects mismatched tag/file versions and other hosts or URL suffixes.

Rope's browser matrix serves local assets under the intended play origin for both native and practice entries. The initial localhost practice run failed WebKit's actual analytics CORS check; that raw failure is retained privately. The corrected origin run is a predeployment browser control, not live production delivery. Actual play-origin shelf, recording, RUM and stored-object recovery remain cutover gates. No old host redirects or repositories have been archived.

## First play deployment and analytics correction, 2026-11-05

The first deployment used signed main c8dafba9526bbe3d04fbf4bc096669245c008518 after CI run 42137025365 passed. Cloudflare Worker `games-static` version 9135efe0-9c89-448d-bfc9-af6ec55b1007 serves the production custom domain `play.adamwhite.work` in the `adamwhite.work` zone. The custom-domain ID is 9538ef3577ebc3eeb15283ea08e65d2ff8ce773c. Cloudflare created its proxied DNS record. Both direct HTTPS path manifests matched the clean build. The deployment wrapper exited 1 because its immediate readback hit a stale negative DNS answer; the normal Wrangler upload and trigger deployment had succeeded. Later TLS readbacks used the address returned by public DNS. Normal resolution subsequently recovered for both paths, and the temporary test connection tunnel was closed. No second upload was used to conceal that failure.

Live Chromium and WebKit then exposed two analytics snippets: the manual source snippet and the zone's automatic injection. The manual endpoint returned 404/CORS. This change removes only the manual snippets. Analytics now depends on the existing enabled zone rule, which includes every hostname and path. Its site token is 16c78483308e46519c2eb1ab552fe0d2 and ruleset is 5abe77fa-21be-466c-addc-074cbe5087ac. Other sites keep their existing zone configuration. CSP permits the injected script, the same-origin RUM endpoint and the manual endpoint.

After the correction deploys, verify one injected snippet and a real successful RUM response at each game path. Complete native, shelf, recording, replay and file checks before enabling redirects. The first live browser attempt stopped at the duplicate-snippet assertion; it is a negative receipt, not gameplay acceptance. Both legacy hosts still serve their original deployments. No original repository is archived.


## Full migration candidate, 2026-11-11

All 18 registry games now retain unsquashed original history. Nine remaining imports follow PR5: Warren, Commonstead, Child, Neighbours, Lefthand, Days, Word, Smoke and Island. The source inventory is in `docs/migration-lineage.md`. Full per-game local checks and actual current export/replay controls were completed during import; exact integrated-head hosted checks, production and redirects remain. No original repository was archived or source directory deleted.

PR5 merged normally as `90517cc289e00403cbadfeb58190d6489947069e` after clear exact-head review and green PR CI. Its main CI is running. Production still serves the previous three-game release. The director will deploy the corrected complete release after its exact green main rather than ship the intermediate bundle with confirmed file-startup queue retries. The new Actions workflow requires the owner-entered `CLOUDFLARE_API_TOKEN`; README gives the exact setup. Existing CLI account access was confirmed without reading or recording credentials.

Root configuration is the only active workspace authority. Obsolete game-root lockfiles and workspace configurations are removed; every original byte remains in retained source history. Game instructions now point to portable root preparation/check commands. Neighbours requires pinned Python and declared native requirements; browsers are installed through the registry preparation command. Optional historical research harnesses remain explicitly outside build/CI and are audited in `docs/cloud-readiness.md`.

Review found automatic same-game queue retries on file pages, two games sharing a remembered feedback-name key, unconditional service-worker error caching and unverified downloaded Godot tools. Corrections are in progress and must be verified before production. Builds receive a credential-stripped environment; this is inheritance control, not an OS sandbox. Only final Wrangler upload receives the deployment environment. Small Works alias activation now enforces zone mode so its retained `/experiments` archive cannot be swallowed by a catch-all Worker route.
