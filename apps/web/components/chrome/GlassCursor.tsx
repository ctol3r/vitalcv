'use client';

/**
 * GlassCursor — a frosted lens that rides with the pointer.
 *
 * The native arrow is never hidden or replaced: hiding the OS cursor trades a
 * moment of style for permanent "where is my pointer" — the lens travels
 * WITH it, a beat behind (damped follow), and reacts to what it crosses:
 * it swells over interactive elements and contracts on press. That reaction
 * is the honest use of motion here — position and affordance, not decor.
 *
 * Restraint rules ("not too distracting" is the brief):
 * - pointer:coarse (touch) and prefers-reduced-motion: the lens never mounts
 *   its listeners and stays invisible. CD-2 law 3: meaning never lives in
 *   motion — the lens ADDS nothing a reader needs.
 * - The rAF loop is not an idle loop (CD-11): it runs only while the lens is
 *   still converging on the pointer, then stops until the next pointer event.
 * - pointer-events: none and aria-hidden — it can never intercept a click or
 *   reach the accessibility tree.
 */

import * as React from 'react';

/**
 * Anywhere the reader is meant to ACT. Over any of these the lens hides
 * outright — it does not swell, tint, or linger. Founder call, and the right
 * one: on the conversion path a decoration that reacts to a control is
 * competing with it. The lens decorates empty canvas and yields everywhere
 * else. `.ask-answer` is the live NPI result card — the moment the product
 * actually delivers, and the last place a flourish belongs.
 */
const YIELD_TO =
  'a,button,input,textarea,select,summary,label,[role="button"],[role="link"],' +
  '.ask-answer,.ask-answer *,[data-home-lane-ledger],[data-home-lane-ledger] *';

export function GlassCursor() {
  const ref = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.matchMedia('(pointer: coarse)').matches) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const el = ref.current;
    if (!el) return;

    let x = -100;
    let y = -100;
    let targetX = -100;
    let targetY = -100;
    let scale = 1;
    let targetScale = 1;
    let raf = 0;
    let running = false;

    const tick = () => {
      x += (targetX - x) * 0.22;
      y += (targetY - y) * 0.22;
      scale += (targetScale - scale) * 0.25;
      el.style.transform = `translate3d(${x - 18}px, ${y - 18}px, 0) scale(${scale})`;
      const settled =
        Math.abs(targetX - x) < 0.3 && Math.abs(targetY - y) < 0.3 && Math.abs(targetScale - scale) < 0.01;
      if (settled) {
        running = false;
      } else {
        raf = requestAnimationFrame(tick);
      }
    };

    const wake = () => {
      if (!running) {
        running = true;
        raf = requestAnimationFrame(tick);
      }
    };

    /** True when the pointer is over anything the reader might act on. */
    const yielding = (e: PointerEvent) =>
      Boolean((e.target as Element | null)?.closest?.(YIELD_TO));

    const onMove = (e: PointerEvent) => {
      targetX = e.clientX;
      targetY = e.clientY;
      el.dataset.on = '';
      if (yielding(e)) {
        el.dataset.yield = '';
      } else {
        delete el.dataset.yield;
      }
      wake();
    };
    const onDown = (e: PointerEvent) => {
      // Only meaningful on empty canvas; over a control the lens is already
      // hidden and the press does nothing visible.
      if (!yielding(e)) targetScale = 0.85;
      wake();
    };
    const onUp = () => {
      targetScale = 1;
      wake();
    };
    const onLeave = () => {
      delete el.dataset.on;
    };

    document.addEventListener('pointermove', onMove, { passive: true });
    document.addEventListener('pointerdown', onDown, { passive: true });
    document.addEventListener('pointerup', onUp, { passive: true });
    document.documentElement.addEventListener('pointerleave', onLeave);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('pointerup', onUp);
      document.documentElement.removeEventListener('pointerleave', onLeave);
    };
  }, []);

  return <div ref={ref} className="vt-cursor" aria-hidden="true" data-vt-cursor="" />;
}
