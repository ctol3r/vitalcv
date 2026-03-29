import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const employerSummaryCardSource = readFileSync(
  new URL('../components/apply/EmployerSummaryCard.tsx', import.meta.url),
  'utf8',
);

describe('employer summary card wording', () => {
  it('keeps the buyer-facing share framed as a public snapshot, not a full decision surface', () => {
    expect(employerSummaryCardSource).toContain('public readiness snapshot for employer review');
    expect(employerSummaryCardSource).toContain('full decision report and employer actions');
    expect(employerSummaryCardSource).not.toContain('verified review');
    expect(employerSummaryCardSource).not.toContain('ready to hire');
  });

  it('keeps blocker, verified, and missing buckets explicit in the buyer surface', () => {
    expect(employerSummaryCardSource).toContain('title="Verified"');
    expect(employerSummaryCardSource).toContain('title="Missing"');
    expect(employerSummaryCardSource).toContain('title="Blocked"');
    expect(employerSummaryCardSource).toContain('emptyLabel="No current blockers."');
  });
});
