'use client';

/**
 * CareerEvidenceField — the hero's generative "career evidence field" (VHS-1).
 *
 * It replaces the force-directed graph in the homepage hero with an ABSTRACT
 * system metaphor: named source signals converge into a clinician-owned wallet
 * capsule, which sends muted arcs out toward opportunity and a single, bounded
 * employer-acceptance ring. It is decoration (aria-hidden) — the honest meaning
 * lives in the semantic legend beside it — and it never emits fabricated
 * per-clinician data.
 *
 * Progressive enhancement, per the bundle's resilience bar:
 *  1. Server / first paint: a static SVG poster (below) — no blank reserved area.
 *  2. Reduced motion / no canvas / init failure: the poster stays; no rAF loop.
 *  3. Default: a deterministic, seeded Canvas 2D animation fades in over it.
 * The public /evidence-network page is a static system-concept explainer; the
 * formerly explorable public graph is retired (SHD-0.3) and must not return.
 */

import * as React from 'react';

import { SceneBoundary } from '@/components/home/scene/SceneBoundary';
import {
  FIELD_ANCHORS,
  KIND_COLOR,
  MODEL,
  readPalette,
  withAlpha,
} from '@/components/home/evidence-field/model';
import { cn } from '@/lib/utils';

/* The seeded field model, palette bridge, and color helpers moved to
   components/home/evidence-field/model.ts (SHD-2.1) so the WebGPU tier, this
   2D tier, and the SVG poster all bind the SAME semantic composition. */

/** Anchor indices whose in-links carry the named-source emphasis. */
const NAMED_SOURCE_ATOMS = new Set([0, 3, 6]);

/** How long to wait between asking the GPU tier to prove it painted something. */
const GPU_PAINT_PROBE_MS = 1200;

const pct = (n: number) => `${(n * 100).toFixed(2)}%`;

/**
 * The designed static baseline (HERO-RESET-1). Percentage geometry, not a
 * sliced viewBox: the previous `viewBox="0 0 100 62"` + `slice` cropped ~40%
 * of the composition out of the tall desktop panel, which is why the field
 * read as nonexistent while technically present. Every element now maps the
 * SAME normalized model coordinates the Canvas 2D and WebGPU tiers use, so
 * nothing essential exists only in an animated tier.
 */
function FieldPoster() {
  return (
    <svg data-field-poster="" aria-hidden="true" className="absolute inset-0 h-full w-full">
      <defs>
        <radialGradient id="cef-wash-source" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="color-mix(in oklab, var(--vt-accent-emerald) 9%, transparent)" />
          <stop offset="100%" stopColor="transparent" />
        </radialGradient>
        <radialGradient id="cef-wash-record" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="color-mix(in oklab, var(--accent) 10%, transparent)" />
          <stop offset="100%" stopColor="transparent" />
        </radialGradient>
        <radialGradient id="cef-wash-opportunity" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="color-mix(in oklab, var(--vt-field-opportunity, #2f6fb0) 8%, transparent)" />
          <stop offset="100%" stopColor="transparent" />
        </radialGradient>
        <linearGradient id="cef-cap" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="var(--vt-surface)" />
          <stop offset="60%" stopColor="var(--vt-surface-subtle)" />
          <stop offset="100%" stopColor="color-mix(in oklab, var(--accent) 12%, var(--vt-surface-subtle))" />
        </linearGradient>
      </defs>

      {/* atmosphere washes — restrained depth so the panel never reads as blank paper */}
      <ellipse cx="14%" cy="46%" rx="26%" ry="42%" fill="url(#cef-wash-source)" />
      <ellipse cx={pct(MODEL.capsule.x)} cy={pct(MODEL.capsule.y)} rx="30%" ry="38%" fill="url(#cef-wash-record)" />
      <ellipse cx="87%" cy="44%" rx="20%" ry="30%" fill="url(#cef-wash-opportunity)" />

      {/* converging evidence — named sources carry the strongest connectors */}
      {MODEL.inLinks.map((i) => {
        const a = MODEL.atoms[i];
        const named = NAMED_SOURCE_ATOMS.has(i);
        return (
          <line
            key={`in-${i}`}
            x1={pct(a.x)} y1={pct(a.y)}
            x2={pct(MODEL.capsule.x)} y2={pct(MODEL.capsule.y)}
            stroke={
              named
                ? 'color-mix(in oklab, var(--vt-accent-emerald) 44%, transparent)'
                : 'color-mix(in oklab, var(--vt-text-primary) 16%, transparent)'
            }
            strokeWidth={named ? 1.6 : 1.1}
          />
        );
      })}
      {/* the record carrying evidence out toward opportunity */}
      {MODEL.outLinks.map((i) => {
        const a = MODEL.atoms[i];
        return (
          <line
            key={`out-${i}`}
            x1={pct(MODEL.capsule.x)} y1={pct(MODEL.capsule.y)}
            x2={pct(a.x)} y2={pct(a.y)}
            stroke="color-mix(in oklab, var(--vt-field-opportunity, #2f6fb0) 42%, transparent)"
            strokeWidth={1.4}
          />
        );
      })}

      {/* the clinician-owned record capsule */}
      <rect
        x="48%" y="41.5%" width="24%" height="17%" rx="12"
        fill="url(#cef-cap)"
        stroke="color-mix(in oklab, var(--vt-text-primary) 30%, transparent)"
        strokeWidth="1.25"
      />
      <line
        x1="50%" y1="50%" x2="70%" y2="50%"
        stroke="color-mix(in oklab, var(--vt-text-primary) 14%, transparent)"
        strokeWidth="1"
      />

      {/* signal atoms — named sources read as clear stations, texture stays quiet */}
      {MODEL.atoms.map((a, i) => {
        const color =
          a.kind === 'source' ? 'var(--vt-accent-emerald)'
            : a.kind === 'proof' ? 'var(--accent)'
              : a.kind === 'opportunity' ? 'var(--vt-field-opportunity, #2f6fb0)'
                : 'var(--vt-state-stale, #a2670b)';
        const named = NAMED_SOURCE_ATOMS.has(i);
        const r = named ? 6 : a.kind === 'opportunity' ? 4.5 + a.base : a.kind === 'attention' ? 4 : 3 + a.base;
        return (
          <g key={i}>
            {named ? (
              <circle
                cx={pct(a.x)} cy={pct(a.y)} r={11}
                fill="none"
                stroke="color-mix(in oklab, var(--vt-accent-emerald) 35%, transparent)"
                strokeWidth="1.25"
              />
            ) : null}
            {a.kind === 'attention' ? (
              <circle
                cx={pct(a.x)} cy={pct(a.y)} r={8}
                fill="none"
                stroke="color-mix(in oklab, var(--vt-state-stale, #a2670b) 55%, transparent)"
                strokeWidth="1.25"
                strokeDasharray="3 3"
              />
            ) : null}
            <circle cx={pct(a.x)} cy={pct(a.y)} r={r} fill={color} opacity="0.9" />
          </g>
        );
      })}

      {/* ONE bounded employer-decision ring — a boundary, never a clearance */}
      <circle
        data-poster-ring=""
        cx={pct(MODEL.atoms[MODEL.acceptance].x)}
        cy={pct(MODEL.atoms[MODEL.acceptance].y)}
        r={16}
        fill="none"
        stroke="var(--vt-field-opportunity, #2f6fb0)"
        strokeWidth="1.5"
        strokeDasharray="5 4"
        opacity="0.75"
      />
    </svg>
  );
}

/**
 * Shared label overlay (HERO-RESET-1). Rendered OUTSIDE the tier switch so
 * static, Canvas 2D, and WebGPU present identical names — a tier change can
 * never drop the composition's meaning. Positions come from FIELD_ANCHORS,
 * the same coordinates every renderer draws.
 */
// Cleared past the station, not tucked against it: the GPU tier draws these as
// lit spheres ~20px across where the poster draws a 6px dot, so the old 14px
// offset put the first letter of every source name underneath its own atom.
// One offset has to clear the largest tier.
const LABEL_OFFSET: Record<(typeof FIELD_ANCHORS)[number]['id'], string> = {
  nppes: 'translate(26px, -50%)',
  'oig-leie': 'translate(26px, -50%)',
  pecos: 'translate(26px, -50%)',
  record: 'translate(-50%, 54px)',
  opportunity: 'translate(-50%, 30px)',
};

function FieldLabels() {
  return (
    <div data-field-labels="" aria-hidden="true" className="pointer-events-none absolute inset-0 z-[2]">
      {FIELD_ANCHORS.map((anchor) => (
        <span
          key={anchor.id}
          data-field-label={anchor.id}
          className={cn(
            'absolute whitespace-nowrap font-semibold uppercase',
            anchor.id === 'record'
              ? 'text-[11px] tracking-[0.16em] text-[var(--vt-text-secondary)]'
              : 'text-[10px] tracking-[0.14em] text-[var(--vt-text-muted)]',
          )}
          style={{ left: pct(anchor.x), top: pct(anchor.y), transform: LABEL_OFFSET[anchor.id] }}
        >
          {anchor.label}
        </span>
      ))}
    </div>
  );
}

const LEGEND = [
  { label: 'Source-backed', color: 'var(--vt-accent-emerald)' },
  { label: 'Checked', color: 'var(--accent)' },
  { label: 'Access required', color: 'var(--vt-state-stale, #a2670b)' },
  { label: 'Employer decision', color: 'var(--vt-field-opportunity, #2f6fb0)' },
] as const;

function FieldLegend() {
  return (
    <ul
      data-field-legend=""
      aria-label="Evidence states this page distinguishes"
      className="pointer-events-none absolute inset-x-3 bottom-3 z-[3] flex flex-wrap items-center gap-x-3 gap-y-1"
    >
      {LEGEND.map((item) => (
        <li key={item.label} className="inline-flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.1em] text-[var(--vt-text-muted)]">
          <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full" style={{ background: item.color }} />
          {item.label}
        </li>
      ))}
      <li className="sr-only">
        Named public sources shown: NPPES, OIG/LEIE, and PECOS — signals flowing into a
        clinician-owned career record and out to one opportunity with a single bounded
        employer decision. Illustrative structure; no real people or employers.
      </li>
    </ul>
  );
}

/**
 * The live Canvas-2D scene. Mounted only through SceneBoundary, so it never
 * exists under reduced motion / static tier (no loop, not an idle canvas) and
 * a crash inside it can only ever fall back to the poster.
 */
function FieldCanvas({ wrapRef }: { wrapRef: React.RefObject<HTMLDivElement | null> }) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const [canvasReady, setCanvasReady] = React.useState(false);

  React.useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return; // no 2D context → poster stays

    let palette = readPalette(wrap);
    let raf = 0;
    let w = 0, h = 0, dpr = Math.min(window.devicePixelRatio || 1, 2);
    let onscreen = true;
    let hidden = document.hidden;
    let ready = false;
    let start = performance.now();
    // Pointer parallax: a small eased depth shift (≤ ~10px), never a cursor
    // follow. Target set on move, eased toward 0 when the pointer leaves.
    const ptr = { x: 0, y: 0, tx: 0, ty: 0 };

    const resize = () => {
      const r = wrap.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) return;
      w = r.width; h = r.height; dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`; canvas.style.height = `${h}px`;
      palette = readPalette(wrap);
      if (!ready) { ready = true; setCanvasReady(true); }
    };

    const px = (nx: number) => nx * w;
    const py = (ny: number) => ny * h;

    const draw = (now: number) => {
      const t = (now - start) / 1000;
      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, w, h);

      // ease pointer toward its target and apply a whole-scene parallax
      ptr.x += (ptr.tx - ptr.x) * 0.06;
      ptr.y += (ptr.ty - ptr.y) * 0.06;
      const parX = ptr.x * 10, parY = ptr.y * 8;
      ctx.translate(parX, parY);

      // faint clinical grid — fine engraved geometry behind the field
      const grid = 30;
      ctx.strokeStyle = withAlpha(palette.ink, 0.035);
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let gx = ((-parX % grid) + grid) % grid - grid; gx < w + grid; gx += grid) {
        ctx.moveTo(gx, -Math.abs(parY) - grid); ctx.lineTo(gx, h + Math.abs(parY) + grid);
      }
      for (let gy = ((-parY % grid) + grid) % grid - grid; gy < h + grid; gy += grid) {
        ctx.moveTo(-Math.abs(parX) - grid, gy); ctx.lineTo(w + Math.abs(parX) + grid, gy);
      }
      ctx.stroke();

      const cap = MODEL.capsule;
      const capX = px(cap.x), capY = py(cap.y);

      // converging + outgoing links
      ctx.lineWidth = 1;
      const drawLink = (i: number, into: boolean) => {
        const a = MODEL.atoms[i];
        const ax = px(a.x), ay = py(a.y);
        ctx.strokeStyle = withAlpha(palette.line, into ? 0.7 : 0.55);
        ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(capX, capY); ctx.stroke();
        // a single travelling signal per link — evidence flowing to/from the wallet
        const speed = into ? 0.16 : 0.12;
        const frac = ((t * speed + a.phase * 0.16) % 1 + 1) % 1;
        const f = into ? frac : 1 - frac; // outgoing travels away from capsule
        const sx = into ? ax : capX, sy = into ? ay : capY;
        const ex = into ? capX : ax, ey = into ? capY : ay;
        const dxp = sx + (ex - sx) * f, dyp = sy + (ey - sy) * f;
        const col = into ? KIND_COLOR(palette, a.kind) : palette.opportunity;
        ctx.globalAlpha = 0.35 + 0.5 * Math.sin(frac * Math.PI);
        ctx.fillStyle = col;
        ctx.beginPath(); ctx.arc(dxp, dyp, into ? 1.7 : 2, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
      };
      MODEL.inLinks.forEach((i) => drawLink(i, true));
      MODEL.outLinks.forEach((i) => drawLink(i, false));

      // the wallet capsule — a frosted refractive plate that breathes softly.
      // Proportional to the panel (24% × 17%) so it lands exactly on the
      // poster capsule beneath it — the tiers must share one geometry.
      const breathe = 1 + Math.sin(t * 0.9) * 0.02;
      const cw = w * 0.24 * breathe, ch = h * 0.17 * breathe;
      const rr = Math.min(12, ch * 0.3);
      const cx0 = capX - cw / 2, cy0 = capY - ch / 2;
      // outer bloom so it sits in light, not on a flat card
      const bloom = ctx.createRadialGradient(capX, capY, ch * 0.3, capX, capY, cw * 1.5);
      bloom.addColorStop(0, withAlpha(palette.proof, 0.12));
      bloom.addColorStop(1, withAlpha(palette.proof, 0));
      ctx.fillStyle = bloom;
      ctx.beginPath(); ctx.arc(capX, capY, cw * 1.5, 0, Math.PI * 2); ctx.fill();
      // frosted body: a diagonal refraction gradient
      const grad = ctx.createLinearGradient(cx0, cy0, capX + cw / 2, capY + ch / 2);
      grad.addColorStop(0, withAlpha(palette.capsule, 0.97));
      grad.addColorStop(0.55, withAlpha(palette.capsule, 0.9));
      grad.addColorStop(1, withAlpha(palette.proof, 0.14));
      roundRect(ctx, cx0, cy0, cw, ch, rr);
      ctx.fillStyle = grad; ctx.fill();
      // caustic highlight — a soft light band sweeping the upper third
      ctx.save();
      roundRect(ctx, cx0, cy0, cw, ch, rr); ctx.clip();
      const sweep = capX + Math.sin(t * 0.5) * cw * 0.28;
      const caustic = ctx.createLinearGradient(sweep - cw * 0.4, cy0, sweep + cw * 0.4, cy0 + ch * 0.6);
      caustic.addColorStop(0, withAlpha('#ffffff', 0));
      caustic.addColorStop(0.5, withAlpha('#ffffff', 0.5));
      caustic.addColorStop(1, withAlpha('#ffffff', 0));
      ctx.fillStyle = caustic;
      ctx.fillRect(cx0, cy0, cw, ch * 0.55);
      ctx.restore();
      // rim light (top) + edge
      ctx.lineWidth = 1; ctx.strokeStyle = withAlpha(palette.capsuleEdge, 0.9);
      roundRect(ctx, cx0, cy0, cw, ch, rr); ctx.stroke();
      ctx.lineWidth = 1.2; ctx.strokeStyle = withAlpha('#ffffff', 0.5);
      ctx.beginPath();
      ctx.moveTo(cx0 + rr, cy0 + 0.6); ctx.lineTo(cx0 + cw - rr, cy0 + 0.6); ctx.stroke();
      // engraved centre line — the "record" seam
      ctx.strokeStyle = withAlpha(palette.ink, 0.12);
      ctx.beginPath(); ctx.moveTo(cx0 + 6, capY); ctx.lineTo(cx0 + cw - 6, capY); ctx.stroke();

      // atoms — bloom + core + a small specular for dimensionality; larger
      // (nearer) atoms take a touch more parallax for depth.
      MODEL.atoms.forEach((a) => {
        const depth = (a.base - 0.7) * 4;
        const ax = px(a.x) + ptr.x * depth, ay = py(a.y) + ptr.y * depth;
        const pulse = 0.5 + 0.5 * Math.sin(t * 1.3 + a.phase);
        const r = (2.2 + a.base * 2.4) * (0.9 + pulse * 0.16);
        const col = KIND_COLOR(palette, a.kind);
        // soft bloom halo
        const halo = ctx.createRadialGradient(ax, ay, r * 0.3, ax, ay, r * 2.8);
        halo.addColorStop(0, withAlpha(col, a.kind === 'attention' ? 0.18 : 0.26));
        halo.addColorStop(1, withAlpha(col, 0));
        ctx.fillStyle = halo;
        ctx.beginPath(); ctx.arc(ax, ay, r * 2.8, 0, Math.PI * 2); ctx.fill();
        // core with a subtle vertical shade for roundness
        const core = ctx.createLinearGradient(ax, ay - r, ax, ay + r);
        core.addColorStop(0, withAlpha('#ffffff', 0.35));
        core.addColorStop(0.35, col);
        core.addColorStop(1, withAlpha(col, 0.85));
        ctx.fillStyle = core;
        ctx.beginPath(); ctx.arc(ax, ay, r, 0, Math.PI * 2); ctx.fill();
        // specular dot
        ctx.fillStyle = withAlpha('#ffffff', 0.55);
        ctx.beginPath(); ctx.arc(ax - r * 0.3, ay - r * 0.34, r * 0.32, 0, Math.PI * 2); ctx.fill();
      });

      // a SINGLE bounded acceptance ring — never a universal "cleared" signal
      const acc = MODEL.atoms[MODEL.acceptance];
      if (acc) {
        const ax = px(acc.x), ay = py(acc.y);
        const rp = 0.5 + 0.5 * Math.sin(t * 0.8);
        ctx.globalAlpha = 0.3 + rp * 0.4;
        ctx.strokeStyle = palette.opportunity; ctx.lineWidth = 1.5;
        // breathes around the poster ring's r=16 so the tiers agree at rest
        ctx.beginPath(); ctx.arc(ax, ay, 14 + rp * 4, 0, Math.PI * 2); ctx.stroke();
        ctx.globalAlpha = 1;
      }

      ctx.restore();
    };

    const frame = (now: number) => {
      raf = 0;
      if (!onscreen || hidden) return; // settle: no loop while offscreen/hidden
      draw(now);
      raf = requestAnimationFrame(frame);
    };
    const wake = () => { if (!raf && onscreen && !hidden) raf = requestAnimationFrame(frame); };

    resize();
    draw(performance.now()); // paint one frame immediately so the fade-in isn't blank

    const ro = new ResizeObserver(() => { resize(); if (!raf) draw(performance.now()); });
    ro.observe(wrap);
    const io = new IntersectionObserver((e) => { onscreen = e[0]?.isIntersecting ?? true; wake(); }, { threshold: 0.02 });
    io.observe(wrap);
    const onVis = () => { hidden = document.hidden; wake(); };
    document.addEventListener('visibilitychange', onVis);
    const onMove = (e: PointerEvent) => {
      const r = wrap.getBoundingClientRect();
      ptr.tx = Math.max(-0.5, Math.min(0.5, (e.clientX - r.left) / r.width - 0.5));
      ptr.ty = Math.max(-0.5, Math.min(0.5, (e.clientY - r.top) / r.height - 0.5));
      wake();
    };
    const onLeave = () => { ptr.tx = 0; ptr.ty = 0; wake(); };
    wrap.addEventListener('pointermove', onMove);
    wrap.addEventListener('pointerleave', onLeave);

    wake();
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      document.removeEventListener('visibilitychange', onVis);
      wrap.removeEventListener('pointermove', onMove);
      wrap.removeEventListener('pointerleave', onLeave);
    };
  }, [wrapRef]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 transition-opacity duration-700"
      style={{ opacity: canvasReady ? 1 : 0 }}
    />
  );
}

/**
 * The WebGPU tier (SHD-2.1). Lazily imports the renderer only when the tier
 * grants it; a missing adapter, slow init (deadline-bounded), or device loss
 * resolves to `onFallback()`, which swaps in the Canvas-2D tier on the SAME
 * semantic model. No user-visible failure state exists at any point.
 */
function FieldGpuCanvas({
  wrapRef,
  onFallback,
}: {
  wrapRef: React.RefObject<HTMLDivElement | null>;
  onFallback: () => void;
}) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const [gpuReady, setGpuReady] = React.useState(false);

  React.useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    let cancelled = false;
    let handle: { destroy(): void } | null = null;
    let probe = 0;

    void import('@/components/home/evidence-field/webgpu').then(async (mod) => {
      if (cancelled) return;
      const h = await mod.initEvidenceFieldGpu(canvas, wrap, onFallback);
      if (!h) {
        if (!cancelled) onFallback();
        return;
      }
      if (cancelled) {
        h.destroy();
        return;
      }
      handle = h;
      setGpuReady(true);

      // Paint probe. A successful init proves the device came up, NOT that the
      // scene draws: a bad projection matrix produces a valid, wholly blank
      // canvas and no error, so `onFallback` never fires and the 2D tier never
      // mounts — the hero silently degrades to a static poster. That shipped.
      //
      // The measurement belongs to the renderer (`paintedPixels`), which reads
      // its own render target GPU-side. Reading it from here instead —
      // `drawImage` onto a 2D scratch canvas — returns empty for a live rAF
      // loop once the frame has been presented, and demotes a scene that is
      // visibly drawing. `null` means not measured yet (the loop parks while
      // offscreen or hidden, and a background tab starts hidden), so this asks
      // again rather than assuming the worst.
      const judge = () => {
        if (cancelled) return;
        const painted = h.paintedPixels();
        if (painted === null) {
          probe = window.setTimeout(judge, GPU_PAINT_PROBE_MS); // not measured yet
          return;
        }
        if (painted === 0) onFallback(); // −1 = unmeasurable → keep the tier
      };
      probe = window.setTimeout(judge, GPU_PAINT_PROBE_MS);
    });

    return () => {
      cancelled = true;
      window.clearTimeout(probe);
      handle?.destroy();
    };
  }, [wrapRef, onFallback]);

  return (
    <canvas
      ref={canvasRef}
      data-field-gpu=""
      className="absolute inset-0 transition-opacity duration-700"
      style={{ opacity: gpuReady ? 1 : 0 }}
    />
  );
}

/**
 * SHD-2.2 hero interaction signal. The field reflects only SAFE, non-sensitive
 * input state:
 *   'idle'      — no interaction;
 *   'listening' — the NPI caret is present (the system is attending);
 *   'ready'     — the entered value passes the CMS checksum (still not a
 *                 lookup — no clinician-specific claim is rendered).
 * The cue is a bordered/elevation shift on the container only; it never
 * fabricates data and needs no animation, so it is reduced-motion-safe.
 */
export type FieldSignal = 'idle' | 'listening' | 'ready';

export function CareerEvidenceField({ signal = 'idle' }: { signal?: FieldSignal }) {
  const wrapRef = React.useRef<HTMLDivElement>(null);
  // Sticky per-mount: once the GPU path declines, stay on Canvas 2D.
  const [gpuFailed, setGpuFailed] = React.useState(false);
  const fallBack = React.useCallback(() => setGpuFailed(true), []);

  return (
    <div
      ref={wrapRef}
      data-home-evidence-field=""
      data-field-signal={signal}
      className={cn(
        // The field BLEEDS into the hero paper: no fill, no rule, no card.
        // It was `bg-[var(--vt-surface)]` + a 1px `--vt-border` — but
        // `.mz-cloud-paper` re-tints --paper to Cloud Dancer WITHOUT re-tinting
        // --vt-surface, so the panel kept --card (#FBFAF6, cooler and brighter)
        // outlined in --rule (#C9C3B6) on #F0EEE9 paper: a pasted-on box, and a
        // temperature mismatch besides. Ambience belongs in the paper; depth is
        // the renderer's job, not a frame's.
        'relative aspect-[16/10] w-full overflow-hidden bg-transparent transition-[opacity] duration-500 lg:aspect-auto lg:h-[clamp(28rem,54vh,38rem)]',
        // The NPI signal now reads as the field itself lifting, not as chrome
        // changing colour — nothing here fabricates a per-clinician claim.
        signal === 'idle' ? 'opacity-95' : 'opacity-100',
      )}
    >
      {/* Decorative visual layer only. The honest meaning lives in the
          accessible legend below, kept OUT of this aria-hidden subtree so
          assistive tech still receives it (VHS-1 §7). The SceneBoundary owns
          the tier decision (SHD-1.1): poster always renders; a live scene
          mounts only when animation is allowed, and any scene crash falls
          back to the poster silently. SHD-2.1 adds the ladder INSIDE the
          animated branch: webgpu tier → Graphene-language renderer; anything
          less (or a declined/lost device) → the deterministic Canvas 2D
          field. All tiers draw the same seeded semantic model. */}
      <div aria-hidden="true" className="absolute inset-0">
        <SceneBoundary poster={<FieldPoster />} className="absolute inset-0">
          {(tier) =>
            tier === 'webgpu' && !gpuFailed ? (
              <FieldGpuCanvas wrapRef={wrapRef} onFallback={fallBack} />
            ) : (
              <FieldCanvas wrapRef={wrapRef} />
            )
          }
        </SceneBoundary>
      </div>
      <FieldLabels />
      <FieldLegend />
    </div>
  );
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export default CareerEvidenceField;
