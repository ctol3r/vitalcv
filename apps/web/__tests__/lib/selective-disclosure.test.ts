import { buildPresentationRequestPayload } from '@/lib/selective-disclosure';

describe('selective-disclosure', () => {
  it('includes only selected claims in the presentation payload', () => {
    const payload = {
      credentialId: 'CRED-123',
      subjectId: 'npi:1234567890',
      licenseNumber: 'LIC-999',
      issuer: 'California Medical Board',
      additionalData: {
        specialization: 'Cardiology',
        boardScore: 95,
      },
      // JWT reserved claims (should never appear in disclosed claims)
      iat: 1700000000,
      exp: 1700003600,
      iss: 'vitalcv-demo-issuer',
    };

    const result = buildPresentationRequestPayload({
      credentialId: 'CRED-123',
      payload,
      selectedClaimPaths: ['subjectId', 'additionalData.specialization'],
      now: new Date('2026-01-09T00:00:00.000Z'),
    });

    expect(result.credentialId).toBe('CRED-123');
    expect(result.selectedClaimPaths).toEqual(['additionalData.specialization', 'subjectId']);
    expect(result.claims).toEqual({
      subjectId: 'npi:1234567890',
      additionalData: {
        specialization: 'Cardiology',
      },
    });

    // Ensure unselected fields are absent
    expect((result.claims as any).licenseNumber).toBeUndefined();
    expect((result.claims as any).issuer).toBeUndefined();
    expect((result.claims as any).additionalData?.boardScore).toBeUndefined();

    // Ensure reserved JWT claims are absent
    expect((result.claims as any).iat).toBeUndefined();
    expect((result.claims as any).exp).toBeUndefined();
    expect((result.claims as any).iss).toBeUndefined();
  });

  it('produces an empty claims object when nothing is selected', () => {
    const payload = {
      credentialId: 'CRED-1',
      subjectId: 'npi:1',
      licenseNumber: 'LIC-1',
    };

    const result = buildPresentationRequestPayload({
      credentialId: 'CRED-1',
      payload,
      selectedClaimPaths: [],
      now: new Date('2026-01-09T00:00:00.000Z'),
    });

    expect(result.claims).toEqual({});
    expect(result.selectedClaimPaths).toEqual([]);
  });
});

