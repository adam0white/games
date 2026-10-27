import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { LessonControl } from '../src/components/LessonControl';
import { PersonalReply } from '../src/components/PersonalReply';
import { RecentConversation } from '../src/components/RecentConversation';
import { discoveredAccounts } from '../src/game/cast-content';
import { createGame, dispatch, saveGame } from '../src/game/engine';
import type { Command, GameState } from '../src/game/types';

function act(s: GameState, c: Command) {
  const r = dispatch(s, c);
  expect(r.ok, r.message).toBe(true);
  return r.state;
}
function lesson(s: GameState) {
  return renderToStaticMarkup(
    createElement(LessonControl, { state: s, act: () => {}, onBench: () => {} }),
  );
}
describe('visible route to an actual shared observation', () => {
  it('offers request, actual agreement, bench test and retained witness rather than teaching by a label', () => {
    let s = createGame(42);
    expect(lesson(s)).toContain('Share an observation with Sam');
    expect(lesson(s)).toContain('Request lesson');
    expect(lesson(s)).toContain('Go to the held object');
    const unwatched = act(s, { type: 'verify', jobId: s.selectedJobId, condition: 'movement' });
    expect(unwatched.jobs[0]?.evidence.at(-1)?.witnessedBy ?? []).not.toContain('sam');
    expect(dispatch(unwatched, { type: 'ask-about-work', personId: 'sam' }).ok).toBe(false);
    const before = saveGame(s);
    lesson(s);
    expect(saveGame(s)).toBe(before);
    s = act(s, { type: 'request-lesson' });
    expect(s.watching).toBe(false);
    expect(lesson(s)).toContain('Start lesson');
    s = act(s, { type: 'start-lesson' });
    expect(s.watching).toBe(true);
    s = act(s, { type: 'verify', jobId: s.selectedJobId, condition: 'movement' });
    expect(s.jobs[0]?.evidence.at(-1)?.witnessedBy).toContain('sam');
    expect(lesson(s)).toContain('Witnessed test');
    expect(dispatch(s, { type: 'ask-about-work', personId: 'sam' }).ok).toBe(true);
    s = act(s, { type: 'watch', enabled: false });
    s = act(s, { type: 'verify', jobId: s.selectedJobId, condition: 'movement' });
    expect(s.jobs[0]?.evidence.at(-1)?.witnessedBy ?? []).not.toContain('sam');
  });
  it('keeps Halil’s exact quoted words and moves narrator limits outside the speech', () => {
    const original = discoveredAccounts.halil;
    const markup = renderToStaticMarkup(
      createElement(RecentConversation, {
        lines: [{ id: 1, at: 540, speaker: 'Halil', text: original, tone: 'ordinary' }],
        canAskSam: false,
        onAskSam: () => {},
      }),
    );
    expect(markup).toContain('Nuran asked why I would not name a price.');
    expect(markup).toContain('<summary>Narrator limits</summary>');
    expect(markup.indexOf('hypertension')).toBeGreaterThan(
      markup.indexOf('<summary>Narrator limits</summary>'),
    );
    expect(discoveredAccounts.halil).toBe(original);
  });
  it('retains the disclosed account when ordinary history retention has removed the statement', () => {
    let s = createGame(42);
    s = act(s, { type: 'watch', enabled: true });
    s = act(s, { type: 'verify', jobId: s.selectedJobId, condition: 'movement' });
    s = act(s, { type: 'ask-about-work', personId: 'sam' });
    // Existing 160-line log retention is exercised through legal inputs, without changing saved history.
    for (let n = 0; n < 160; n++) s = act(s, { type: 'watch', enabled: false });
    expect(s.log.some((e) => e.text === discoveredAccounts.sam)).toBe(false);
    const markup = renderToStaticMarkup(
      createElement(PersonalReply, { state: s, personId: 'sam', act: () => {} }),
    );
    expect(markup).toContain('I once copied another player');
    expect(markup).toContain('That conversation has ended.');
    expect(markup).toContain('disabled');
  });
});
