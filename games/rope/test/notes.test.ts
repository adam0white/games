// @vitest-environment happy-dom
import { readFileSync } from 'node:fs';
import { afterEach, expect, it } from 'vitest';

const css = readFileSync('src/ui/style.css', 'utf8');

afterEach(() => {
  document.head.innerHTML = '';
  document.body.innerHTML = '';
});

it('keeps essential tutorial instructions reachable by wrapping or scrolling', () => {
  document.head.innerHTML = `<style>${css}</style>`;
  document.body.innerHTML =
    '<div class="note"><button aria-label="dismiss">×</button><span class="note-copy">Someone is flagging. Pick them, then open <strong>more actions</strong> to <strong>take their pack</strong> or <strong>share food</strong> from yours.</span></div>';
  const note = document.querySelector('.note') as HTMLElement;
  const copy = document.querySelector('.note-copy') as HTMLElement;
  // Browser receipts cover actual wrapping and access to both ends of the note.
  // A bounded container must scroll; the copy must never discard instructions.
  const noteStyle = getComputedStyle(note);
  if (!['', 'none'].includes(noteStyle.maxHeight)) {
    expect(['auto', 'scroll']).toContain(noteStyle.overflowY || noteStyle.overflow);
  }
  expect(getComputedStyle(copy).getPropertyValue('-webkit-line-clamp')).toBe('');
  expect(getComputedStyle(copy).overflow).not.toBe('hidden');
});

it('names the tired person when teaching pack help', async () => {
  const { startClimb } = await import('../src/sim/climb.ts');
  const { nextNote } = await import('../src/ui/disclosure.ts');
  const state = startClimb(4, 3, undefined, 'hollin', 2);
  const oskar = state.members.find((m) => m.id === 'oskar');
  if (!oskar) throw new Error('Missing Oskar');
  oskar.rations = 0;
  const note = nextNote(
    { unlocked: ['insist', 'tell', 'promise', 'rope', 'fix'], seen: ['intro', 'people', 'walk'] },
    state,
  );
  expect(note?.text).toContain('Oskar');
  expect(note?.text).not.toContain('Someone');
  expect(note?.text).toContain('more requests');
});

it('does not keep teaching a completed first request', async () => {
  const { startClimb, queueInput, step } = await import('../src/sim/climb.ts');
  const { nextNote } = await import('../src/ui/disclosure.ts');
  const s = startClimb(4, 3);
  queueInput(s, { t: 'say', act: 'rest', to: 'all', force: 'ask' });
  step(s);
  expect(nextNote({ unlocked: ['insist'], seen: ['lead'] }, s)?.id).not.toBe('ask');
});

it('keeps the first cue until a real upward lead and skips only on request', async () => {
  const { startClimb, queueInput, step } = await import('../src/sim/climb.ts');
  const { newDisclosure, nextNote } = await import('../src/ui/disclosure.ts');
  const state = startClimb(4, 3);
  const disc = newDisclosure();
  disc.seen.push('lead');
  expect(nextNote(disc, state)?.id).toBe('lead');
  queueInput(state, { t: 'lead', dir: 'up' });
  step(state);
  expect(nextNote(disc, state)?.id).toBe('ask');
  disc.seen.push('intro-skip');
  expect(nextNote(disc, state)?.id).not.toBe('ask');
});

it('offers refusal guidance when a player makes another request before leading', async () => {
  const { startClimb, queueInput, step } = await import('../src/sim/climb.ts');
  const { newDisclosure, nextNote } = await import('../src/ui/disclosure.ts');
  const state = startClimb(4, 3);
  queueInput(state, { t: 'say', act: 'rest', to: 'all', force: 'ask' });
  step(state);
  // A controlled response tests the guidance gate, not the simulation's verdict.
  state.lines.push({ at: state.minute, who: 'oskar', input: 0, verdict: 'refused', reason: '', says: '' });
  expect(nextNote(newDisclosure(), state)?.id).toBe('insist');
});
