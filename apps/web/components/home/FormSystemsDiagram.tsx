import * as React from 'react';

/**
 * FormSystemsDiagram — the hand-drawn "form vs. systems" motif (Chris,
 * 2026-07-18, from the reference reader): a cube on the left ("form" — a static
 * résumé/document that states) and a node graph on the right ("systems" — the
 * connected evidence network that proves). Strokes use currentColor so the
 * parent band sets the ink (light on the dark manifesto band).
 *
 * Slight path irregularity + round caps give the marker-sketch feel without a
 * custom font or raster asset — it stays crisp at any size and theme.
 */
export function FormSystemsDiagram({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 360 200"
      className={className}
      role="img"
      aria-label="A hand-drawn cube labelled form beside a node graph labelled systems."
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* ── form: a slightly wobbly isometric cube ── */}
      <g opacity="0.92">
        <path d="M40 78 L96 66 L150 82 L94 96 Z" />
        <path d="M40 78 L41 132 L95 150 L94 96" />
        <path d="M150 82 L150 136 L95 150" />
        <path d="M94 96 L94 96" />
        {/* faint interior edge for depth */}
        <path d="M96 66 L97 120 L95 150" opacity="0.4" />
      </g>

      {/* ── divider ── */}
      <path d="M180 44 L180 158" opacity="0.35" strokeDasharray="2 7" />

      {/* ── systems: nodes + links ── */}
      <g>
        {/* links first, so nodes sit on top */}
        <g opacity="0.6">
          <path d="M250 62 L300 84" />
          <path d="M250 62 L232 108" />
          <path d="M300 84 L232 108" />
          <path d="M300 84 L318 130" />
          <path d="M232 108 L270 146" />
          <path d="M318 130 L270 146" />
          <path d="M232 108 L318 130" />
        </g>
        {[
          [250, 62, 6],
          [300, 84, 7],
          [232, 108, 5.5],
          [318, 130, 6],
          [270, 146, 5],
        ].map(([cx, cy, r], i) => (
          <circle key={i} cx={cx} cy={cy} r={r} fill="currentColor" stroke="none" opacity="0.92" />
        ))}
      </g>

      {/* ── labels (lowercase, sketch register) ── */}
      <text x="82" y="176" textAnchor="middle" fontSize="15" fontStyle="italic" fill="currentColor" stroke="none" opacity="0.85">
        form
      </text>
      <text x="278" y="176" textAnchor="middle" fontSize="15" fontStyle="italic" fill="currentColor" stroke="none" opacity="0.85">
        systems
      </text>
    </svg>
  );
}

export default FormSystemsDiagram;
