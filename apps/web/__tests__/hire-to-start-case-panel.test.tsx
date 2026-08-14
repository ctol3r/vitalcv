import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
import { HireToStartCasePanel } from '@/components/applications/HireToStartCasePanel';
import { EmployerDecisionControls } from '@/components/employer/EmployerDecisionControls';
import type { HireToStartCase } from '@/lib/applications/hireToStart';

const data = {
  application: {
    id: 'app-1', status: 'ACCEPTED', submittedAt: '2026-08-14T10:00:00.000Z',
    opportunity: { id: 'opp-1', submittedVersion: 'v1', currentVersion: 'v2', title: 'Hospitalist', specialty: 'Internal Medicine', hiringType: 'permanent', state: 'CA', organizationId: 'org-1' },
  },
  accessPerspective: 'employer',
  submission: { mode: 'sealed', submittedPacket: { packetVersion: 1, packetHash: 'a'.repeat(64), lifecycle: 'active' } },
  packetBinding: { state: 'bound', packetVersion: 1, packetHash: 'a'.repeat(64), integrity: 'valid', limitations: [] },
  decision: { state: 'accepted_as_head_start', decidedAt: '2026-08-14T11:00:00.000Z', acceptanceId: 'accept-1', packetHash: 'a'.repeat(64), institutionReviewRemains: true },
  currentStage: 'requirements_in_progress', intendedStartDate: '2026-09-01T12:00:00.000Z', actualStart: null,
  requirements: [{ id: 'req-1', category: 'onboarding', label: 'Hospital orientation', necessity: 'required', status: 'not_started', owner: 'clinician', evidenceRule: null, dependencyIds: [], dueAt: '2026-08-28T12:00:00.000Z', resolvedBy: null, resolvedAt: null, policyVersion: 'v1', externalSourceSystem: null, externalObjectType: null, externalIdentifier: null, externalObservedAt: null, externalLimitation: null }],
  blockerSummary: [{ requirementId: 'req-1', label: 'Hospital orientation', status: 'not_started', owner: 'clinician', dueAt: '2026-08-28T12:00:00.000Z' }],
  primaryNextAction: { kind: 'clinician_requirement', owner: 'clinician', label: 'Hospital orientation', objectId: 'req-1' },
  milestones: [{ type: 'application_submitted', occurredAt: '2026-08-14T10:00:00.000Z' }, { type: 'head_start_accepted', occurredAt: '2026-08-14T11:00:00.000Z' }],
  externalSystemSync: { state: 'not_configured', lastEventAt: null, sources: [], limitations: ['No external ATS or credentialing event source is configured for this case.'] },
  limitations: [],
} as unknown as HireToStartCase;

describe('HireToStartCasePanel', () => {
  it('renders one honest joined case with owner, blocker, next action, and sync state', () => {
    const html = renderToStaticMarkup(<HireToStartCasePanel result={{ status: 'ok', data }} variant="employer" />);
    expect(html).toContain('data-hire-to-start-case="employer"');
    expect(html).toContain('Requirements in progress');
    expect(html).toContain('clinician owns this');
    expect(html).toContain('Hospital orientation');
    expect(html).toContain('Not configured for this case');
    expect(html).toContain('Actual first day');
    expect(html).not.toContain('credentialing complete');
  });

  it('does not render unauthorized case state', () => {
    expect(renderToStaticMarkup(<HireToStartCasePanel result={{ status: 'unauthorized' }} />)).toBe('');
  });

  it('offers exact-packet employer actions without claiming final clearance', () => {
    const reviewData = { ...data, decision: null, currentStage: 'employer_review' } as HireToStartCase;
    const html = renderToStaticMarkup(<EmployerDecisionControls data={reviewData} />);
    expect(html).toContain('Request clarification');
    expect(html).toContain('Accept as a head start');
    expect(html).toContain('Do not proceed');
    expect(html).toContain('credentialing and privileging authority remain with the institution');
    expect(html).not.toContain('Final clearance');
  });
});
