import { describe, it, expect } from '@jest/globals';
import {
  parsePecosProvider,
  parsePecosProviderUpdate,
  PecosEnrollmentType,
  PecosProviderStatus,
  mapProviderStatusToEnrollment,
} from '../models/PECOSProvider.js';
import {
  parsePecosDocument,
  parsePecosDocumentUpdate,
  PecosDocumentType,
} from '../models/PECOSDocuments.js';

describe('PECOS models', () => {
  const baseProvider = {
    clinicianId: 'did:example:123',
    enrollmentType: PecosEnrollmentType.CMS855I,
    npi: '1234567890',
    medicareId: 'MED-123',
    status: PecosProviderStatus.ENROLLED,
    effectiveDate: new Date().toISOString(),
    revalidationDate: new Date(Date.now() + 1000).toISOString(),
    lastCheckedAt: new Date().toISOString(),
  };

  it('should validate PECOS provider payloads', () => {
    const parsed = parsePecosProvider(baseProvider);
    expect(parsed.clinicianId).toBe(baseProvider.clinicianId);
    expect(parsed.status).toBe(PecosProviderStatus.ENROLLED);
  });

  it('should reject invalid PECOS provider payloads', () => {
    expect(() =>
      parsePecosProvider({
        ...baseProvider,
        clinicianId: '',
      })
    ).toThrow();
  });

  it('should validate PECOS provider updates', () => {
    const parsed = parsePecosProviderUpdate({
      id: 'ck123',
      status: PecosProviderStatus.DEACTIVATED,
    });
    expect(parsed.status).toBe(PecosProviderStatus.DEACTIVATED);
  });

  it('should validate PECOS documents', () => {
    const parsed = parsePecosDocument({
      providerId: 'provider-1',
      documentType: PecosDocumentType.CMS855I,
      submittedAt: new Date().toISOString(),
      parsedFields: { controlNumber: 'CMS855I-1' },
    });

    expect(parsed.documentType).toBe(PecosDocumentType.CMS855I);
  });

  it('should validate PECOS document updates', () => {
    const parsed = parsePecosDocumentUpdate({
      id: 'doc-1',
      providerId: 'provider-1',
      documentType: PecosDocumentType.CMS855R,
    });

    expect(parsed.documentType).toBe(PecosDocumentType.CMS855R);
  });

  it('maps provider status to enrollment status', () => {
    expect(mapProviderStatusToEnrollment(PecosProviderStatus.ENROLLED)).toBe('APPROVED');
    expect(mapProviderStatusToEnrollment(PecosProviderStatus.PENDING)).toBe('SUBMITTED');
    expect(mapProviderStatusToEnrollment(PecosProviderStatus.REJECTED)).toBe('DENIED');
    expect(mapProviderStatusToEnrollment(PecosProviderStatus.DEACTIVATED)).toBe('TERMINATED');
  });
});

