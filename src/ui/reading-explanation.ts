import type { Evidence } from '../game/types';

/** Explain only a recorded measurement, without inferring the hidden part condition. */
export function readingExplanation(reading: Evidence | undefined): string | undefined {
  const request = reading?.request;
  if (
    reading?.kind !== 'measurement' ||
    request?.mode !== 'voltage' ||
    reading.cues.signal !== 'high-drop' ||
    reading.value == null
  )
    return undefined;
  return `This reading is the voltage difference between ${request.a} and ${request.b}, not a second battery reading. A working connection usually loses less than 0.2 V. This larger difference points to a problem between the probes; it does not say why or prove a repair.`;
}
