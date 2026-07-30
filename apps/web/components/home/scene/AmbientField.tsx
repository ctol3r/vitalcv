'use client';

/**
 * AmbientField (SHD-1.2, manifest rows 1–2) — the page-level career-evidence
 * atmosphere. Substitutes the template's `Swirl` + pointer-reactive
 * `ChromaFlow` layers (the `shaders` npm package ships no license, so this is
 * an original implementation, not an import).
 *
 * SHD-1.3: the field is a chapter-progress consumer. It subscribes to the
 * single ChapterProgress driver and crossfades accent palettes / flow / wake
 * through each chapter handoff, so the whole page reads as one continuous
 * environment in both scroll directions. Without a provider it renders the
 * `chapterId` prop's scene statically — same field, no journey.
 *
 * Runtime discipline (rides SHD-1.1):
 *  - mounts only when SceneBoundary grants an animated tier;
 *  - static tier / errors → the CSS poster gradient in scene.css stands alone;
 *  - DPR capped at 1.5 (it is blurred anyway), rAF suspends offscreen/hidden;
 *  - deterministic seeded geometry — zero Math.random, zero CLS;
 *  - flow is integrated incrementally (phase += dt · flow), so a mid-journey
 *    flow change bends the motion instead of jumping it.
 */

import * as React from 'react';

import { useChapterProgressSubscription } from './ChapterProgress';
import { blendSceneParams, type ChapterProgress, type SceneBlend } from './progress';
import { getChapterScene, type SceneAccent } from './registry';

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Blob {
  x: number;
  y: number;
  ox: number;
  oy: number;
  w: number;
  phase: number;
  /** radius as a fraction of the larger viewport side */
  r: number;
  accent: 'accent' | 'support';
}

const BLOBS: readonly Blob[] = (() => {
  const rnd = mulberry32(0x5eed12);
  const blobs: Blob[] = [];
  for (let i = 0; i < 5; i++) {
    blobs.push({
      x: 0.12 + rnd() * 0.76,
      y: 0.1 + rnd() * 0.8,
      ox: 0.04 + rnd() * 0.05,
      oy: 0.03 + rnd() * 0.04,
      w: 0.05 + rnd() * 0.06,
      phase: rnd() * Math.PI * 2,
      r: 0.28 + rnd() * 0.2,
      accent: i % 2 === 0 ? 'accent' : 'support',
    });
  }
  return blobs;
})();

interface AmbientPalette {
  emerald: string;
  indigo: string;
  amber: string;
  neutral: string;
}

function readAmbientPalette(el: HTMLElement): AmbientPalette {
  const s = getComputedStyle(el);
  const v = (name: string, fallback: string) => s.getPropertyValue(name).trim() || fallback;
  return {
    emerald: v('--vt-accent-editorial', '#4338CA'),
    indigo: v('--accent', '#4f46e5'),
    amber: v('--vt-state-stale', '#a2670b'),
    neutral: v('--vt-border', '#d6ded9'),
  };
}

const accentColor = (p: AmbientPalette, a: SceneAccent) =>
  a === 'emerald' ? p.emerald : a === 'indigo' ? p.indigo : a === 'amber' ? p.amber : p.neutral;

function tint(color: string, alpha: number): string {
  return `color-mix(in oklab, ${color} ${Math.round(alpha * 100)}%, transparent)`;
}

export interface AmbientFieldProps {
  /** Fallback scene when no ChapterProgressProvider is mounted. */
  chapterId?: string;
}

/**
 * Renders the animated canvas layer only. Mount inside a SceneBoundary whose
 * poster carries the static gradient (`.scene-ambient-poster`).
 */
export function AmbientField({ chapterId = 'wallet' }: AmbientFieldProps) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const fallbackScene = getChapterScene(chapterId);
  const blendRef = React.useRef<SceneBlend>({ from: fallbackScene, to: fallbackScene, t: 0 });
  const [ready, setReady] = React.useState(false);

  const onProgress = React.useCallback((p: ChapterProgress) => {
    blendRef.current = p.blend;
  }, []);
  useChapterProgressSubscription(onProgress);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return; // poster stands alone

    const host = canvas.parentElement ?? canvas;
    let palette = readAmbientPalette(host);
    let raf = 0;
    let w = 0;
    let h = 0;
    let dpr = 1;
    let onscreen = true;
    let hidden = document.hidden;
    let lastNow = performance.now();
    /** Integrated journey clock: advances by dt·flow each frame. */
    let phase = 0;
    const wake = { x: 0.5, y: 0.4, tx: 0.5, ty: 0.4, energy: 0 };

    const resize = () => {
      const r = host.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) return;
      w = r.width;
      h = r.height;
      dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      palette = readAmbientPalette(host);
      setReady(true);
    };

    const drawBlob = (b: Blob, color: string, alpha: number) => {
      if (alpha <= 0.001) return;
      const bx = (b.x + Math.cos(phase * b.w * Math.PI * 2 + b.phase) * b.ox) * w;
      const by = (b.y + Math.sin(phase * b.w * Math.PI * 2 + b.phase * 1.3) * b.oy) * h;
      const br = b.r * Math.max(w, h);
      const g = ctx.createRadialGradient(bx, by, 0, bx, by, br);
      g.addColorStop(0, tint(color, 0.11 * alpha));
      g.addColorStop(0.6, tint(color, 0.05 * alpha));
      g.addColorStop(1, tint(color, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(bx, by, br, 0, Math.PI * 2);
      ctx.fill();
    };

    const draw = (now: number) => {
      const blend = blendRef.current;
      const params = blendSceneParams(blend);
      const dt = Math.min(0.1, Math.max(0, (now - lastNow) / 1000));
      lastNow = now;
      phase += dt * params.flow;

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, w, h);

      // chapter handoff: each blob crossfades from-accent → to-accent
      for (const b of BLOBS) {
        const fromCol = accentColor(
          palette,
          b.accent === 'accent' ? blend.from.accent : blend.from.support,
        );
        const toCol = accentColor(
          palette,
          b.accent === 'accent' ? blend.to.accent : blend.to.support,
        );
        if (blend.t < 0.999 || fromCol === toCol) drawBlob(b, fromCol, 1 - blend.t);
        if (blend.t > 0.001 && fromCol !== toCol) drawBlob(b, toCol, blend.t);
      }

      // pointer wake — bounded by the BLENDED chapter amplitude; decays when
      // the pointer rests. Accent follows the dominant scene of the handoff.
      if (params.wake > 0 && wake.energy > 0.01) {
        wake.x += (wake.tx - wake.x) * 0.07;
        wake.y += (wake.ty - wake.y) * 0.07;
        wake.energy *= 0.985;
        const wx = wake.x * w;
        const wy = wake.y * h;
        const wr = Math.max(w, h) * 0.22;
        const dominant = blend.t < 0.5 ? blend.from : blend.to;
        const col = accentColor(palette, dominant.accent);
        const g = ctx.createRadialGradient(wx, wy, 0, wx, wy, wr);
        g.addColorStop(0, tint(col, 0.11 * params.wake * wake.energy));
        g.addColorStop(1, tint(col, 0));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(wx, wy, wr, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    };

    const frame = (now: number) => {
      raf = 0;
      if (!onscreen || hidden) return;
      draw(now);
      raf = requestAnimationFrame(frame);
    };
    const wakeLoop = () => {
      if (!raf && onscreen && !hidden) {
        lastNow = performance.now();
        raf = requestAnimationFrame(frame);
      }
    };

    resize();
    draw(performance.now());

    const ro = new ResizeObserver(() => {
      resize();
      if (!raf) draw(performance.now());
    });
    ro.observe(host);
    const io = new IntersectionObserver(
      (e) => {
        onscreen = e[0]?.isIntersecting ?? true;
        wakeLoop();
      },
      { threshold: 0.01 },
    );
    io.observe(host);
    const onVis = () => {
      hidden = document.hidden;
      wakeLoop();
    };
    document.addEventListener('visibilitychange', onVis);
    const onMove = (e: PointerEvent) => {
      wake.tx = Math.min(1, Math.max(0, e.clientX / Math.max(1, window.innerWidth)));
      wake.ty = Math.min(1, Math.max(0, e.clientY / Math.max(1, window.innerHeight)));
      wake.energy = 1;
      wakeLoop();
    };
    // window-level: the atmosphere reacts to page-wide pointer movement, like
    // the source ChromaFlow, but as tint only — never a cursor replacement.
    window.addEventListener('pointermove', onMove, { passive: true });

    wakeLoop();
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('pointermove', onMove);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      data-scene-ambient=""
      className="absolute inset-0 h-full w-full transition-opacity duration-700"
      style={{ opacity: ready ? 1 : 0 }}
    />
  );
}

export default AmbientField;
