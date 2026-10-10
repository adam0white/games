/** Display only. Stored commitment labels and IDs retain their replay meaning.
 * The host supplies already known object titles; missing titles disclose no ID. */
export function commitmentLabel(
  label: string | undefined,
  knownObjects: readonly { id: string; title: string }[],
): string {
  if (!label) return 'An agreed appointment';
  const prefix = 'Checked collection: ';
  if (!label.startsWith(prefix)) return label;
  const object = knownObjects.find((item) => item.id === label.slice(prefix.length));
  return object ? `Checked collection of ${object.title}` : 'An agreed checked collection';
}
