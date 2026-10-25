import { gunzipSync } from 'node:zlib';
import { createLab } from '@adam0white/lab-client';
import { afterEach, expect, it, vi } from 'vitest';
import { queueFeedback } from '../src/ui/feedback';

afterEach(() => vi.unstubAllGlobals());
it('submits literal choices through the released transport with linked and recording-off privacy', async () => {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  };
  vi.stubGlobal('localStorage', storage);
  vi.stubGlobal('sessionStorage', storage);
  vi.stubGlobal('location', {
    hostname: 'repair.adamwhite.work',
    origin: 'https://repair.adamwhite.work',
  });
  vi.stubGlobal('navigator', {});
  const envelopes: Record<string, unknown>[] = [];
  const network = vi.fn(async (_url: unknown, init: RequestInit) => {
    const body = new Uint8Array(await (init.body as Blob).arrayBuffer());
    envelopes.push(JSON.parse(gunzipSync(body).toString()));
    return Response.json({ ok: true, id: 'local-control' });
  });
  vi.stubGlobal('fetch', network);
  const lab = createLab({ game: 'repair', build: { a: 'local-control' } });
  const getRun = () => ({ seed: 416, inputs: [] });
  expect(network).not.toHaveBeenCalled();
  const result = await queueFeedback({
    lab,
    getRun,
    note: '',
    verdict: '',
    name: '',
    feedbackLabel: 'stopping',
  });
  expect(result).toContain('Sent. Your note is stored.');
  const note = envelopes.find((e) => e.kind === 'note');
  const run = envelopes.find((e) => e.kind === 'run');
  expect(note?.data).toEqual({ note: "I'm stopping" });
  if (!run) throw new Error('Missing linked run');
  expect(JSON.parse((run.data as { text: string }).text)).toEqual(getRun());
  expect(note?.player).toBe(run?.player);
  expect(note?.runId).toBe(run?.runId);
  lab.setTelemetryOff(true);
  envelopes.length = 0;
  await queueFeedback({ lab, getRun, note: '', verdict: '', name: '', feedbackLabel: 'confused' });
  expect(envelopes).toHaveLength(1);
  expect(envelopes[0]?.note).toBe("I'm confused");
  expect(envelopes[0]?.run).toEqual({ feedbackOnly: true });
  expect(envelopes[0]?.player).toBeUndefined();
  expect(lab.telemetryOn).toBe(false);
});
