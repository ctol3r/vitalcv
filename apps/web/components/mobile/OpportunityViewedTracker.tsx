'use client';

import { useEffect } from 'react';
import { trackClinicianEventOncePerSession } from '@/lib/mobile/analytics';
import { trackPilotEvent } from '@/lib/pilot-ops/client';

export default function OpportunityViewedTracker({
  opportunityId,
  organizationName,
  title,
}: {
  opportunityId: string;
  organizationName: string;
  title: string;
}) {
  useEffect(() => {
    void trackClinicianEventOncePerSession(`opportunity-view:${opportunityId}`, 'clinician.opportunity_viewed', {
      opportunityId,
      organizationName,
      title,
    });
    void trackPilotEvent({
      eventType: 'opportunity_viewed',
      entity: {
        kind: 'opportunity',
        id: opportunityId,
        label: title,
        objectType: 'opportunity',
      },
      details: {
        organizationName,
        title,
      },
    });
  }, [opportunityId, organizationName, title]);

  return null;
}
