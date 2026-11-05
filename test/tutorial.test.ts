import { describe, expect, it } from 'vitest';
import { tutorialCue } from '../src/ui/tutorial.ts';

describe('watch tutorial cues', () => {
  it('waits for actual request and response before moving to the gate', () => {
    expect(tutorialCue({ phase: 'read', gateOpen: false })).toBe('read');
    expect(tutorialCue({ phase: 'read', gateOpen: true })).toBe('gate-choice');
    expect(tutorialCue({ phase: 'waiting-read', gateOpen: false })).toBe('radio');
    expect(tutorialCue({ phase: 'waiting-read', gateOpen: true })).toBe('gate-choice');
    expect(tutorialCue({ phase: 'gate', gateOpen: false })).toBe('gate');
    expect(tutorialCue({ phase: 'gate', gateOpen: true })).toBe('gate-choice');
    expect(tutorialCue({ phase: 'waiting-gate', gateOpen: false })).toBe('radio');
    expect(tutorialCue({ phase: 'waiting-report', gateOpen: false })).toBe('radio');
    expect(tutorialCue({ phase: 'answered', gateOpen: false })).toBe('answer');
  });
});
