'use client';

/**
 * MatchaConstellation — the signature interactive centerpiece.
 *
 * A clinician's career rendered as a living orbital constellation you can *scrub through time*:
 * where you began (residency, first license), where you are now (source-backed evidence, readiness,
 * recognition), and where you're headed (projected opportunities that light up as readiness grows).
 * Drag to rotate the sky, hover a star to read it, and pull the time control to travel your career.
 *
 * This is a deliberate, alive moment — gentle orbital motion, depth, twinkle — inside the otherwise
 * calm product. Honesty: "now" nodes are real career-evidence categories; past and future are
 * clearly labeled as illustrative/projected, never asserted as verified facts.
 *
 * Respects prefers-reduced-motion (settles to a static sky, still fully interactive via the scrubber).
 */

import { useEffect, useMemo, useRef, useState } from 'react';

type Era = 'origin' | 'now' | 'future';
type Kind = 'you' | 'origin' | 'credential' | 'readiness' | 'recognition' | 'opportunity' | 'future';

interface Star {
  id: string;
  label: string;
  kind: Kind;
  era: Era;
  /** temporal position 0 (earliest) … 1 (furthest future) */
  t: number;
  ring: 1 | 2 | 3;
  angle: number; // base angle (radians)
  twinkle: number; // phase
}

const PALETTE: Record<Kind, string> = {
  you: '#f4c76b',
  origin: '#9aa0b5',
  credential: '#5fd4bf',
  readiness: '#8b8cf0',
  recognition: '#f4a15f',
  opportunity: '#7fe0a3',
  future: '#8b8cf0',
};

/** Optional real signed-in data — relabels the "now" stars so the sky is the clinician's own. */
export interface ConstellationProfile {
  specialty?: string;
  readinessScore?: number | null;
  matchCount?: number;
}

// Deterministic layout (no Math.random at module scope; twinkle phase derived from index).
function buildStars(profile?: ConstellationProfile): Star[] {
  const defs: Array<Omit<Star, 'angle' | 'twinkle'>> = [
    { id: 'you', label: 'You', kind: 'you', era: 'now', t: 0.5, ring: 1 },
    // origin era
    { id: 'residency', label: 'Residency', kind: 'origin', era: 'origin', t: 0.08, ring: 3 },
    { id: 'first-license', label: 'First license', kind: 'origin', era: 'origin', t: 0.15, ring: 2 },
    { id: 'boards', label: 'Board exam', kind: 'origin', era: 'origin', t: 0.2, ring: 3 },
    { id: 'first-role', label: 'First role', kind: 'origin', era: 'origin', t: 0.27, ring: 2 },
    // now era — real evidence categories
    { id: 'npi', label: 'NPI', kind: 'credential', era: 'now', t: 0.46, ring: 1 },
    { id: 'license', label: 'State license', kind: 'credential', era: 'now', t: 0.5, ring: 2 },
    { id: 'board-cert', label: 'Board cert', kind: 'credential', era: 'now', t: 0.52, ring: 2 },
    { id: 'dea', label: 'DEA', kind: 'credential', era: 'now', t: 0.48, ring: 3 },
    { id: 'readiness', label: 'Readiness', kind: 'readiness', era: 'now', t: 0.5, ring: 1 },
    { id: 'recognition', label: 'Recognition', kind: 'recognition', era: 'now', t: 0.55, ring: 2 },
    { id: 'specialty', label: 'Specialty', kind: 'readiness', era: 'now', t: 0.54, ring: 3 },
    // future era — projected
    { id: 'opp1', label: 'Projected role', kind: 'future', era: 'future', t: 0.72, ring: 2 },
    { id: 'opp2', label: 'Projected role', kind: 'future', era: 'future', t: 0.8, ring: 3 },
    { id: 'next-license', label: 'Next license', kind: 'future', era: 'future', t: 0.76, ring: 2 },
    { id: 'subspecialty', label: 'Subspecialty', kind: 'future', era: 'future', t: 0.88, ring: 3 },
    { id: 'leadership', label: 'Leadership', kind: 'future', era: 'future', t: 0.93, ring: 2 },
  ];
  const perRing: Record<number, number> = { 1: 0, 2: 0, 3: 0 };
  const ringCount: Record<number, number> = {
    1: defs.filter((d) => d.ring === 1 && d.id !== 'you').length,
    2: defs.filter((d) => d.ring === 2).length,
    3: defs.filter((d) => d.ring === 3).length,
  };
  const stars = defs.map((d, i) => {
    if (d.id === 'you') return { ...d, angle: 0, twinkle: 0 };
    const idx = perRing[d.ring]++;
    const angle = (idx / Math.max(1, ringCount[d.ring])) * Math.PI * 2 + d.ring * 0.6;
    return { ...d, angle, twinkle: (i * 1.7) % (Math.PI * 2) };
  });

  // Relabel the "now" stars with the clinician's real values when signed in.
  if (profile) {
    for (const s of stars) {
      if (s.id === 'specialty' && profile.specialty) s.label = profile.specialty;
      if (s.id === 'readiness' && profile.readinessScore != null) s.label = `Readiness ${profile.readinessScore}`;
      if (s.id === 'opp1' && profile.matchCount && profile.matchCount > 0) s.label = `${profile.matchCount} matched`;
    }
  }
  return stars;
}

const ERA_LABEL: Record<Era, string> = {
  origin: 'Where you began',
  now: 'Where you are',
  future: 'Where you’re headed',
};

function eraForTime(t: number): Era {
  if (t < 0.35) return 'origin';
  if (t > 0.62) return 'future';
  return 'now';
}

export function MatchaConstellation({ height = 460, profile }: { height?: number; profile?: ConstellationProfile }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const stars = useMemo(() => buildStars(profile), [profile]);
  const [time, setTime] = useState(0.5);
  const [hoverLabel, setHoverLabel] = useState<string | null>(null);
  const timeRef = useRef(0.5);
  timeRef.current = time;

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = wrap.clientWidth;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);
    const setSize = () => {
      width = wrap.clientWidth;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
    };
    setSize();

    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    const ringR = () => [0, Math.min(width, height * 1.6) * 0.16, Math.min(width, height * 1.6) * 0.26, Math.min(width, height * 1.6) * 0.36];

    let rot = 0;
    let dragRot = 0;
    let dragging = false;
    let lastX = 0;
    let hovered: string | null = null;
    let mouse = { x: 0, y: 0 };
    let raf = 0;
    let last = 0;

    const positions = new Map<string, { x: number; y: number; scale: number; alpha: number }>();

    function draw(now: number) {
      if (!ctx) return;
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
      last = now;
      if (!reduced) rot += dt * 0.18;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);
      const cx = width / 2;
      const cy = height / 2;
      const rings = ringR();
      const t = timeRef.current;

      // faint orbit rings (elliptical)
      ctx.strokeStyle = 'rgba(139,140,240,0.10)';
      ctx.lineWidth = 1;
      for (let r = 1; r <= 3; r++) {
        ctx.beginPath();
        ctx.ellipse(cx, cy, rings[r], rings[r] * 0.55, 0, 0, Math.PI * 2);
        ctx.stroke();
      }

      // compute positions
      positions.clear();
      for (const s of stars) {
        if (s.id === 'you') {
          positions.set(s.id, { x: cx, y: cy, scale: 1, alpha: 1 });
          continue;
        }
        const ringSpeed = 1 / s.ring;
        const a = s.angle + rot * ringSpeed + dragRot;
        const r = rings[s.ring];
        const x = cx + Math.cos(a) * r;
        const depth = Math.sin(a); // -1 back … 1 front
        const y = cy + Math.sin(a) * r * 0.55 - depth * 6;
        const scale = 0.7 + (depth + 1) * 0.28;
        // temporal brightness: bright near the scrubbed time, dim far away
        const dist = Math.abs(t - s.t);
        const timeAlpha = Math.max(0.05, 1 - dist * 2.6);
        const tw = reduced ? 1 : 0.82 + 0.18 * Math.sin(now / 600 + s.twinkle);
        positions.set(s.id, { x, y, scale, alpha: timeAlpha * tw });
      }

      // links from center to visible-ish stars
      const you = positions.get('you')!;
      for (const s of stars) {
        if (s.id === 'you') continue;
        const p = positions.get(s.id)!;
        if (p.alpha < 0.12) continue;
        ctx.strokeStyle = `rgba(139,140,240,${0.05 + p.alpha * 0.12})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(you.x, you.y);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
      }

      // stars — back to front
      const order = [...stars].sort((a, b) => (positions.get(a.id)!.y) - (positions.get(b.id)!.y));
      for (const s of order) {
        const p = positions.get(s.id)!;
        const isHover = hovered === s.id;
        const baseR = (s.id === 'you' ? 9 : s.kind === 'future' ? 4.5 : 5.5) * p.scale;
        const col = PALETTE[s.kind];
        ctx.globalAlpha = Math.min(1, p.alpha + (isHover ? 0.4 : 0));
        // glow
        const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, baseR * (isHover ? 5 : 3.4));
        glow.addColorStop(0, col);
        glow.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.globalAlpha = Math.min(0.5, p.alpha * (isHover ? 0.85 : 0.42));
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(p.x, p.y, baseR * (isHover ? 5 : 3.4), 0, Math.PI * 2);
        ctx.fill();
        // core
        ctx.globalAlpha = Math.min(1, p.alpha + (isHover ? 0.35 : 0));
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.arc(p.x, p.y, baseR, 0, Math.PI * 2);
        ctx.fill();
        if (s.kind === 'future') {
          ctx.globalAlpha = Math.min(1, p.alpha);
          ctx.strokeStyle = col;
          ctx.lineWidth = 1;
          ctx.setLineDash([2, 3]);
          ctx.beginPath();
          ctx.arc(p.x, p.y, baseR + 3.5, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);
        }
        // labels: You always, hovered, and the brightest of the current era
        if ((s.id === 'you' || isHover || p.alpha > 0.72) && p.alpha > 0.2) {
          ctx.globalAlpha = Math.min(1, p.alpha + 0.15);
          ctx.fillStyle = 'rgba(233,232,240,0.92)';
          ctx.font = `${s.id === 'you' ? 12 : 10.5}px ui-monospace, "Geist Mono", monospace`;
          ctx.textAlign = 'center';
          ctx.fillText(s.label, p.x, p.y - baseR - 7);
        }
      }
      ctx.globalAlpha = 1;

      // update hover from last mouse pos
      if (mouse.x || mouse.y) {
        let found: string | null = null;
        let best = 20 * 20;
        for (const s of stars) {
          const p = positions.get(s.id)!;
          if (p.alpha < 0.15) continue;
          const dx = p.x - mouse.x;
          const dy = p.y - mouse.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < best) { best = d2; found = s.id; }
        }
        if (found !== hovered) {
          hovered = found;
          setHoverLabel(found ? stars.find((s) => s.id === found)!.label : null);
          canvas!.style.cursor = found ? 'pointer' : dragging ? 'grabbing' : 'grab';
        }
      }

      raf = requestAnimationFrame(draw);
    }
    raf = requestAnimationFrame(draw);

    const onMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouse = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      if (dragging) {
        dragRot += (e.clientX - lastX) * 0.005;
        lastX = e.clientX;
      }
    };
    const onDown = (e: MouseEvent) => { dragging = true; lastX = e.clientX; canvas.style.cursor = 'grabbing'; };
    const onUp = () => { dragging = false; canvas.style.cursor = 'grab'; };
    canvas.style.cursor = 'grab';
    canvas.addEventListener('mousemove', onMove);
    canvas.addEventListener('mousedown', onDown);
    window.addEventListener('mouseup', onUp);
    const ro = new ResizeObserver(setSize);
    ro.observe(wrap);

    return () => {
      cancelAnimationFrame(raf);
      canvas.removeEventListener('mousemove', onMove);
      canvas.removeEventListener('mousedown', onDown);
      window.removeEventListener('mouseup', onUp);
      ro.disconnect();
    };
  }, [stars, height]);

  const currentEra = eraForTime(time);

  return (
    <div
      ref={wrapRef}
      style={{
        position: 'relative',
        width: '100%',
        overflow: 'hidden',
        // Blend into the page instead of sitting in a bordered box: no border or
        // radius, just a faint nebula wash that fades to transparent so the
        // starfield melts into whatever dark ground sits behind it.
        background:
          'radial-gradient(120% 95% at 50% 30%, rgba(139,140,240,0.07) 0%, rgba(95,212,191,0.03) 44%, transparent 72%)',
      }}
    >
      <canvas
        ref={canvasRef}
        aria-label="Interactive constellation of a clinician career across time"
        style={{
          display: 'block',
          // Soft radial edge-fade so the map has no hard rectangular border and
          // dissolves into the surrounding section.
          WebkitMaskImage: 'radial-gradient(130% 118% at 50% 44%, #000 64%, transparent 100%)',
          maskImage: 'radial-gradient(130% 118% at 50% 44%, #000 64%, transparent 100%)',
        }}
      />

      {/* era readout — top left. Ink tokens so the labels read on the calm paper
          page (they adapt automatically under .dark .mz if ever shown on dark). */}
      <div style={{ position: 'absolute', left: 18, top: 16, pointerEvents: 'none' }}>
        <div style={{ fontFamily: 'var(--font-geist-mono, ui-monospace, monospace)', fontSize: 9.5, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'var(--accent, #4f46e5)' }}>
          {String(currentEra === 'origin' ? '← past' : currentEra === 'future' ? 'future →' : 'present')}
        </div>
        <div style={{ marginTop: 4, fontFamily: 'var(--font-fraunces, var(--vt-font-display, Georgia, serif))', fontSize: 22, color: 'var(--ink-900, #14141a)', letterSpacing: '-0.01em' }}>
          {ERA_LABEL[currentEra]}
        </div>
      </div>

      {/* hover readout — top right */}
      <div style={{ position: 'absolute', right: 18, top: 16, fontFamily: 'var(--font-geist-mono, ui-monospace, monospace)', fontSize: 11, color: 'var(--ink-500, #6b6860)', pointerEvents: 'none', minHeight: 14 }}>
        {hoverLabel ? `→ ${hoverLabel}` : 'drag to rotate'}
      </div>

      {/* time scrubber — bottom */}
      <div style={{ position: 'absolute', left: 18, right: 18, bottom: 14 }}>
        <input
          type="range"
          min={0}
          max={1}
          step={0.001}
          value={time}
          onChange={(e) => setTime(parseFloat(e.target.value))}
          aria-label="Travel your career timeline"
          className="mzc-scrub"
          style={{ width: '100%' }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontFamily: 'ui-monospace, "Geist Mono", monospace', fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(233,232,240,0.4)' }}>
          <span>Began</span>
          <span>Now</span>
          <span>Headed</span>
        </div>
      </div>

      <style
        dangerouslySetInnerHTML={{
          __html:
            '.mzc-scrub{-webkit-appearance:none;appearance:none;height:3px;border-radius:999px;background:linear-gradient(90deg,rgba(154,160,181,0.5),rgba(139,140,240,0.6),rgba(127,224,163,0.6));outline:none;cursor:pointer;}' +
            '.mzc-scrub::-webkit-slider-thumb{-webkit-appearance:none;width:14px;height:14px;border-radius:50%;background:#f4c76b;border:2px solid #0a0a12;box-shadow:0 0 12px rgba(244,199,107,0.6);cursor:grab;}' +
            '.mzc-scrub::-moz-range-thumb{width:14px;height:14px;border-radius:50%;background:#f4c76b;border:2px solid #0a0a12;cursor:grab;}',
        }}
      />
    </div>
  );
}
