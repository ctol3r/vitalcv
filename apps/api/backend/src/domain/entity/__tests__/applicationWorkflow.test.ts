import { nextAction, VCVApplication } from '../vcvApplication';

describe('Application Workflow Engine', () => {
  test('Macie case: identity complete, sanctions pending, no critical blockers -> "Ready for review"', () => {
    const macieApp: Partial<VCVApplication> = {
      progress: {
        identity: 'complete',
        sanctions: 'pending',
        licensure: 'complete',
        enrollment: 'complete'
      },
      blockers: [
        { type: 'pending_oig', severity: 'medium' }
      ]
    };

    expect(nextAction(macieApp)).toBe('Ready for review');
  });

  test('nextAction yields "Upload required documents" when collecting docs', () => {
    const app: Partial<VCVApplication> = { status: 'collecting_docs' };
    expect(nextAction(app)).toBe('Upload required documents');
  });

  test('nextAction yields "Waiting on source response" when waiting on source', () => {
    const app: Partial<VCVApplication> = { status: 'waiting_on_source' };
    expect(nextAction(app)).toBe('Waiting on source response');
  });

  test('nextAction yields "Ready for credentialing review" when ready for review', () => {
    const app: Partial<VCVApplication> = { status: 'ready_for_review' };
    expect(nextAction(app)).toBe('Ready for credentialing review');
  });
});
