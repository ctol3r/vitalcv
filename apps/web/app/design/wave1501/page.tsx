/**
 * /design/wave1501 — Wave 1501 · Flagship homepage (design reference)
 *
 * The wave1501 homepage design, standing on its own so it can be judged as
 * designed before any of it is argued onto the live `/`.
 *
 * Unlike /design/wave1505 this is NOT `ssr: false`. The island reads no
 * browser-only state during first render, and rendering it on the server is
 * deliberate: if this design is ever promoted to `/`, the homepage must satisfy
 * a no-JS SSR floor, a bounded `s-maxage`, and a deploy smoke check that greps
 * the raw HTML. Proving the composition server-renders here is how we find out
 * cheaply, rather than during the swap.
 *
 * Carries its own chrome (no global Navbar/Footer) via the OPS_SURFACE_PREFIXES
 * registration for `/design` in components/layout/publicSurfaceRoutes.ts.
 *
 * Design Handoff References:
 *   design-handoff/claude-design-2026-07-12-wave1505/wave1501/index.html
 *   design-handoff/claude-design-2026-07-12-wave1505/wave1501/CHANGES.md
 *   design-handoff/claude-design-2026-07-12-wave1505/wave1500/ (tokens + primitives)
 */

import type { Metadata } from 'next';

import { Wave1501Client } from '@/components/home/w1501/Wave1501Client';

export const metadata: Metadata = {
  title: 'Wave 1501 · Flagship homepage — design reference',
  description:
    'Design reference implementation of the wave 1501 homepage: segmented NPI, readiness wallet, canonical path, MATCHA demo, and the drag-rotate career constellation.',
  robots: { index: false, follow: false },
};

export default function DesignWave1501Page() {
  return <Wave1501Client />;
}
