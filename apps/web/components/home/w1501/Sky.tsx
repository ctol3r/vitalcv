'use client';

/**
 * Wave 1501 · Career constellation (DG-7.8) — port of `wave1501/hp-sky.jsx`.
 *
 * Drag-rotate sky + Began/Now/Headed slider. Paper sky — light only.
 *
 * THE TRUTH RULE, which no interaction may bend: recorded events are solid ink
 * and future events are ALWAYS dashed. The slider changes only what is
 * EMPHASISED along the arc — it can never promote an illustrative event into
 * something that reads as recorded. `solid` is derived from the event's own
 * fixed `t` against NOW_T, never from the slider position `T`.
 */

import * as React from 'react';

// Imported here, not only at the island root: this section is mounted on the
// live homepage as well as at /design/wave1501, and it renders nothing legible
// without the scoped `.w1501` token layer. Next dedupes the double import.
import '@/styles/wave1501-home.css';

import { HonestyLabel } from './primitives';
import { Reveal, SecHead, useReducedMotion } from './shared';

const NOW_T = 0.5;

/** Deterministic width for the server render and the hydrating client render. */
const SSR_WIDTH = 720;

type SkyEvent = {
  t: number;
  a: number;
  r: number;
  label: string;
  src: string;
  now?: boolean;
};

const SKY_EVENTS: SkyEvent[] = [
  { t: 0.02, a: 206, r: 0.92, label: 'NPI issued', src: 'NPPES' },
  { t: 0.11, a: 242, r: 0.62, label: 'MD conferred', src: 'Self-attested' },
  { t: 0.2, a: 279, r: 0.82, label: 'Board certified', src: 'Issuer artifact' },
  { t: 0.3, a: 316, r: 0.52, label: 'CA license', src: 'State board' },
  { t: 0.4, a: 351, r: 0.76, label: 'Fellowship', src: 'Institution' },
  { t: 0.46, a: 21, r: 0.46, label: 'First attending role', src: 'Employer' },
  { t: 0.5, a: 39, r: 0.66, label: 'Snapshot claimed', src: 'VitalCV', now: true },
  { t: 0.66, a: 76, r: 0.56, label: 'Locum privileges', src: 'Illustrative' },
  { t: 0.82, a: 110, r: 0.78, label: 'Faculty appointment', src: 'Illustrative' },
  { t: 0.96, a: 144, r: 0.94, label: 'Dept. leadership', src: 'Illustrative' },
];

type Placed = SkyEvent & { x: number; y: number };

const skyPath = (arr: Placed[]) =>
  arr.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

export const SkySection = () => {
  const reduced = useReducedMotion();
  const wrapRef = React.useRef<HTMLDivElement>(null);
  const [measured, setMeasured] = React.useState(SSR_WIDTH);
  const [hydrated, setHydrated] = React.useState(false);
  const [rot, setRot] = React.useState(-8);
  const [T, setT] = React.useState(NOW_T);
  const [dragging, setDragging] = React.useState(false);
  const drag = React.useRef<{ start: number; base: number } | null>(null);

  React.useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver((es) => setMeasured(Math.max(300, es[0].contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  React.useEffect(() => {
    setHydrated(true);
  }, []);

  /**
   * Every star coordinate is derived from `w`, so `w` MUST be identical on the
   * server and in React's hydrating render. The ResizeObserver fires before
   * hydration commits, so reading its value directly meant the server emitted
   * the arc at 720px while the client rendered it at the real width — a real
   * hydration mismatch on ~40 SVG attributes, which React refuses to patch up.
   *
   * Pinning to SSR_WIDTH until the mount effect has run guarantees the first
   * client render matches the HTML byte for byte; the true width lands on the
   * very next commit. The alternative — a fixed viewBox scaled by CSS — was
   * rejected because it shrinks the 9.5px mono labels below legibility at
   * 360px, which is the reason the handoff computes geometry in px at all.
   */
  const w = hydrated ? measured : SSR_WIDTH;

  const h = Math.round(Math.min(560, Math.max(340, w * 0.58)));
  const cx = w / 2;
  const cy = h / 2;
  const small = w < 560;

  /**
   * DEVIATION from the handoff, deliberate.
   *
   * hp-sky.jsx uses one radius, `Math.min(w, h) / 2 - 56`. On a wide stage the
   * height wins, so at 1200×480 the arc is a 368px circle floating in a 1200px
   * box with dead space either side. The projection is not load-bearing — the
   * truth encoding lives in `solid` vs dashed, not in the shape — so the radius
   * is split per axis and the arc fills the stage it was given.
   *
   * radX keeps 130px of right margin because labels render at `x + 10` and
   * would otherwise run out of the pane at the 3 o'clock positions.
   */
  const radX = Math.max(120, w / 2 - (small ? 92 : 130));
  const radY = Math.max(110, h / 2 - 44);

  /**
   * Coordinates are ROUNDED, and that is a correctness fix rather than tidiness.
   *
   * `Math.cos`/`Math.sin` are not required by the spec to be correctly rounded,
   * so Node's V8 and the browser's V8 can disagree in the last ULP: the server
   * emitted `cx="204.4787351667836"` where the client computed
   * `204.47873516678362`, and React reported a hydration mismatch on every star
   * and label. The handoff never hit this because `skyPath` already rounds via
   * `.toFixed(1)` — only the raw `cx`/`x` attributes were unrounded.
   *
   * Two decimals is far below one device pixel, so nothing moves.
   */
  const pts: Placed[] = SKY_EVENTS.map((e) => {
    const ang = ((e.a + rot) * Math.PI) / 180;
    return {
      ...e,
      x: Math.round((cx + Math.cos(ang) * radX * e.r) * 100) / 100,
      y: Math.round((cy + Math.sin(ang) * radY * e.r) * 100) / 100,
    };
  });
  const recorded = pts.filter((p) => p.t <= NOW_T); // solid ink, always
  const future = pts.filter((p) => p.t > NOW_T); // dashed, always
  const bridgePts = [recorded[recorded.length - 1], future[0]].filter(Boolean) as Placed[];
  const inHorizon = (p: Placed) => p.t <= T;
  const recVis = recorded.filter(inHorizon);
  const futVis = future.filter(inHorizon);
  const bridgeVis = recVis.length === recorded.length && futVis.length > 0;

  const angleAt = (ev: React.PointerEvent) => {
    const el = wrapRef.current;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    return (Math.atan2(ev.clientY - (rect.top + cy), ev.clientX - (rect.left + cx)) * 180) / Math.PI;
  };
  const onDown = (e: React.PointerEvent) => {
    if (reduced) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { start: angleAt(e), base: rot };
    setDragging(true);
  };
  const onMove = (e: React.PointerEvent) => {
    if (drag.current) setRot(drag.current.base + (angleAt(e) - drag.current.start));
  };
  const onUp = () => {
    drag.current = null;
    setDragging(false);
  };

  const tickOn = T < 0.25 ? 'began' : T > 0.75 ? 'headed' : 'now';

  return (
    <section className="hp-section" id="sky" data-screen-label="Career constellation">
      <div className="hp-container">
        <SecHead
          eyebrow="Constellation"
          title={
            <>
              One record, the <span className="vt-accent-i">whole arc.</span>
            </>
          }
          lede={
            'Drag the sky. Slide from where this career began to where it’s headed — solid stars are recorded events; dashed stars never pretend to be.'
          }
        />
        <Reveal>
          <div className="sky-wrap">
            <div
              ref={wrapRef}
              className={`sky-stage${reduced ? '' : ' draggable'}${dragging ? ' dragging' : ''}`}
              style={{ height: h }}
              onPointerDown={onDown}
              onPointerMove={onMove}
              onPointerUp={onUp}
              onPointerCancel={onUp}
            >
              <svg width={w} height={h} style={{ display: 'block' }} aria-hidden="true">
                {[0.35, 0.65, 0.95].map((k) => (
                  <ellipse
                    key={k}
                    cx={cx}
                    cy={cy}
                    rx={radX * k}
                    ry={radY * k}
                    fill="none"
                    stroke="var(--vt-rule-soft)"
                    strokeWidth="1"
                  />
                ))}
                <circle cx={cx} cy={cy} r="2" fill="var(--vt-rule)" />
                {/* baseline arc, faint */}
                <path d={skyPath(recorded)} fill="none" stroke="var(--vt-rule)" strokeWidth="1" />
                <path
                  d={skyPath(bridgePts)}
                  fill="none"
                  stroke="var(--vt-rule)"
                  strokeWidth="1"
                  strokeDasharray="3 4"
                />
                <path
                  d={skyPath(future)}
                  fill="none"
                  stroke="var(--vt-rule)"
                  strokeWidth="1"
                  strokeDasharray="3 4"
                />
                {/* horizon emphasis */}
                {recVis.length > 1 ? (
                  <path
                    d={skyPath(recVis)}
                    fill="none"
                    stroke="var(--vt-rule-strong)"
                    strokeWidth="1.25"
                    opacity="0.6"
                  />
                ) : null}
                {bridgeVis ? (
                  <path
                    d={skyPath(bridgePts)}
                    fill="none"
                    stroke="var(--vt-degraded-border)"
                    strokeWidth="1.25"
                    strokeDasharray="3 4"
                  />
                ) : null}
                {futVis.length > 1 ? (
                  <path
                    d={skyPath(futVis)}
                    fill="none"
                    stroke="var(--vt-degraded-border)"
                    strokeWidth="1.25"
                    strokeDasharray="3 4"
                  />
                ) : null}
                {/* stars */}
                {pts.map((p) => {
                  const solid = p.t <= NOW_T;
                  return (
                    <g
                      key={p.label}
                      opacity={inHorizon(p) ? 1 : 0.28}
                      style={{ transition: reduced ? 'none' : 'opacity var(--dur-fast) var(--ease-house)' }}
                    >
                      {p.now ? (
                        <rect
                          x={p.x - 7}
                          y={p.y - 7}
                          width="14"
                          height="14"
                          transform={`rotate(45 ${p.x} ${p.y})`}
                          fill="none"
                          stroke="var(--vt-brand)"
                          strokeWidth="1.25"
                        />
                      ) : null}
                      {solid ? (
                        <circle cx={p.x} cy={p.y} r="4" fill="var(--vt-text)" />
                      ) : (
                        <circle
                          cx={p.x}
                          cy={p.y}
                          r="4.5"
                          fill="var(--vt-surface-card)"
                          stroke="var(--vt-degraded-border)"
                          strokeWidth="1.25"
                          strokeDasharray="2.5 2"
                        />
                      )}
                      <text
                        x={p.x + 10}
                        y={p.y - (small ? 4 : 6)}
                        fontFamily="var(--font-mono)"
                        fontSize={small ? 8.5 : 9.5}
                        letterSpacing="0.08em"
                        fill={solid ? 'var(--vt-text)' : 'var(--vt-text-muted)'}
                      >
                        {p.label.toUpperCase()}
                      </text>
                      {small ? null : (
                        <text
                          x={p.x + 10}
                          y={p.y + 5}
                          fontFamily="var(--font-mono)"
                          fontSize="8"
                          letterSpacing="0.06em"
                          fill="var(--vt-text-faint)"
                        >
                          {p.src}
                        </text>
                      )}
                    </g>
                  );
                })}
              </svg>
              {/* The chart itself is aria-hidden (it is a rotating decorative
                  projection). This list is the non-visual equivalent so the
                  arc's content — and crucially which entries are recorded vs
                  illustrative — is not sighted-only. Visual output unchanged. */}
              <ul className="sr-only">
                {SKY_EVENTS.map((e) => (
                  <li key={e.label}>
                    {e.label} — {e.src} — {e.t <= NOW_T ? 'recorded' : 'illustrative, not recorded'}
                  </li>
                ))}
              </ul>
              <div style={{ position: 'absolute', top: 14, left: 16 }}>
                <HonestyLabel>Past and future are illustrative</HonestyLabel>
              </div>
              {reduced ? null : (
                <span className="sky-hint" style={{ position: 'absolute', top: 16, right: 16 }}>
                  DRAG TO ROTATE
                </span>
              )}
            </div>
            <div className="sky-foot">
              <div className="sky-slider">
                <input
                  type="range"
                  className="vt-range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={T}
                  aria-label="Career horizon, from began to headed"
                  onChange={(e) => setT(+e.target.value)}
                />
                <div className="sky-ticks" aria-hidden="true">
                  <span className={tickOn === 'began' ? 'on' : ''}>BEGAN</span>
                  <span className={tickOn === 'now' ? 'on' : ''}>NOW</span>
                  <span className={tickOn === 'headed' ? 'on' : ''}>HEADED</span>
                </div>
              </div>
              <div
                style={{ display: 'flex', gap: 18, flexShrink: 0, alignItems: 'center' }}
                aria-hidden="true"
              >
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 7,
                    fontFamily: 'var(--font-mono)',
                    fontSize: 9.5,
                    letterSpacing: '0.12em',
                    color: 'var(--vt-text-secondary)',
                  }}
                >
                  <span
                    style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--vt-text)' }}
                  />
                  RECORDED
                </span>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 7,
                    fontFamily: 'var(--font-mono)',
                    fontSize: 9.5,
                    letterSpacing: '0.12em',
                    color: 'var(--vt-text-secondary)',
                  }}
                >
                  <span
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: '50%',
                      background: 'var(--vt-surface-card)',
                      border: '1px dashed var(--vt-degraded-border)',
                    }}
                  />
                  ILLUSTRATIVE
                </span>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
};
