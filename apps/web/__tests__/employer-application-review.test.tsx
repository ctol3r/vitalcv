import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/components/applications/ApplicationEvidenceView', () => ({
  ApplicationEvidenceView: () => <div data-application-evidence-view="true" />,
}));
vi.mock('@/components/employer/EmployerDecisionControls', () => ({
  EmployerDecisionControls: () => <div data-employer-decision-controls="true" />,
}));

import { EmployerApplicationReview } from '@/components/employer/EmployerApplicationReview';

const workflowResult = {
  status: 'ok' as const,
  data: {
    id: 'a1111111-1111-4111-8111-111111111111',
    opportunityId: 'b1111111-1111-4111-8111-111111111111',
    clerkUserId: 'clinician-1', npi: '1558302470', coverNote: null, status: 'PENDING', reviewedBy: null, reviewedAt: null, reviewNote: null,
    createdAt: '2026-07-23T12:00:00.000Z', updatedAt: '2026-07-23T12:00:00.000Z', queue: 'applications' as const, workflowState: 'NEW' as const,
    missingRequests: [], provider: { npi: '1558302470', fullName: 'Ada Clinician', specialty: 'Cardiology', stateOfPractice: 'CA' },
    employer: { organizationId: 'org-1', name: 'Packet Test Health' }, readiness: null, latestRecommendation: null, timeline: [], systemBehavesAutonomously: false,
    opportunity: { id: 'b1111111-1111-4111-8111-111111111111', organizationId: 'org-1', organizationName: 'Packet Test Health', title: 'Cardiologist', specialty: 'Cardiology', hiringType: 'Full-time', state: 'CA', payRange: null, status: 'ACTIVE' },
  },
};

const evidenceResult = { status: 'not_found' as const };

describe('EmployerApplicationReview', () => {
  it('shows the authorized application context and exact-packet boundary without inventing unavailable decisions', () => {
    const html = renderToStaticMarkup(
      <EmployerApplicationReview workflowResult={workflowResult} evidenceResult={evidenceResult} />,
    );

    expect(html).toContain('Authorized employer review');
    expect(html).toContain('Ada Clinician');
    expect(html).toContain('data-application-evidence-view="true"');
    expect(html).toContain('Review the exact submitted packet below');
    expect(html).not.toContain('data-employer-decision-controls="true"');
    expect(html).not.toMatch(/Accept as head start|Request missing info|Reject/);
  });
});
