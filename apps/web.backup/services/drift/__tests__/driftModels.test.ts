import { describe, expect, it } from '@jest/globals';
import { validateDriftEvent } from '../models/DriftEvent';
import { validateDriftResolution } from '../models/DriftResolution';
import { getSeverityForCause, inferSeverityForDrift } from '../rules/driftRuleSet';

const baseEvent = {
  clinicianId: 'clinician-123',
  driftType: 'LICENSE_STATUS' as const,
  severity: 'HIGH' as const,
  oldValue: { status: 'ACTIVE' },
  newValue: { status: 'SUSPENDED' },
  detectedAt: new Date().toISOString(),
};

describe('DriftEventSchema', () => {
  it('accepts a well-formed drift event', () => {
    const parsed = validateDriftEvent(baseEvent);
    expect(parsed.clinicianId).toBe(baseEvent.clinicianId);
    expect(parsed.oldValue).toEqual({ status: 'ACTIVE' });
    expect(parsed.resolvedAt).toBeUndefined();
  });

  it('rejects drift events with invalid drift type', () => {
    expect(() =>
      validateDriftEvent({
        ...baseEvent,
        driftType: 'UNKNOWN',
      })
    ).toThrow();
  });
});

describe('DriftResolutionSchema', () => {
  it('requires a known resolution type', () => {
    const input = {
      eventId: 'event-1',
      resolutionType: 'DATA_CORRECTION' as const,
      resolvedBy: 'analyst-7',
      resolvedAt: new Date().toISOString(),
      notes: 'Corrected CAQH record and re-synced PECOS',
    };

    const parsed = validateDriftResolution(input);
    expect(parsed.resolutionType).toBe('DATA_CORRECTION');
  });

  it('throws when resolution type is invalid', () => {
    expect(() =>
      validateDriftResolution({
        eventId: 'event-1',
        resolutionType: 'FIXED',
        resolvedBy: 'analyst-7',
        resolvedAt: new Date().toISOString(),
      })
    ).toThrow();
  });
});

describe('DriftRuleSet registry', () => {
  it('maps LICENSE_EXPIRED to CRITICAL severity', () => {
    expect(getSeverityForCause('LICENSE_EXPIRED')).toBe('CRITICAL');
  });

  it('maps NAME_VARIANT to LOW severity per policy', () => {
    expect(getSeverityForCause('NAME_VARIANT')).toBe('LOW');
  });

  it('falls back to default severity when cause missing', () => {
    expect(
      inferSeverityForDrift({
        driftType: 'DEA_STATUS',
      })
    ).toBe('MEDIUM');
  });
});

