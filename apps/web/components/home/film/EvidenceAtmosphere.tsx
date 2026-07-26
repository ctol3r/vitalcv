'use client';

import * as React from 'react';

import {
  DEFAULT_FRAGMENT_COUNT,
  coreLight,
  createFragments,
  fragmentPose,
  type FragmentLane,
} from './atmosphere';

/**
 * The evidence atmosphere renderer (COMPETE-2 spike).
 *
 * Draws the pure model from ./atmosphere.ts at whichever tier the device
 * supports. It renders record FRAGMENTS and one unlabeled core of gathered
 * light — never nodes, edges, people, or a constellation (retired mechanism
 * R1). Nothing is ever drawn BETWEEN two fragments.
 *
 * Tiers (docs/design/homepage-composition-ownership.md §3):
 *   static   → the SSR poster: real geometry at the current progress, no loop.
 *   canvas2d → the same geometry, animated.
 *   webgpu   → not implemented in the spike; falls through to canvas2d, which
 *              is the honest behaviour (a tier that cannot draw must degrade,
 *              never blank). Wiring it is COMPETE-2 production work.
 *
 * The static tier is not a placeholder image — it is the same composition,
 * still. That is what makes a degraded render read as deliberate.
 */

/** Ink values, not tokens: canvas cannot resolve CSS custom properties. */
/**
 * The atmosphere is INK, not colour.
 *
 * These four lanes used to paint in green, indigo and amber. Two problems, and
 * they compound: at up to 0.52 opacity a field of tinted horizontal bars reads
 * as a loading skeleton rather than as evidence, and it was the loudest thing
 * in every frame. It also spends the state palette on decoration — CD-4 keeps
 * green, amber and slate for what a source actually returned, so a decorative
 * bar in "confirmed green" devalues the one place green is allowed to mean
 * something.
 *
 * Warm ink at four weights instead. The fragments still separate into lanes by
 * value, so the composition keeps its depth, but nothing in the atmosphere can
 * be mistaken for a state.
 */
const LANE_INK: Record<FragmentLane, string> = {
  provenance: '26, 24, 21',
  evidence: '61, 58, 52',
  attention: '87, 83, 74',
  neutral: '103, 98, 87',
};

export interface EvidenceAtmosphereProps {
  /** 0 → 1 film progress. */
  progress: number;
  /** Resolved render tier. */
  tier: 'static' | 'canvas2d' | 'webgpu';
  /** Pointer position in stage space (0–1), or null when the pointer is away. */
  pointer?: { x: number; y: number } | null;
  fragmentCount?: number;
}

/**
 * Test-only still-frame hook (DG-18.3).
 *
 * Visual-regression baselines need a deterministic frame, and the atmosphere
 * drifts continuously — a screenshot at T differs from one at T+16ms, which
 * would make every baseline flaky. Freezing renders exactly one frame at
 * time 0, which is also what the static tier and the SSR poster draw, so a
 * frozen capture is a real frame of the composition rather than a special
 * rendering path invented for tests.
 *
 * This does NOT disable the film (reduced motion would, by resolving the
 * static tier) — layout stays pinned and horizontal, only the clock stops.
 *
 * Gated exactly like `readForcedTier`: dev/test only, never honored in a
 * production build unless NEXT_PUBLIC_SCENE_DEBUG=1 is set for a test deploy.
 */
export function readFrozen(win: Window): boolean {
  const debugAllowed =
    process.env.NODE_ENV !== 'production' || process.env.NEXT_PUBLIC_SCENE_DEBUG === '1';
  if (!debugAllowed) return false;
  const fromGlobal = (win as Window & { __VCV_FILM_FREEZE__?: unknown }).__VCV_FILM_FREEZE__;
  if (fromGlobal === true) return true;
  try {
    return new URLSearchParams(win.location.search).get('filmFreeze') === '1';
  } catch {
    return false;
  }
}

export function EvidenceAtmosphere({
  progress,
  tier,
  pointer = null,
  fragmentCount = DEFAULT_FRAGMENT_COUNT,
}: EvidenceAtmosphereProps) {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const fragments = React.useMemo(() => createFragments(fragmentCount), [fragmentCount]);

  // Latest inputs live in refs so the animation loop is started ONCE and never
  // torn down per frame — and so the loop never becomes a second scroll owner.
  const progressRef = React.useRef(progress);
  const pointerRef = React.useRef(pointer);
  progressRef.current = progress;
  pointerRef.current = pointer;

  // Resolved after mount so SSR and the first client render agree.
  const [frozen, setFrozen] = React.useState(false);
  React.useEffect(() => setFrozen(readFrozen(window)), []);

  const animated = tier !== 'static' && !frozen;

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return; // No 2D context: the SSR poster underneath stands.

    let raf: number | null = null;
    let disposed = false;
    const start = performance.now();

    const draw = (now: number) => {
      if (disposed) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      const p = progressRef.current;
      // Still frame when not animated: time 0 makes the canvas tier render
      // pixel-identical to the poster, so switching tiers never jumps.
      const time = animated ? (now - start) / 1000 : 0;

      // The career core: one soft radial of gathered light. Unlabeled,
      // uncounted, connected to nothing.
      const light = coreLight(p);
      const cx = w * 0.14;
      const cy = h * 0.5;
      const radius = Math.min(w, h) * (0.18 + 0.1 * light);
      const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
      glow.addColorStop(0, `rgba(18, 106, 84, ${0.05 + light * 0.1})`);
      glow.addColorStop(1, 'rgba(18, 106, 84, 0)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, w, h);

      const ptr = pointerRef.current;

      for (let i = 0; i < fragments.length; i += 1) {
        const fragment = fragments[i];
        if (!fragment) continue;
        const pose = fragmentPose(fragment, p, i, fragments.length, time);

        let x = pose.x * w;
        const y = pose.y * h;
        let opacity = pose.opacity;

        // Cursor as a reading light, not a decoration: fragments near the
        // pointer lift slightly and brighten. This is the mandate's
        // "meaningful cursor/overlay" — the pointer reveals evidence rather
        // than trailing a shape. Costs nothing when the pointer is away.
        if (ptr) {
          const dx = pose.x - ptr.x;
          const dy = pose.y - ptr.y;
          const dist = Math.hypot(dx, dy);
          if (dist < 0.18) {
            const near = 1 - dist / 0.18;
            opacity += near * 0.28;
            x += near * 6;
          }
        }

        ctx.fillStyle = `rgba(${LANE_INK[pose.lane]}, ${Math.min(0.9, opacity)})`;
        // A record fragment: a thin horizontal strip. Height is fixed and
        // small so it reads as a ruled line from a record, not as a bar chart.
        ctx.fillRect(x, y, pose.width * w, 1.5);
      }

      if (animated) raf = window.requestAnimationFrame(draw);
    };

    raf = window.requestAnimationFrame(draw);

    // Redraw a still frame on resize even when not animating.
    const onResize = () => {
      if (!animated && !disposed) window.requestAnimationFrame(draw);
    };
    window.addEventListener('resize', onResize, { passive: true });

    return () => {
      disposed = true;
      if (raf !== null) window.cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
    };
  }, [fragments, animated]);

  return (
    <div className="film-atmosphere" aria-hidden="true" data-film-tier={tier}>
      {/* The SSR poster. Rendered as real SVG geometry from the SAME model, so
          it is present before hydration, present with JS disabled, and present
          if the canvas never gets a context. The canvas draws on top of it. */}
      <svg
        className="film-atmosphere-poster"
        viewBox="0 0 1000 600"
        preserveAspectRatio="none"
        focusable="false"
      >
        <defs>
          <radialGradient id="film-core" cx="14%" cy="50%" r="30%">
            <stop offset="0%" stopColor="rgb(18, 106, 84)" stopOpacity={0.05 + coreLight(progress) * 0.1} />
            <stop offset="100%" stopColor="rgb(18, 106, 84)" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width="1000" height="600" fill="url(#film-core)" />
        {fragments.map((fragment, i) => {
          const pose = fragmentPose(fragment, progress, i, fragments.length, 0);
          return (
            <rect
              key={fragment.id}
              x={pose.x * 1000}
              y={pose.y * 600}
              width={pose.width * 1000}
              height={1.5}
              fill={`rgba(${LANE_INK[pose.lane]}, ${pose.opacity})`}
            />
          );
        })}
      </svg>
      {/* Decoration only. `aria-hidden` keeps a screen reader from announcing a
          bare graphic that carries no meaning — the film's meaning is always in
          the text, never in the atmosphere (composition-ownership §3). */}
      {tier !== 'static' ? (
        <canvas ref={canvasRef} className="film-atmosphere-canvas" aria-hidden="true" />
      ) : null}
    </div>
  );
}
