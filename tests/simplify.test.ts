import { describe, expect, it } from 'vitest';
import { UnsupportedCastChapter } from '../src/game/cast-errors';
import { workshopStartError } from '../src/ui/start-error';

describe('player presentation', () => {
  it('keeps SDK details out of ordinary startup recovery', () => {
    expect(workshopStartError()).not.toContain('Shelf');
    expect(workshopStartError()).toContain('unchanged');
    expect(workshopStartError()).toContain('Feedback');
  });
});

it('explains a refused character history without exposing unrelated errors', () => {
  const unsupported = new UnsupportedCastChapter();
  expect(workshopStartError(unsupported)).toContain('character history');
  expect(workshopStartError(unsupported)).toContain('unchanged');
  expect(workshopStartError(new Error('private protocol detail'))).not.toContain(
    'private protocol detail',
  );
});
