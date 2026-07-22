// Wave 1501 · hp-sky.jsx — Career constellation (DG-7.8).
// Drag-rotate sky + Began/Now/Headed slider (form kit). Paper sky — light only.
// Truth semantics never move with the slider: recorded events are solid ink,
// future events are ALWAYS dashed (illustrative). The slider only reveals the
// arc. Reduced-motion = static render, no drag.

const NOW_T = 0.5;
const SKY_EVENTS = [
  { t: 0.02, a: 206, r: 0.92, label: 'NPI issued', src: 'NPPES' },
  { t: 0.11, a: 242, r: 0.62, label: 'MD conferred', src: 'Self-attested' },
  { t: 0.20, a: 279, r: 0.82, label: 'Board certified', src: 'Issuer artifact' },
  { t: 0.30, a: 316, r: 0.52, label: 'CA license', src: 'State board' },
  { t: 0.40, a: 351, r: 0.76, label: 'Fellowship', src: 'Institution' },
  { t: 0.46, a: 21, r: 0.46, label: 'First attending role', src: 'Employer' },
  { t: 0.50, a: 39, r: 0.66, label: 'Snapshot claimed', src: 'VitalCV', now: true },
  { t: 0.66, a: 76, r: 0.56, label: 'Locum privileges', src: 'Illustrative' },
  { t: 0.82, a: 110, r: 0.78, label: 'Faculty appointment', src: 'Illustrative' },
  { t: 0.96, a: 144, r: 0.94, label: 'Dept. leadership', src: 'Illustrative' },
];

const skyPath = (arr) => arr.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

const SkySection = () => {
  const reduced = useReducedMotion();
  const wrapRef = React.useRef(null);
  const [w, setW] = React.useState(720);
  const [rot, setRot] = React.useState(-8);
  const [T, setT] = React.useState(NOW_T);
  const [dragging, setDragging] = React.useState(false);
  const drag = React.useRef(null);

  React.useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver((es) => setW(Math.max(300, es[0].contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const h = Math.round(Math.min(480, Math.max(340, w * 0.58)));
  const cx = w / 2, cy = h / 2;
  const rad = Math.min(w, h) / 2 - 56;
  const small = w < 560;

  const pts = SKY_EVENTS.map((e) => {
    const ang = ((e.a + rot) * Math.PI) / 180;
    return { ...e, x: cx + Math.cos(ang) * rad * e.r, y: cy + Math.sin(ang) * rad * e.r };
  });
  const recorded = pts.filter((p) => p.t <= NOW_T);          // solid ink, always
  const future = pts.filter((p) => p.t > NOW_T);             // dashed, always
  const bridgePts = [recorded[recorded.length - 1], future[0]];
  const inHorizon = (p) => p.t <= T;
  const recVis = recorded.filter(inHorizon);
  const futVis = future.filter(inHorizon);
  const bridgeVis = recVis.length === recorded.length && futVis.length > 0;

  const angleAt = (ev) => {
    const rect = wrapRef.current.getBoundingClientRect();
    return (Math.atan2(ev.clientY - (rect.top + cy), ev.clientX - (rect.left + cx)) * 180) / Math.PI;
  };
  const onDown = (e) => {
    if (reduced) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { start: angleAt(e), base: rot };
    setDragging(true);
  };
  const onMove = (e) => { if (drag.current) setRot(drag.current.base + (angleAt(e) - drag.current.start)); };
  const onUp = () => { drag.current = null; setDragging(false); };

  const tickOn = T < 0.25 ? 'began' : T > 0.75 ? 'headed' : 'now';

  return (
    <section className="hp-section" id="sky" data-screen-label="Career constellation">
      <div className="hp-container">
        <SecHead
          eyebrow="Constellation"
          title={<React.Fragment>One record, the <span className="vt-accent-i">whole arc.</span></React.Fragment>}
          lede={'Drag the sky. Slide from where this career began to where it\u2019s headed — solid stars are recorded events; dashed stars never pretend to be.'}
        />
        <Reveal>
          <div className="sky-wrap">
            <div
              ref={wrapRef}
              className={`sky-stage${reduced ? '' : ' draggable'}${dragging ? ' dragging' : ''}`}
              style={{ height: h }}
              onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
              <svg width={w} height={h} style={{ display: 'block' }} aria-hidden="true">
                {[0.35, 0.65, 0.95].map((k) => (
                  <circle key={k} cx={cx} cy={cy} r={rad * k} fill="none"
                    stroke="var(--vt-rule-soft)" strokeWidth="1" />
                ))}
                <circle cx={cx} cy={cy} r="2" fill="var(--vt-rule)" />
                {/* baseline arc, faint */}
                <path d={skyPath(recorded)} fill="none" stroke="var(--vt-rule)" strokeWidth="1" />
                <path d={skyPath(bridgePts)} fill="none" stroke="var(--vt-rule)" strokeWidth="1" strokeDasharray="3 4" />
                <path d={skyPath(future)} fill="none" stroke="var(--vt-rule)" strokeWidth="1" strokeDasharray="3 4" />
                {/* horizon emphasis */}
                {recVis.length > 1 ? <path d={skyPath(recVis)} fill="none" stroke="var(--vt-rule-strong)" strokeWidth="1.25" opacity="0.6" /> : null}
                {bridgeVis ? <path d={skyPath(bridgePts)} fill="none" stroke="var(--vt-degraded-border)" strokeWidth="1.25" strokeDasharray="3 4" /> : null}
                {futVis.length > 1 ? <path d={skyPath(futVis)} fill="none" stroke="var(--vt-degraded-border)" strokeWidth="1.25" strokeDasharray="3 4" /> : null}
                {/* stars */}
                {pts.map((p) => {
                  const solid = p.t <= NOW_T;
                  return (
                    <g key={p.label} opacity={inHorizon(p) ? 1 : 0.28}
                      style={{ transition: reduced ? 'none' : 'opacity var(--dur-fast) var(--ease-house)' }}>
                      {p.now ? <rect x={p.x - 7} y={p.y - 7} width="14" height="14"
                        transform={`rotate(45 ${p.x} ${p.y})`} fill="none"
                        stroke="var(--vt-brand)" strokeWidth="1.25" /> : null}
                      {solid
                        ? <circle cx={p.x} cy={p.y} r="4" fill="var(--vt-text)" />
                        : <circle cx={p.x} cy={p.y} r="4.5" fill="var(--vt-surface-card)"
                            stroke="var(--vt-degraded-border)" strokeWidth="1.25" strokeDasharray="2.5 2" />}
                      <text x={p.x + 10} y={p.y - (small ? 4 : 6)}
                        fontFamily="var(--font-mono)" fontSize={small ? 8.5 : 9.5} letterSpacing="0.08em"
                        fill={solid ? 'var(--vt-text)' : 'var(--vt-text-muted)'}>
                        {p.label.toUpperCase()}
                      </text>
                      {small ? null : (
                        <text x={p.x + 10} y={p.y + 5} fontFamily="var(--font-mono)" fontSize="8"
                          letterSpacing="0.06em" fill="var(--vt-text-faint)">{p.src}</text>
                      )}
                    </g>
                  );
                })}
              </svg>
              <div style={{ position: 'absolute', top: 14, left: 16 }}>
                <HonestyLabel>Past and future are illustrative</HonestyLabel>
              </div>
              {reduced ? null : (
                <span className="sky-hint" style={{ position: 'absolute', top: 16, right: 16 }}>DRAG TO ROTATE</span>
              )}
            </div>
            <div className="sky-foot">
              <div className="sky-slider">
                <input type="range" className="vt-range" min="0" max="1" step="0.01" value={T}
                  aria-label="Career horizon, from began to headed"
                  onChange={(e) => setT(+e.target.value)} />
                <div className="sky-ticks" aria-hidden="true">
                  <span className={tickOn === 'began' ? 'on' : ''}>BEGAN</span>
                  <span className={tickOn === 'now' ? 'on' : ''}>NOW</span>
                  <span className={tickOn === 'headed' ? 'on' : ''}>HEADED</span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 18, flexShrink: 0, alignItems: 'center' }} aria-hidden="true">
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7,
                  fontFamily: 'var(--font-mono)', fontSize: 9.5, letterSpacing: '0.12em', color: 'var(--vt-text-secondary)' }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--vt-text)' }}></span>RECORDED
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7,
                  fontFamily: 'var(--font-mono)', fontSize: 9.5, letterSpacing: '0.12em', color: 'var(--vt-text-secondary)' }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--vt-surface-card)',
                    border: '1px dashed var(--vt-degraded-border)' }}></span>ILLUSTRATIVE
                </span>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
};

Object.assign(window, { SkySection });
