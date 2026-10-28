/** Compare recorded JSON data while retaining array order and every object field. */
export function matchesJson(text: string, value: unknown): boolean {
  const canonical = (item: unknown): string =>
    JSON.stringify(item, (_key, nested) =>
      nested && typeof nested === 'object' && !Array.isArray(nested)
        ? Object.fromEntries(
            Object.entries(nested).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
          )
        : nested,
    );
  try {
    return canonical(JSON.parse(text)) === canonical(value);
  } catch {
    return false;
  }
}
