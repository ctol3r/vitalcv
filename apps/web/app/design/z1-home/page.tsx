/**
 * /design/z1-home — the Z1 product story, on the isolated preview only.
 *
 * NOT the public homepage. '/' continues to serve the six-scene film until a
 * founder visual review approves the cutover; this route is where the Z1
 * composition is reviewed. Gated by the /design layout, which 404s the whole
 * subtree in canonical production, and served by the isolated z1-preview
 * Railway environment (DESIGN_PREVIEW=1).
 *
 * Renders the shared Z1Home component, so the review surface and any future
 * homepage cannot drift from one another.
 *
 * Design Handoff References:
 *   artifacts/zoox-fidelity-z0/z0-evidence-package.md
 *   artifacts/zoox-fidelity-z0/acceptance-matrix.md
 */

import type { Metadata } from 'next';

import { Z1Home } from '@/components/evidence-record/Z1Home';

export const metadata: Metadata = {
  title: 'Z1 · Homepage story — founder preview',
  description: 'Preview of the Z1 homepage story: NPI activation, the Living Evidence Record, MATCHA discovery, the apply handoff, and the career loop.',
  robots: { index: false, follow: false },
};

export default function Z1HomePreviewPage() {
  return <Z1Home />;
}
