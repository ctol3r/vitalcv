import { describe, it, expect } from '@jest/globals';
import { timelineEventsToProvenance } from '../adapter/timelineProvenanceAdapter';
import { validateResource } from '../validator';
import { TimelineEvent } from '../../timeline/types';

describe('timelineProvenanceAdapter', () => {
  const baseEvent: TimelineEvent = {
    id: 'evt-1',
    phase: 'identity',
    type: 'CLAIM_L2_OK',
    title: 'Identity Level 2 completed',
    timestamp: new Date('2025-01-01T00:00:00Z'),
    status: 'completed',
    source: 'audit_event',
  };

  it('converts events into Provenance resources', () => {
    const resources = timelineEventsToProvenance([baseEvent], {
      subjectReference: 'Practitioner/test-clinician',
      sourceDisplay: 'Chai VC Timeline',
    });

    expect(resources).toHaveLength(1);
    const provenance = resources[0];
    expect(provenance.resourceType).toBe('Provenance');
    expect(provenance.activity?.coding?.[0].code).toBe('CLAIM_L2_OK');
    expect(provenance.reason?.[0].coding?.[0].code).toBe('identity');
    expect(provenance.agent[0].who).toEqual({ display: 'Chai VC Timeline' });

    const validation = validateResource(provenance, 'Provenance');
    expect(validation.valid).toBe(true);
    expect(validation.errors).toHaveLength(0);
  });

  it('includes actor reference when provided', () => {
    const actorEvent: TimelineEvent = {
      ...baseEvent,
      id: 'evt-2',
      actor: {
        display: 'Automated Identity Service',
        reference: 'Organization/identity-svc',
      },
    };

    const resources = timelineEventsToProvenance([actorEvent], {
      subjectReference: 'Practitioner/test-clinician',
    });

    expect(resources[0].agent[0].who).toEqual({
      reference: 'Organization/identity-svc',
      display: 'Automated Identity Service',
    });
  });
});


