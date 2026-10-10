export const SAVE_KEY = 'repair-game.story.v1';

export function readStory(): string | null {
  try {
    return window.localStorage.getItem(SAVE_KEY);
  } catch {
    return null;
  }
}

export function writeStory(text: string): boolean {
  try {
    window.localStorage.setItem(SAVE_KEY, text);
    return true;
  } catch {
    return false;
  }
}
