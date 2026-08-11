/**
 * /design/band-system — structural primitives and the component layer.
 *
 * Primitives are adapted from reference R2 (Palantir); the component
 * layer is a synthesis with reference R3 (Zoox). Both are bound to
 * VitalCV tokens, so the same components render near-sharp graphite in
 * the base registers and R3-warm in the scene register.
 *
 * Design reference surface only. Not linked from product navigation and
 * not indexed. Renders all three registers in sequence so a component
 * cannot be signed off in one register alone.
 *
 * Design Handoff References:
 *   docs/design/palantir-r2-element-adoption-2026-08-09.md
 *   docs/design/zoox-r3-element-adoption-2026-08-10.md
 *   docs/design/zoox-r3-component-synthesis-2026-08-10.md
 *   docs/design/reference-experience-atlas.md (R2, R3)
 *   EC-3, EC-4, EC-5, EC-10, EC-20 (as amended A-1, A-2)
 */

import type { Metadata } from 'next';

import '../../../styles/band-system.css';
import '../../../styles/band-system-components.css';
import BandSystemReference from './BandSystemReference';

export const metadata: Metadata = {
  title: 'Band System · primitives and components — design reference',
  description:
    'Design reference for the VitalCV band system: contain geometry, registers, earmarks, hairline rules, and the component layer — dual-glyph actions, icon instruments, segmented controls, hover-reveal rows, coordinated disclosures and floating-label fields — rendered in all three registers.',
  robots: { index: false, follow: false },
};

export default function BandSystemPage() {
  return <BandSystemReference />;
}
