import { describe, expect, it } from 'vitest';
import { labToolsEnabled } from '../src/ui/lab-tools';
import { workshopStartError } from '../src/ui/start-error';

describe('player presentation', () => {
  it('keeps SDK errors out of ordinary startup recovery while retaining lab detail', () => {
    const error = new Error('Shelf unavailable. Use a local file.');
    expect(workshopStartError(error, false)).not.toContain('Shelf');
    expect(workshopStartError(error, false)).not.toContain('file');
    expect(workshopStartError(error, false)).toContain('unchanged');
    expect(workshopStartError(error, false)).toContain('Feedback');
    expect(workshopStartError(error, true)).toBe(error.message);
  });

  it.each(['', '?lab=0', '?lab=true', '?seed=1', '?collab=1'])(
    'keeps lab tools out of %s',
    (search) => {
      expect(labToolsEnabled(search)).toBe(false);
    },
  );
  it('enables lab tools only with the explicit flag', () => {
    expect(labToolsEnabled('?lab=1')).toBe(true);
    expect(labToolsEnabled('?x=2&lab=1')).toBe(true);
  });
});
