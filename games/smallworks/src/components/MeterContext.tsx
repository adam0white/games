import { requiredChecks } from '../game/engine';
import { testWords } from '../game/test-words';
import type { Evidence, Job, TestCondition } from '../game/types';

export function MeterContext({
  job,
  reading,
  condition,
}: {
  job: Job;
  reading?: Evidence;
  condition: TestCondition;
}) {
  const checks = requiredChecks(job);
  const required = checks.map((c) => testWords[c]).join(' and ');
  const comparison = [...new Set<TestCondition>(['bench', ...checks])].map((c) => testWords[c]);
  return (
    <>
      {reading?.request?.mode === 'voltage' && (
        <p>
          This is the voltage difference between the two probes under the condition shown above.
          {comparison.length > 1 && <>Compare the same probes {comparison.join(' and ')}. </>}
          Try measuring across another connection {required}. A source reading alone does not
          identify a faulty part.
        </p>
      )}
      {!checks.includes(condition) && (
        <p>
          The owner needs a check {required}; the selected meter condition is {testWords[condition]}
          .
        </p>
      )}
    </>
  );
}
