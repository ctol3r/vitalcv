import { describe, it, expect } from '@jest/globals';
import {
  mapProviderStatusToEnrollment,
  parsePecosProvider,
  parsePecosProviderUpdate,
  PecosEnrollmentType,
  PecosProviderStatus,
} from '../models/PECOSProvider.js';
import {
  parsePecosDocument,
  parsePecosDocumentUpdate,
  PecosDocumentType,
} from '../models/PECOSDocuments.js';
import {
  appendLifecycleEvent,
  PecosLifecycleStatus,
  PecosStatusSource,
} from '../models/PECOSEnrollment.js';
import { runPecosStatusEngine } from '../statusEngine.js';
import { detectPecosDiscrepancies } from '../detectDiscrepancies.js';

describe('PECOS models', () => {
  const baseProvider = {
    clinicianId: 'did:example:123',
    enrollmentType: PecosEnrollmentType.CMS855I,
    npi: '1234567890',
    medicareId: 'MED-123',
    status: PecosProviderStatus.ENROLLED,
    effectiveDate: new Date().toISOString(),
    revalidationDate: new Date(Date.now() + 1_000_000).toISOString(),
    lastCheckedAt: new Date().toISOString(),
  };

  it('validates PECOS provider payloads', () => {
    const parsed = parsePecosProvider(baseProvider);
    expect(parsed.status).toBe(PecosProviderStatus.ENROLLED);
  });

  it('rejects invalid PECOS providers', () => {
    expect(() => parsePecosProvider({ ...baseProvider, clinicianId: '' })).toThrow();
  });

  it('parses PECOS provider updates', () => {
    const parsed = parsePecosProviderUpdate({ id: 'ck123', status: PecosProviderStatus.DEACTIVATED });
    expect(parsed.status).toBe(PecosProviderStatus.DEACTIVATED);
  });

  it('validates PECOS documents', () => {
    const parsed = parsePecosDocument({
      providerId: 'provider-1',
      documentType: PecosDocumentType.CMS855I,
      submittedAt: new Date().toISOString(),
      parsedFields: { controlNumber: 'CMS855I-1' },
    });
    expect(parsed.documentType).toBe(PecosDocumentType.CMS855I);
  });

  it('parses PECOS document updates', () => {
    const parsed = parsePecosDocumentUpdate({ id: 'doc-1', providerId: 'p1', documentType: PecosDocumentType.CMS855R });
    expect(parsed.documentType).toBe(PecosDocumentType.CMS855R);
  });

  it('maps provider status to enrollment status', () => {
    expect(mapProviderStatusToEnrollment(PecosProviderStatus.ENROLLED)).toBe('APPROVED');
    expect(mapProviderStatusToEnrollment(PecosProviderStatus.PENDING)).toBe('SUBMITTED');
    expect(mapProviderStatusToEnrollment(PecosProviderStatus.REJECTED)).toBe('DENIED');
    expect(mapProviderStatusToEnrollment(PecosProviderStatus.DEACTIVATED)).toBe('TERMINATED');
  });
});


describe('PECOS lifecycle utilities', () => {
  it('appends lifecycle events chronologically', () => {
    const initial = appendLifecycleEvent([], {
      status: PecosLifecycleStatus.PENDING,
      occurredAt: new Date('2023-01-01'),
      source: PecosStatusSource.CMS,
    });
    const updated = appendLifecycleEvent(initial, {
      status: PecosLifecycleStatus.ENROLLED,
      occurredAt: new Date('2023-02-01'),
      source: PecosStatusSource.CMS,
    });
    expect(updated).toHaveLength(2);
    expect(updated[1].status).toBe(PecosLifecycleStatus.ENROLLED);
  });

  it('derives revalidation due status when date approaches', () => {
    const result = runPecosStatusEngine({
      enrollmentType: PecosEnrollmentType.CMS855I,
      providerStatus: PecosProviderStatus.ENROLLED,
      history: [],
      effectiveDate: new Date('2020-01-01').toISOString(),
      revalidationDate: new Date('2024-12-01').toISOString(),
      checkedAt: new Date('2024-10-15'),
    });
    expect(result.currentStatus).toBe(PecosLifecycleStatus.REVALIDATION_DUE);
    expect(result.history).toHaveLength(1);
  });

  it('detects discrepancies between expected and observed PECOS data', () => {
    const discrepancies = detectPecosDiscrepancies(
      {
        enrollmentType: PecosEnrollmentType.CMS855B,
        specialties: ['207R00000X'],
        practiceLocations: [{ state: 'TX' }],
      },
      {
        expectedEnrollmentType: PecosEnrollmentType.CMS855I,
        specialties: ['207R00000X'],
        practiceLocations: [{ state: 'CA' }],
      }
    );
    expect(discrepancies.length).toBeGreaterThan(0);
  });
});
