import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  acknowledgeConversation,
  conversationCue,
  initialConversation,
  RecentConversation,
} from '../src/components/RecentConversation';
import { createGame, dispatch, requiredChecks } from '../src/game/engine';
import { type SpokenLine, todaysWords } from '../src/ui/crises';

const opening: SpokenLine = {
  id: 1,
  at: 540,
  speaker: 'Mum',
  text: 'The light flickers when I carry it.',
  tone: 'ordinary',
};
const warning: SpokenLine = {
  id: 2,
  at: 550,
  speaker: 'Nora',
  text: 'It isn’t quite her box any more.',
  tone: 'warning',
};

describe('recent conversation acknowledgment', () => {
  it('keeps opening speech collapsed without adding an unread cue or words', () => {
    const lines = todaysWords(createGame(42));
    expect(conversationCue(initialConversation(lines), lines)).toBe('');
    const markup = renderToStaticMarkup(
      createElement(RecentConversation, { lines, canAskSam: false, onAskSam: () => {} }),
    );
    expect(markup).toContain('<summary>Recent conversation</summary>');
    expect(markup).not.toContain(' open=');
    expect(markup).not.toContain('role="alert"');
    expect(markup).toContain('What people said today');
  });

  it('names the new warning’s speaker while full speech stays available on request', () => {
    const state = initialConversation([opening]);
    expect(conversationCue(state, [warning, opening])).toBe(' · 1 new · Nora');
    expect(conversationCue(state, [warning, opening])).not.toContain(warning.text);
  });

  it('surfaces Nora’s actual engine warning after a replacement return', () => {
    let state = dispatch(createGame(42), { type: 'next-day' }).state;
    const box = state.jobs.find((job) => job.title === 'Nora’s keepsake music box');
    if (!box) throw new Error('Missing keepsake box');
    // Focused return fixture: the repair is already completed with a replacement.
    for (const part of box.model.components) {
      part.condition = 'good';
      if (part.kind === 'governor') part.setting = 2;
    }
    box.model.ratedDrive = (box.model.desiredRPM ?? 15) * 2 * (box.model.gearRatio ?? 4);
    box.status = 'ready';
    box.verified = requiredChecks(box);
    box.contributions.push({ actorId: 'player', action: 'replace:drive', at: state.now });
    const baseline = initialConversation(todaysWords(state));
    const returned = dispatch(state, { type: 'deliver', jobId: box.id });
    expect(returned.ok, returned.message).toBe(true);
    expect(returned.message).toBe('Returned to use.');
    state = returned.state;
    const lines = todaysWords(state);
    expect(lines.some((line) => line.tone === 'warning' && line.text.includes(warning.text))).toBe(
      true,
    );
    expect(conversationCue(baseline, lines)).toMatch(/new · Nora/);
  });

  it('acknowledges opening the conversation and speech arriving while it is open', () => {
    const lines = [warning, opening];
    const opened = acknowledgeConversation(initialConversation([opening]), lines, true);
    expect(conversationCue(opened, lines)).toBe('');
    const later = { ...warning, id: 3, speaker: 'Sam', text: 'I can watch.' };
    expect(conversationCue(opened, [later, ...lines])).toBe('');
    const closed = acknowledgeConversation(opened, [later, ...lines], false);
    expect(conversationCue(closed, [later, ...lines])).toBe('');
    expect(conversationCue(closed, [{ ...warning, id: 4 }, later, warning])).toBe(
      ' · 1 new · Nora',
    );
  });

  it('uses a fresh quiet baseline on import/reset even when log ids overlap', () => {
    const old = acknowledgeConversation(initialConversation([warning]), [warning], true);
    expect(old.open).toBe(true);
    const imported = initialConversation([opening, warning]);
    expect(imported.open).toBe(false);
    expect(conversationCue(imported, [warning, opening])).toBe('');
    const reset = initialConversation([opening]);
    expect(conversationCue(reset, [warning, opening])).toBe(' · 1 new · Nora');
  });

  it('retains the existing today/window filter and never reads private person state', () => {
    const state = createGame(42);
    const baseline = initialConversation(todaysWords(state));
    const nextId = Math.max(...state.log.map((line) => line.id)) + 1;
    state.log.push({ ...warning, id: nextId, at: state.now });
    expect(conversationCue(baseline, todaysWords(state))).toBe(' · 1 new · Nora');
    state.now += 121;
    expect(conversationCue(baseline, todaysWords(state))).toBe('');
  });
});
