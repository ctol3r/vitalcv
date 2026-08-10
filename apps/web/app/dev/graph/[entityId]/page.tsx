import { notFound } from 'next/navigation';

import GraphExplorerClient from './GraphExplorerClient';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Evidence Graph Explorer (dev)',
  robots: { index: false, follow: false },
};

/**
 * Developer-only inspector for the evidence GraphProjection (Wave 221, C6).
 * Not a production surface — plain node/relationship/JSON view for debugging.
 *
 * GATED, 2026-08-09. The sentence above was true as documentation and false as
 * behaviour: this route served **HTTP 200 to anonymous visitors** on
 * https://www.vitalcv.com. It was the only `/dev/*` route with no gate — every
 * sibling refuses one way or another, and `/design/*` is covered by a layout
 * gate written precisely so a new reference is gated the moment it exists.
 *
 * `robots: { index: false }` is not a gate. It removed the route from search
 * results and left it fully reachable, which is why the drift survived: the
 * route looked deliberate from every angle except the one that mattered.
 *
 * Scope, so this is not overstated: the backing `/api/graph/:id` returns public
 * NPPES-derived registry data with `decisionGrade: false` — the same class
 * already published deliberately at `/directory/[npi]`. This closes a gating
 * inconsistency, not a data leak.
 *
 * Mirrors the /dev/page-stack gate: available in dev, and in a production-mode
 * build only behind an explicit opt-in (the e2e web server builds in production
 * mode and needs a way in).
 */
export default async function GraphExplorerPage({
  params,
}: {
  params: Promise<{ entityId: string }>;
}) {
  const enabled =
    process.env.NODE_ENV !== 'production' || process.env.GRAPH_EXPLORER_PREVIEW === '1';
  if (!enabled) notFound();

  const { entityId } = await params;
  return <GraphExplorerClient entityId={entityId} />;
}
