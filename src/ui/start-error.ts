/** Ordinary errors explain the action and recovery without exposing shelf protocol details. */
export function workshopStartError(error: unknown, labMode: boolean): string {
  const detail = error instanceof Error ? error.message : String(error);
  if (labMode) return detail;
  return 'The workshop could not open. Any saved workshop is unchanged. You can try again or use Feedback.';
}
export const damagedWorkshopMessage =
  'This saved workshop could not open. It is still stored on this device. Use Feedback to report it, or confirm New game to replace it.';
