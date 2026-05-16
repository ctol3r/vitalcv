/**
 * runNcqaValidationGate.ts — W2-PR40A
 *
 * CI tool that runs the in-process NCQA validation suite from
 * `services/audit/regulatoryExports/ncqaValidationGate.ts` and exits
 * non-zero on any failure. Wired into CI via the `ncqa:validate` script
 * in apps/api/backend/package.json and a step in monorepo.yml.
 */
import { runNcqaValidationGate } from '../services/audit/regulatoryExports/ncqaValidationGate';

function main(): void {
  const verdict = runNcqaValidationGate();

  // eslint-disable-next-line no-console
  console.log('NCQA validation gate — checks:');
  for (const check of verdict.checks) {
    const mark = check.passed ? 'PASS' : 'FAIL';
    // eslint-disable-next-line no-console
    console.log(`  [${mark}] ${check.id} — ${check.detail}`);
  }
  // eslint-disable-next-line no-console
  console.log(
    `\nNCQA validation gate verdict: ${verdict.ok ? 'OK' : 'FAILED'} (${verdict.passed} passed, ${verdict.failed} failed)`,
  );

  if (!verdict.ok) {
    process.exit(1);
  }
}

main();
