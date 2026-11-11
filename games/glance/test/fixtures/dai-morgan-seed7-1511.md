# Dai's Morgan question fixture

`dai-morgan-seed7-1511.json.gz` is the complete current-engine export from Glance source `5e34d4838801871f1271d9775d27ad7c915b36be`, using published Human Framework `4.17.0`, seed 7, no inputs, and native replay frontier minute 1511. It was generated in the game directory with Node 26.12.0:

```js
const state = replay(7, [], 1511);
const bytes = gzipSync(JSON.stringify(exportRun(state, '4.17.0')), { level: 9 });
```

SHA-256 of the gzip bytes: `fa056d78a89355b450cc209449d0d23745689b769874f7ba7141807c203a6a37`. The focused test regenerates and compares the complete uncompressed export bytes, proves the question first appears at this frontier, and checks that the original minute 1520 has the same undiscovered and available-talk conditions. The UI test still loads the stored run through the real current replay validation.
