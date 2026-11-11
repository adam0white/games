import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import { act, createGame, exportRun, replayRun, view } from '../src/game';
import { NativeFileSelection } from '../src/native-file';

function choose(state: ReturnType<typeof createGame>, label: string) {
  const choice = view(state).choices.find((item) => item.text.includes(label));
  if (!choice) throw new Error(`Missing choice: ${label}`);
  act(state, { choice: choice.id });
}
function fixture() {
  const state = createGame(42);
  choose(state, 'Put the notebook');
  choose(state, 'Hear what');
  choose(state, 'Ask Halil');
  choose(state, 'Fetch Nuri');
  return state;
}
function file(bytes: Uint8Array) {
  return { name: 'meeting.json', size: bytes.byteLength, arrayBuffer: async () => bytes.slice().buffer };
}

// Dropping a Person field, rewriting bytes, or skipping full replay breaks this control.
it('preserves original UTF-8 bytes and complete replay through continued play', async () => {
  const original = fixture();
  const exported = exportRun(original);
  const bytes = new TextEncoder().encode(`\uFEFF${JSON.stringify(exported, null, 2)}\n`);
  const accepted = await new NativeFileSelection().read(file(bytes));
  expect(accepted).not.toBeNull();
  if (!accepted) throw new Error('The valid run was not accepted.');
  expect(accepted.bytes).toEqual(bytes);
  expect(accepted.sha256).toBe(createHash('sha256').update(bytes).digest('hex'));
  expect(accepted.original).toEqual(exported);
  expect(accepted.state).toEqual(original);
  expect(Object.keys(exportRun(accepted.state).archive.current.people)).toEqual([
    'halil',
    'riza',
    'osman',
    'ferda',
    'nephew',
  ]);
  choose(original, 'Hear what');
  choose(accepted.state, 'Hear what');
  choose(original, 'Ask Osman');
  choose(accepted.state, 'Ask Osman');
  expect(exportRun(accepted.state)).toEqual(exportRun(original));
  expect(replayRun(JSON.parse(JSON.stringify(exportRun(accepted.state))))).toEqual(original);
});

// Replacement decoding or JSON-only validation would admit at least one invalid input.
it('refuses malformed bytes and invalid full exports without accepting a meeting', async () => {
  const run = exportRun(fixture());
  const tampered = structuredClone(run);
  tampered.state.remaining++;
  for (const bytes of [
    new Uint8Array([0xff]),
    new TextEncoder().encode('\uFEFF\uFEFF{}'),
    new TextEncoder().encode('{}'),
    new TextEncoder().encode(JSON.stringify({ ...run, edition: 'word-2' })),
    new TextEncoder().encode(JSON.stringify(tampered)),
  ])
    await expect(new NativeFileSelection().read(file(bytes))).rejects.toThrow();
});

// Reading before the cap or trusting declared size admits oversized files.
it('refuses oversized files before reading and checks actual bytes too', async () => {
  let reads = 0;
  const selection = new NativeFileSelection();
  await expect(
    selection.read({
      name: 'large.json',
      size: 16 * 1024 * 1024 + 1,
      arrayBuffer: async () => {
        reads++;
        return new ArrayBuffer(0);
      },
    }),
  ).rejects.toThrow(/16 MiB/);
  expect(reads).toBe(0);
  await expect(
    selection.read({
      name: 'large.json',
      size: 1,
      arrayBuffer: async () => new ArrayBuffer(16 * 1024 * 1024 + 1),
    }),
  ).rejects.toThrow(/16 MiB/);
});

// Removing generation checks would let a superseded read replace accepted play.
it('discards old reads after newer selection, invalid selection, cancel or Resume', async () => {
  const bytes = new TextEncoder().encode(JSON.stringify(exportRun(fixture())));
  const selection = new NativeFileSelection();
  for (const invalidate of [
    () => selection.read(file(bytes)),
    () => selection.read(file(new Uint8Array([0xff]))).catch(() => null),
    () => selection.cancel(),
  ]) {
    let release: (value: ArrayBuffer) => void = () => {};
    const delayed = selection.read({
      name: 'old.json',
      size: bytes.length,
      arrayBuffer: () =>
        new Promise<ArrayBuffer>((resolve) => {
          release = resolve;
        }),
    });
    await invalidate();
    release(bytes.slice().buffer);
    expect(await delayed).toBeNull();
  }
});
