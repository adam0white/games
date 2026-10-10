import { expect, it } from 'vitest';
import { createGame, getView, transition } from '../src/game/engine';

for (const kind of ['bell', 'torch'] as const) {
  it(`keeps Mum’s ${kind} reply specific to its attended physical test`, () => {
    const state = transition(createGame(1701), { type: 'action', id: 'talk-family' });
    const item = state.objects[0];
    if (!item) throw Error('Missing repair object');
    item.form = kind;
    if (kind === 'torch') item.id = 'friend-1';
    state.focusId = item.id;
    item.repaired = true;
    item.checkStarted = state.now;
    const mum = state.people.mum;
    if (!mum) throw Error('Missing Mum');
    // Keep this copy control separate from the opening's prayer schedule.
    mum.activity = null;
    const next = transition(state, { type: 'action', id: 'ask-mum' });
    expect(next).not.toBe(state);
    const words =
      getView(next)
        .currentDialogue?.map((line) => line.text)
        .join(' ') ?? '';
    expect(words.toLowerCase()).toContain(kind === 'bell' ? 'ring' : 'grip');
    expect(words).not.toContain('Leave it on');
    expect(words).not.toContain('Keep it running gently');
    expect(next.objects.find((object) => object.id === item.id)?.verified).toBe(false);
  });
}
