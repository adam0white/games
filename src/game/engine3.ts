/**
 * Deterministic family-to-garage opening. The host owns fictional low-voltage lamp
 * faults and material accounting; released HF owns people, attended observations,
 * practice, effort and remembered outcomes. Manual controls select host offers;
 * no learned task policy, apprenticeship or commercial economy is claimed.
 */
import {
  type Affordance,
  begin,
  createPerson,
  decide,
  FRAMEWORK_VERSION,
  finish,
  perceive,
  restore,
  snapshot,
  tick,
} from '@repair/hf-legacy';
import { askMumToHelp, shareTea } from './humans3';

import { restoreGame as restoreLegacy } from './legacy-engine';
import { itemStory, optionalStoryChoices, storyBeat } from './story3';
import type { ActionView, Fault, GameInput, GameState, GameView, RepairObject } from './types';

const ENGINE = 'home-garage-3';
const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));
const object = (
  id: string,
  title: string,
  owner: string,
  story: string,
  fault: Fault,
  form: 'lamp' | 'torch' = 'lamp',
): RepairObject => ({
  id,
  title,
  owner,
  story,
  fault,
  form,
  location: 'bench',
  observations: [],
  inspected: false,
  tested: false,
  attempted: 0,
  repaired: false,
  verified: false,
  discovered: true,
});
const focused = (s: GameState) =>
  s.objects.find((o) => o.id === s.focusId && o.discovered && o.location !== 'returned');
function say(
  s: GameState,
  speaker: string,
  text: string,
  tone: 'warm' | 'notice' | 'mistake' = 'notice',
) {
  s.nextLineId ??= (s.conversation.at(-1)?.id ?? -1) + 1;
  const entry = { id: s.nextLineId++, speaker, text, tone };
  s.conversation.push(entry);
  s.journal ??= [];
  s.journal.push(entry);
  s.conversation = s.conversation.slice(-8);
  const p = s.people.player;
  if (p)
    perceive(p, [
      {
        at: p.now,
        channel: speaker === 'You' ? 'saw' : 'told',
        actorId: speaker === 'Mum' ? 'mum' : undefined,
        kind: 'repair-observation',
        summary: text,
        salience: 0.9,
        valence: tone === 'warm' ? 0.3 : tone === 'mistake' ? -0.1 : 0,
      },
    ]);
}
export function createGame(seed = 1701): GameState {
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) throw Error('Invalid seed');
  return {
    schema: 1,
    scenario: 1,
    framework: FRAMEWORK_VERSION,
    seed,
    now: 0,
    chapter: 'family',
    focusId: null,
    objects: [],
    people: {
      player: createPerson({
        id: 'player',
        name: 'You',
        seed,
        now: 0,
        bornAt: -25 * 365 * 1440,
        sex: 'male',
        skills: { repair: 0.12 },
        relationships: [{ otherId: 'mum', roles: ['parent'] }],
        retention: { trace: 12, chronicleDays: 31 },
      }),
      mum: createPerson({
        id: 'mum',
        name: 'Mum',
        seed: seed ^ 913,
        now: 0,
        bornAt: -52 * 365 * 1440,
        sex: 'female',
        relationships: [{ otherId: 'player', roles: ['child'] }],
        retention: { trace: 8, chronicleDays: 31 },
      }),
    },
    parts: { batteries: 1, holders: 0 },
    unlocked: [],
    conversation: [
      {
        id: 0,
        speaker: 'Mum',
        text: 'Could you come over here a moment? The little lamp beside my chair keeps flickering.',
        tone: 'warm',
      },
    ],
    journal: [
      {
        id: 0,
        speaker: 'Mum',
        text: 'Could you come over here a moment? The little lamp beside my chair keeps flickering.',
        tone: 'warm',
      },
    ],
    inputs: [],
    discoveries: 0,
    repairs: 0,
    requests: 0,
    worldRng: (seed ^ 0x9e3779b9) >>> 0,
    feedbackRevisionFrom: 0,
  };
}
function available(s: GameState): ActionView[] {
  const a: ActionView[] = [];
  const add = (id: string, label: string, detail?: string) =>
    a.push({
      id,
      label,
      detail,
      intent: ['early-return', 'return', 'talk-garage'].includes(id)
        ? 'leave'
        : ['rest', 'shelve'].includes(id)
          ? 'pause'
          : 'stay',
    });
  if (s.chapter === 'family') {
    add('talk-family', 'Sit with Mum');
    return a;
  }
  const o = focused(s);
  if (o) {
    if (!o.inspected) add('inspect', 'Look closely');
    if (o.inspected && !o.repaired) {
      if (o.form === 'torch' && o.fault === 'cap')
        add(
          'twist-cap',
          'Clean the cap thread and seat it squarely',
          'The cap carries the return contact; the flat lamp contact is a different part.',
        );
      if (!o.tested)
        add(
          'test-battery',
          'Try the known-good battery',
          'A test: the battery goes back in the tray.',
        );
      if (o.fault !== 'holder' || !o.observations.some((x) => x.includes('holder'))) {
        add('clean-contact', 'Clean and reseat the contact');
        if (s.parts.batteries > 0) add('replace-battery', 'Put in the spare battery');
      }
      if (o.inspected && o.observations.some((x) => x.includes('holder')) && s.parts.holders > 0)
        add('fit-holder', 'Fit the recovered holder');
    }
    if (o.repaired && !o.verified) {
      if (o.checkStarted === undefined)
        add(
          'verify',
          'Start a longer light check',
          'Leave it shining for twenty minutes; other things can happen meanwhile.',
        );
      else if (s.now - o.checkStarted >= 20)
        add('check-result', 'Move it, switch it, and read the check');
      else
        add(
          'wait-check',
          'Stay with the light a while',
          'Ten quiet minutes, watching for a change.',
        );
      add(
        'early-return',
        o.owner === 'You'
          ? 'Put it beside the bed before the longer check'
          : 'Give it back before the longer check',
        'Say plainly that it lights now but has not been checked for long.',
      );
    }
    if (o.verified) add('return', o.owner === 'You' ? 'Set it beside your bed' : 'Give it back');
    if (o.location === 'bench' && !o.verified) add('shelve', 'Put it aside carefully');
    if (o.location === 'shelf') add('resume', 'Bring it back to the bench');
  }
  if (s.unlocked.includes('garage-hint') && !s.unlocked.includes('garage'))
    add('talk-garage', 'Go and look at the garage bench');
  if (s.unlocked.includes('garage') && !s.unlocked.includes('donor'))
    add('search-donor', 'Look through Dad’s old lamp box');
  if (s.repairs >= 1 && s.unlocked.includes('garage') && !s.unlocked.includes('friends'))
    add('talk-friends', 'Tell Mum about the garage bench');
  if (
    s.unlocked.includes('friends') &&
    !o &&
    s.objects.filter((x) => x.id.startsWith('friend-') && x.location !== 'returned').length < 2
  )
    add(
      'accept-request',
      'See who needs a hand',
      'Room for one on the bench and one waiting safely on the shelf.',
    );
  add(
    'rest',
    s.chapter === 'garage' ? 'Join Mum for tea on the garage step' : 'Sit with Mum over tea',
    'Leave the work safely on the bench for a while.',
  );
  if (o?.checkStarted !== undefined && !o.verified && !s.unlocked.includes(`help:${o.id}`))
    add('ask-mum', 'Ask Mum to hold it while you check');
  for (const choice of optionalStoryChoices({
    focusId: s.focusId,
    focusOwner: o?.owner,
    chapter: s.chapter,
    unlocked: s.unlocked,
  }))
    add(choice.id, choice.label);
  return a;
}
export function transition(original: GameState, input: GameInput): GameState {
  if (
    !input ||
    typeof input.id !== 'string' ||
    input.id.length > 80 ||
    !['action', 'select'].includes(input.type)
  )
    throw Error('Invalid input');
  if (input.type === 'action' && !available(original).some((a) => a.id === input.id))
    throw Error('That action is not available');
  if (
    input.type === 'select' &&
    !original.objects.some((o) => o.id === input.id && o.discovered && o.location !== 'returned')
  )
    throw Error('Unknown object');
  const s = clone(original);
  s.inputs.push({ at: s.now, input: clone(input) });
  s.eventStartId = s.nextLineId ?? (s.conversation.at(-1)?.id ?? -1) + 1;
  if (input.type === 'select') {
    const previous = focused(s);
    if (previous && previous.id !== input.id) previous.location = 'shelf';
    s.focusId = input.id;
    const o = focused(s);
    if (o) o.location = 'bench';
    return s;
  }
  const id = input.id;
  const o = focused(s);
  const storyChoice = optionalStoryChoices({
    focusId: s.focusId,
    focusOwner: o?.owner,
    chapter: s.chapter,
    unlocked: s.unlocked,
  }).find((x) => x.id === id);
  if (storyChoice) {
    s.unlocked.push(`story:${id}`);
    for (const line of storyChoice.lines) {
      s.nextLineId ??= (s.conversation.at(-1)?.id ?? -1) + 1;
      const entry = { id: s.nextLineId, ...line };
      s.nextLineId++;
      s.conversation.push(entry);
      s.journal ??= [];
      s.journal.push(entry);
    }
    s.conversation = s.conversation.slice(-8);
    return s;
  }
  const contactName = id === 'accept-request' ? (s.requests % 2 === 0 ? 'nora' : 'sam') : undefined;
  const beat =
    id === 'return' || id === 'early-return'
      ? `${id === 'early-return' ? 'return-early' : 'return'}-${o?.id === 'family' || o?.id === 'personal' ? o.id : o?.owner.toLowerCase()}`
      : contactName
        ? `request-${contactName}`
        : id === 'rest' && s.chapter === 'garage'
          ? 'rest-garage'
          : id;
  const repeatedContact = contactName && s.unlocked.includes(`met:${contactName}`);
  const lines = storyBeat(repeatedContact ? `callback-${contactName}` : beat);
  const narrate: typeof say = (...args) => {
    if (!lines.length) say(...args);
  };
  const p = s.people.player;
  if (!p) throw Error('Missing player');
  const duration =
    id === 'rest'
      ? 30
      : id === 'wait-check'
        ? 10
        : id === 'ask-mum'
          ? 8
          : ['clean-contact', 'replace-battery', 'fit-holder'].includes(id)
            ? 12
            : 4;
  const aff: Affordance = {
    id,
    action: id === 'rest' ? 'rest' : 'repair',
    label: available(s).find((a) => a.id === id)?.label ?? id,
    duration,
    effort: id === 'rest' ? 0 : 0.15,
    focus: id === 'rest' ? 0 : 0.4,
    advertises: id === 'rest' ? { leisure: 0.1 } : { competence: 0.03 },
    ...([
      'inspect',
      'test-battery',
      'clean-contact',
      'replace-battery',
      'fit-holder',
      'verify',
    ].includes(id)
      ? { skill: { id: 'repair', difficulty: 0.25 } }
      : {}),
  };
  const familyMember = s.people.mum;
  if (!familyMember) throw Error('Missing family member');
  if (id === 'rest') shareTea(p, familyMember, s.now + duration);
  else {
    begin(p, aff, decide(p, [aff]));
    tick(p, s.now + duration);
  }
  s.now += duration;
  let failed = false;
  switch (id) {
    case 'talk-family':
      s.chapter = 'bench';
      s.objects.push(
        object(
          'family',
          'Mum’s reading lamp',
          'Mum',
          'It has lit Mum’s evening reading for years.',
          'contact',
        ),
      );
      s.focusId = 'family';
      narrate(
        s,
        'Mum',
        'It brightens if I hold it still. There’s a spare battery in the drawer if you want to compare.',
        'warm',
      );
      break;
    case 'inspect':
      if (o) {
        o.inspected = true;
        const text =
          o.form === 'torch' && o.fault === 'cap'
            ? 'The torch’s cap sits crooked. Its metal thread completes the circuit; pressure on the cap makes the beam return.'
            : o.fault === 'holder'
              ? 'The battery holder is cracked through. It needs a matching holder, not a stronger battery.'
              : 'The switch moves freely. There’s a little grime on the contact; the battery could also be tired.';
        o.observations.push(text);
        narrate(s, 'You', text);
        if (o.id === 'personal' && !s.unlocked.includes('garage-hint')) {
          s.unlocked.push('garage-hint');
          narrate(
            s,
            'Mum',
            'Dad kept a box of old lamps in the garage. You could look for a matching part when you feel like it.',
          );
        }
      }
      break;
    case 'test-battery':
      if (o) {
        o.tested = true;
        const text =
          o.fault === 'cap'
            ? 'The fresh battery makes no difference. The beam returns only while the cap is held straight.'
            : o.fault === 'battery'
              ? 'With the known-good battery it shines steadily. The old battery is tired.'
              : o.fault === 'holder'
                ? 'The crack prevents the battery sitting firmly. A test battery cannot bridge it.'
                : 'With the known-good battery it still flickers when moved. The contact needs attention.';
        o.observations.push(text);
        narrate(s, 'You', text);
      }
      break;
    case 'twist-cap':
    case 'clean-contact':
    case 'replace-battery':
    case 'fit-holder':
      if (o) {
        o.attempted++;
        const matches =
          (id === 'twist-cap' && o.fault === 'cap') ||
          (id === 'clean-contact' && o.fault === 'contact') ||
          (id === 'replace-battery' && o.fault === 'battery') ||
          (id === 'fit-holder' && o.fault === 'holder');
        if (id === 'fit-holder') s.parts.holders--;
        if (id === 'replace-battery') s.parts.batteries--;
        o.repaired = matches;
        failed = !matches;
        const text = matches
          ? 'The light comes on steadily. It deserves a longer check before calling it finished.'
          : o.fault === 'contact'
            ? 'It still flickers when moved. Changing the battery did not restore the contact.'
            : s.inputs.length <= (s.feedbackRevisionFrom ?? 0)
              ? 'That did not help. Testing the battery will separate a weak cell from a contact problem.'
              : o.fault === 'cap'
                ? id === 'replace-battery'
                  ? 'The spare battery does not straighten this torch’s threaded cap. The cap needs seating squarely so its thread can carry the return contact.'
                  : 'Cleaning the flat contact did not straighten this torch’s threaded cap. The cap needs seating squarely so its thread can carry the return contact.'
                : o.tested
                  ? 'Cleaning the contact did not restore the old battery. The known-good battery already made it shine steadily; the original cell needs replacing.'
                  : 'That did not help. Testing the battery will separate a weak cell from a contact problem.';
        o.observations.push(text);
        narrate(s, 'You', text, matches ? 'notice' : 'mistake');
      }
      break;
    case 'verify':
      if (o) {
        o.checkStarted = s.now;
        narrate(
          s,
          'You',
          'The light is left on. A brief glow is not yet an evening of reliable light.',
        );
      }
      break;
    case 'wait-check':
      narrate(s, 'You', 'You watch the light for a while. It keeps shining.');
      break;
    case 'check-result':
      if (o) {
        o.verified = true;
        o.observations.push('After a longer run, movement and switching, the light stays steady.');
        narrate(s, 'You', 'After a longer run, movement and switching, the light stays steady.');
      }
      break;
    case 'ask-mum': {
      const mum = familyMember;
      tick(mum, s.now - duration);
      const helps = askMumToHelp(mum);
      s.unlocked.push(`help:${o?.id}`);
      s.humanNote = helps
        ? 'Mum chooses a little more time together, holding the light while you check.'
        : 'Mum has had some company and chooses her own chapter. The check can continue without her.';
      narrate(
        s,
        'Mum',
        helps
          ? 'All right. You move the switch; I’ll keep it steady.'
          : 'That was nice, sitting together. I’m going back to my chapter. Leave it on — you can still watch it.',
      );
      break;
    }
    case 'early-return':
    case 'return':
      if (o && id === 'early-return') {
        o.returnedEarly = true;
        o.callbackSeen = false;
        o.callbackAt = s.now + 25;
        delete o.checkStarted;
      }
      if (o) {
        o.location = 'returned';
        if (o.verified) {
          s.repairs++;
          o.returnedEarly = false;
        }
        if (o.returnedEarly)
          narrate(
            s,
            'You',
            'It lights now, but I have not given it the longer check. Tell me if it falters.',
            'notice',
          );
        s.focusId = null;
        s.parts.batteries = 1;
        if (o.id === 'family' && !s.objects.some((x) => x.id === 'personal')) {
          s.objects.push(
            object(
              'personal',
              'Your bedside lamp',
              'You',
              'You kept meaning to fix the little lamp from your old room.',
              'holder',
            ),
          );
          s.focusId = 'personal';
          s.chapter = 'later';
          narrate(
            s,
            'Mum',
            o.returnedEarly
              ? 'Thank you for saying it has not had the longer check. I’ll keep the other light nearby. Your old bedside lamp is still here too, if you’d like to look.'
              : 'That’s much better. I can finish my chapter tonight. Thank you. Your old bedside lamp is still here too, if you’d like to look.',
            'warm',
          );
        } else if (o.id === 'personal' && !o.returnedEarly)
          narrate(
            s,
            'You',
            'Back beside the bed, with a part that would have been thrown away.',
            'warm',
          );
        else if (!o.returnedEarly)
          narrate(s, o.owner, 'I’m glad you checked it before giving it back. Thank you.', 'warm');
      }
      break;
    case 'shelve':
      if (o) {
        o.location = 'shelf';
        s.focusId = null;
        narrate(s, 'You', 'Put aside with its notes. Nothing is lost; you can come back to it.');
      }
      break;
    case 'resume':
      if (o) o.location = 'bench';
      break;
    case 'talk-garage':
      s.unlocked.push('garage');
      s.chapter = 'garage';
      narrate(
        s,
        'Mum',
        'There’s room on Dad’s bench. The old lamp box is under it; he said we could use anything in there.',
        'warm',
      );
      break;
    case 'search-donor':
      s.unlocked.push('donor');
      s.discoveries++;
      s.parts.holders++;
      narrate(
        s,
        'You',
        'One discarded lamp has a sound holder of the same size. The rest goes in the recycling box.',
      );
      break;
    case 'talk-friends':
      s.unlocked.push('friends');
      narrate(
        s,
        'Mum',
        'I told our friends Nora and Sam about your careful checks. They sometimes have a little lamp or torch that needs attention. We can keep one on the bench and one waiting safely on the shelf. No rush.',
        'warm',
      );
      break;
    case 'accept-request': {
      const n = s.requests++;
      // Game-owned LCG: job draws never depend on the actors’ RNG consumption.
      s.worldRng = (Math.imul(s.worldRng, 1664525) + 1013904223) >>> 0;
      const fault: Fault =
        n % 2 === 1 && s.worldRng >= 0x80000000
          ? 'cap'
          : s.worldRng < 0x80000000
            ? 'battery'
            : 'contact';
      s.objects = s.objects.filter(
        (x) =>
          !x.id.startsWith('friend-') ||
          x.location !== 'returned' ||
          (x.returnedEarly && !x.callbackSeen),
      );
      const person = n % 2 === 0 ? 'Nora' : 'Sam';
      if (person === 'Sam' && !s.unlocked.includes('met-sam')) s.unlocked.push('met-sam');
      const item = object(
        `friend-${n}`,
        person === 'Nora' ? 'Nora’s kitchen lamp' : 'Sam’s pocket torch',
        person,
        person === 'Nora'
          ? 'Used to find a glass of water without waking the household.'
          : 'It lives by the back door for evening walks.',
        fault,
        person === 'Nora' ? 'lamp' : 'torch',
      );
      s.objects.push(item);
      s.focusId = item.id;
      s.parts.batteries = 1;
      narrate(
        s,
        person,
        'It’s unreliable lately. Could you see what’s happening when you have a moment?',
        'warm',
      );
      break;
    }
    case 'rest':
      s.humanNote =
        'The cups are empty. Mum seems content to settle back into her book for a while.';
      break;
  }
  if (id !== 'rest')
    finish(p, {
      affordanceId: id,
      action: aff.action,
      at: s.now,
      status: failed ? 'failed' : 'completed',
      summary: failed ? 'An attempted repair revealed the remaining problem.' : aff.label,
      needs: id === 'rest' ? { leisure: 0.1 } : { competence: failed ? 0 : 0.03 },
    });
  if (contactName && !repeatedContact) s.unlocked.push(`met:${contactName}`);
  for (const line of lines) say(s, line.speaker, line.text, line.tone);
  const mum = s.people.mum;
  if (!mum) throw Error('Missing family member');
  tick(mum, s.now);
  for (const returned of s.objects) {
    if (
      returned.returnedEarly &&
      !returned.callbackSeen &&
      s.now >= (returned.callbackAt ?? Infinity)
    ) {
      returned.callbackSeen = true;
      returned.location = 'shelf';
      returned.verified = false;
      say(
        s,
        returned.owner,
        'It worked for a little while, but I kept wondering whether it would flicker again. Could we do that longer check after all? You said it had not been checked.',
        'notice',
      );
      returned.observations.push(
        'Returned for the promised longer check; the repair itself remains intact.',
      );
    }
  }
  return s;
}
export function getView(s: GameState): GameView {
  const o = focused(s);
  return {
    title:
      s.chapter === 'family'
        ? 'A little light'
        : s.chapter === 'garage'
          ? 'The garage bench'
          : 'At home',
    subtitle:
      s.chapter === 'garage' ? 'Familiar things, a place to work.' : 'An afternoon at home.',
    scene: s.chapter === 'garage' ? 'garage' : 'home',
    focus: o
      ? {
          id: o.id,
          title: o.title,
          owner: o.owner,
          story: itemStory(o.id, o.owner) ?? o.story,
          form: o.form,
          condition: o.verified
            ? 'Checked and ready'
            : o.repaired
              ? 'It lights up — still needs checking'
              : o.inspected && o.fault === 'holder'
                ? 'A broken holder'
                : o.inspected && o.fault === 'cap'
                  ? 'A loose cap contact'
                  : o.tested && o.fault === 'contact'
                    ? 'The contact needs attention'
                    : o.tested && o.fault === 'battery'
                      ? 'A tired battery'
                      : 'An unreliable light',
          visual: o.repaired
            ? 'steady'
            : o.fault === 'holder'
              ? 'broken'
              : o.fault === 'battery'
                ? 'off'
                : 'flickering',
          observations: [...o.observations],
          appearance:
            o.form === 'torch'
              ? 'torch'
              : o.id === 'family'
                ? 'reading'
                : o.id === 'personal'
                  ? 'bedside'
                  : 'kitchen',
        }
      : null,
    actions: available(s),
    conversation: s.conversation,
    currentDialogue: (s.journal ?? s.conversation).filter(
      (line) => line.id >= (s.eventStartId ?? 0),
    ),
    journal: [
      ...(s.journal ?? []),
      ...s.conversation.filter((line) => !s.journal?.some((entry) => entry.id === line.id)),
    ].sort((a, b) => a.id - b.id),
    shelf: s.objects
      .filter((x) => x.discovered && x.location === 'shelf')
      .map((x) => ({
        id: x.id,
        title: x.title,
        note: x.observations.at(-1) ?? 'Waiting for another look.',
      })),
    parts:
      s.unlocked.includes('donor') && s.parts.holders > 0
        ? [{ id: 'holders', label: 'Matching recovered holder', count: s.parts.holders }]
        : [],
    note:
      o?.checkStarted !== undefined && !o.verified
        ? s.now - o.checkStarted >= 20
          ? 'The longer run is ready to read.'
          : 'The light is still running. Tea, waiting, or another repair can fill the time.'
        : null,
    humanNote:
      o?.checkStarted !== undefined && !o.verified
        ? (s.humanNote ?? null)
        : (s.humanNote
            ?.replace(' The check can continue without her.', '')
            .replace(
              'Mum chooses a little more time together, holding the light while you check.',
              'Mum spends a little more time nearby.',
            ) ?? null),
  };
}
function packet(s: GameState) {
  return {
    engine: ENGINE,
    state: {
      ...s,
      people: Object.fromEntries(Object.entries(s.people).map(([k, p]) => [k, snapshot(p)])),
    },
  };
}
export function serializeGame(s: GameState): string {
  return JSON.stringify(packet(s));
}
export const exportPlaytest = serializeGame;
export function restoreGame(text: string): GameState {
  if (typeof text !== 'string' || text.length > 8_000_000) throw Error('Save is too large');
  const data = JSON.parse(text);
  if (data?.engine === 'home-garage-2') {
    const legacy = restoreLegacy(text);
    const conversation = legacy.conversation.map((line, id) => ({ ...line, id }));
    return {
      ...legacy,
      conversation,
      journal: [...conversation],
      nextLineId: conversation.length,
      legacySave: text,
      legacyInputCount: legacy.inputs.length,
      feedbackRevisionFrom: 0,
    };
  }
  if (
    !data ||
    data.engine !== ENGINE ||
    data.state?.schema !== 1 ||
    data.state?.scenario !== 1 ||
    data.state?.framework !== FRAMEWORK_VERSION ||
    !Array.isArray(data.state.inputs) ||
    data.state.inputs.length > 20000
  )
    throw Error('Unsupported save');
  if (
    data.state.legacySave &&
    (typeof data.state.legacySave !== 'string' ||
      JSON.parse(data.state.legacySave)?.engine !== 'home-garage-2')
  )
    throw Error('Invalid legacy save');
  let s = data.state.legacySave ? restoreGame(data.state.legacySave) : createGame(data.state.seed);
  const feedbackCutoff = data.state.feedbackRevisionFrom;
  if (
    feedbackCutoff !== undefined &&
    (!Number.isInteger(feedbackCutoff) ||
      feedbackCutoff < 0 ||
      feedbackCutoff > data.state.inputs.length)
  )
    throw Error('Invalid feedback revision');
  s.feedbackRevisionFrom = feedbackCutoff ?? data.state.inputs.length;
  if (data.state.legacyInputCount !== s.legacyInputCount) throw Error('Invalid migration history');
  for (const entry of data.state.inputs.slice(s.legacyInputCount ?? 0)) {
    if (!entry || entry.at !== s.now) throw Error('Invalid input history');
    s = transition(s, entry.input);
  }
  for (const p of Object.values(data.state.people ?? {})) restore(p);
  const replayed = packet(s);
  if (feedbackCutoff === undefined) delete replayed.state.feedbackRevisionFrom;
  if (JSON.stringify(replayed) !== JSON.stringify(data))
    throw Error('Save does not match its history');
  return s;
}
export const replayPlaytest = restoreGame;
