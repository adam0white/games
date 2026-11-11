import { requiredChecks } from '../game/engine';
import { runUseTest } from '../game/model';
import type { Evidence, Job, UseResult } from '../game/types';

// Presentation of earned use only. No check, audience, learning or completion is awarded here.
export function theatrePerformance(job: Job) {
  if (!job.isPersonal || job.isDonor || job.kind !== 'music-box') return undefined;
  const revision = job.evidence.findLast((entry) => entry.kind === 'work')?.id ?? 0;
  const use = job.evidence.findLast((entry) => entry.kind === 'use' && entry.id > revision);
  if (!use) return undefined;
  const recorded = use as Evidence & Partial<UseResult>;
  const measured = use.summary.match(/turns at (\d+(?:\.\d+)?) (?:rpm|turns per minute)/);
  const output =
    typeof recorded.output === 'number' && Number.isFinite(recorded.output)
      ? recorded.output
      : Number(measured?.[1] ?? 0);
  const working = Boolean(
    job.model.power &&
      use.condition &&
      use.cues.signal === 'steady-output' &&
      output > 0 &&
      requiredChecks(job).every(
        (condition) => job.verified.includes(condition) && runUseTest(job.model, condition).passes,
      ) &&
      runUseTest(job.model, use.condition).passes,
  );
  return { working, output, summary: use.summary };
}
