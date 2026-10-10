import { type ChangeEvent, type ReactNode, useEffect, useRef, useState } from 'react';
import { HistoricalRuntimeLoadError, restoreBrowserStory } from '../game/browser-replay';
import { createGame, serializeGame } from '../game/current-engine';
import type { GameState } from '../game/types';
import { readStory, writeStory } from './storage';

function downloadOriginal(raw: string) {
  const url = URL.createObjectURL(new Blob([raw], { type: 'application/json' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'stored-repair-story.json';
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
/** Saved story loading owns the screen until validated; no placeholder gameplay can overwrite it. */
export function StoryBootstrap({
  render,
}: {
  render: (game: GameState, warning?: string | null) => ReactNode;
}) {
  const [stored] = useState(readStory);
  const [game, setGame] = useState<GameState | null>(() => (stored ? null : createGame()));
  const [warning, setWarning] = useState<string | null>(null);
  const [status, setStatus] = useState('Opening your saved story…');
  const [retry, setRetry] = useState(0);
  const [failed, setFailed] = useState(false);
  const [runtimeLoadFailed, setRuntimeLoadFailed] = useState(false);
  const [confirmNew, setConfirmNew] = useState(false);
  const generation = useRef(0);
  useEffect(() => {
    if (!stored) return;
    // Explicit retries reuse the original bytes rather than a placeholder state.
    const attempt = retry;
    let active = true;
    const request = ++generation.current;
    setStatus(attempt ? 'Trying your saved story again…' : 'Opening your saved story…');
    setFailed(false);
    setRuntimeLoadFailed(false);
    restoreBrowserStory(stored)
      .then((restored) => {
        if (active && request === generation.current) setGame(restored);
      })
      .catch((error: unknown) => {
        if (!active || request !== generation.current) return;
        setFailed(true);
        setRuntimeLoadFailed(error instanceof HistoricalRuntimeLoadError);
        setStatus(
          error instanceof HistoricalRuntimeLoadError
            ? 'The code for this saved story could not be loaded. Check your connection and retry. Your stored story is unchanged.'
            : 'This stored story could not be validated. You can export its original file or open another story. Your stored story is unchanged.',
        );
      });
    return () => {
      active = false;
    };
  }, [stored, retry]);
  async function importStory(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const request = ++generation.current;
    if (file.size > 8_000_000) {
      setFailed(true);
      setRuntimeLoadFailed(false);
      setStatus('That file is larger than the 8 MB story limit. Your stored story is unchanged.');
      return;
    }
    setFailed(false);
    setRuntimeLoadFailed(false);
    setStatus('Opening your exported story…');
    try {
      const text = await file.text();
      if (request !== generation.current) return;
      const restored = await restoreBrowserStory(text);
      if (request !== generation.current) return;
      setWarning(
        writeStory(serializeGame(restored))
          ? null
          : 'Your story is open, but this browser could not save it. Export it from the journal before leaving.',
      );
      setGame(restored);
    } catch (error) {
      if (request !== generation.current) return;
      setFailed(true);
      setRuntimeLoadFailed(error instanceof HistoricalRuntimeLoadError);
      setStatus(
        error instanceof HistoricalRuntimeLoadError
          ? 'The saved-story code could not be loaded. Retry opening the file when connected. Your stored story is unchanged.'
          : 'That exported story could not be validated. Your stored story is unchanged.',
      );
    }
  }
  if (game) return render(game, warning);
  return (
    <main className="story" aria-busy={!failed}>
      <h1>A little light</h1>
      <p role="status">{status}</p>
      {failed && (
        <button
          type="button"
          onClick={() => {
            if (runtimeLoadFailed) window.location.reload();
            else setRetry((value) => value + 1);
          }}
        >
          Retry saved story
        </button>
      )}
      {stored && (
        <button type="button" onClick={() => downloadOriginal(stored)}>
          Export stored story
        </button>
      )}
      <label>
        Open another exported story{' '}
        <input type="file" accept="application/json,.json" onChange={importStory} />
      </label>
      <button type="button" onClick={() => setConfirmNew(true)}>
        Start a new story
      </button>
      {confirmNew && (
        <section>
          <p>
            A new story replaces the stored story. Export the stored file first if you want to keep
            it.
          </p>
          <button
            type="button"
            onClick={() => {
              generation.current++;
              const fresh = createGame();
              setWarning(
                writeStory(serializeGame(fresh))
                  ? null
                  : 'This new story is open, but the browser could not save it. Export it from the journal before leaving.',
              );
              setGame(fresh);
            }}
          >
            Begin new story
          </button>
          <button type="button" onClick={() => setConfirmNew(false)}>
            Keep stored story
          </button>
        </section>
      )}
    </main>
  );
}
