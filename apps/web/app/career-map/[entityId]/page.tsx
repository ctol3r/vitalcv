import { notFound } from 'next/navigation';

import { viewerOwnsNpi } from '@/lib/auth/npi-ownership-scope';

import CareerMapClient from './CareerMapClient';

export const dynamic = 'force-dynamic';

export const metadata = {
  robots: { index: false, follow: false },
  title: 'Career Map',
  description: 'A navigable map of a clinician’s career — evidence, sources, organizations, and trust, connected.',
};

/**
 * /career-map/:entityId — the clinician's own career graph.
 *
 * Two independent gates, because neither is sufficient alone:
 *
 *  1. The middleware role guard (`/career-map` → AUTHENTICATED in
 *     `lib/auth/roles.ts`) proves the caller is signed in. Before it existed
 *     this route was neither public nor protected, so it fell through the
 *     middleware's pass-through branch and answered 200 to anonymous requests
 *     in production, keyed by NPI.
 *  2. This ownership check proves the record is THEIRS. Authentication alone
 *     would let any signed-in user read any clinician by editing the URL.
 *
 * A caller who does not own the NPI gets `notFound()` — the same response as an
 * NPI that does not exist. Distinguishing the two would turn this route into an
 * oracle for "is this clinician on VitalCV", which is exactly the enumeration
 * surface the sibling relationship endpoint's uniform 404 exists to prevent.
 */
export default async function CareerMapPage({ params }: { params: Promise<{ entityId: string }> }) {
  const { entityId } = await params;

  if (!(await viewerOwnsNpi(entityId))) {
    notFound();
  }

  return <CareerMapClient entityId={entityId} />;
}
