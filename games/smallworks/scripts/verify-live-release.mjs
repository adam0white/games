const RELEASE_URL = 'https://repair.adamwhite.work/release.json';

export async function verifyLiveRelease(expected, budgetMs = 45_000) {
  if (expected.dirty !== false) throw Error('Expected release must be a clean integrated build');
  if (!Number.isFinite(budgetMs) || budgetMs <= 0 || budgetMs > 45_000) {
    throw Error('Release verification budget must be between 1 and 45000 milliseconds');
  }
  const deadline = performance.now() + budgetMs;
  let delay = 500;
  let lastResult = 'No release response received';
  while (performance.now() < deadline) {
    try {
      const remaining = Math.max(1, Math.floor(deadline - performance.now()));
      const response = await fetch(RELEASE_URL, {
        cache: 'no-store',
        signal: AbortSignal.timeout(remaining),
      });
      if (!response.ok) {
        lastResult = `Live release read failed: ${response.status}`;
      } else {
        const live = await response.json();
        if (performance.now() < deadline && live.dirty === false &&
            JSON.stringify(expected) === JSON.stringify(live)) return live;
        lastResult = `Live release mismatch: ${JSON.stringify(live)}`;
      }
    } catch (error) {
      lastResult = `Live release read failed: ${error.message}`;
    }
    const remaining = deadline - performance.now();
    if (remaining <= 0) break;
    await new Promise((resolve) => setTimeout(resolve, Math.min(delay, remaining)));
    delay = Math.min(delay * 2, 3_000);
  }
  throw Error(`Live release did not match the clean integrated build within ${budgetMs} ms. ${lastResult}`);
}
