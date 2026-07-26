'use client';

/**
 * SceneCursor (SHD-1.2, manifest row 22 — adapt) — the template's dual-ring
 * lerp cursor, ported under VitalCV's accessibility contract:
 *
 *  - fine-pointer devices only; coarse pointer or prefers-reduced-motion
 *    renders nothing at all;
 *  - the native cursor is NEVER globally hidden (the source sets
 *    `cursor: none` on everything). The rings are an additive halo layered
 *    UNDER the pointer; over text inputs the halo fades out entirely so the
 *    caret/I-beam experience is untouched;
 *  - rings scale up over interactive elements (link/button/summary/label),
 *    matching the source affordance, and are pointer-events: none throughout.
 *
 * Implementation: two fixed dots eased toward the pointer at different lerp
 * rates (0.35 dot / 0.15 ring), driven by one rAF that sleeps when the
 * pointer rests or leaves the document.
 */

import * as React from 'react';

const INTERACTIVE = 'a, button, [role="button"], summary, label, input[type="submit"]';
const FORMS = 'input, textarea, select, [contenteditable="true"]';

export function SceneCursor() {
  const dotRef = React.useRef<HTMLDivElement>(null);
  const ringRef = React.useRef<HTMLDivElement>(null);
  const [active, setActive] = React.useState(false);

  React.useEffect(() => {
    const fine =
      window.matchMedia('(pointer: fine)').matches &&
      !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!fine) return;
    setActive(true);
  }, []);

  React.useEffect(() => {
    if (!active) return;
    const dot = dotRef.current;
    const ring = ringRef.current;
    if (!dot || !ring) return;

    let raf = 0;
    const p = { x: -100, y: -100 };
    const d = { x: -100, y: -100 };
    const r = { x: -100, y: -100 };
    let scale = 1;
    let targetScale = 1;
    let opacity = 0;
    let targetOpacity = 0;

    const step = () => {
      raf = 0;
      d.x += (p.x - d.x) * 0.35;
      d.y += (p.y - d.y) * 0.35;
      r.x += (p.x - r.x) * 0.15;
      r.y += (p.y - r.y) * 0.15;
      scale += (targetScale - scale) * 0.2;
      opacity += (targetOpacity - opacity) * 0.2;
      dot.style.transform = `translate(${d.x}px, ${d.y}px) translate(-50%, -50%)`;
      ring.style.transform = `translate(${r.x}px, ${r.y}px) translate(-50%, -50%) scale(${scale.toFixed(3)})`;
      dot.style.opacity = String(opacity.toFixed(3));
      ring.style.opacity = String((opacity * 0.9).toFixed(3));
      const settled =
        Math.abs(p.x - r.x) < 0.3 &&
        Math.abs(p.y - r.y) < 0.3 &&
        Math.abs(targetScale - scale) < 0.01 &&
        Math.abs(targetOpacity - opacity) < 0.01;
      if (!settled) raf = requestAnimationFrame(step);
    };
    const wake = () => {
      if (!raf) raf = requestAnimationFrame(step);
    };

    const onMove = (e: PointerEvent) => {
      p.x = e.clientX;
      p.y = e.clientY;
      const t = e.target as Element | null;
      const overForm = Boolean(t?.closest?.(FORMS));
      const overInteractive = Boolean(t?.closest?.(INTERACTIVE));
      targetOpacity = overForm ? 0 : 1;
      targetScale = overInteractive ? 1.6 : 1;
      wake();
    };
    const onLeave = () => {
      targetOpacity = 0;
      wake();
    };

    document.addEventListener('pointermove', onMove, { passive: true });
    document.documentElement.addEventListener('pointerleave', onLeave);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('pointermove', onMove);
      document.documentElement.removeEventListener('pointerleave', onLeave);
    };
  }, [active]);

  if (!active) return null;
  return (
    <div aria-hidden="true" data-scene-cursor="">
      <div ref={dotRef} className="scene-cursor-dot" />
      <div ref={ringRef} className="scene-cursor-ring" />
    </div>
  );
}

export default SceneCursor;
