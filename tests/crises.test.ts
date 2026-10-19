import { describe, expect, it } from 'vitest';
import { createGame, dispatch } from '../src/game/engine';
import { workshopCrises } from '../src/ui/crises';

describe('surfaced workshop problems', () => {
  it('names an overdue promise first, without hidden state', () => {
    let state = createGame(416);
    const job = state.jobs.find(
      (j) => !j.isDonor && !j.isPersonal && ['offer', 'active'].includes(j.status),
    );
    if (!job) throw new Error('No opening object');
    if (job.status === 'offer') state = dispatch(state, { type: 'accept', jobId: job.id }).state;
    expect(workshopCrises(state).some((c) => c.urgent)).toBe(false);
    state = dispatch(state, { type: 'next-day' }).state;
    state = dispatch(state, { type: 'next-day' }).state;
    const [first] = workshopCrises(state);
    expect(first?.urgent).toBe(true);
    expect(first?.jobId).toBe(job.id);
    expect(first?.text).toContain('You said');
  });
});

describe('names inside sentences', () => {
  it('keeps a person’s name and lowers the rest', async () => {
    const { inSentence } = await import('../src/ui/crises');
    expect(inSentence('Nora’s keepsake music box')).toBe('Nora’s keepsake music box');
    expect(inSentence('The community room fan')).toBe('the community room fan');
  });
});
