import type { ChangeEvent } from 'react';
import { useEffect, useId, useRef, useState } from 'react';
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
import { createChoiceGate } from './ui/choiceGate';
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
  const appearance = object.appearance ?? (object.form === 'torch' ? 'torch' : 'reading');
  return (
    <div className={`object-art ${object.visual} ${appearance}`}>
      <svg viewBox="0 0 320 250" role="img" aria-labelledby={titleId}>
        <title id={titleId}>
          {object.title}: {object.condition}
        </title>
        <ellipse className="light-pool" cx="160" cy="216" rx="123" ry="23" />
        {appearance === 'reading' && (
          <>
            <path className="lamp-base" d="M106 216 Q149 196 197 212 L197 221 L106 221 Z" />
            <path className="lamp-stem" d="M151 206 L142 137 L189 88" />
            <circle className="joint" cx="142" cy="137" r="9" />
            <path className="lamp-shade" d="M176 65 Q207 66 222 90 L238 115 L172 127 L166 89 Z" />
            <path className="shade-rim" d="M172 127 L238 115" />
            <path className="pull" d="M125 216 C80 221 91 238 58 227" />
          </>
        )}
        {appearance === 'bedside' && (
          <>
            <path className="lamp-shade" d="M112 51 Q160 39 208 51 L229 119 Q160 137 91 119 Z" />
            <path className="shade-rim" d="M91 119 Q160 136 229 119" />
            <path
              className="ceramic-body"
              d="M146 132 L174 132 L176 158 C211 170 205 211 179 217 L141 217 C115 211 109 170 144 158 Z"
            />
            <path
              className="ceramic-mark"
              d="M138 176 Q160 187 181 177 M134 190 Q158 202 185 192"
            />
            <path className="pull" d="M195 133 L195 157" />
            <circle className="pull-tip" cx="195" cy="162" r="4" />
          </>
        )}
        {appearance === 'kitchen' && (
          <>
            <path className="handle" d="M132 73 L132 52 Q160 26 188 52 L188 73" />
            <path className="lamp-base" d="M121 76 L199 76 L210 209 L110 209 Z" />
            <path className="lamp-shade glass" d="M128 99 L192 99 L199 184 L121 184 Z" />
            <path className="shade-rim" d="M124 137 L196 137 M160 100 L160 183" />
            <path className="lamp-base" d="M109 209 L211 209 L211 221 L109 221 Z" />
            <circle className="pull-tip" cx="160" cy="87" r="5" />
          </>
        )}
        {appearance === 'torch' && (
          <>
            <path className="lamp-base" d="M74 144 L186 108 L207 172 L95 207 Q79 190 74 144 Z" />
            <path
              className="torch-grip"
              d="M103 145 L116 187 M120 140 L133 182 M137 135 L150 177"
            />
            <path className="lamp-shade" d="M183 105 L220 86 L250 177 L207 175 Z" />
            <path className="shade-rim" d="M224 97 L246 167" />
            <path className="pull" d="M79 177 C33 182 52 218 91 203" />
            <path className="torch-switch" d="M146 122 L167 116 L170 125 L149 131 Z" />
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
  const [settling, setSettling] = useState(false);
  const [resultText, setResultText] = useState<string | null>(null);
  const [lastChoice, setLastChoice] = useState<string | null>(null);
  const [previousEvidence, setPreviousEvidence] = useState<{
    id: string;
    observations: string[];
  } | null>(null);
  const [choiceGate] = useState(() => createChoiceGate(() => setSettling(false)));
  useEffect(() => () => choiceGate.cancel(), [choiceGate]);
  const storyRevision = useRef(0);
  const fileInput = useRef<HTMLInputElement>(null);
  const view = getView(game);
  const latest = view.conversation.at(-1);
  const dialogue = view.currentDialogue ?? (latest ? [latest] : []);
  const history = view.journal ?? view.conversation;
  function keep(next: GameState) {
    storyRevision.current++;
    choiceGate.cancel();
    setSettling(false);
    setGame(next);
    setMessage(
      writeStory(serializeGame(next))
        ? null
        : 'This story is still playable, but this browser could not save it. Export it from the journal before leaving.',
    );
  }
  function act(input: GameInput) {
    if (choiceGate.locked) return;
    const next = transition(game, input);
    if (next === game) return;
    const nextView = getView(next);
    const reply = nextView.currentDialogue?.at(-1) ?? nextView.conversation.at(-1);
    const newObservation = nextView.focus?.observations.find(
      (observation) =>
        nextView.focus?.id !== view.focus?.id || !view.focus?.observations.includes(observation),
    );
    setResultText(
      nextView.moment ??
        (reply && reply.id !== latest?.id
          ? `${reply.speaker}: ${reply.text.length > 170 ? `${reply.text.slice(0, 167).replace(/\s+\S*$/, '')}…` : reply.text}`
          : (newObservation ?? nextView.note ?? nextView.focus?.condition ?? null)),
    );
    setPreviousEvidence(
      view.focus ? { id: view.focus.id, observations: view.focus.observations } : null,
    );
    setLastChoice(
      input.type === 'action'
        ? (view.actions.find((action) => action.id === input.id)?.label ?? null)
        : `Return to ${view.shelf.find((item) => item.id === input.id)?.title ?? 'the bench'}`,
    );
    keep(next);
    choiceGate.pause(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false);
    setSettling(choiceGate.locked);
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
    const revision = ++storyRevision.current;
    try {
      const text = await file.text();
      if (revision !== storyRevision.current) return;
      const next = replayPlaytest(text);
      keep(next);
      setJournal(false);
      setLastChoice(null);
      setResultText(null);
      setPreviousEvidence(null);
    } catch {
      if (revision !== storyRevision.current) return;
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
          {history.length > 0 && (
            <ol className="past-conversation">
              {history.map((line) => (
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
                  setLastChoice(null);
                  setResultText(null);
                  setPreviousEvidence(null);
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
      {dialogue.length > 0 && (
        <section
          key={dialogue.map((line) => line.id).join('-')}
          className={`conversation ${dialogue.at(-1)?.tone ?? 'warm'}`}
          aria-live="polite"
          aria-atomic="true"
        >
          {dialogue.map((line) => (
            <div className="dialogue-line" key={line.id}>
              <span className="speaker">{line.speaker}</span>
              <p>{line.text}</p>
            </div>
          ))}
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
                  <li
                    key={observation}
                    className={
                      previousEvidence?.id === view.focus?.id &&
                      !previousEvidence?.observations.includes(observation)
                        ? 'new-evidence'
                        : ''
                    }
                  >
                    {previousEvidence?.id === view.focus?.id &&
                      !previousEvidence?.observations.includes(observation) && (
                        <span className="evidence-tag">New</span>
                      )}
                    {observation}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}
      {view.note && <p className="bench-note">{view.note}</p>}
      {view.humanNote && <p className="human-note">{view.humanNote}</p>}
      {lastChoice && (
        <section className="action-result" aria-live="polite" aria-atomic="true">
          <span className="result-choice">You chose: {lastChoice}</span>
          <p>{resultText}</p>
        </section>
      )}
      {view.actions.length > 0 && (
        <section
          className={`actions ${settling ? 'settling' : 'ready'}`}
          aria-busy={settling}
          aria-label="What to do next"
        >
          {view.actions.map((action) => (
            <button
              type="button"
              key={action.id}
              className={`${action.kind === 'primary' ? 'primary' : ''} intent-${action.intent ?? 'stay'}`}
              disabled={settling}
              onClick={() => act({ type: 'action', id: action.id })}
            >
              <span className="action-label">
                {action.label}
                {action.intent && action.intent !== 'stay' && (
                  <span className="intent-mark" aria-hidden="true">
                    {action.intent === 'pause' ? 'Ⅱ' : '↗'}
                  </span>
                )}
              </span>
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
                    disabled={settling}
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
