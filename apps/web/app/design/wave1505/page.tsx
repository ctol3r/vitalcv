/**
 * /design/wave1505 — Wave 1505 · System Pages & Governance (design reference)
 *
 * Self-contained, client-rendered port of the wave1505 Claude Design handoff
 * (system pages, auth theming spec, legal template, contact, pricing,
 * responsive/a11y audit, /dev/design style guide, governance specs). Renders
 * without the global Navbar/Footer (it carries its own chrome) via the
 * OPS_SURFACE_PREFIXES registration in components/layout/publicSurfaceRoutes.ts.
 *
 * Design Handoff References:
 *   design-handoff/claude-design-2026-07-12-wave1505/wave1505/index.html
 *   (+ the wave1500–1504 kit files alongside it)
 */

import type { Metadata } from 'next';
import Wave1505Mount from './Wave1505Mount';

export const metadata: Metadata = {
  title: 'Wave 1505 · System Pages & Governance — design reference',
  description:
    'Design reference implementation of the wave 1505 closing wave: system states, auth theming spec, legal template, contact, pricing doctrine, quality gates, and governance artifacts.',
  robots: { index: false, follow: false },
};

export default function DesignWave1505Page() {
  return <Wave1505Mount />;
}
