import * as React from 'react';

/**
 * ClinicianFigure — the holder, present as a figure (ILL-03).
 *
 * ── A recorded departure from EC-27, not an oversight ──────────────────────
 *
 * EC-27 says the protagonist is "the clinician's own record — not a dashboard,
 * hospital, network graph, AI motif, or a person." The founder's ILL prototype
 * puts a clinician silhouette beside the folio, and this component implements
 * that. EC-27 is Class C, so it departs through design review with a named
 * rationale (EC-21) rather than an EC-22 amendment — this comment and
 * `docs/design/illustrated-journey-baseline.md` §4.1 are that record.
 *
 * The rationale, stated so a later reviewer can disagree with it precisely:
 * the figure is a SUPPORTING actor, not the protagonist. The record stays the
 * largest object, the only one with faces, and the only one that travels; the
 * figure never appears without it, never carries a fact, and never appears in
 * the recipient or review zones. What EC-27 forbids is the record's role being
 * taken over — not a human ever appearing in a scene about a human's career.
 * If review disagrees, deleting this one component restores strict EC-27.
 *
 * ── What is deliberately absent ────────────────────────────────────────────
 *
 * No skin tone, no coat, no stethoscope, no gender cue, no face. The prototype
 * rendered a skin-toned head (`#e8c9a8`); the illustration brief that produced
 * that prototype separately warns against "skin color stereotypes, white-coat
 * glamour, or a fabricated medical identity", and a single rendered skin tone
 * in the one human figure the product ships is exactly the identity signal that
 * warning is about. The figure is scene ink at low emphasis — a presence and a
 * posture, nothing more.
 */
export interface ClinicianFigureProps {
  className?: string;
}

export function ClinicianFigure({ className }: ClinicianFigureProps) {
  return (
    <span
      data-clinician-figure=""
      aria-hidden="true"
      className={`relative block h-[62px] w-[36px] shrink-0 ${className ?? ''}`}
    >
      {/* head */}
      <span
        className="absolute left-1/2 top-0 block h-[17px] w-[17px] -translate-x-1/2"
        style={{ borderRadius: '9999px', background: 'var(--vt-scene-text-tertiary)' }}
      />
      {/* shoulders and body — one form, no garment, no insignia */}
      <span
        className="absolute inset-x-0 bottom-0 top-[21px] block"
        style={{
          borderRadius: '16px 16px 3px 3px',
          background: 'var(--vt-scene-text-tertiary)',
        }}
      />
    </span>
  );
}
