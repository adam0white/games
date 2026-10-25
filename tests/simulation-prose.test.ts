import { describe, expect, it } from 'vitest';
import { createCommunityEvent, finalizeCommunityEvent } from '../src/game/community';
import { createGame, dispatch } from '../src/game/engine';
import { helpFeedback } from '../src/game/help-feedback';
import { calibrate, createModel, intervene, measure } from '../src/game/model';

describe('simulation prose clarity', () => {
  it('describes slowing and speeding without negative reductions or changed readings', () => {
    const model = createModel('music-box', 1, []);
    const before = structuredClone(model);
    const slowing = measure(model, { mode: 'motion', a: 'A', b: 'B', condition: 'bench' });
    const speeding = measure(model, { mode: 'motion', a: 'B', b: 'A', condition: 'bench' });
    expect(slowing.value).toBe(-90);
    expect(speeding.value).toBe(90);
    expect(slowing.summary).toContain('It slows by 90 turns per minute');
    expect(speeding.summary).toContain('It speeds up by 90 turns per minute');
    expect(slowing.summary).not.toMatch(/Terminal|rpm|slows by -/);
    expect(model).toEqual(before);
  });

  it('keeps the voltage unit capitalized and explains mechanical part names', () => {
    expect(intervene(createModel('lantern', 1, []), 'cell', 'replace').summary).toContain('6 V');
    const model = createModel('music-box', 1, []);
    expect(intervene(model, 'spring', 'clean').summary).toContain('shaft that holds the spring');
    expect(calibrate(model, 'governor', 2).summary).toContain('speed control ring');
  });

  it('groups neighbours who chose the same alternative without claiming they attended', () => {
    const state = createGame(42);
    const event = createCommunityEvent();
    event.resolvedAt = 5220;
    event.decisions = [
      {
        personId: 'mum',
        activityLabel: 'Spend 30 minutes on: Visit a neighbour',
        speech: '',
        completed: false,
      },
      { personId: 'nora', activityLabel: 'Take a break', speech: '', completed: false },
      { personId: 'rafi', activityLabel: 'Take a break', speech: '', completed: false },
      { personId: 'sam', activityLabel: 'Have food and water', speech: '', completed: false },
      { personId: 'halil', activityLabel: 'Have food and water', speech: '', completed: false },
    ];
    finalizeCommunityEvent(state, event, 5250);
    expect(event.outcome).toBe(
      'Nobody finished an activity you prepared. Sam’s mother chose to visit a neighbour. Nora and Rafi chose to take a break. Sam and Halil chose to eat and drink.',
    );
    expect(event.decisions.every((decision) => !decision.completed)).toBe(true);
  });

  it('explains missing witnessed tests after a repair without claiming the object failed', () => {
    const state = createGame(42);
    const job = state.jobs[0];
    const sam = state.people.sam;
    if (!job || !sam) throw new Error('Missing opening cast');
    job.evidence.push({
      id: 1,
      at: state.now,
      kind: 'work',
      actorId: 'sam',
      summary: 'The contact was cleaned.',
      cues: {},
    });
    expect(helpFeedback(job, sam, [])).toBe(
      'Since the last change, I have not seen it pass every test it needs. Let me watch you test it the way it will be used.',
    );
  });

  it('makes clear that the player owes the return while Sam has the repair responsibility', () => {
    const state = createGame(42);
    const job = state.jobs[0];
    if (!job) throw new Error('Missing opening lantern');
    job.due = state.now - 1;
    job.assignedTo = 'sam';
    job.blocked = { at: state.now, kind: 'help', reason: 'Waiting for a lesson.' };
    const next = dispatch(state, { type: 'wait', minutes: 15 }).state;
    const reminder = next.log.find((line) => line.text.startsWith('You said '));
    expect(reminder?.text).toContain(
      'Sam is responsible for repairing it. I am still waiting for you to return it to me.',
    );
  });
});
