import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createGame, getView, restoreGame, serializeGame, transition } from '../src/game/engine';
import { archetypes, chooseVisible, runPlayer } from './support/player-archetypes';

describe('exposed-choice simulated player policies', () => {
  it('chooses by visible words and intent, with stable ties and no hidden oracle', () => {
    const view = getView(createGame());
    view.actions = [
      { id: 'opaque-a', label: 'Inspect the lamp' },
      { id: 'opaque-b', label: 'Move on', intent: 'leave' },
      { id: 'opaque-c', label: 'Talk with Mum' },
    ];
    view.shelf = [];
    expect(chooseVisible(view, 'skip-everything', new Map())).toEqual({
      type: 'action',
      id: 'opaque-b',
    });
    expect(chooseVisible(view, 'social-first', new Map())).toEqual({
      type: 'action',
      id: 'opaque-c',
    });
    expect(chooseVisible(view, 'completionist', new Map())).toEqual({
      type: 'action',
      id: 'opaque-a',
    });
    view.actions = [
      { id: 'a', label: 'Wait a while' },
      { id: 'b', label: 'Wait until the check finishes in 5 minutes' },
    ];
    expect(chooseVisible(view, 'impatient', new Map())).toEqual({ type: 'action', id: 'b' });
    view.actions = [
      { id: 'opaque-next', label: 'Begin the next school break' },
      { id: 'opaque-day', label: 'Wait until tomorrow morning', intent: 'leave' },
    ];
    expect(chooseVisible(view, 'continuation-seeker', new Map())).toEqual({
      type: 'action',
      id: 'opaque-next',
    });
    view.actions = [];
    expect(chooseVisible(view, 'impatient', new Map())).toBeNull();
  });
  it('bounds work and rejects unbounded runs', () => {
    expect(() => runPlayer('impatient', 17, 2001)).toThrow();
    expect(runPlayer('impatient', 17, 0).actions).toEqual([]);
  });
  for (const archetype of archetypes) {
    it(`replays actual visible inputs deterministically: ${archetype}`, () => {
      const seed = 1701;
      const initial = process.env.PLAYER_STORY
        ? restoreGame(readFileSync(process.env.PLAYER_STORY, 'utf8'))
        : undefined;
      const run = runPlayer(archetype, seed, 100, initial);
      expect(run).toEqual(runPlayer(archetype, seed, 100, initial));
      let state = initial ?? createGame(seed);
      for (const action of run.actions) {
        const view = getView(state);
        expect(
          action.input.type === 'action'
            ? view.actions.some((a) => a.id === action.input.id)
            : view.shelf.some((o) => o.id === action.input.id),
        ).toBe(true);
        state = transition(state, action.input);
      }
      expect(serializeGame(state)).toEqual(run.finalExport);
      expect(serializeGame(restoreGame(run.finalExport))).toEqual(run.finalExport);
      if (process.env.PLAYER_REPORT_DIR) {
        mkdirSync(process.env.PLAYER_REPORT_DIR, { recursive: true });
        writeFileSync(
          resolve(process.env.PLAYER_REPORT_DIR, `${archetype}.json`),
          JSON.stringify(run, null, 2),
        );
      }
    }, 30000);
  }
});
