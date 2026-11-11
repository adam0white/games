import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');

describe('meter control grouping', () => {
  it('keeps probe controls before the diagram and pins the reading action after it', () => {
    const meterStart = app.indexOf("{pane === 'meter' && (");
    const diagramAfterControls = app.indexOf("{pane === 'meter' && diagram}", meterStart);
    const probeControls = app.indexOf('className="probe-tabs"', meterStart);
    const reading = app.indexOf('Read meter <small>', meterStart);
    expect(meterStart).toBeGreaterThan(-1);
    expect(probeControls).toBeGreaterThan(meterStart);
    expect(reading).toBeGreaterThan(probeControls);
    expect(diagramAfterControls).toBeGreaterThan(probeControls);
    expect(reading).toBeGreaterThan(diagramAfterControls);
    expect(reading).toBeGreaterThan(app.indexOf('className={`bench-action-bar'));
    expect(probeControls).toBeLessThan(reading);
    expect(app).not.toContain(
      "(pane === 'object' || pane === 'meter' || pane === 'repair') && diagram",
    );
  });

  it('keeps power available next to the reading when the phone object illustration is hidden', () => {
    const controls = app.slice(
      app.indexOf('className="meter-controls"'),
      app.indexOf("{pane === 'repair' && ("),
    );
    expect(controls).toContain('className="meter-power-toggle"');
    expect(controls).toContain("type: 'power'");
    expect(controls).toContain('aria-pressed={job.model.power}');
  });
});
