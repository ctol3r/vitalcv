import { describe, it, expect, vi } from 'vitest';
import { simulateCredentialRevocation } from '../liveSimulationEngine';
import { computeClinicianTrustState } from '../../trust/trustStateEngine';
import { capsuleEngine } from '../../decision/capsuleEngine';
import { appendAuditEvent } from '../../audit/auditLedger';

vi.mock('../../trust/trustStateEngine');
vi.mock('../../decision/capsuleEngine');
vi.mock('../../audit/auditLedger');

describe('liveSimulationEngine', () => {
  it('should calculate revenue and staffing impact', async () => {
    vi.mocked(computeClinicianTrustState).mockResolvedValue({
      readiness_level: 'L3',
      readiness_score: 95
    });
    vi.mocked(capsuleEngine.getCapsulesByNpi).mockResolvedValue([
      { id: 'cap1', subjectNpi: '1234567890', decisionType: 'PRIVILEGING', metadata: { opportunityId: 'org123' } } as any
    ]);

    const result = await simulateCredentialRevocation({ npi: '1234567890', credentialType: 'state_license' });
    
    expect(result.estimatedImpact).toBeDefined();
    expect(result.estimatedImpact.hospitalsAffected).toBe(1);
    expect(result.estimatedImpact.privilegesImpacted).toBe(1);
    expect(result.estimatedImpact.revenueImpact?.dailyRevenue).toBe(2500);
    expect(result.estimatedImpact.staffingGap?.uncoveredShifts).toBeGreaterThan(0);
    expect(appendAuditEvent).toHaveBeenCalled();
  });
});
