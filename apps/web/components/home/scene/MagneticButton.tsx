'use client';

/**
 * MagneticButton (SHD-1.2, manifest row 7 — port) — the template's magnetic
 * CTA affordance: the element eases toward a nearby fine pointer (×0.15 of
 * the offset, spring back on leave).
 *
 * Ported as a WRAPPER so the child keeps its own semantics: a submit button
 * still submits, a link still navigates, focus/keyboard behavior is
 * untouched, and tests that target the child see no difference. The pull is
 * pure translate on the wrapper — layout never shifts.
 *
 * Disabled entirely on coarse pointers and under prefers-reduced-motion
 * (manifest a11y contract): the wrapper then renders as an inert span.
 */

import * as React from 'react';

const PULL = 0.15;
const MAX_PULL_PX = 14;

export function MagneticButton({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = React.useRef<HTMLSpanElement>(null);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fine =
      window.matchMedia('(pointer: fine)').matches &&
      !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!fine) return;

    let raf = 0;
    const pos = { x: 0, y: 0, tx: 0, ty: 0 };

    const step = () => {
      raf = 0;
      pos.x += (pos.tx - pos.x) * 0.18;
      pos.y += (pos.ty - pos.y) * 0.18;
      el.style.transform = `translate(${pos.x.toFixed(2)}px, ${pos.y.toFixed(2)}px)`;
      if (Math.abs(pos.tx - pos.x) > 0.1 || Math.abs(pos.ty - pos.y) > 0.1) {
        raf = requestAnimationFrame(step);
      }
    };
    const wake = () => {
      if (!raf) raf = requestAnimationFrame(step);
    };

    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2);
      const dy = e.clientY - (r.top + r.height / 2);
      pos.tx = Math.max(-MAX_PULL_PX, Math.min(MAX_PULL_PX, dx * PULL));
      pos.ty = Math.max(-MAX_PULL_PX, Math.min(MAX_PULL_PX, dy * PULL));
      wake();
    };
    const onLeave = () => {
      pos.tx = 0;
      pos.ty = 0;
      wake();
    };

    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerleave', onLeave);
    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerleave', onLeave);
    };
  }, []);

  return (
    <span ref={ref} data-scene-magnetic="" className={className} style={{ display: 'inline-block' }}>
      {children}
    </span>
  );
}

export default MagneticButton;
