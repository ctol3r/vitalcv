import { buildProgress, buildHumanReadableSummary, ApplicationLanes } from '../credentialingIntelligence';

describe('Credentialing Intelligence', () => {
  test('Macie -> identity complete, others reflect real state', () => {
    const macieLanes: ApplicationLanes = {
      identity: { status: 'complete', source: 'NPPES' },
      sanctions: { status: 'complete', source: 'OIG' },
      licensure: { status: 'missing', source: 'state_board' },
      enrollment: { status: 'in_progress', source: 'PECOS' }
    };

    const progress = buildProgress(macieLanes);

    expect(progress).toEqual({
      identity: 'complete',
      sanctions: 'complete',
      licensure: 'missing',
      enrollment: 'in_progress'
    });

    const summary = buildHumanReadableSummary(progress);
    expect(summary).toBe('Identity verified. Sanctions verified. Licensure missing. Enrollment in progress.');
  });

  test('All missing', () => {
    const missingLanes: any = {
      identity: { status: 'missing' },
      sanctions: { status: 'missing' },
      licensure: { status: 'missing' },
      enrollment: { status: 'missing' }
    };

    const progress = buildProgress(missingLanes);
    const summary = buildHumanReadableSummary(progress);
    expect(summary).toBe('Identity missing. Sanctions missing. Licensure missing. Enrollment missing.');
  });
});
