import { createLab, PRIVACY_URL } from '@adam0white/lab-client';
import { fileLab } from './file-lab';
import { act, createGame, exportRun, type GameState, hashState, replayRun, view } from './game';
import { type AcceptedNativeFile, NativeFileSelection } from './native-file';
import './style.css';

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('The reading surface is missing.');
const root = app;
const fileMode = ['/word/file', '/word/file/index.html'].includes(location.pathname.replace(/\/$/, ''));
const lab = fileMode ? fileLab('word') : createLab({ game: 'word' });
const selection = new NativeFileSelection();
let acceptedFile: AcceptedNativeFile | null = null;
let stopTracking: (() => void) | null = null;
const saveKey = 'his-word-save-v1';
const noticeKey = 'his-word-notice-v1';
const guideKey = 'his-word-guide-v1';
function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* Play remains available without storage. */
  }
}
function freshSeed(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0] ?? 1;
}
let status = '';
let state: GameState | null = null;
if (!fileMode) {
  state = createGame(freshSeed());
  const saved = read(saveKey);
  if (saved) {
    try {
      state = replayRun(JSON.parse(saved));
    } catch {
      status =
        'Your saved meeting could not be replayed in this version of His Word, so a fresh meeting has started.';
    }
  }
}
let guide = !fileMode && !read(guideKey) && !!state && state.inputs.length === 0;
let guideReply = false;
let replayGuideOnNew = false;
type Surface = 'play' | 'menu' | 'notebook' | 'feedback' | 'new' | 'notice' | 'lab' | 'file';
let surface: Surface = fileMode ? 'file' : read(noticeKey) ? 'play' : 'notice';
function trackMeeting(): void {
  // Replacement intentionally ends the old file's future snapshots. It does not
  // promise a final recording receipt; the player can download before replacing.
  stopTracking?.();
  const meeting = state;
  stopTracking = meeting ? lab.trackRun(() => exportRun(meeting), { runKey: () => meeting.seed }) : null;
}
function currentMeeting(): GameState {
  if (!state) throw new Error('Choose a meeting before playing.');
  return state;
}
if (!fileMode) {
  lab.trackRun(() => exportRun(currentMeeting()), { runKey: () => currentMeeting().seed });
} else {
  window.addEventListener('pagehide', () => {
    selection.cancel();
    // The SDK awaits the complete export before recording its final snapshot.
    // Leave its tracker and transport alive through that asynchronous boundary.
  });
}

function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  text = '',
  className = '',
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (text) node.textContent = text;
  if (className) node.className = className;
  return node;
}
function button(text: string, action: () => void, className = ''): HTMLButtonElement {
  const node = element('button', text, className);
  node.type = 'button';
  if (className === 'choice') {
    const arrow = element('span', '↗', 'choice-arrow');
    arrow.setAttribute('aria-hidden', 'true');
    node.append(arrow);
  }
  node.addEventListener('click', action);
  return node;
}
function change(next: Surface): void {
  if (surface === 'new' && next !== 'new') replayGuideOnNew = false;
  selection.cancel();
  surface = next;
  status = '';
  render();
}
function heading(text: string): HTMLHeadingElement {
  const node = element('h1', text);
  node.tabIndex = -1;
  return node;
}
function paragraph(text: string): HTMLParagraphElement {
  return element('p', text);
}
function recording(): HTMLElement {
  const row = element('label', '', 'recording');
  const input = element('input');
  input.type = 'checkbox';
  input.checked = lab.telemetryOn;
  input.disabled =
    fileMode && lab.preservationStatus !== 'standard' && lab.preservationStatus !== 'existing-local';
  input.addEventListener('change', () => {
    lab.setTelemetryOff(!input.checked);
    if (fileMode) render(false);
  });
  row.append(input, element('span', 'Record my play for the lab'));
  return row;
}
function download(): void {
  if (!state) return;
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(exportRun(state), null, 2)], { type: 'application/json' }),
  );
  const link = element('a');
  link.href = url;
  link.download = 'his-word-playtest.json';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  status = 'Playtest export downloaded.';
  render(false);
}
function persist(): void {
  if (fileMode || !state) return;
  write(saveKey, JSON.stringify(exportRun(state)));
}
function menu(leaf: HTMLElement): void {
  leaf.append(
    heading('Set the notebook down'),
    paragraph(
      fileMode
        ? 'This meeting stays only in this tab. Download your playtest before closing it.'
        : 'Your place is kept in this browser when storage is available.',
    ),
  );
  const options = element('div', '', 'menu-options');
  options.append(
    button('Resume', () => change('play')),
    button('Notebook', () => change('notebook')),
    ...(!fileMode ||
    (currentMeeting().result === 'playing' && ['opening', 'table', 'hear'].includes(currentMeeting().page))
      ? [
          button('Replay guide', () => {
            if (fileMode) {
              guide = true;
              guideReply = false;
              change('play');
            } else {
              replayGuideOnNew = true;
              change('new');
            }
          }),
        ]
      : []),
    button('Feedback', () => change('feedback')),
    ...(fileMode
      ? [button('Choose another file', () => change('file')), button('Close file', closeFile)]
      : [button('New game', () => change('new'))]),
  );
  if (document.fullscreenEnabled)
    options.append(
      button(document.fullscreenElement ? 'Leave fullscreen' : 'Fullscreen', () => {
        const request = document.fullscreenElement
          ? document.exitFullscreen()
          : document.documentElement.requestFullscreen();
        void request
          .then(() => render(false))
          .catch(() => {
            status = 'Fullscreen is unavailable here.';
            render(false);
          });
      }),
    );
  const all = element('a', 'All games');
  all.href = 'https://human.adamwhite.work/games/';
  options.append(all);
  if (!fileMode) {
    const openFile = element('a', 'Open a file');
    openFile.href = '/word/file/';
    options.append(openFile);
  }
  leaf.append(options, recording());
  if (fileMode) leaf.append(paragraph(recordingStatus()));
  const privacy = element('a', 'Recording and privacy');
  privacy.href = PRIVACY_URL;
  privacy.target = '_blank';
  privacy.rel = 'noopener';
  const footer = element('div', '', 'menu-footer');
  const debug = element('details');
  debug.append(element('summary', 'Debug'), button('Export playtest', download));
  if (!fileMode) debug.append(button('Replay tools', () => change('lab')));
  footer.append(privacy, debug);
  leaf.append(footer);
}

function recordingStatus(): string {
  if (fileMode && lab.preservationStatus === 'standard')
    return 'Recording is off for this file. Turn it on to record this meeting.';
  if (lab.preservationStatus !== 'existing-local') {
    const reasons = {
      'missing-identity': 'No existing recording identity is available on this site.',
      'incompatible-session': 'This tab’s existing recording session cannot be reused.',
      'identity-mismatch': 'The existing recording identities do not match.',
      standard: 'Preserving recording is unavailable.',
    };
    return `Recording is blocked. ${reasons[lab.preservationStatus]} Your recording preferences are kept.`;
  }
  return lab.telemetryOn
    ? 'Recording is on for this meeting. Delivery still needs a stored receipt.'
    : 'Recording is off. Your browser privacy signal and recording preferences are respected.';
}
function closeFile(): void {
  selection.cancel();
  // Explicit Close discards this in-memory file and stops future snapshots.
  // It does not claim that the final state was recorded; download before closing.
  stopTracking?.();
  stopTracking = null;
  state = null;
  acceptedFile = null;
  change('file');
}
function renderFile(focus = true): void {
  root.replaceChildren();
  document.body.dataset.surface = 'file';
  const top = element('header', '', 'masthead');
  top.append(element('span', 'His Word', 'brand'), element('span', 'A tailor’s notebook', 'masthead-note'));
  const leaf = element('main', '', 'leaf');
  leaf.append(
    heading('Open a His Word file'),
    paragraph(
      'Choose a complete His Word playtest export. This meeting stays only in this tab. Your browser’s saved meeting is kept.',
    ),
    paragraph(
      'The lab can record decisions and link play on this device when recording is already available and enabled. This notice does not change your recording preferences.',
    ),
    paragraph(recordingStatus()),
    recording(),
  );
  const privacy = element('a', 'Recording and privacy');
  privacy.href = PRIVACY_URL;
  privacy.target = '_blank';
  privacy.rel = 'noopener';
  const label = element('label', 'Choose a playtest file', 'import-label');
  const input = element('input');
  input.type = 'file';
  input.accept = '.json,application/json';
  input.addEventListener('click', () => {
    selection.cancel();
    input.value = '';
  });
  input.addEventListener('cancel', () => {
    selection.cancel();
    status = state ? 'File selection canceled. Your opened meeting is kept.' : 'File selection canceled.';
    renderFile(false);
  });
  input.addEventListener('change', () => {
    const file = input.files?.[0];
    if (!file) {
      selection.cancel();
      return;
    }
    status = 'Checking the complete meeting…';
    // Keep this input mounted while a read is pending; another selection cancels it.
    const message = leaf.querySelector('[role="status"]');
    if (message) message.textContent = status;
    void selection
      .read(file)
      .then((accepted) => {
        if (!accepted) return;
        acceptedFile = accepted;
        state = accepted.state;
        trackMeeting();
        change('play');
      })
      .catch((error: unknown) => {
        status =
          error instanceof Error
            ? error.message
            : 'This file could not be opened. Your last meeting is kept.';
        renderFile(false);
      });
  });
  label.append(input);
  leaf.append(privacy, label);
  if (acceptedFile && state) {
    const provenance = paragraph(
      `Original file: ${acceptedFile.bytes.byteLength} bytes. SHA-256: ${acceptedFile.sha256}`,
    );
    provenance.style.overflowWrap = 'anywhere';
    leaf.append(
      provenance,
      button('Resume opened meeting', () => change('play'), 'choice'),
      button('Export playtest', download, 'choice'),
      button('Close file', closeFile, 'choice'),
    );
  }
  const message = paragraph(
    status ||
      (acceptedFile
        ? 'Your opened meeting is available. Choose another file or resume it.'
        : 'No file has been selected. Files must be no larger than 16 MiB.'),
  );
  message.className = 'status';
  message.setAttribute('role', 'status');
  leaf.append(message);
  root.append(top, leaf);
  if (focus) leaf.querySelector('h1')?.focus({ preventScroll: true });
}

function render(focus = true): void {
  if (fileMode && (surface === 'file' || !state)) {
    renderFile(focus);
    return;
  }
  const meeting = state;
  if (!meeting) throw new Error('Choose a meeting before playing.');
  root.replaceChildren();
  document.body.dataset.surface = surface;
  const top = element('header', '', 'masthead');
  const brand = element('span', 'His Word', 'brand');
  top.append(brand, element('span', 'A tailor’s notebook', 'masthead-note'));
  if (surface !== 'notice')
    top.append(
      button(
        surface === 'play' ? 'Menu' : 'Back',
        () => change(surface === 'play' ? 'menu' : 'play'),
        'small-button',
      ),
    );
  const leaf = element('main', '', 'leaf');
  leaf.id = 'reading';
  if (surface === 'play') {
    const scene = view(meeting);
    if (guide && !guideReply && !['opening', 'table', 'hear'].includes(meeting.page)) {
      guide = false;
      if (!fileMode) write(guideKey, '1');
    }
    lab.screen(scene.title);
    leaf.classList.toggle('guided', guide && !scene.ending);
    leaf.append(
      element(
        'p',
        scene.ending
          ? 'One month later'
          : `${meeting.remaining} ${meeting.remaining === 1 ? 'minute' : 'minutes'} before Osman leaves`,
        'eyebrow',
      ),
      heading(scene.title),
    );
    const prose = element('div', '', 'prose');
    const guideBox = element('aside', '', 'guide');
    if (guide && !scene.ending) {
      const message = guideReply
        ? 'A real reply. The clock moved. Find terms all four can sign before time runs out.'
        : meeting.page === 'opening'
          ? 'Agree on work, cart storage and rent for a month before Osman leaves.'
          : meeting.page === 'table'
            ? 'Choose what to do. No agreement when time runs out means the shop stays shut.'
            : meeting.page === 'hear'
              ? 'Choose someone to ask. The conversation costs two minutes.'
              : 'Choose a real action. Time spent brings Osman closer to leaving.';
      guideBox.append(
        element('strong', message),
        button('Skip guide', () => {
          guide = false;
          if (!fileMode) write(guideKey, '1');
          render(false);
        }),
      );
      leaf.append(guideBox);
    }
    for (const line of scene.prose) prose.append(paragraph(line));
    if (scene.speech) {
      const quote = element('blockquote');
      if (scene.speaker) quote.append(element('cite', scene.speaker));
      quote.append(paragraph(scene.speech));
      leaf.append(quote);
    }
    const choices = element('div', '', 'choices');
    choices.setAttribute('aria-label', 'Your next decision');
    for (const choice of scene.choices) {
      const option = button(
        choice.text,
        () => {
          const previousPage = meeting.page;
          if (guideReply) guide = false;
          act(meeting, { choice: choice.id });
          guideReply = guide && previousPage === 'hear' && !!meeting.speaker;
          if (guide && guideReply && !fileMode) write(guideKey, '1');
          persist();
          render();
        },
        'choice',
      );
      if (meeting.page === 'offer' && choice.text.includes('(2 minutes)')) {
        const split = choice.text.indexOf('(2 minutes)') + '(2 minutes)'.length;
        if (option.firstChild) option.firstChild.textContent = choice.text.slice(0, split);
        const preview = element('span', choice.text.slice(split).trim(), 'agreement-preview');
        option.insertBefore(preview, option.querySelector('.choice-arrow'));
      }
      option.dataset.choice = choice.id;
      choices.append(option);
    }
    if (scene.ending) {
      leaf.append(element('p', scene.ending === 'win' ? 'AGREED' : 'NO AGREEMENT', `seal ${scene.ending}`));
      lab.milestone(`ending:${scene.ending}`);
      choices.append(
        button('Read the notebook', () => change('notebook'), 'choice'),
        ...(fileMode
          ? [button('Choose another file', () => change('file'), 'choice')]
          : [button('Begin again', () => change('new'), 'choice')]),
      );
    }
    if (guide && !scene.ending && !guideReply) leaf.append(choices, prose);
    else leaf.append(prose, choices);
    const foot = element('footer');
    foot.append(button('Open notebook', () => change('notebook'), 'text-button'));
    leaf.append(foot);
  } else if (surface === 'menu') menu(leaf);
  else if (surface === 'notebook') {
    leaf.append(element('p', 'What was said here', 'eyebrow'), heading('The notebook'));
    if (!meeting.log.length)
      leaf.append(paragraph('No words from this meeting yet. Nuri’s letter is still at the depot.'));
    const list = element('ol', '', 'entries');
    for (const entry of meeting.log) {
      const item = element('li');
      item.append(element('span', `${entry.at} min`, 'entry-time'), paragraph(entry.text));
      list.append(item);
    }
    leaf.append(
      list,
      button('Back to the table', () => change('play'), 'choice'),
    );
  } else if (surface === 'notice' && !fileMode) {
    leaf.append(
      element('p', 'Before you sit down', 'eyebrow'),
      heading('A note about recording'),
      paragraph(
        'The lab records your decisions and where you stop. A browser ID can link your play across lab games. This helps us find confusing choices. You can turn recording off here or in the menu.',
      ),
      paragraph(
        'Your browser’s privacy signal is respected. Feedback you choose to send still works when recording is off.',
      ),
      recording(),
    );
    const privacy = element('a', 'Read the privacy notice');
    privacy.href = PRIVACY_URL;
    privacy.target = '_blank';
    privacy.rel = 'noopener';
    leaf.append(
      privacy,
      button(
        'Take a seat',
        () => {
          write(noticeKey, '1');
          change('play');
        },
        'choice',
      ),
    );
  } else if (surface === 'new' && !fileMode) {
    leaf.append(
      heading(replayGuideOnNew ? 'Start again with the guide?' : 'Start another meeting?'),
      paragraph('This replaces your current place. Export your playtest first if you want to keep it.'),
      button(
        'Keep this meeting',
        () => {
          replayGuideOnNew = false;
          change('play');
        },
        'choice',
      ),
      button(
        'Start new game',
        () => {
          state = createGame(freshSeed());
          guide = replayGuideOnNew;
          guideReply = false;
          replayGuideOnNew = false;
          persist();
          change('play');
        },
        'choice',
      ),
    );
  } else if (surface === 'feedback') {
    leaf.append(
      heading('Leave a note'),
      paragraph(
        'Choose a note to start a draft. Nothing is sent until you review it and press Submit. With recording off, a submitted note goes without your linked play.',
      ),
    );
    const draft = (text: string) => {
      lab.openSendDialog({
        title: 'Leave a note',
        note: text,
        getRun: () => (state ? exportRun(state) : null),
      });
    };
    for (const text of ["I'm stopping", "I'm confused"])
      leaf.append(button(text, () => draft(text), 'choice'));
    leaf.append(button('Return to the table', () => change('play'), 'text-button'));
  } else if (surface === 'lab' && !fileMode) {
    leaf.append(
      heading('Replay tools'),
      paragraph(`Seed: ${meeting.seed}`),
      paragraph(`Final state hash: ${hashState(meeting)}`),
    );
    const label = element('label', 'Import a playtest export', 'import-label');
    const input = element('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (!file) return;
      void file
        .text()
        .then((text) => {
          state = replayRun(JSON.parse(text));
          persist();
          status = `Replay verified. Final hash: ${hashState(state)}`;
          render(false);
        })
        .catch((error: unknown) => {
          status = `This export could not be replayed. ${error instanceof Error ? `${error.message} ` : ''}Your current meeting is kept.`;
          render(false);
        });
    });
    label.append(input);
    leaf.append(
      label,
      button('Export playtest', download, 'choice'),
      button('Resume replay', () => change('play'), 'choice'),
    );
  }
  if (status) {
    const message = element('p', status, 'status');
    message.setAttribute('role', 'status');
    leaf.append(message);
  }
  root.append(top, leaf, element('div', 'Nuri’s promises. Your words.', 'cloth-note'));
  if (focus) {
    leaf.querySelector('h1')?.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }
}
render(false);
