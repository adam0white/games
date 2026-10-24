import { useEffect, useRef, useState } from 'react';
import { lab } from '../lab';
import {
  FEEDBACK_NAME_KEY,
  LAB_PRIVACY,
  queueFeedback,
  recordingIsOff,
  storedPreference,
} from '../ui/feedback';
import './send-word.css';

export function SendWord({
  getRun,
  onBack,
  onGame = onBack,
}: {
  getRun: () => unknown;
  onBack: () => void;
  onGame?: () => void;
}) {
  const [off, setOff] = useState(recordingIsOff);
  const [recording, setRecording] = useState(lab.telemetryOn);
  const [consent, setConsent] = useState(false);
  const [verdict, setVerdict] = useState('');
  const [note, setNote] = useState('');
  const [name, setName] = useState(() => storedPreference(FEEDBACK_NAME_KEY));
  const [status, setStatus] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState('');
  const pending = useRef(false);
  const screen = useRef<HTMLElement>(null);
  const privacyOnly = !off && lab.privacySignalOn && !lab.privacyOverride;
  const disabled = false;
  useEffect(() => {
    const sync = () => {
      setOff(recordingIsOff());
      setRecording(lab.telemetryOn);
    };
    window.addEventListener('storage', sync);
    window.addEventListener('focus', sync);
    window.addEventListener('hf-lab-preference', sync);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener('focus', sync);
      window.removeEventListener('hf-lab-preference', sync);
    };
  }, []);
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
    if (disabled || pending.current) return;
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
        consent,
        off,
        onSent: () => {
          setSent(true);
          setStatus('Sent. Thank you.');
        },
      });
      setSent(result === 'queued');
      setStatus(
        result === 'queued' ? 'Sent. Thank you.' : 'Use the send dialog to finish sending.',
      );
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : 'Your word could not be sent. Please try again.',
      );
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };
  const download = () => {
    try {
      const run = getRun();
      const day = (run as { day?: number }).day ?? 1;
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(run)], { type: 'application/json' }),
      );
      const link = document.createElement('a');
      link.href = url;
      link.download = `small-works-day-${day}.json`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch {
      setStatus('This run could not be prepared. Please try again.');
    }
  };
  return (
    <section className="sw-feedback" ref={screen} aria-label="Send word">
      <div className="sw-feedback-body">
        <h1>Send word</h1>
        <p>Send a note about this game. Recording and continuing-person choices are optional.</p>
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
        <label className="sw-note-label" htmlFor="sw-feedback-note">
          What happened at the bench, what you wanted, what got in the way.
        </label>
        <textarea
          id="sw-feedback-note"
          aria-label="Your word"
          rows={4}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <details className="sw-feedback-name">
          <summary>+ Add a name or tester id</summary>
          <label htmlFor="sw-feedback-name">Your name or tester id</label>
          <input
            id="sw-feedback-name"
            value={name}
            maxLength={60}
            autoComplete="nickname"
            onChange={(e) => setName(e.target.value)}
          />
          <p>
            A sent name labels your whole linked history on this device, past and future. Leave it
            empty to stay pseudonymous.
          </p>
        </details>
        {lab.personaRecordingRequired && !lab.personaRecordingAllowed && (
          <label>
            <input type="checkbox" onChange={(e) => lab.allowPersonaRecording(e.target.checked)} />
            Link this continuing person to my recorded play (optional)
          </label>
        )}
        {off && (
          <div className="sw-recording-notice">
            <p>Recording is off. You can still send your note.</p>
            <label>
              <input
                type="checkbox"
                checked={recording && !off}
                onChange={(e) => {
                  lab.setTelemetryOff(!e.target.checked);
                  setOff(recordingIsOff());
                  setRecording(lab.telemetryOn);
                }}
              />{' '}
              Record play for the lab
            </label>
          </div>
        )}
        {privacyOnly && (
          <label className="sw-run-consent">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
            />{' '}
            Send this run with my note
          </label>
        )}
        <details
          onToggle={(e) => {
            if (e.currentTarget.open) setPreview(JSON.stringify(getRun(), null, 2));
          }}
        >
          <summary>What is sent</summary>
          <p>
            Your note, verdict and optional name. With recording off, no run or linked history is
            sent.
          </p>
          <pre>{preview}</pre>
          <a href={LAB_PRIVACY}>Lab privacy</a>
        </details>
        <button type="button" onClick={download}>
          Keep a copy of this run
        </button>
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
          disabled={!sent && (disabled || busy)}
          onClick={sent ? onGame : send}
        >
          {sent ? 'Back to the game' : busy ? 'Sending…' : 'Send'}
        </button>
      </div>
    </section>
  );
}
