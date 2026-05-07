/**
 * Single source of truth for the inline qualifier copy that accompanies every
 * numeric metric on the ROI Console v2 surface. Imported by every component
 * that renders a number; the component MUST NOT render an inline qualifier
 * outside this map.
 *
 * Why a single export: the wave brief's anti-contract requires every projected
 * number to carry an "Estimated" / "Projected" / "Observed" qualifier. Drift
 * is the failure mode — one component decides to omit it "to keep the layout
 * clean," and suddenly the surface looks like a guarantee. By forcing every
 * render through this map, drift becomes a typed `keyof` violation.
 */

export const LABEL_QUALIFIER_V2 = {
  hours: 'Projected · subject to volume',
  dollars: 'Estimated · based on your default wage',
  baseline: 'You entered this · used as the comparison point for ROI',
  decisions: 'Observed · receipt-derived count for this pilot window',
  rate: 'Observed · running average over the pilot window',
  vsBaseline: 'Comparison vs. your baseline · not an industry average',
} as const;

export type LabelQualifierKind = keyof typeof LABEL_QUALIFIER_V2;
