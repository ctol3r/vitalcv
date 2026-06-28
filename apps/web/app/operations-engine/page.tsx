/**
 * /operations-engine — VitalCV Healthcare Operations Engine (Wave 1400)
 *
 * Self-contained, client-rendered operations console ported from the wave1400
 * Claude Design handoff. Renders without the global Navbar/Footer (it carries
 * its own chrome) via the OPS_SURFACE_PREFIXES registration in
 * components/layout/publicSurfaceRoutes.ts.
 */

import type { Metadata } from 'next';
import OpsEngineMount from './OpsEngineMount';

export const metadata: Metadata = {
  title: 'Operations Engine · VitalCV',
  description:
    'Live operations console for provider career evidence — readiness, risk, pipeline, and an append-only operational ledger.',
};

export default function OperationsEnginePage() {
  return <OpsEngineMount />;
}
