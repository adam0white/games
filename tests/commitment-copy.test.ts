import { expect, it } from 'vitest';
import { commitmentLabel } from '../src/game/commitment-copy';

it('renders checked collection using only an actual known title, preserving the stored label and IDs', () => {
  const objects = [{ id: 'workshop-neighbourhood-nora-light', title: 'Nora’s oil-flask light' }];
  const label = 'Checked collection: workshop-neighbourhood-nora-light';
  expect(commitmentLabel(label, objects)).toBe('Checked collection of Nora’s oil-flask light');
  expect(label).toBe('Checked collection: workshop-neighbourhood-nora-light');
  expect(objects[0]?.id).toBe('workshop-neighbourhood-nora-light');
  expect(commitmentLabel(label, [])).toBe('An agreed checked collection');
  expect(commitmentLabel('Cabinet time with Dad', objects)).toBe('Cabinet time with Dad');
});
