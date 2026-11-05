/** Kitchen-specific teaching uses ordinary controls and never changes simulation inputs. */
type Step =
  | 'plan'
  | 'station'
  | 'break'
  | 'cover'
  | 'done'
  | 'ask-plan'
  | 'open'
  | 'crew'
  | 'ask'
  | 'result'
  | 'waiting'
  | 'continue';
let step: Step | null = null;
let latestPlan = '';
let requestedCook: string | null = null;
let replyReady: (() => boolean) | null = null;
let bill = 5200;
let earned = 0;
export function teachingBill(due: number, till: number) {
  const changed = bill !== due || earned !== till;
  bill = due;
  earned = till;
  const picture = document.querySelector('.tutorial-stakes');
  if (changed && picture) picture.innerHTML = stakesPicture();
}
function stakesPicture() {
  return `<div>🥗 → 🍽 → ₺ → 📅 Saturday</div><meter min="0" max="${Math.max(1, bill)}" value="${Math.max(0, earned)}" aria-label="Money toward the bill"></meter> <b>₺${earned} / ₺${bill}</b><div>Unpaid bill → ⚠ strike + shortfall × 1.10 next week</div><div>⚠⚠ → 🔒 · Unpaid final bill → 🔒</div><small>Broken promises can also add a strike.</small>`;
}
const cues: Record<Step, [string, string]> = {
  continue: [
    '#cont:not([disabled]), #open:not([disabled]), #end, #again, #fresh, #new, [data-jar], [data-key]:not([disabled])',
    'Choose your next step. Practice returns when a kitchen plan opens.',
  ],
  waiting: ['.panel-reply', 'Your request is waiting for the cook’s answer. The kitchen keeps running.'],
  plan: ['.board-change', 'Keep the kitchen earning enough to pay Saturday’s bill. Choose a cook’s plan.'],
  station: [
    '[data-field="station"][data-value="cold"]',
    '🥗 Cold side = salads and cold dishes. Choose where this cook works.',
  ],
  break: [
    '[data-field="break"]',
    'Choose a 20-minute meal break. Customers still need food while the cook eats.',
  ],
  cover: [
    '[data-field="cover"]',
    'Choose who takes over. Choosing Nobody leaves this station empty; borrowing a cook can leave another empty.',
  ],
  done: ['#board-done', 'Your proposed staffing is below. Keep this choice or change it, then press Done.'],
  'ask-plan': [
    '#ask-board, #open-service',
    'Ask the cooks. A proposed plan becomes a real assignment only if they agree.',
  ],
  open: [
    '#open-service',
    'Open the doors when you decide. A cook can refuse a changed plan. Empty stations delay meals; late customers leave without paying.',
  ],
  crew: ['[data-pick]', 'The kitchen is running. Choose a cook to ask for a job; they can say no.'],
  ask: [
    '[data-v]:not([disabled])',
    'Choose a real job request. The cook decides; watch the reply and their current job.',
  ],
  result: [
    '.panel-reply',
    'Your request is sent. The cook’s reply appears here. Keep food moving to earn the bill; an empty station can lose a table.',
  ],
};

export function beginTeaching(phase: string, replay = false) {
  if (!replay) {
    try {
      if (step === null && localStorage.getItem('pass-teaching-done')) return;
    } catch {
      /* Teaching still works without storage. */
    }
  }
  requestedCook = null;
  replyReady = null;
  latestPlan = '';
  step = phase === 'service' ? 'crew' : phase === 'board' ? 'plan' : 'continue';
}

function finish() {
  step = null;
  try {
    localStorage.setItem('pass-teaching-done', '1');
  } catch {
    /* Optional device preference. */
  }
  mountTeaching();
}

export function mountTeaching(plan = latestPlan) {
  latestPlan = plan;
  document.querySelectorAll('.teaching-cue').forEach((node) => {
    node.remove();
  });
  document.querySelectorAll('.teaching-target').forEach((node) => {
    node.classList.remove('teaching-target');
  });
  if (!step) return;
  if (
    document.querySelector('.people-service') &&
    ['plan', 'station', 'break', 'cover', 'done', 'ask-plan', 'open', 'continue'].includes(step)
  )
    step = 'crew';
  const boardVisible = !!document.querySelector('.board-change');
  const serviceVisible = !!document.querySelector('.people-service');
  if (boardVisible && ['crew', 'ask', 'waiting', 'result', 'continue'].includes(step)) {
    step = 'plan';
    requestedCook = null;
    replyReady = null;
  } else if (!boardVisible && !serviceVisible) {
    step = 'continue';
    requestedCook = null;
    replyReady = null;
  }
  if (step === 'continue' && document.querySelector('[data-pick]')) step = 'crew';
  if (['station', 'break', 'cover', 'done'].includes(step) && !document.querySelector('.board-editor'))
    step = 'plan';
  if (step === 'ask' && !document.querySelector('[data-v]')) step = 'crew';
  if (step === 'ask-plan' && !document.querySelector('#ask-board')) step = 'open';
  const [selector, words] = cues[step];
  const requestedSelected =
    requestedCook &&
    document.querySelector(`[data-pick="${CSS.escape(requestedCook)}"][aria-pressed="true"]`);
  const showingReply = !['waiting', 'result'].includes(step) || !!requestedSelected;
  const target =
    !showingReply && requestedCook
      ? document.querySelector<HTMLElement>(`[data-pick="${CSS.escape(requestedCook)}"]`)
      : document.querySelector<HTMLElement>(selector);
  if (!target) return;
  target.classList.add('teaching-target');
  const cue = document.createElement('aside');
  cue.className = 'teaching-cue';
  cue.dataset.tutorialStep = step;
  cue.setAttribute('aria-label', 'Kitchen practice');
  const line = document.createElement('p');
  line.textContent =
    step === 'result' && !showingReply ? 'Your cook has answered. Tap their name to see the reply.' : words;
  cue.append(line);
  if (['plan', 'open', 'result'].includes(step)) {
    const stakes = document.createElement('div');
    stakes.className = 'tutorial-stakes';
    stakes.innerHTML = stakesPicture();
    cue.append(stakes);
  }
  if (['break', 'cover', 'done'].includes(step) && plan) {
    const picture = document.createElement('div');
    picture.className = 'tutorial-plan';
    picture.innerHTML = plan;
    cue.append(picture);
  }
  const skip = document.createElement('button');
  skip.type = 'button';
  skip.dataset.tutorialSkip = '';
  skip.textContent = 'Skip practice';
  skip.addEventListener('click', finish);
  cue.append(skip);
  if (step === 'result' && showingReply) {
    const done = document.createElement('button');
    done.type = 'button';
    done.dataset.tutorialFinish = '';
    done.textContent = 'Run the kitchen';
    done.addEventListener('click', finish);
    cue.prepend(done);
  }
  target.insertAdjacentElement('afterend', cue);
}

document.addEventListener(
  'click',
  (event) => {
    if (!step || !(event.target instanceof Element)) return;
    const transitions: Partial<Record<Step, [string, Step]>> = {
      plan: ['.board-change', 'station'],
      station: ['[data-field="station"]', 'break'],
      break: ['[data-field="break"]', 'cover'],
      cover: ['[data-field="cover"]', 'done'],
      done: ['#board-done', 'ask-plan'],
      'ask-plan': ['#ask-board', 'open'],
      open: ['#open-service', 'crew'],
      crew: ['[data-pick]', 'ask'],
    };
    if (event.target.closest('#close, [data-pick]')) setTimeout(() => mountTeaching(), 0);
    const next = transitions[step];
    if (!next || !event.target.closest(next[0])) return;
    step = next[1];
    // The ordinary click handler renders the actual consequence first.
    setTimeout(() => mountTeaching(), 0);
  },
  true,
);

export function teachingRequestSent(ready: () => boolean, cook: string) {
  if (step && ['ask', 'waiting', 'result'].includes(step)) {
    step = 'waiting';
    replyReady = ready;
    requestedCook = cook;
  }
  mountTeaching();
}
export function refreshTeaching() {
  if (step === 'waiting' && replyReady?.()) {
    step = 'result';
    replyReady = null;
    mountTeaching();
  } else if (step && !document.querySelector('.teaching-cue')) mountTeaching();
}
