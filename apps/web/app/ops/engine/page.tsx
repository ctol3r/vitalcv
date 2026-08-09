/**
 * /ops/engine — VitalCV Operations Engine (real, authed, org-scoped).
 *
 * The live counterpart to the public /operations-engine demo. Gated on Clerk
 * auth (real provider names/NPI must sit behind sign-in, per source-honesty
 * doctrine) and scoped to the operator's organization. Reads a real snapshot
 * from the backend; when no live data source is connected it renders an honest
 * status panel rather than mock data.
 */

import type { Metadata } from 'next';
// The .w14 console's keyframes live in the house motion file (LINT-03 permits
// definitions nowhere else). motion.css is imported per-page, not globally, so
// this import is what actually makes those animations run.
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { getOpsEngineSnapshot } from '@/lib/ops-engine/getOpsEngineSnapshot';
import OpsEngineStatusPanel from '@/components/ops-engine/OpsEngineStatusPanel';
import OpsEngineLiveMount from './OpsEngineLiveMount';

export const metadata: Metadata = {
  title: 'Operations Engine',
  description: 'Live operations console — real roster, readiness, and the append-only operational ledger.',
};

export const dynamic = 'force-dynamic';

export default async function OpsEnginePage() {
  const session = await auth();
  if (!session.userId) {
    redirect('/sign-in?redirect_url=/ops/engine');
  }

  const snapshot = await getOpsEngineSnapshot({
    userId: session.userId,
    orgId: session.orgId ?? null,
    session,
  });

  // Real data → full engine in live mode. No live source / no records → honest
  // status panel (never a fabricated roster).
  if (snapshot.status === 'live' && snapshot.workspaces.length > 0) {
    return <OpsEngineLiveMount snapshot={snapshot} />;
  }
  return <OpsEngineStatusPanel snapshot={snapshot} />;
}
