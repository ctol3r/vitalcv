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
 * The real explorable graph remains at /evidence-network; this is not that.
 */

import * as React from 'react';

import { SceneBoundary } from '@/components/home/scene/SceneBoundary';
import {
  KIND_COLOR,
  MODEL,
  readPalette,
  withAlpha,
} from '@/components/home/evidence-field/model';
import { cn } from '@/lib/utils';

/* The seeded field model, palette bridge, and color helpers moved to
   components/home/evidence-field/model.ts (SHD-2.1) so the WebGPU tier, this
   2D tier, and the SVG poster all bind the SAME semantic composition. */

const KIND_FILL = (kind: string) =>
  kind === 'source'
    ? 'var(--vt-accent-emerald)'
    : kind === 'proof'
      ? 'var(--accent)'
      : kind === 'opportunity'
        ? 'var(--vt-field-opportunity, #2f6fb0)'
        : 'var(--vt-state-stale, #a2670b)';

function FieldPoster() {
  // HERO-RESET-1 Task 4: the poster is the BASELINE composition, not a
  // low-contrast emergency state. A human must recognize the evidence field in
  // a static screenshot: washed depth, a fine grid, colored source→record
  // connectors with a visible flow mark, a dimensional record capsule, one
  // bounded employer-decision ring. Canvas/WebGPU add motion over this same
  // geometry; nothing essential exists only in an animated tier.
  const cap = MODEL.capsule;
  const acc = MODEL.atoms[MODEL.acceptance];
  return (
    <svg
      data-field-poster=""
      aria-hidden="true"
      viewBox="0 0 100 62"
      preserveAspectRatio="xMidYMid slice"
      className="absolute inset-0 h-full w-full"
    >
      <defs>
        <radialGradient id="cef-cap" cx="50%" cy="42%" r="65%">
          <stop offset="0%" stopColor="var(--vt-surface)" />
          <stop offset="100%" stopColor="var(--vt-surface-subtle)" />
        </radialGradient>
        <radialGradient id="cef-wash-a" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="var(--vt-accent-emerald)" stopOpacity="0.1" />
          <stop offset="100%" stopColor="var(--vt-accent-emerald)" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="cef-wash-b" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.09" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="cef-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="var(--vt-text-primary)" stopOpacity="0.16" />
          <stop offset="100%" stopColor="var(--vt-text-primary)" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* depth washes — the field sits IN light, not on flat paper */}
      <ellipse cx="20" cy="28" rx="26" ry="20" fill="url(#cef-wash-a)" />
      <ellipse cx="82" cy="34" rx="24" ry="18" fill="url(#cef-wash-b)" />

      {/* fine clinical grid */}
      {[12.4, 24.8, 37.2, 49.6].map((gy) => (
        <line key={`gy-${gy}`} x1="0" y1={gy} x2="100" y2={gy} stroke="var(--vt-text-primary)" strokeOpacity="0.05" strokeWidth="0.12" />
      ))}
      {[16.6, 33.3, 50, 66.6, 83.3].map((gx) => (
        <line key={`gx-${gx}`} x1={gx} y1="0" x2={gx} y2="62" stroke="var(--vt-text-primary)" strokeOpacity="0.05" strokeWidth="0.12" />
      ))}

      {/* source → record connectors, colored by their signal, with a visible
          static flow mark at two-thirds travel */}
      {MODEL.inLinks.map((i) => {
        const a = MODEL.atoms[i];
        const color = KIND_FILL(a.kind);
        const mx = a.x * 100 + (cap.x * 100 - a.x * 100) * 0.66;
        const my = a.y * 62 + (cap.y * 62 - a.y * 62) * 0.66;
        return (
          <g key={`in-${i}`}>
            <line x1={a.x * 100} y1={a.y * 62} x2={cap.x * 100} y2={cap.y * 62} stroke={color} strokeOpacity="0.38" strokeWidth="0.4" />
            <circle cx={mx} cy={my} r="0.55" fill={color} opacity="0.75" />
          </g>
        );
      })}
      {/* record → opportunity connectors */}
      {MODEL.outLinks.map((i) => {
        const a = MODEL.atoms[i];
        return (
          <line
            key={`out-${i}`}
            x1={cap.x * 100} y1={cap.y * 62}
            x2={a.x * 100} y2={a.y * 62}
            stroke="var(--vt-field-opportunity, #2f6fb0)" strokeOpacity="0.34" strokeWidth="0.38"
            strokeDasharray="1.3 1"
          />
        );
      })}

      {/* the clinician-owned record capsule — dimensional, not a flat chip */}
      <ellipse cx={cap.x * 100} cy={cap.y * 62 + 4.4} rx="8.6" ry="1.7" fill="var(--vt-text-primary)" opacity="0.08" />
      <rect
        x={cap.x * 100 - 7} y={cap.y * 62 - 5.6}
        width="14" height="11.2" rx="3.2"
        fill="url(#cef-cap)" stroke="var(--vt-border)" strokeWidth="0.45"
      />
      <line x1={cap.x * 100 - 4.6} y1={cap.y * 62 - 2.2} x2={cap.x * 100 + 4.6} y2={cap.y * 62 - 2.2} stroke="var(--vt-text-primary)" strokeOpacity="0.28" strokeWidth="0.45" />
      <line x1={cap.x * 100 - 4.6} y1={cap.y * 62 + 0.2} x2={cap.x * 100 + 2.8} y2={cap.y * 62 + 0.2} stroke="var(--vt-text-primary)" strokeOpacity="0.18" strokeWidth="0.45" />
      <line x1={cap.x * 100 - 4.6} y1={cap.y * 62 + 2.5} x2={cap.x * 100 + 3.8} y2={cap.y * 62 + 2.5} stroke="var(--vt-text-primary)" strokeOpacity="0.18" strokeWidth="0.45" />

      {/* atoms — glow + core + specular so every node reads at a glance */}
      {MODEL.atoms.map((a, i) => {
        const color = KIND_FILL(a.kind);
        const r = 1.15 + a.base * 0.85;
        return (
          <g key={i}>
            <circle cx={a.x * 100} cy={a.y * 62} r={r * 2.6} fill="url(#cef-glow)" opacity="0.5" />
            <circle cx={a.x * 100} cy={a.y * 62} r={r * 1.9} fill={color} opacity="0.14" />
            <circle cx={a.x * 100} cy={a.y * 62} r={r} fill={color} opacity="0.95" />
            <circle cx={a.x * 100 - r * 0.3} cy={a.y * 62 - r * 0.34} r={r * 0.3} fill="#ffffff" opacity="0.55" />
            {a.kind === 'attention' ? (
              <circle cx={a.x * 100} cy={a.y * 62} r={r * 1.7} fill="none" stroke={color} strokeOpacity="0.6" strokeWidth="0.3" />
            ) : null}
          </g>
        );
      })}

      {/* ONE bounded employer-decision ring — never a universal cleared badge */}
      {acc ? (
        <>
          <circle cx={acc.x * 100} cy={acc.y * 62} r="5.4" fill="none" stroke="var(--vt-field-opportunity, #2f6fb0)" strokeOpacity="0.55" strokeWidth="0.5" />
          <circle cx={acc.x * 100} cy={acc.y * 62} r="7.2" fill="none" stroke="var(--vt-field-opportunity, #2f6fb0)" strokeOpacity="0.22" strokeWidth="0.35" />
        </>
      ) : null}
    </svg>
  );
}

/**
 * Shared tier-independent labels (HERO-RESET-1): the three named public
 * sources, the record, and the decision ring are captioned in plain HTML
 * ABOVE every render tier, so static, Canvas 2D, and WebGPU all present the
 * same composition. Decorative (`aria-hidden`) — the accessible meaning
 * stays in the legend and surrounding copy. No person or employer names.
 */
const FIELD_LABELS = [
  // Anchors chosen so no caption collides with the legend strip at the panel
  // bottom (atom 6 sits too low — verified visually, HERO-RESET-1).
  { text: 'NPPES', atom: 0, dx: -1, dy: -3 },
  { text: 'OIG / LEIE', atom: 3, dx: -1, dy: -3 },
  { text: 'PECOS', atom: 5, dx: -1, dy: -3 },
] as const;

function FieldLabels() {
  return (
    <div aria-hidden="true" data-field-labels="" className="pointer-events-none absolute inset-0 z-[2]">
      {FIELD_LABELS.map((l) => {
        const a = MODEL.atoms[l.atom];
        if (!a) return null;
        return (
          <span
            key={l.text}
            className="absolute font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--vt-text-secondary)]"
            style={{ left: `${a.x * 100 + l.dx}%`, top: `calc(${a.y * 100}% + ${l.dy * 4}px)` }}
          >
            {l.text}
          </span>
        );
      })}
      <span
        className="absolute -translate-x-1/2 font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--vt-text-secondary)]"
        style={{ left: `${MODEL.capsule.x * 100}%`, top: `calc(${MODEL.capsule.y * 100}% + 44px)` }}
      >
        Your career record
      </span>
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

      // the wallet capsule — a frosted refractive plate that breathes softly
      const breathe = 1 + Math.sin(t * 0.9) * 0.02;
      const cw = 34 * breathe, ch = 26 * breathe;
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
      roundRect(ctx, cx0, cy0, cw, ch, 8);
      ctx.fillStyle = grad; ctx.fill();
      // caustic highlight — a soft light band sweeping the upper third
      ctx.save();
      roundRect(ctx, cx0, cy0, cw, ch, 8); ctx.clip();
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
      roundRect(ctx, cx0, cy0, cw, ch, 8); ctx.stroke();
      ctx.lineWidth = 1.2; ctx.strokeStyle = withAlpha('#ffffff', 0.5);
      ctx.beginPath();
      ctx.moveTo(cx0 + 8, cy0 + 0.6); ctx.lineTo(cx0 + cw - 8, cy0 + 0.6); ctx.stroke();
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
        ctx.strokeStyle = palette.opportunity; ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.arc(ax, ay, 8 + rp * 4, 0, Math.PI * 2); ctx.stroke();
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
    });

    return () => {
      cancelled = true;
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
        'relative aspect-[16/10] w-full overflow-hidden rounded-[16px] border bg-[var(--vt-surface)] transition-[box-shadow,border-color] duration-500 lg:aspect-auto lg:h-[clamp(28rem,54vh,38rem)]',
        signal === 'ready'
          ? 'border-[color-mix(in_oklab,var(--vt-accent-emerald)_55%,var(--vt-border))] shadow-[0_30px_70px_-52px_color-mix(in_oklab,var(--vt-accent-emerald)_45%,transparent)]'
          : signal === 'listening'
            ? 'border-[color-mix(in_oklab,var(--vt-accent-emerald)_28%,var(--vt-border))] shadow-[0_30px_70px_-54px_rgba(20,20,20,0.4)]'
            : 'border-[var(--vt-border)] shadow-[0_30px_70px_-55px_rgba(20,20,20,0.4)]',
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
        {/* Tier-independent captions sit ABOVE the animated layers, so every
            tier presents the same named composition (HERO-RESET-1 Task 4). */}
        <FieldLabels />
      </div>
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
