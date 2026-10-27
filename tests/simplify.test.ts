import { describe, expect, it } from 'vitest';
import { workshopStartError } from '../src/ui/start-error';

describe('player presentation', () => {
  it('keeps SDK details out of ordinary startup recovery', () => {
    expect(workshopStartError()).not.toContain('Shelf');
    expect(workshopStartError()).toContain('unchanged');
    expect(workshopStartError()).toContain('Feedback');
  });
});
