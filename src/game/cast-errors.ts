/** The existing character history is preserved when a passport cannot be admitted. */
export class UnsupportedCastChapter extends Error {
  constructor() {
    super(
      'This saved person belongs to an unsupported chapter. Keep or export it there; start fresh here.',
    );
  }
}
