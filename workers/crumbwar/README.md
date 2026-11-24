# Crumbwar

A many-player ant game, served at `play.adamwhite.work/crumbwar/`. Four colonies carry food home and bite each other. One Durable Object runs each room. "Crumbwar" is a working name.

**Owner decision (2026-11-23).** The owner asked for this game: massively multiplayer, built on Cloudflare with Durable Objects, with bots to fill rooms. That is the owner decision that `AGENTS.md` requires for multiplayer and for new server infrastructure. It covers this Worker only. The page is unlisted and `noindex`; outside publishing stays paused.

This is a technical base. The design choices and their costs are in [DECISIONS.md](DECISIONS.md). Art and game feel come later.

## Layout

- `public/crumbwar/` is the page. `shared/` holds the code that the page and the server both run: constants, movement, the wire format and prediction.
- `src/sim.mjs` is the game. It is pure and seeded. `src/bots.mjs` drives bots. `src/net.mjs` writes messages.
- `src/room.mjs` is the `Room` Durable Object. `src/directory.mjs` is the `Directory` Durable Object, one per region, which picks a room. `src/index.mjs` is the Worker.
- `test/` are unit tests. `loadtest/bench.mjs` times the room pipeline in Node. `loadtest/load.mjs` connects simulated clients to a running server.

## Commands

Run these from `workers/crumbwar`.

```sh
node --test test/                       # unit tests
node loadtest/bench.mjs                 # tick cost and bytes per client, in Node
echo "LOADTEST_KEY=$(openssl rand -hex 16)" > .dev.vars
npx wrangler dev --port 8799            # local server at http://localhost:8799/crumbwar/
node loadtest/load.mjs --url ws://localhost:8799/crumbwar/play --key <key> --clients 20 --seconds 15
npx wrangler deploy                     # deploy (first deployed 2026-11-23)
```

The production `LOADTEST_KEY` is a Worker secret. A copy is in the owner's macOS Keychain: `security find-generic-password -a crumbwar -s crumbwar-loadtest-key -w`.

```sh
node loadtest/load.mjs --url wss://play.adamwhite.work --key <key> --clients 60 --seconds 60
```

`GET /crumbwar/api/metrics?lt=<key>` returns hourly totals for the last 14 days, per region: joins, refusals and kicks by reason, room-minutes, peak people. See [DECISIONS.md](DECISIONS.md), "Metrics read path".

**Before a deploy that changes `public/crumbwar/shared/` or `src/net.mjs`:** a test fails until you decide whether old pages and new rooms can still play together. If they cannot, raise `PROTO` in `shared/config.js`, then record the new fingerprint the test prints. The Worker then reloads old pages and stops sending people to rooms still running the old code. See [DECISIONS.md](DECISIONS.md), "Version check".

A load test names its own room (`--room`, sent as `lt-<name>`), may raise the room's cap (`--cap`) and may overload the room on purpose (`--burn`). Both need the `LOADTEST_KEY` secret. `lt-` rooms never appear in the directory, so no player is sent to one. `GET /crumbwar/api/status?lt=<key>&room=<name>` returns a room's counters, and without `room` it lists the region's rooms.

First-time hint: `public/crumbwar/client.js` loads the shared kit hint (`/kit/hint.js`, kind `stick`, key `crumbwar:hint`) with a dynamic import that does nothing if the file is missing. The static site serves that file, so deploy the static site first; until then the hint does not show, and in `wrangler dev` it never shows. The kit styles itself with a constructed stylesheet, so the page's `style-src 'self'` policy needs no change.

Lab recording: the page loads the shared kit recorder (`/kit/lab.js`) the same way, and records nothing where it is missing. The notice and the off switch are on the start card. What is recorded and when is in [DECISIONS.md](DECISIONS.md) under "Telemetry". The slug `crumbwar` is in `LAB_PROTOTYPES` in human-framework.

## Roll back

Watching it: `GET /crumbwar/api/health` lists rooms that were lost or ran slow in the last 6 hours, and the workflow `.github/workflows/crumbwar-watch.yml` turns new entries into a GitHub issue labelled `crumbwar-alert`. Joins are limited to 60 a minute per address. Both are described in [DECISIONS.md](DECISIONS.md) under "Alerts" and "Rooms and scaling".

`npx wrangler rollback` returns to the previous version. To remove the game, run `npx wrangler delete`: the routes go with the Worker, and `/crumbwar/` then falls through to the static site, which has no such path. Rooms store nothing, so there is no data to migrate or restore. A deploy does not close open sockets at once: an occupied room can run the old code for minutes (seen 2026-11-24). Pages and rooms of another `PROTO` are kept apart by the version check. A rollback past the version check removes it.
