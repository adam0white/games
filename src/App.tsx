import type { ChangeEvent } from 'react';
import { useId, useRef, useState } from 'react';
import {
  createGame,
  exportPlaytest,
  getView,
  replayPlaytest,
  restoreGame,
  serializeGame,
  transition,
} from './game/engine';
import type { GameInput, GameState, ObjectView } from './game/types';
import { readStory, writeStory } from './ui/storage';

function initialStory(): { game: GameState; warning: string | null } {
  const saved = readStory();
  if (saved) {
    try {
      return { game: restoreGame(saved), warning: null };
    } catch {
      return {
        game: createGame(),
        warning:
          'The saved story could not be read. A fresh story is open; your old save will remain until you take an action.',
      };
    }
  }
  return { game: createGame(), warning: null };
}

function Lamp({ object }: { object: ObjectView }) {
  const titleId = useId();
  return (
    <div className={`object-art ${object.visual} ${object.form}`}>
      <svg viewBox="0 0 320 250" role="img" aria-labelledby={titleId}>
        <title id={titleId}>
          {object.title}: {object.condition}
        </title>
        <ellipse className="light-pool" cx="160" cy="216" rx="123" ry="23" />
        {object.form === 'lamp' ? (
          <>
            <path className="lamp-shade" d="M111 48 Q160 33 209 48 L238 121 Q160 144 82 121 Z" />
            <path className="shade-rim" d="M82 121 Q160 141 238 121" />
            <path className="lamp-stem" d="M160 135 L160 206" />
            <path className="lamp-base" d="M116 211 Q160 192 204 211 L204 221 L116 221 Z" />
            <path className="pull" d="M196 135 L196 164" />
            <circle className="pull-tip" cx="196" cy="169" r="4" />
          </>
        ) : (
          <>
            <path className="lamp-base" d="M109 97 L205 123 L188 184 L92 158 Z" />
            <path className="lamp-shade" d="M203 107 L237 122 L218 193 L186 185 Z" />
            <path className="shade-rim" d="M222 125 L207 181" />
          </>
        )}
      </svg>
      <span className="object-condition">{object.condition}</span>
    </div>
  );
}

export default function App() {
  const [initial] = useState(initialStory);
  const [game, setGame] = useState(initial.game);
  const [message, setMessage] = useState<string | null>(initial.warning);
  const [journal, setJournal] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const view = getView(game);
  const latest = view.conversation.at(-1);
  function keep(next: GameState) {
    setGame(next);
    setMessage(
      writeStory(serializeGame(next))
        ? null
        : 'This story is still playable, but this browser could not save it. Export it from the journal before leaving.',
    );
  }
  function act(input: GameInput) {
    keep(transition(game, input));
  }
  function download() {
    const url = URL.createObjectURL(new Blob([exportPlaytest(game)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'repair-story.json';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function importStory(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (file.size > 2_000_000) {
      setMessage('That file is too large to be a story. Your current story is unchanged.');
      return;
    }
    try {
      const next = replayPlaytest(await file.text());
      keep(next);
      setJournal(false);
    } catch {
      setMessage(
        'That story could not be replayed. Please choose an exported repair story. Your current story is unchanged.',
      );
    }
  }
  return (
    <main className={`story scene-${view.scene}`}>
      <header className="masthead">
        <span className="place">{view.scene === 'home' ? 'At home' : 'In the garage'}</span>
        <button
          type="button"
          className="journal-toggle"
          onClick={() => {
            setJournal(!journal);
            setConfirmReset(false);
          }}
          aria-expanded={journal}
          aria-controls="journal"
        >
          Journal
        </button>
      </header>
      {journal && (
        <section id="journal" className="journal" aria-label="Story journal">
          <h2>Your story</h2>
          {view.conversation.length > 1 && (
            <ol className="past-conversation">
              {view.conversation.slice(0, -1).map((line) => (
                <li key={line.id}>
                  <strong>{line.speaker}</strong>
                  <p>{line.text}</p>
                </li>
              ))}
            </ol>
          )}
          <div className="journal-tools">
            <button type="button" onClick={download}>
              Export story
            </button>
            <button type="button" onClick={() => fileInput.current?.click()}>
              Open exported story
            </button>
            <button type="button" onClick={() => setConfirmReset(true)}>
              Start a new story
            </button>
          </div>
          <p className="journal-note">
            Opening a story replaces the current one. Export first if you want to keep both.
          </p>
          {confirmReset && (
            <div className="reset-confirm">
              <p>Leave this story and begin again? Export it first if you want to return.</p>
              <button
                type="button"
                onClick={() => {
                  keep(createGame());
                  setConfirmReset(false);
                  setJournal(false);
                }}
              >
                Begin again
              </button>
              <button type="button" onClick={() => setConfirmReset(false)}>
                Keep this story
              </button>
            </div>
          )}
        </section>
      )}
      <input
        ref={fileInput}
        type="file"
        accept=".json,application/json"
        onChange={importStory}
        hidden
      />
      {message && (
        <p className="message" role="status">
          {message}
        </p>
      )}
      <section className="story-heading">
        <h1>{view.title}</h1>
        <p>{view.subtitle}</p>
      </section>
      {latest && (
        <section
          className={`conversation ${latest.tone ?? 'warm'}`}
          aria-live="polite"
          aria-atomic="true"
        >
          <span className="speaker">{latest.speaker}</span>
          <p>{latest.text}</p>
        </section>
      )}
      {view.focus && (
        <section className="workbench" aria-label={view.focus.title}>
          <Lamp object={view.focus} />
          <div className="object-story">
            <h2>{view.focus.title}</h2>
            <p className="owner">{view.focus.owner}</p>
            <p>{view.focus.story}</p>
            {view.focus.observations.length > 0 && (
              <ul className="observations">
                {view.focus.observations.map((observation) => (
                  <li key={observation}>{observation}</li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}
      {view.note && <p className="bench-note">{view.note}</p>}
      {view.actions.length > 0 && (
        <section className="actions" aria-label="What to do next">
          {view.actions.map((action) => (
            <button
              type="button"
              key={action.id}
              className={action.kind === 'primary' ? 'primary' : ''}
              onClick={() => act({ type: 'action', id: action.id })}
            >
              <span>{action.label}</span>
              {action.detail && <small>{action.detail}</small>}
            </button>
          ))}
        </section>
      )}
      {(view.shelf.length > 0 || view.parts.length > 0) && (
        <aside className="belongings">
          {view.shelf.length > 0 && (
            <section>
              <h2>Put aside</h2>
              <div className="shelf">
                {view.shelf.map((item) => (
                  <button
                    type="button"
                    key={item.id}
                    onClick={() => act({ type: 'select', id: item.id })}
                  >
                    <span>{item.title}</span>
                    <small>{item.note}</small>
                  </button>
                ))}
              </div>
            </section>
          )}
          {view.parts.length > 0 && (
            <section>
              <h2>Parts tray</h2>
              <ul className="parts">
                {view.parts.map((part) => (
                  <li key={part.id}>
                    {part.label}
                    {part.count > 1 ? ` · ${part.count}` : ''}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </aside>
      )}
      <footer>A little work, a little patience.</footer>
    </main>
  );
}
