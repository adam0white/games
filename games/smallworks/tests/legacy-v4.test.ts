import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { loadGame } from '../src/game/persistence';
import { replayRecordedRun } from '../src/game/replay';

// Real historical exports stay unchanged and playable only in their compatible archive.
const exports = [
  'focused-first-visit-2026-10-15.json',
  'focused-mobile-2026-10-15.json',
  'mentor-ui-play-2026-10-14.json',
  'candidate-play-2026-10-14.json',
  'release-play-2026-10-14.json',
  'final-episode-play-2026-10-14.json',
];
describe('canonical edition archive boundary', () => {
  it.each(exports)('refuses %s without recasting historical people', (name) => {
    const text = readFileSync(`docs/restart/evidence/${name}`, 'utf8');
    const saved = JSON.parse(text);
    expect(() => loadGame(text)).toThrow('Start fresh');
    expect(
      replayRecordedRun(
        { seed: saved.seed, inputs: saved.inputs, provenance: saved.provenance },
        text,
      ).ok,
    ).toBe(false);
  });
});
