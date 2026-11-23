// When the page loses the screen: another app, a phone call, a locked phone, another tab or window.
// A game calls its own pause from here; pausing an already paused game must be harmless.
export function onLeave(pause) {
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
  addEventListener('blur', () => pause());
  addEventListener('pagehide', () => pause());
}
// P or Escape toggles pause. Returns true when the key was a pause key, so the game can skip it.
export const isPauseKey = event => event.key === 'p' || event.key === 'P' || event.key === 'Escape';
