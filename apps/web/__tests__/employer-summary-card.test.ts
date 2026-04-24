import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const employerSummaryCardSource = readFileSync(
  new URL('../components/apply/EmployerSummaryCard.tsx', import.meta.url),
  'utf8',
);

describe('employer summary card wording', () => {
  it('keeps the buyer-facing share framed as a public snapshot, not a full decision surface', () => {
    expect(employerSummaryCardSource).toContain('Employer decision snapshot');
    expect(employerSummaryCardSource).toContain('Sign in to record the next action');
    expect(employerSummaryCardSource).not.toContain('verified review');
    expect(employerSummaryCardSource).not.toContain('ready to hire');
  });

  it('keeps blocker, verified, and missing buckets explicit in the buyer surface', () => {
    expect(employerSummaryCardSource).toContain('title="Verified now"');
    expect(employerSummaryCardSource).toContain('title="Still missing"');
    expect(employerSummaryCardSource).toContain('title="Blocks start"');
    expect(employerSummaryCardSource).toContain('emptyLabel="No current blockers."');
  });
});
