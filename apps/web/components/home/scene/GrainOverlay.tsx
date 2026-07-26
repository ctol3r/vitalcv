'use client';

/**
 * GrainOverlay (SHD-1.2, manifest row 23 — port) — the template's SVG
 * feTurbulence film grain, at VitalCV amplitude. Purely decorative texture
 * that keeps large soft-gradient regions from banding; pointer-events pass
 * through and assistive tech never sees it.
 *
 * The turbulence is baked into an inline SVG data URI (static — no filter
 * re-evaluation per frame, no render loop), so it costs one composited layer.
 */

import * as React from 'react';

const GRAIN_SVG = encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="2" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/></filter><rect width="160" height="160" filter="url(#n)"/></svg>`,
);

export function GrainOverlay({ opacity = 0.05 }: { opacity?: number }) {
  if (opacity <= 0) return null;
  return (
    <div
      aria-hidden="true"
      data-scene-grain=""
      className="pointer-events-none absolute inset-0 mix-blend-overlay"
      style={{
        opacity,
        backgroundImage: `url("data:image/svg+xml,${GRAIN_SVG}")`,
        backgroundSize: '160px 160px',
      }}
    />
  );
}

export default GrainOverlay;
