/** Ordinary errors explain the action and recovery without exposing shelf protocol details. */
export function workshopStartError(): string {
  return 'The workshop could not open. Any saved workshop is unchanged. You can try again or use Feedback.';
}
export const damagedWorkshopMessage =
  'This saved workshop may come from an older version or be damaged. It cannot open here. It is still stored on this device. Choose New game to start fresh.';
