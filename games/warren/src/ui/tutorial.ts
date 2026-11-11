export type GuideStep = 'tool' | 'mark' | 'result' | 'done';
export type GuideAction = 'chalk' | 'mark' | 'refused';

export function advanceGuide(step: GuideStep, action: GuideAction): GuideStep {
  if (step === 'tool' && action === 'chalk') return 'mark';
  if (step === 'mark' && action === 'mark') return 'result';
  return step;
}
