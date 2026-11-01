/** Current rules. Older notebooks remain downloadable but cannot continue. */
export const REMAINDER_EDITION = '0.10.0';
export const NATIVE_PACKAGE = '@adam0white/human-framework@4.15.1';

/** Refuse an older native package before any host replay or activation. */
export function requireCurrentNativePackage(archive: unknown): void {
  const engine = archive && typeof archive === 'object' && 'engine' in archive ? archive.engine : undefined;
  if (!engine || typeof engine !== 'object' || !('package' in engine) || engine.package !== NATIVE_PACKAGE)
    throw Error(START_FRESH);
}

export const START_FRESH =
  'This notebook was written under older rules. Download it if you want to keep it, then start a new week.';
export const isHf4Edition = (v: string | undefined) => v === '0.10.0' || v === '0.10.1' || v === '0.10.2';
export const isThreeWeekEdition = (v: string) => v === '0.10.1';
export const isOutcomesEdition = (v: string) => v === '0.10.2';
export function requireCurrentEdition(v: string | undefined): void {
  if (!isHf4Edition(v)) throw Error(START_FRESH);
}
export const sourceRules = (v: string) => {
  requireCurrentEdition(v);
  return REMAINDER_EDITION;
};
export const isCanonicalEdition = (v: string | undefined) => v === REMAINDER_EDITION;
