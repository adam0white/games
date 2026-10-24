import { describe, expect, it } from 'vitest';
import { labToolsEnabled } from '../src/ui/lab-tools';
import { plainText } from '../src/ui/plain-text';
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
  it('clarifies felt output without changing conditions or comparative severity', () => {
    expect(plainText('Only a faint glow while carried; not enough.')).toBe(
      'The light glows faintly while carried. It is not bright enough.',
    );
    expect(plainText('The melody drags a little under load.')).toBe(
      'The tune plays a little too slowly under load.',
    );
    expect(plainText('The melody drags under load.')).toBe('The tune plays too slowly under load.');
  });
  it('clarifies comparative fragments while preserving the speed comparison', () => {
    expect(plainText('About the same as the last try.')).toBe(
      'The tune plays at about the same speed as it did on the last try.',
    );
  });
  it('preserves names, cultural terms, numerical evidence and unrelated text', () => {
    const original = 'Halil, Nuran, Selin and Rafi in Bornova. 12 V from A to B.';
    expect(plainText(original)).toBe(original);
  });
});
