import { exportRun, inspect, restoreRun } from '@adam0white/human-framework';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createGame, dispatch, saveGame } from '../src/game/engine';
import { exportPersonRun, livePersonWords } from '../src/game/hf';
import { loadGame } from '../src/game/persistence';

describe('HF 4.11 live readings', () => {
  it('renders current feelings and learned expectations as words without changing the run', () => {
    let state = createGame(42);
    state = dispatch(state, { type: 'wait', minutes: 30 }).state;
    const person = state.people.sam!;
    const before = saveGame(state);
    const words = livePersonWords(person);
    expect(words.some((line) => line.startsWith('Sam feels'))).toBe(true);
    expect(words.some((line) => line.includes('expects') || line.includes('expectations'))).toBe(
      true,
    );
    expect(words.join(' ')).not.toMatch(/[0-9%]|successRate|valence|intensity/);
    expect(
      renderToStaticMarkup(
        <div>
          {words.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>,
      ),
    ).toContain('Sam feels');
    expect(saveGame(state)).toBe(before);
    expect(livePersonWords(loadGame(before).people.sam!)).toEqual(words);
    const archive = exportPersonRun(person);
    const restored = restoreRun(archive);
    if (!restored.ok) throw Error(JSON.stringify(restored.error));
    const view = inspect(restored.value, {
      perspective: { kind: 'person', observer: 'nora' },
      people: ['sam'],
      select: ['affect', 'expectations'],
    });
    expect(view.ok).toBe(true);
    expect(JSON.stringify(view)).toContain('unobserved');
    expect(exportRun(restored.value).hashes.full).toBe(archive.hashes.full);
  });
});
