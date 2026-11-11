# Neighbours in the games workspace

The complete Concordia fork is retained here, with the Neighbours app in `neighbours/` and the Python modules in `concordia/`. `LICENSING.md` describes the license boundary. The original public source is recorded in the games registry; the monorepo version targets `/neighbours/` and has not yet been deployed there.

From the monorepo root, install with `pnpm install --frozen-lockfile`. Run the game checks with `pnpm --filter ./games/neighbours run check`. The native, six-resident replay, parity and historical-evidence controls use Python 3.12.13 and `neighbours/native-gm-requirements.txt`; set `PYTHON` to that interpreter and run `pnpm --filter ./games/neighbours run ci:check`. Browser controls use `pnpm --filter alder-quay-neighbours run test:e2e`, with four shards in CI.

`release-metadata.json` pins the source identity and Python bundle digest used in the assembled release. The app build checks the generated Python sources and installed Pyodide against it; changing the Python bundle requires a reviewed update to that metadata. The public six-resident qualification does not establish the retained 206-person research gates or player acceptance.
