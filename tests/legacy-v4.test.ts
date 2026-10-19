import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createGame, currentRules, dispatch, upgradeRules } from '../src/game/engine';
import { loadGame, saveGame } from '../src/game/persistence';
import { LEGACY_PROVENANCE, SAVE_PROVENANCE } from '../src/game/recording';
import { replayRecordedRun } from '../src/game/replay';
import type { Command, GameState } from '../src/game/types';

// Real engine-4 player exports (HF 2.2.1, game 3.0.0-alpha.4), read in place and never edited.
const V4_EXPORTS = [
  ['focused-first-visit-2026-10-15.json', 48],
  ['focused-mobile-2026-10-15.json', 14],
  ['mentor-ui-play-2026-10-14.json', 48],
] as const;
const read = (name: string) => readFileSync(`docs/restart/evidence/${name}`, 'utf8');

/** Every path where two JSON values differ. */
function differences(a: unknown, b: unknown, path = ''): string[] {
  if (JSON.stringify(a) === JSON.stringify(b)) return [];
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return [path];
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  return [...keys].flatMap((k) =>
    differences(
      (a as Record<string, unknown>)[k],
      (b as Record<string, unknown>)[k],
      `${path}.${k}`,
    ),
  );
}

describe('engine-4 saves and exports under engine 5 and HF 2.8.0', () => {
  it.each(V4_EXPORTS)('%s restores as an engine-4 world', (name, inputs) => {
    const state = loadGame(read(name));
    expect(state.schema).toBe('small-works@4');
    expect(state.provenance).toEqual(LEGACY_PROVENANCE);
    expect(state.inputs).toHaveLength(inputs);
    expect(currentRules(state)).toBe(false);
  });

  it.each(V4_EXPORTS)('%s replays exactly under engine-4 rules', (name) => {
    const text = read(name);
    const exported = JSON.parse(text) as GameState;
    const result = replayRecordedRun(
      { seed: exported.seed, inputs: exported.inputs, provenance: exported.provenance },
      text,
    );
    expect(result.ok, result.ok ? '' : result.message).toBe(true);
    if (!result.ok) return;
    // Byte-level: only HF's own engine stamp on each person differs from the 2.2.1 file.
    expect(differences(JSON.parse(text), JSON.parse(result.save)).sort()).toEqual([
      '.people.evan.engine',
      '.people.mum.engine',
      '.people.nora.engine',
      '.people.sam.engine',
    ]);
  });

  it.each(V4_EXPORTS)('%s continues under engine 5 and the whole run still replays', (name, n) => {
    let state = upgradeRules(loadGame(read(name)));
    expect(state.schema).toBe('small-works@5');
    expect(state.provenance).toEqual(SAVE_PROVENANCE);
    expect(state.migratedFrom).toEqual({ engine: 'small-works@4', atInput: n });
    const more: Command[] = [
      { type: 'wait', minutes: 20 },
      { type: 'next-day' },
      { type: 'wait', minutes: 45 },
    ];
    for (const command of more) {
      const result = dispatch(state, command);
      expect(result.ok, result.message).toBe(true);
      state = result.state;
    }
    const save = saveGame(state);
    const reloaded = loadGame(save);
    expect(saveGame(reloaded)).toBe(save);
    const replay = replayRecordedRun(
      {
        seed: state.seed,
        inputs: state.inputs,
        provenance: state.provenance,
        migratedFrom: state.migratedFrom,
      },
      save,
    );
    expect(replay.ok, replay.ok ? '' : replay.message).toBe(true);
  });

  it('keeps engine-4 behaviour for an engine-4 world and refuses mixed provenance', () => {
    const legacy = createGame(42, 'legacy');
    expect(JSON.parse(saveGame(legacy)).provenance).toEqual(LEGACY_PROVENANCE);
    const text = read('focused-mobile-2026-10-15.json');
    const mixed = JSON.parse(text);
    mixed.provenance = { ...SAVE_PROVENANCE };
    expect(() => loadGame(JSON.stringify(mixed))).toThrow();
    const wrongIndex = JSON.parse(saveGame(upgradeRules(loadGame(text))));
    wrongIndex.migratedFrom.atInput = 9999;
    expect(() => loadGame(JSON.stringify(wrongIndex))).toThrow();
  });

  it('still refuses earlier engine-1 to engine-3 exports', () => {
    for (const name of [
      'candidate-play-2026-10-14.json',
      'release-play-2026-10-14.json',
      'final-episode-play-2026-10-14.json',
    ])
      expect(() => loadGame(read(name))).toThrow();
  });
});
