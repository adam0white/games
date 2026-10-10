import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import { restoreGame, serializeGame, transition } from '../src/game/engine';
import * as thirteen from '../src/game/engine13';
import * as fourteen from '../src/game/engine14';
import * as fifteen from '../src/game/engine15';
import type { GameInput } from '../src/game/types';
import longRoute from './fixtures/fifteen-long-workshop-route.json';
import ownerRoute from './fixtures/fifteen-owner-return-route.json';
import longBase from './fixtures/fourteen-long-workshop-route.json';
import ownerBase from './fixtures/fourteen-owner-return-route.json';
import ownerSource from './fixtures/owner-thirteen-school-apprentice-route.json';

const hash = (raw: string) => createHash('sha256').update(raw).digest('hex');
function baseStory(owner: boolean) {
  if (!owner) {
    let s = fourteen.createGame(longBase.seed);
    for (const input of longBase.inputs) s = fourteen.transition(s, input as GameInput);
    return fourteen.serializeGame(s);
  }
  let source = thirteen.createGame(ownerSource.seed);
  for (const input of ownerSource.inputs) source = thirteen.transition(source, input as GameInput);
  let s = fourteen.restoreGame(thirteen.serializeGame(source));
  for (const input of ownerBase.inputs) s = fourteen.transition(s, input as GameInput);
  return fourteen.serializeGame(s);
}
for (const [owner, route] of [
  [false, longRoute],
  [true, ownerRoute],
] as const) {
  it(`preserves the actual candidate61a7 engine15 ${owner ? 'owner model completion' : 'stopped watching'} history before continuation`, () => {
    const base = baseStory(owner);
    expect(hash(base)).toBe(route.sourceSha256);
    let historical = fifteen.restoreGame(base);
    for (const input of route.inputs)
      historical = fifteen.transition(historical, input as GameInput);
    const raw = fifteen.serializeGame(historical);
    expect(hash(raw)).toBe(route.sha256);
    expect(historical.inputs).toHaveLength(route.inputCount);
    expect(historical.journal).toHaveLength(route.journalCount);
    expect(fifteen.serializeGame(fifteen.restoreGame(raw))).toBe(raw);
    const current = restoreGame(raw);
    expect(current.people).toEqual(historical.people);
    expect(current.objects).toEqual(historical.objects);
    expect(current.journal).toEqual(historical.journal);
    expect(current.engine3Save).toBe(raw);
    expect(current.engine3InputCount).toBe(route.inputCount);
    const continued = transition(current, { type: 'action', id: 'rest' });
    expect(restoreGame(serializeGame(continued))).toEqual(continued);
  }, 30_000);
}
