// Controlled localhost source check; never an existing-owner-profile admission.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, appendFileSync } from 'node:fs';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const url = process.env.FOREIGN_FILE_URL;
const input = process.env.FOREIGN_FILE_INPUT;
const evidence = process.env.FOREIGN_FILE_EVIDENCE;
assert(url && input && evidence, 'Provide task URL, exact full input and exclusive evidence output.');
assert(['127.0.0.1', 'localhost'].includes(new URL(url).hostname), 'Controlled loopback only.');
writeFileSync(evidence, '', { flag: 'wx', mode: 0o600 });
const file = readFileSync(input, 'utf8');
const selected = JSON.parse(file);
assert.equal(Object.keys(selected.people).length, 5);
assert.deepEqual(selected.castSources, []);
const protectedKeys = ['small-works-cast-local-v2', 'small-works-cast-outcomes-v1', 'small-works-source-journal-v2', `small-works-canonical-intro-${selected.seed}`, 'unrelated-owner-key', 'hf-persona-opt-in'];
const owner = JSON.stringify({ state: file, started: true, continuity: { runId: 'occupied-owner', fileSources: [], heads: [], fileOrigin: false } });
const sentinels = [owner, 'occupied-outcome', JSON.stringify([{ runId: 'occupied-owner', unique: 'source-journal' }]), 'skipped', 'keep', '0'];
const browser = await chromium.launch({ headless: true });
appendFileSync(evidence, `${JSON.stringify({ kind: 'owned-process-inventory-at-launch', operator: process.pid, children: execFileSync('ps', ['-axo', 'pid,ppid,args'], { encoding: 'utf8' }).split('\n').filter(line => Number(line.trim().split(/\s+/)[1]) === process.pid) })}\n`);
let preserve = false;
function record(value) { appendFileSync(evidence, `${JSON.stringify(value)}\n`); }
async function close(context) {
  try {
    for (const page of context.pages()) {
      const pending = await page.evaluate(async () => {
        if (!(await indexedDB.databases()).some(d => d.name === 'hf-lab-pending')) return { exists: false, count: 0 };
        const request = indexedDB.open('hf-lab-pending');
        const db = await new Promise((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
        try { return { exists: true, count: await new Promise((resolve, reject) => { const r = db.transaction('pieces').objectStore('pieces').count(); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); }) }; }
        finally { db.close(); }
      });
      record({ kind: 'before-context-close', url: page.url(), pending });
      assert.equal(pending.count, 0, 'Preserve unknown/nonempty recording queue; never clear it.');
    }
    await context.close();
  } catch (error) { preserve = true; record({ kind: 'CLEANUP_BLOCKED_PRESERVE_BROWSER', error: String(error) }); throw error; }
}
async function occupied(nativeFresh = false) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.route('**/foreign-source-setup', route => route.fulfill({ contentType: 'text/html', body: '<title>Source setup</title>' }));
  await page.goto(new URL('/foreign-source-setup', url).href);
  const setup = await page.evaluate(async ({ keys, values, nativeFresh }) => {
    if (localStorage.length) throw new Error('Nonpristine task origin before sentinel writes.');
    let facts;
    if (nativeFresh) { const { createGame, saveGame } = await import('/src/game/engine.ts'); const state = createGame(42); facts = { seed: state.seed, people: Object.keys(state.people), rng: state.rng, inputs: state.inputs, peopleSnapshots: JSON.parse(saveGame(state)).people }; values[0] = JSON.stringify({ state: saveGame(state), started: true, continuity: { runId: 'source-public-fresh42', fileSources: [], heads: [], fileOrigin: false } }); }
    keys.forEach((key, i) => localStorage.setItem(key, values[i]));
    return facts;
  }, { keys: protectedKeys, values: sentinels, nativeFresh });
  if (setup) record({ kind: 'normal-public-createGame42-before-setup', setup });
  await page.addInitScript(({ keys }) => {
    const get = Storage.prototype.getItem, set = Storage.prototype.setItem, remove = Storage.prototype.removeItem;
    window.foreignBoundary = { reads: [], writes: [], shelf: 0 };
    window.readOwnerSentinels = () => keys.map(key => get.call(localStorage, key));
    Storage.prototype.getItem = function(key) { if (this === localStorage && (keys.includes(key) || key.startsWith('small-works-canonical-intro-'))) window.foreignBoundary.reads.push(key); return get.call(this, key); };
    Storage.prototype.setItem = function(key, value) { if (this === localStorage && (keys.includes(key) || key.startsWith('small-works-canonical-intro-'))) window.foreignBoundary.writes.push(key); return set.call(this, key, value); };
    Storage.prototype.removeItem = function(key) { if (this === localStorage && keys.includes(key)) window.foreignBoundary.writes.push(key); return remove.call(this, key); };
  }, { keys: protectedKeys });
  await page.route('**/*lab-client*.js*', async route => {
    const response = await route.fetch(); const text = await response.text();
    await route.fulfill({ response, body: text.replace('function personaChannel() {', 'function personaChannel() { window.foreignBoundary.shelf++;') });
  });
  page.on('request', r => { if (r.url().startsWith('http') && new URL(r.url()).origin !== new URL(url).origin) record({ kind: 'external-request', method: r.method(), url: r.url() }); });
  return { context, page };
}
let downloadIndex = 0;
async function download(page) {
  const waiting = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download this game file', exact: true }).click();
  const d = await waiting, stream = await d.createReadStream(), chunks = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  const bytes = Buffer.concat(chunks); record({ kind: 'download', bytes: bytes.length });
  if (process.env.FOREIGN_FILE_DOWNLOAD) writeFileSync(`${process.env.FOREIGN_FILE_DOWNLOAD}.${downloadIndex++}.json`, bytes, { flag: 'wx', mode: 0o600 });
  return JSON.parse(bytes.toString());
}
try {
  if (!process.env.FOREIGN_FILE_NATIVE_ONLY) {
  const overlap = await occupied();
  try {
    const page = overlap.page;
    await page.goto(new URL('?file=1', url).href);
    await page.getByLabel('Open a workshop file', { exact: true }).waitFor();
    const fileB = await page.evaluate(async text => { const { loadGame, saveGame, dispatch } = await import('/src/game/engine.ts'); const state = loadGame(text); const result = dispatch(state, { type: 'verify', jobId: state.selectedJobId, condition: 'movement' }); if (!result.ok) throw Error(result.message); return JSON.stringify({ ...JSON.parse(saveGame(result.state)), castSources: [] }); }, file);
    record({ kind: 'overlap-valid-B-derived-through-public-Carry', file: JSON.parse(fileB) });
    async function holdA() {
      await page.evaluate(() => { const actual = File.prototype.text; window.slowReadStarted = false; File.prototype.text = function() { const read = actual.call(this); if (this.name !== 'slow-A.json') return read; window.slowReadStarted = true; return read.then(text => new Promise(resolve => { window.releaseSlowA = () => resolve(text); })); }; });
      await page.getByLabel('Open a workshop file', { exact: true }).setInputFiles({ name: 'slow-A.json', mimeType: 'application/json', buffer: Buffer.from(file) });
      await page.waitForFunction(() => typeof window.releaseSlowA === 'function');
    }
    async function pickB() { await page.getByLabel('Open a workshop file', { exact: true }).setInputFiles({ name: 'B.json', mimeType: 'application/json', buffer: Buffer.from(fileB) }); await page.getByRole('button', { name: 'Resume', exact: true }).click(); await page.getByRole('button', { name: 'Menu', exact: true }).click(); }
    async function releaseA() { await page.evaluate(async () => { window.releaseSlowA(); await new Promise(resolve => setTimeout(resolve, 100)); }); }
    await holdA(); await pickB();
    const identityB = await page.evaluate(async () => (await import('/src/continuity.ts')).continuity.runId);
    await releaseA();
    const identityAfterA = await page.evaluate(async () => (await import('/src/continuity.ts')).continuity.runId);
    record({ kind: 'overlap-A-after-B-identities', identityB, identityAfterA });
    assert.equal(identityAfterA, identityB, 'Stale A must not mutate B continuity after its delayed read.');
    assert.deepEqual(await download(page), JSON.parse(fileB), 'B visible state and continuity stay paired after A resolves.');
    await page.getByRole('button', { name: 'Close file session', exact: true }).click();
    await page.getByLabel('Open a workshop file', { exact: true }).waitFor();
    await page.reload(); await page.getByLabel('Open a workshop file', { exact: true }).waitFor();
    await holdA(); await pickB();
    await page.getByRole('button', { name: 'Close file session', exact: true }).click();
    await page.getByLabel('Open a workshop file', { exact: true }).waitFor();
    await releaseA();
    assert.equal(await page.getByLabel('Open a workshop file', { exact: true }).count(), 1, 'Close must invalidate pending A and stay at chooser.');
    const closed = await page.evaluate(async () => (await import('/src/continuity.ts')).continuity.isStarted); assert.equal(closed, false);
    await page.reload(); await page.getByLabel('Open a workshop file', { exact: true }).waitFor();
    await holdA();
    await page.getByLabel('Open a workshop file', { exact: true }).setInputFiles({ name: 'bad-later.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ ...selected, castSources: { unsupported: true } })) });
    await page.getByRole('alert').waitFor(); const errorB = await page.getByRole('alert').innerText(); await releaseA();
    assert.equal(await page.getByLabel('Open a workshop file', { exact: true }).count(), 1, 'Rejected later selection invalidates earlier A.'); assert.equal(await page.getByRole('alert').innerText(), errorB);
    assert.deepEqual(await page.evaluate(() => window.readOwnerSentinels()), sentinels);
    record({ kind: 'overlap-B-identity-close-and-rejected-later', PASS: true });
  } finally { await close(overlap.context); }
  const { context, page } = await occupied();
  try {
    await page.goto(new URL('?file=1&lab=1', url).href);
    await page.locator('h1').first().waitFor();
    const boundary = await page.evaluate(() => window.foreignBoundary);
    record({ kind: 'startup-boundary', boundary });
    assert.deepEqual(boundary, { reads: [], writes: [], shelf: 0 }, 'Foreign entry must precede native/guide reads and Shelf construction.');
    const picker = page.getByLabel('Open a workshop file', { exact: true });
    for (const [name, sources] of [['bad-object', { lost: true }], ['nonempty', [{ source: 'unsupported' }]], ['oversize', ['x'.repeat(1_000_001)]]]) {
      await picker.setInputFiles({ name: `${name}.json`, mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ ...selected, castSources: sources })) });
      await page.getByRole('alert').waitFor();
      assert.equal(await picker.count(), 1, 'Refused source archive keeps chooser.');
      record({ kind: 'unsupported-file-refused', name });
    }
    await picker.setInputFiles({ name: 'workshop.json', mimeType: 'application/json', buffer: Buffer.from(file) });
    await page.getByRole('button', { name: 'Resume', exact: true }).click();
    await page.getByRole('button', { name: 'Menu', exact: true }).click();
    const first = await download(page);
    assert.deepEqual(first, selected, 'Actual full public load/export retains every field and all five people.');
    await page.getByRole('button', { name: 'Resume', exact: true }).click();
    // The guide's ordinary use test dispatches the source-backed15-minute Carry.
    await page.getByRole('button', { name: /^Carry.*15 min$/ }).click();
    await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: true }); document.dispatchEvent(new Event('visibilitychange')); window.dispatchEvent(new Event('pagehide')); });
    await page.waitForTimeout(100);
    await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: false }); window.dispatchEvent(new Event('pageshow')); });
    await page.getByRole('button', { name: 'Menu', exact: true }).click();
    const after = await download(page);
    const verified = await page.evaluate(async ({ text, exported }) => {
      const { loadGame, saveGame, dispatch } = await import('/src/game/engine.ts');
      const { replayRecordedRun } = await import('/src/game/replay.ts');
      const { continuity } = await import('/src/continuity.ts');
      const before = loadGame(text), actual = loadGame(JSON.stringify(exported));
      let expected = dispatch(before, { type: 'verify', jobId: before.selectedJobId, condition: 'movement' }).state;
      expected = dispatch(expected, { type: 'pause-chapter' }).state;
      expected = dispatch(expected, { type: 'resume-chapter' }).state;
      const replay = replayRecordedRun({ seed: actual.seed, inputs: actual.inputs, provenance: actual.provenance, migratedFrom: actual.migratedFrom, openingPeople: actual.openingPeople, castChapter: actual.castChapter }, saveGame(actual));
      return { exact: saveGame(actual) === saveGame(expected), replay, sources: exported.castSources, owner: window.readOwnerSentinels(), boundary: window.foreignBoundary, heads: continuity.heads };
    }, { text: file, exported: after });
    assert(verified.exact, 'Complete same-input save equality, including people/RNG/clock.'); assert(verified.replay.ok, JSON.stringify(verified.replay)); assert.deepEqual(verified.sources, []); assert.deepEqual(verified.heads, []); assert.deepEqual(verified.owner, sentinels); assert.deepEqual(verified.boundary, { reads: [], writes: [], shelf: 0 });
    await page.getByRole('button', { name: 'Verify the recorded replay', exact: true }).click();
    await page.getByText(/produced this exact workshop state/).waitFor();
    await page.getByRole('button', { name: 'Close file session', exact: true }).click();
    await page.getByLabel('Open a workshop file', { exact: true }).waitFor();
    assert.deepEqual(await page.evaluate(() => window.readOwnerSentinels()), sentinels);
    record({ kind: 'foreign-full-state-replay-preservation', PASS: true, people: Object.keys(after.people), inputs: after.inputs });
  } finally { await close(context); }
  }
  const normal = await occupied(true);
  try {
    await normal.page.goto(new URL('?lab=1', url).href);
    await normal.page.getByRole('button', { name: 'Resume', exact: true }).click();
    await normal.page.getByRole('button', { name: /^Carry.*15 min$/ }).click();
    await normal.page.evaluate(async () => { const { continuity } = await import('/src/continuity.ts'); window.dispatchEvent(new Event('pagehide')); await continuity.depart(); });
    const observed = await normal.page.evaluate(async () => { const { continuity } = await import('/src/continuity.ts'); return { status: continuity.status, started: continuity.isStarted, boundary: window.foreignBoundary, native: JSON.parse(window.readOwnerSentinels()[0]), journal: JSON.parse(window.readOwnerSentinels()[2]) }; });
    const fullNative = await normal.page.evaluate(async saved => { const { createGame, dispatch, loadGame, saveGame } = await import('/src/game/engine.ts'); const { replayRecordedRun } = await import('/src/game/replay.ts'); let expected = createGame(42); expected = dispatch(expected, { type: 'verify', jobId: expected.selectedJobId, condition: 'movement' }).state; expected = dispatch(expected, { type: 'pause-chapter' }).state; const actual = loadGame(saved.state); return { exact: saveGame(actual) === saveGame(expected), replay: replayRecordedRun({ seed: actual.seed, inputs: actual.inputs, provenance: actual.provenance, migratedFrom: actual.migratedFrom, openingPeople: actual.openingPeople, castChapter: actual.castChapter }, saveGame(actual)) }; }, observed.native);
    record({ kind: 'normal-native-observation', observed, fullNative });
    assert(fullNative.exact); assert(fullNative.replay.ok, JSON.stringify(fullNative.replay));
    assert(observed.boundary.shelf > 0); assert(observed.boundary.writes.includes(protectedKeys[0])); assert(observed.native.state.includes('pause-chapter')); if (observed.journal.length === 1) { assert.equal(observed.status, 'Error: persona: unsupported health condition'); assert.deepEqual(observed.journal, JSON.parse(sentinels[2])); record({ kind: 'native-projection-limit', status: observed.status, journalUnchanged: true, qualification: 'Same publiccreateGame42 control on immutable5e5b261 has this exact refusal; no shared publication is proved.' }); } else assert(observed.journal.length > 1);
    record({ kind: 'normal-native-persistence-and-full-replay-control', PASS: true, sharedCheckpointPublication: observed.journal.length > 1 });
  } finally { await close(normal.context); }
} catch (error) { record({ kind: 'FAIL', error: String(error), stack: error.stack }); throw error; }
finally { if (!preserve) await browser.close(); else { console.error('Preserve browser and contexts: cleanup needs full queue backup or zero readback.'); await new Promise(() => {}); } }
