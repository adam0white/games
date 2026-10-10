import { afterEach, describe, expect, it, vi } from 'vitest';
import { readStory, SAVE_KEY, writeStory } from '../src/ui/storage';

afterEach(() => vi.unstubAllGlobals());

describe('browser story storage', () => {
  it('retains the exact story for reload', () => {
    const entries = new Map<string, string>();
    vi.stubGlobal('window', {
      localStorage: {
        getItem: (key: string) => entries.get(key) ?? null,
        setItem: (key: string, value: string) => entries.set(key, value),
      },
    });
    const story = '{"partialRepair":"put aside","seed":19}';
    expect(readStory()).toBeNull();
    expect(writeStory(story)).toBe(true);
    expect(entries.get(SAVE_KEY)).toBe(story);
    expect(readStory()).toBe(story);
  });

  it('allows in-memory play when browser storage access is denied', () => {
    vi.stubGlobal('window', {
      get localStorage() {
        throw new Error('Access denied');
      },
    });
    expect(readStory()).toBeNull();
    expect(writeStory('story')).toBe(false);
  });

  it('reports quota failure without replacing the existing stored story', () => {
    const saved = 'old story';
    vi.stubGlobal('window', {
      localStorage: {
        getItem: () => saved,
        setItem: () => {
          throw new Error('Quota exceeded');
        },
      },
    });
    expect(writeStory('new story')).toBe(false);
    expect(readStory()).toBe(saved);
  });
});
