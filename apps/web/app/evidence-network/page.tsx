/**
 * /evidence-network — the Provider Career Evidence Network as an explorable,
 * Obsidian-style force-directed graph (dedicated surface). Self-chromed
 * (registered in OPS_SURFACE_PREFIXES → no Navbar/Footer); the graph carries
 * its own controls and a dark/light toggle.
 *
 * Groups follow the doctrine: holder (clinician) / verifier (= employer) /
 * issuer, plus neutral evidence artifacts. Edges are bidirectional (backlinks).
 * The dataset is illustrative structure, labeled as such on the canvas.
 */

import type { Metadata } from 'next';
import EvidenceNetworkMount from './EvidenceNetworkMount';

export const metadata: Metadata = {
  title: 'The Provider Career Evidence Network — VitalCV',
  description:
    'Explore how source-backed clinician evidence connects holders, verifiers, and issuers into one reusable career network — an interactive, force-directed graph with bidirectional links.',
};

export default function EvidenceNetworkPage() {
  return <EvidenceNetworkMount />;
}
