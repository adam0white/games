import { expect, it, vi } from 'vitest';
import { PUBLIC_EDITION } from '../../src/sim/edition.ts';
import { load, save } from '../../src/sim/game.ts';
import { CastSession, type Shelf } from '../../src/ui/cast-session.ts';

it('starts and reloads a public-origin fresh episode without reading or changing an unavailable person shelf', async () => {
  vi.stubGlobal('location', { origin: 'https://valley.adamwhite.work' });
  const calls: string[] = [];
  const forbidden = (name: string): never => {
    calls.push(name);
    throw new Error('Occupied incompatible shelf must remain untouched');
  };
  const shelf: Shelf = {
    get ready() {
      return forbidden('ready');
    },
    get enabled() {
      return forbidden('enabled');
    },
    setEnabled() {
      forbidden('enable');
    },
    async request<T>(): Promise<T> {
      return forbidden('request');
    },
  };
  const lab = {
    setPersonaRecording() {},
    allowPersonaRecording() {},
    personaRecordingAllowed: false,
    build() {
      return {};
    },
  };
  try {
    const session = new CastSession(lab, shelf);
    const g = await session.fresh(7, false, PUBLIC_EDITION);
    await session.activate(g);
    expect(session.localOnly).toBe(true);
    expect(g.cast?.inputs).toEqual([]);
    await session.checkpoint(true);
    await session.alternative('hf.cast.yusuf.well');
    expect(calls).toEqual([]);
    const restored = load(JSON.parse(JSON.stringify(save(g))));
    await session.loaded(restored, session.metadata());
    expect(session.localOnly).toBe(true);
    expect(calls).toEqual([]);
    await session.fresh(8, false, PUBLIC_EDITION);
    expect(calls).toEqual([]);
  } finally {
    vi.unstubAllGlobals();
  }
});
