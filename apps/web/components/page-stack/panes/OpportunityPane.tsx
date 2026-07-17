'use client';

/**
 * Opportunity pane body — reuses the existing OpportunityDetailSurface, which
 * already self-loads by id (from the ClinicianMobile context, falling back to
 * GET /api/opportunities/:id). The pane holds no data; the surface does the
 * authorized fetch. The standalone /holder/opportunities/[id] route keeps using
 * the same component — this only renders it inside a pane.
 */

import OpportunityDetailSurface from '@/app/holder/opportunities/[id]/OpportunityDetailSurface';

export function OpportunityPane({ id }: { id: string }) {
  return <OpportunityDetailSurface opportunityId={id} />;
}
