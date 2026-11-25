// Shared pieces for a page check that proves play recording (kit/lab.js) without reaching the real lab.
//
//   const lab = await answerLab(context, origin);   one per browser context, before the first goto
//   await allowLocalSend(context);                    pages on 127.0.0.1 send only with hf-lab-send-localhost
//   page.goto(withAgent(url))                         ?labRunSource=agent marks every record runSource: 'agent'
//
// answerLab answers the lab endpoint itself, so no check reaches human.adamwhite.work, whatever a page does.
import assert from 'node:assert/strict';
import { gunzipSync } from 'node:zlib';

export const LAB_ORIGIN = 'https://human.adamwhite.work';
export const LAB_NOTICE = /The game lab records play, links it to other lab play on this device, and keeps it for 180 days\. Turn recording off in the pause menu\./;
export const sleep = ms => new Promise(done => setTimeout(done, ms));

export async function answerLab(context, pageOrigin) {
  const lab = { sent: [], tried: 0 };
  await context.route(LAB_ORIGIN + '/**', async route => {
    const request = route.request();
    const cors = { 'access-control-allow-origin': pageOrigin, 'access-control-allow-methods': 'POST, OPTIONS', 'access-control-allow-headers': 'Content-Type' };
    lab.tried++;
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    if (new URL(request.url()).pathname !== '/lab/api/linked') return route.fulfill({ status: 404, headers: cors, body: 'no' });
    let record;
    try { record = JSON.parse(gunzipSync(request.postDataBuffer()).toString()); } catch { return route.fulfill({ status: 400, headers: cors, body: 'bad' }); }
    lab.sent.push(record);
    return route.fulfill({ status: 200, headers: { ...cors, 'content-type': 'application/json' }, body: JSON.stringify({ ok: true, id: record.id }) });
  });
  return lab;
}

// Runs in every page of the context, before its scripts.
export const allowLocalSend = context => context.addInitScript(() => {
  try { if (location.protocol === 'http:') localStorage.setItem('hf-lab-send-localhost', '1'); } catch {}
});

export const withAgent = url => { const u = new URL(url); u.searchParams.set('labRunSource', 'agent'); return u.toString(); };

export const runRecords = (lab, game) => lab.sent.filter(r => r.game === game && r.kind === 'run' && r.data.outcome !== null);
export const eventRecords = (lab, game) => lab.sent.filter(r => r.game === game && r.kind === 'events');

export async function waitForRuns(lab, game, count, ms = 8000) {
  for (let t = 0; t < ms && runRecords(lab, game).filter(r => r.data.outcome !== 'between-runs').length < count; t += 50) await sleep(50);
  return runRecords(lab, game);
}

// The notice is in the page text and visible on the card the player sees before Play.
export async function assertNotice(page, playSelector) {
  const notice = page.locator('.lab-notice').first();
  await notice.waitFor({ state: 'visible', timeout: 5000 });
  assert.match(await notice.textContent(), LAB_NOTICE, 'the recording notice is shown before Play');
  if (playSelector) {
    const [n, p] = await Promise.all([notice.boundingBox(), page.locator(playSelector).first().boundingBox()]);
    assert.ok(n && p && n.y + n.height <= page.viewportSize().height + 1, 'the notice is inside the first screen, not scrolled away');
  }
}

// One finished run was recorded under the right name, marked as an agent run, with its events record.
export function assertRun(lab, game, { outcomes, count = 1, summaryKeys = [] } = {}) {
  const runs = runRecords(lab, game).filter(r => r.data.outcome !== 'between-runs');
  assert.ok(runs.length >= count, `${game}: ${count} run record(s) sent, got ${runs.length}`);
  const last = runs.at(-1);
  assert.equal(last.v, 2); assert.equal(last.game, game); assert.equal(last.data.format, 'kit-lab/1');
  assert.equal(last.runSource, 'agent', 'the agent flag marks the record');
  assert.ok(last.data.started <= last.data.ended);
  if (outcomes) assert.ok(outcomes.includes(last.data.outcome), `${game}: outcome ${last.data.outcome} is one of ${outcomes}`);
  for (const key of summaryKeys) assert.ok(last.data.summary && key in last.data.summary, `${game}: summary has ${key}`);
  assert.ok(eventRecords(lab, game).some(r => r.runId === last.runId), `${game}: the events record for the dashboard`);
  assert.equal(lab.sent.filter(r => r.game !== game).length, 0, 'nothing is sent under another name');
  return last;
}

// Nothing a person typed or a friend's code is in what was sent.
export function assertNoLeak(lab, forbidden) {
  const text = JSON.stringify(lab.sent);
  for (const word of forbidden) assert.ok(!text.includes(word), `${word} is not sent to the lab`);
}

// Turn recording off in the pause card, play on, and check that nothing more is sent and the player id is gone.
export async function assertOffSendsNothing(page, lab, game, { toggle = '.lab-toggle input', play }) {
  const before = lab.sent.length;
  await page.uncheck(toggle);
  assert.equal(await page.evaluate(() => localStorage.getItem('hf-lab-recording-off')), '1');
  assert.equal(await page.evaluate(() => localStorage.getItem('hf-lab-player')), null, 'the player id is deleted');
  await play();
  await sleep(1200);
  assert.equal(lab.sent.length, before, `${game}: nothing is sent while recording is off`);
}
