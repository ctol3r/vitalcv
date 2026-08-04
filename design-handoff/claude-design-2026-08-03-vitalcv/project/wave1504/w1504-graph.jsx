// Wave 1504 · w1504-graph.jsx — /trust/graph · verifier graph explorer (DG-9.6)
// Ink nodes on paper. Every node and edge maps to real data semantics —
// nothing decorative. Static layout; zoom/pan/reset; click a node to
// inspect it through the same slot grid as /trust.

/* ---------- node type → shape (grayscale-legible, --vt-node-* tokens) ---------- */
const NodeShape = ({ type, r = 11, cx = 0, cy = 0 }) => {
  const S = 'var(--vt-node-stroke)', F = 'var(--vt-node-fill)', P = 'var(--vt-node-face)';
  switch (type) {
    case 'ISSUER':   return <rect x={cx - r} y={cy - r} width={r * 2} height={r * 2} fill={F} stroke="none" />;
    case 'KEY':      return <circle cx={cx} cy={cy} r={r * 0.68} fill={F} stroke="none" />;
    case 'ARTIFACT': return <circle cx={cx} cy={cy} r={r} fill={F} stroke="none" />;
    case 'SNAPSHOT': return <circle cx={cx} cy={cy} r={r} fill={P} stroke={S} strokeWidth="1.5" />;
    case 'SUBJECT':  return (
      <g>
        <circle cx={cx} cy={cy} r={r} fill={P} stroke={S} strokeWidth="1.5" />
        <circle cx={cx} cy={cy} r={r * 0.55} fill="none" stroke={S} strokeWidth="1.5" />
      </g>);
    case 'SOURCE':   return <rect x={cx - r * 0.9} y={cy - r * 0.9} width={r * 1.8} height={r * 1.8} fill={P} stroke={S} strokeWidth="1.5" />;
    case 'RUN':      return <path d={`M ${cx} ${cy - r} L ${cx + r} ${cy} L ${cx} ${cy + r} L ${cx - r} ${cy} Z`} fill={P} stroke={S} strokeWidth="1.5" />;
    default: return null;
  }
};

/* ---------- graph data (mirrors the /trust planes — same identifiers) ---------- */
const GX_NODES = [
  { id: 'nppes',    type: 'SOURCE',   label: 'NPPES',                x: 100, y: 120,
    slots: { OBJECT: { v: 'registry record 1234567893' }, OWNERSHIP: { v: 'CMS NPPES', sub: 'external source' }, CHECKED_AT: { v: '2026-07-11T06:42Z' }, CHANNEL: { v: 'https \u00b7 source read' }, RUN_ID: { v: 'run_2026-07-11_0642Z', copy: true } } },
  { id: 'leie',     type: 'SOURCE',   label: 'OIG LEIE',             x: 100, y: 280,
    slots: { OBJECT: { v: 'exclusion list read \u00b7 2026-06' }, OWNERSHIP: { v: 'HHS-OIG', sub: 'external source' }, CHECKED_AT: { v: '2026-07-11T06:42Z' }, CHANNEL: { v: 'https \u00b7 monthly publication' }, RUN_ID: { v: 'run_2026-07-11_0642Z', copy: true } } },
  { id: 'mbc',      type: 'SOURCE',   label: 'MED BOARD OF CA',      x: 100, y: 440,
    slots: { OBJECT: { v: 'license A123456' }, OWNERSHIP: { v: 'Medical Board of California', sub: 'external source' }, CHECKED_AT: { v: '2026-07-10T08:30Z' }, CHANNEL: { v: 'https \u00b7 board adapter' }, RUN_ID: { v: 'run_2026-07-10_0830Z', copy: true } } },
  { id: 'subject',  type: 'SUBJECT',  label: 'npi:1234567893',       x: 330, y: 470,
    slots: { OBJECT: { v: 'npi:1234567893', copy: true }, OWNERSHIP: { v: 'holder-claimed' } } },
  { id: 'snapshot', type: 'SNAPSHOT', label: 'psp_okafor_7f3a',      x: 330, y: 280,
    slots: { OBJECT: { v: 'psp_okafor_7f3a', copy: true, sub: 'snapshot document' }, OWNERSHIP: { v: 'npi:1234567893', sub: 'holder-claimed' }, CHECKED_AT: { v: '2026-07-11T06:42Z' }, CHANNEL: { v: 'https \u00b7 source read' }, REPLAY: { v: 'AVAILABLE' }, RUN_ID: { v: 'run_2026-07-11_0642Z', copy: true } } },
  { id: 'artifact', type: 'ARTIFACT', label: 'vc_okafor_9d2e',       x: 570, y: 280,
    slots: { OBJECT: { v: 'vc_okafor_9d2e', copy: true, sub: 'signed artifact' }, OWNERSHIP: { v: 'did:web:vitalcv.com', sub: 'issuer-bound' }, CHECKED_AT: { v: '2026-07-11T06:42Z' }, CHANNEL: { v: 'JWS \u00b7 ES256' }, REPLAY: { v: 'SURVIVABLE' }, RUN_ID: { v: 'run_2026-07-11_0642Z', copy: true } } },
  { id: 'key',      type: 'KEY',      label: 'kid vitalcv-2026-01',  x: 660, y: 130,
    slots: { OBJECT: { v: 'vitalcv-2026-01', copy: true, sub: 'EC P-256 \u00b7 ES256' }, OWNERSHIP: { v: 'did:web:vitalcv.com' }, CHECKED_AT: { v: 'published 2026-01-05' }, CHANNEL: { v: '/.well-known/jwks.json' } } },
  { id: 'issuer',   type: 'ISSUER',   label: 'did:web:vitalcv.com',  x: 800, y: 95,
    slots: { OBJECT: { v: 'did:web:vitalcv.com', copy: true }, OWNERSHIP: { v: 'self \u00b7 DID document' }, CHANNEL: { v: '/.well-known/did.json' } } },
  { id: 'run',      type: 'RUN',      label: 'run_2026-07-11_0642Z', x: 700, y: 440,
    slots: { OBJECT: { v: 'run_2026-07-11_0642Z', copy: true, sub: 'recorded run' }, OWNERSHIP: { v: 'did:web:vitalcv.com', sub: 'audit trail entry' }, CHECKED_AT: { v: '2026-07-11T06:42Z' }, CHANNEL: { v: '/api/replay/{run_id}' }, REPLAY: { v: 'RE-RUNNABLE' }, RUN_ID: { v: 'run_2026-07-11_0642Z', copy: true } } },
];

const GX_EDGES = [
  { from: 'snapshot', to: 'nppes',    label: 'READ_FROM' },
  { from: 'snapshot', to: 'leie',     label: 'READ_FROM' },
  { from: 'snapshot', to: 'mbc',      label: 'READ_FROM' },
  { from: 'snapshot', to: 'subject',  label: 'DESCRIBES' },
  { from: 'artifact', to: 'snapshot', label: 'MATERIALIZED_FROM' },
  { from: 'artifact', to: 'key',      label: 'SIGNED_BY', strong: true },
  { from: 'key',      to: 'issuer',   label: 'KEY_OF', strong: true },
  { from: 'run',      to: 'artifact', label: 'REPLAY_OF' },
];

const EDGE_MEANINGS = [
  { k: 'READ_FROM', m: 'Snapshot value read from this source (tier T2\u2013T3).' },
  { k: 'DESCRIBES', m: 'Snapshot is about this subject identifier.' },
  { k: 'MATERIALIZED_FROM', m: 'Artifact fixed from this snapshot\u2019s state.' },
  { k: 'SIGNED_BY', m: 'Artifact signature made with this key (T4).' },
  { k: 'KEY_OF', m: 'Key published under this issuer\u2019s DID.' },
  { k: 'REPLAY_OF', m: 'Recorded run that can re-produce the artifact check.' },
];

const NODE_TYPES = [
  { t: 'SOURCE',   m: 'Named external source' },
  { t: 'SUBJECT',  m: 'Provider identifier (public NPI)' },
  { t: 'SNAPSHOT', m: 'Owned snapshot document' },
  { t: 'ARTIFACT', m: 'Signed institutional artifact' },
  { t: 'KEY',      m: 'Published signing key' },
  { t: 'ISSUER',   m: 'did:web issuer' },
  { t: 'RUN',      m: 'Recorded run (audit trail)' },
];

/* ---------- explorer ---------- */
const VB = { w: 920, h: 560 };
const GraphPage = () => {
  const [sel, setSel] = React.useState('artifact');
  const [zoom, setZoom] = React.useState(1);
  const [pan, setPan] = React.useState({ x: 0, y: 0 });
  const drag = React.useRef(null);
  const svgRef = React.useRef(null);

  const byId = React.useMemo(() => Object.fromEntries(GX_NODES.map((n) => [n.id, n])), []);
  const selected = byId[sel];

  const onPointerDown = (e) => {
    drag.current = { sx: e.clientX, sy: e.clientY, px: pan.x, py: pan.y, moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
    e.currentTarget.classList.add('panning');
  };
  const onPointerMove = (e) => {
    if (!drag.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const k = VB.w / rect.width;
    const dx = (e.clientX - drag.current.sx) * k;
    const dy = (e.clientY - drag.current.sy) * k;
    if (Math.abs(dx) + Math.abs(dy) > 3) drag.current.moved = true;
    setPan({ x: drag.current.px + dx, y: drag.current.py + dy });
  };
  const onPointerUp = (e) => {
    drag.current = null;
    e.currentTarget.classList.remove('panning');
  };
  const reset = () => { setZoom(1); setPan({ x: 0, y: 0 }); };

  return (
    <div data-screen-label="Verifier Graph">
      <header className="s4-doctrine">
        <div className="s4-container">
          <span className="vt-eyebrow">vitalcv.com/trust/graph</span>
          <h1>Verifier Graph</h1>
          <div className="sub vt-num">
            <span>{'one record\u2019s lineage'}</span>
            <span>{ISSUER.snapshot} → {ISSUER.artifact}</span>
          </div>
          <p className="lede">
            The same facts as the register, drawn as a graph. Every node is a real object;
            every edge is a recorded relation. Select a node to inspect its slot grid.
          </p>
        </div>
      </header>

      <section className="s4-section first">
        <div className="s4-container gx-wrap">
          <div className="gx-stage">
            <div className="gx-controls">
              <button type="button" className="gx-btn" aria-label="Zoom in" onClick={() => setZoom((z) => Math.min(2.5, z * 1.25))}>+</button>
              <button type="button" className="gx-btn" aria-label="Zoom out" onClick={() => setZoom((z) => Math.max(0.5, z / 1.25))}>−</button>
              <button type="button" className="gx-btn reset" onClick={reset}>RESET</button>
            </div>
            <svg ref={svgRef} viewBox={`0 0 ${VB.w} ${VB.h}`} role="img"
              aria-label="Lineage graph: sources feed a snapshot; the snapshot materializes into a signed artifact; the artifact is signed by a key of the issuer; a recorded run can replay it."
              onPointerDown={onPointerDown} onPointerMove={onPointerMove}
              onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
              <g transform={`translate(${pan.x + VB.w / 2 * (1 - zoom)}, ${pan.y + VB.h / 2 * (1 - zoom)}) scale(${zoom})`}>
                {GX_EDGES.map((e) => {
                  const a = byId[e.from], b = byId[e.to];
                  const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
                  // offset label perpendicular to the edge so it clears node labels
                  const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
                  const ox = -((b.y - a.y) / len) * 9, oy = ((b.x - a.x) / len) * 9;
                  return (
                    <g key={e.from + e.to}>
                      <line x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                        stroke={e.strong ? 'var(--vt-edge-strong)' : 'var(--vt-edge-stroke)'}
                        strokeWidth={e.strong ? 1.5 : 1} />
                      <text x={mx + ox} y={my + oy - 5} textAnchor="middle" fontSize="8"
                        fontFamily="var(--font-mono)" fill="var(--vt-edge-label)"
                        stroke="var(--vt-surface-card)" strokeWidth="3" paintOrder="stroke" letterSpacing="0.08em">
                        {e.label}
                      </text>
                    </g>
                  );
                })}
                {GX_NODES.map((n) => (
                  <g key={n.id} className="gx-node" tabIndex={0} role="button"
                    aria-label={`${n.type} ${n.label}`} aria-pressed={sel === n.id}
                    onClick={() => { if (!(drag.current && drag.current.moved)) setSel(n.id); }}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSel(n.id); } }}>
                    {sel === n.id ? (
                      <circle cx={n.x} cy={n.y} r={17} fill="none"
                        stroke="var(--vt-node-select-ring)" strokeWidth="1.5" strokeDasharray="none" />
                    ) : null}
                    <NodeShape type={n.type} cx={n.x} cy={n.y} />
                    <text x={n.x} y={n.y + 30} textAnchor="middle" fontSize="9.5"
                      fill="var(--vt-node-label)" stroke="var(--vt-surface-card)" strokeWidth="3" paintOrder="stroke">
                      {n.label}
                    </text>
                  </g>
                ))}
              </g>
            </svg>
          </div>

          <div className="gx-side">
            {selected ? (
              <div className="gx-panel" aria-live="polite">
                <div className="ph">
                  <svg width="22" height="22" viewBox="-12 -12 24 24" aria-hidden="true"><NodeShape type={selected.type} r={9} /></svg>
                  <span className="id vt-num">{selected.label}</span>
                  <span className="src-chip">{selected.type}</span>
                </div>
                <SlotGrid slots={selected.slots} dense />
              </div>
            ) : (
              <div className="gx-empty">SELECT A NODE TO INSPECT ITS SLOTS</div>
            )}

            <div className="gx-legend">
              <h3>Node types</h3>
              {NODE_TYPES.map((r) => (
                <div className="gx-leg-row" key={r.t}>
                  <svg width="18" height="18" viewBox="-11 -11 22 22"><NodeShape type={r.t} r={8} /></svg>
                  <span className="k">{r.t}</span>
                  <span className="m">{r.m}</span>
                </div>
              ))}
              <h3 style={{ marginTop: 14 }}>Edge meanings</h3>
              {EDGE_MEANINGS.map((r) => (
                <div className="gx-leg-row" key={r.k}>
                  <svg width="18" height="8" viewBox="0 0 18 8" aria-hidden="true"><line x1="1" y1="4" x2="17" y2="4" stroke="var(--vt-edge-stroke)" strokeWidth="1.2" /></svg>
                  <span className="k">{r.k}</span>
                  <span className="m">{r.m}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

Object.assign(window, { GraphPage, GX_NODES, GX_EDGES, NodeShape });
