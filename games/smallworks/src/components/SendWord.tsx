import { FEEDBACK_LABELS, type FeedbackLabel } from '@adam0white/lab-client';
import { useEffect, useRef, useState } from 'react';
import { lab } from '../lab';
import { FEEDBACK_NAME_KEY, LAB_PRIVACY, queueFeedback, storedPreference } from '../ui/feedback';
import './send-word.css';

export function SendWord({
  getRun,
  onBack,
  onGame = onBack,
}: {
  getRun: () => unknown;
  chooseRecording: (allow: boolean) => void | Promise<void>;
  onBack: () => void;
  onGame?: () => void;
}) {
  const [sharePlay, setSharePlay] = useState(false);
  const [verdict, setVerdict] = useState('');
  const [note, setNote] = useState('');
  const [feedbackLabel, setFeedbackLabel] = useState<FeedbackLabel | undefined>();
  const [name, setName] = useState(() => storedPreference(FEEDBACK_NAME_KEY));
  const [status, setStatus] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState('');
  const pending = useRef(false);
  const screen = useRef<HTMLElement>(null);
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const resize = () => {
      screen.current?.style.setProperty('--feedback-height', `${viewport.height - 44}px`);
      screen.current?.style.setProperty('--feedback-top', `${viewport.offsetTop + 44}px`);
    };
    resize();
    viewport.addEventListener('resize', resize);
    viewport.addEventListener('scroll', resize);
    return () => {
      viewport.removeEventListener('resize', resize);
      viewport.removeEventListener('scroll', resize);
    };
  }, []);
  const send = async () => {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setStatus('');
    try {
      const result = await queueFeedback({
        lab,
        getRun,
        note,
        verdict,
        name,
        sharePlay,
        feedbackLabel,
      });
      setSent(true);
      setStatus(result);
    } catch (error) {
      setStatus(
        error instanceof Error
          ? error.message
          : 'Your feedback could not be sent. Please try again.',
      );
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };

  return (
    <section className="sw-feedback" ref={screen} aria-label="Feedback">
      <div className="sw-feedback-body">
        <h1>Feedback</h1>
        <p>Tell us about this game. Sharing your play data is optional.</p>
        <fieldset className="sw-verdicts" aria-label="Would you keep playing?">
          {(
            [
              ['keep', "I'd keep playing"],
              ['mixed', 'Not sure'],
              ['quit', "I'd stop here"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={verdict === value}
              onClick={() => setVerdict(verdict === value ? '' : value)}
            >
              {label}
            </button>
          ))}
        </fieldset>
        <fieldset className="sw-verdicts" aria-label="What is happening?">
          {(Object.entries(FEEDBACK_LABELS) as [FeedbackLabel, string][]).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={feedbackLabel === value}
              onClick={() => setFeedbackLabel(feedbackLabel === value ? undefined : value)}
            >
              {label}
            </button>
          ))}
        </fieldset>
        <label className="sw-note-label" htmlFor="sw-feedback-note">
          What happened? What did you want to do?
        </label>
        <textarea
          id="sw-feedback-note"
          aria-label="Your feedback"
          rows={4}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <details className="sw-feedback-name">
          <summary>Add a name (optional)</summary>
          <label htmlFor="sw-feedback-name">Your name</label>
          <input
            id="sw-feedback-name"
            value={name}
            maxLength={60}
            autoComplete="nickname"
            onChange={(e) => setName(e.target.value)}
          />
          <p>
            If you send a name, it labels your linked play history on this device, including past
            and future play. Leave this field empty to send without a name.
          </p>
        </details>
        {!lab.telemetryOn && (
          <label>
            <input
              type="checkbox"
              checked={sharePlay}
              onChange={(e) => setSharePlay(e.target.checked)}
            />
            Share this run and my play with the lab
          </label>
        )}
        <details>
          <summary>What is sent</summary>
          <p>
            With Recording on or Share selected, we include your saved game and link your play
            across games on this device. Otherwise we send only your note, answer and optional name.
          </p>
        </details>
        <div className="privacy-tools">
          <a href={LAB_PRIVACY}>Lab privacy</a>
          <details
            className="workshop-debug"
            onToggle={(e) => {
              if (!e.currentTarget.open) return;
              try {
                setPreview(JSON.stringify(getRun(), null, 2));
              } catch {
                setPreview('The current run could not be read. You can still send your note.');
              }
            }}
          >
            <summary>Debug</summary>
            <pre>{preview}</pre>
          </details>
        </div>
        {status && <p role="status">{status}</p>}
      </div>
      <div className="sw-feedback-actions">
        {!sent && (
          <button type="button" onClick={onBack}>
            Back to the menu
          </button>
        )}
        <button
          type="button"
          className="primary sw-primary"
          disabled={!sent && busy}
          onClick={sent ? onGame : send}
        >
          {sent ? 'Back to the game' : busy ? 'Sending…' : 'Submit'}
        </button>
      </div>
    </section>
  );
}
