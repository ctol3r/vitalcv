import {
  buildHireToStartIntegrationSignature,
  parseHireToStartInboundEvent,
  type HireToStartInboundEvent,
} from '../hireToStartIntegrationService';

const event: HireToStartInboundEvent = {
  version: '1',
  organizationId: 'a1111111-1111-4111-8111-111111111111',
  sourceSystem: 'partner-test',
  externalEventId: 'event-1',
  eventType: 'requirement.status_changed',
  applicationId: 'b1111111-1111-4111-8111-111111111111',
  occurredAt: '2026-08-14T20:00:00.000Z',
  data: {
    requirementId: 'c1111111-1111-4111-8111-111111111111',
    status: 'under_review',
    objectType: 'credentialing-case',
    externalIdentifier: 'CASE-123',
    limitation: 'Partner workflow status only; no attributable evidence artifact was supplied.',
  },
};

describe('hire-to-start integration envelope', () => {
  it('normalizes only the allowlisted operational fields and drops arbitrary vendor content', () => {
    const parsed = parseHireToStartInboundEvent({
      ...event,
      clinicianName: 'must not persist',
      diagnosis: 'must not persist',
      data: { ...event.data, privateNote: 'must not persist' },
    });
    expect(parsed).toEqual(event);
    expect(parsed).not.toHaveProperty('clinicianName');
    expect(parsed.data).not.toHaveProperty('privateNote');
  });

  it('rejects unknown event types and invalid requirement states', () => {
    expect(() => parseHireToStartInboundEvent({ ...event, eventType: 'credential.approved' })).toThrow(/not supported/i);
    expect(() => parseHireToStartInboundEvent({
      ...event,
      data: { ...event.data, status: 'credentialed' },
    })).toThrow(/not a supported requirement status/i);
  });

  it('signs the canonical normalized envelope deterministically', () => {
    const timestamp = '1786737600';
    const first = buildHireToStartIntegrationSignature(event, timestamp, 'integration-secret');
    const second = buildHireToStartIntegrationSignature(event, timestamp, 'integration-secret');
    expect(first).toMatch(/^v1=[a-f0-9]{64}$/);
    expect(second).toBe(first);
    expect(buildHireToStartIntegrationSignature({ ...event, externalEventId: 'event-2' }, timestamp, 'integration-secret')).not.toBe(first);
  });
});
