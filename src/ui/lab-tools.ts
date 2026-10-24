/** Only the explicit lab URL exposes replay, import and continuity controls. */
export function labToolsEnabled(search: string): boolean {
  return new URLSearchParams(search).get('lab') === '1';
}
