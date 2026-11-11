import { createGame } from "./host";

/** Preserve random high bits while switching both seeded opening choices. */
export function restartGame(previousSeed: number, entropy: number) {
  const seed = ((entropy & ~3) | ((previousSeed ^ 3) & 3)) >>> 0;
  return createGame(seed);
}
