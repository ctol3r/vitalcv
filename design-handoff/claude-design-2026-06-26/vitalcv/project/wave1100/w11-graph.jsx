// WAVE 1100 — interactive force-directed graph engine.
// A small, dependency-free simulation: charge repulsion + link springs + centering
// + mild family clustering + collision. Pre-settled synchronously on mount (so the
// layout is correct even when rAF is throttled), then rAF handles drag interactions.
// Renders to SVG with pan, zoom, node drag, and selection.

const VW = 1000, VH = 680; // logical viewBox
const G_FAMS = Object.keys(FAMILIES);
const G_ANCHOR = {}; G_FAMS.forEach((f, i) => { const a = (i / G_FAMS.length) * Math.PI * 2; G_ANCHOR[f] = { x: Math.cos(a) * 300, y: Math.sin(a) * 190 }; });

// One physics step. Pure with respect to (ns, byId, links, alpha) — mutates positions.
function stepSim(ns, byId, links, alpha) {
  const BX = 460, BY = 290, MAXV = 22;
  // repulsion — capped impulse, far cutoff
  for (let i = 0; i < ns.length; i++) {
    const a = ns[i];
    for (let j = i + 1; j < ns.length; j++) {
      const b = ns[j];
      let dx = a.x - b.x, dy = a.y - b.y;
      let d = Math.sqrt(dx * dx + dy * dy) || 0.5;
      if (d > 460) continue;
      let f = 3400 / (d * d); if (f > 34) f = 34; f *= (0.42 + 0.58 * alpha);
      const ux = dx / d, uy = dy / d;
      a.vx += ux * f; a.vy += uy * f; b.vx -= ux * f; b.vy -= uy * f;
    }
  }
  // link springs
  links.forEach(l => {
    const a = byId[l.source], b = byId[l.target];
    if (!a || !b) return;
    let dx = b.x - a.x, dy = b.y - a.y;
    let d = Math.sqrt(dx * dx + dy * dy) || 1;
    const L = (a.r + b.r) + 60;
    const f = (d - L) * 0.05 * alpha;
    const ux = dx / d, uy = dy / d;
    a.vx += ux * f; a.vy += uy * f; b.vx -= ux * f; b.vy -= uy * f;
  });
  // family gravity (alpha) + constant centering (always, keeps bounded & off the walls)
  ns.forEach(n => {
    if (n.id === 'self') return;
    const anc = G_ANCHOR[n.family];
    if (anc) { n.vx += (anc.x - n.x) * 0.002 * alpha; n.vy += (anc.y - n.y) * 0.002 * alpha; }
    n.vx += (0 - n.x) * 0.0075; n.vy += (0 - n.y) * 0.011;
  });
  // integrate with velocity clamp
  ns.forEach(n => {
    if (n.fx != null) { n.x = n.fx; n.vx = 0; } else { n.vx *= 0.8; n.vx = Math.max(-MAXV, Math.min(MAXV, n.vx)); n.x += n.vx; }
    if (n.fy != null) { n.y = n.fy; n.vy = 0; } else { n.vy *= 0.8; n.vy = Math.max(-MAXV, Math.min(MAXV, n.vy)); n.y += n.vy; }
  });
  // collision resolution — runs last, guarantees no overlap
  for (let pass = 0; pass < 6; pass++) {
    for (let i = 0; i < ns.length; i++) {
      const a = ns[i];
      for (let j = i + 1; j < ns.length; j++) {
        const b = ns[j];
        let dx = b.x - a.x, dy = b.y - a.y;
        let d = Math.sqrt(dx * dx + dy * dy);
        const min = a.r + b.r + 10;
        if (d < min) {
          if (d < 0.01) { dx = Math.cos(i * 2.4); dy = Math.sin(i * 2.4); d = 1; }
          const push = (min - d) / 2, ux = dx / d, uy = dy / d;
          const aFix = a.fx != null, bFix = b.fx != null;
          if (!aFix) { a.x -= ux * push * (bFix ? 2 : 1); a.y -= uy * push * (bFix ? 2 : 1); }
          if (!bFix) { b.x += ux * push * (aFix ? 2 : 1); b.y += uy * push * (aFix ? 2 : 1); }
        }
      }
    }
  }
  // generous clamp for anything still outside
  ns.forEach(n => { if (n.fx == null) { n.x = Math.max(-BX, Math.min(BX, n.x)); n.y = Math.max(-BY, Math.min(BY, n.y)); } });
}

/* ---------- Build & run the simulation ---------- */
function useForceGraph(nodes, links) {
  const simRef = React.useRef(null);
  const [, setTick] = React.useState(0);
  const rafRef = React.useRef(null);
  const alphaRef = React.useRef(0);

  if (!simRef.current) {
    // seed positions: self at center, others spread by family ring (within bounds)
    const famAngle = {}; G_FAMS.forEach((f, i) => { famAngle[f] = (i / G_FAMS.length) * Math.PI * 2; });
    const sim = nodes.map((n, i) => {
      if (n.id === 'self') return { ...n, x: 0, y: 0, vx: 0, vy: 0, fx: 0, fy: 0 };
      const a = (famAngle[n.family] || 0) + Math.sin(i * 12.9898) * 0.5;
      const rad = 150 + (i % 5) * 26;
      return { ...n, x: Math.cos(a) * rad, y: Math.sin(a) * rad * 0.7, vx: 0, vy: 0, fx: null, fy: null };
    });
    const byId = Object.fromEntries(sim.map(n => [n.id, n]));
    // PRE-SETTLE synchronously so the layout is correct on first paint (rAF-independent)
    let a = 1;
    for (let it = 0; it < 320 && a > 0.02; it++) { stepSim(sim, byId, links, a); a -= 0.006; }
    // a few zero-alpha collision-only passes to guarantee clean separation
    for (let it = 0; it < 8; it++) stepSim(sim, byId, links, 0);
    sim.forEach(n => { n.vx = 0; n.vy = 0; });
    simRef.current = { nodes: sim, byId };
  }

  const reheat = React.useCallback((v = 0.5) => {
    alphaRef.current = Math.max(alphaRef.current, v);
    cancelAnimationFrame(rafRef.current);
    const loop = () => {
      stepSim(simRef.current.nodes, simRef.current.byId, links, alphaRef.current);
      alphaRef.current = Math.max(0, alphaRef.current - 0.02);
      setTick(t => t + 1);
      if (alphaRef.current > 0.01) rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
  }, [links]);

  React.useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  return { sim: simRef.current, reheat };
}

/* ---------- The canvas ---------- */
function GraphCanvas({ selectedId, onSelect, hoverId, onHover, highlightIds, filterFamily, height = 560, showAllLabels = false }) {
  const { sim, reheat } = useForceGraph(NODES, LINKS);
  const [view, setView] = React.useState({ k: 1, tx: 0, ty: 0 });
  const svgRef = React.useRef(null);
  const dragRef = React.useRef(null);
  const panRef = React.useRef(null);

  // active neighborhood for selection
  const activeSet = React.useMemo(() => {
    if (highlightIds) return new Set(highlightIds);
    if (!selectedId) return null;
    const s = new Set([selectedId]);
    (ADJ[selectedId] || []).forEach(e => s.add(e.id));
    return s;
  }, [selectedId, highlightIds]);

  const isDim = (id) => {
    if (filterFamily && NODE_BY_ID[id]?.family !== filterFamily && id !== 'self') return true;
    if (!activeSet) return false;
    return !activeSet.has(id);
  };
  const edgeDim = (l) => {
    if (highlightIds) return !(activeSet.has(l.source) && activeSet.has(l.target));
    if (filterFamily) return isDim(l.source) && isDim(l.target);
    if (!selectedId) return false;
    return !(l.source === selectedId || l.target === selectedId);
  };

  // ---- pointer: pan background ----
  const onBgDown = (e) => {
    if (e.target.closest('[data-node]')) return;
    panRef.current = { x: e.clientX, y: e.clientY, tx: view.tx, ty: view.ty };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onMove = (e) => {
    if (dragRef.current) {
      const { id, dx0, dy0 } = dragRef.current;
      const rect = svgRef.current.getBoundingClientRect();
      const scale = (VW / rect.width) / view.k;
      const n = sim.byId[id];
      n.fx = (e.clientX - rect.left - rect.width / 2) * scale - view.tx / view.k + dx0;
      n.fy = (e.clientY - rect.top - rect.height / 2) * scale - view.ty / view.k + dy0;
      reheat(0.25);
    } else if (panRef.current) {
      setView(v => ({ ...v, tx: panRef.current.tx + (e.clientX - panRef.current.x), ty: panRef.current.ty + (e.clientY - panRef.current.y) }));
    }
  };
  const onUp = () => {
    if (dragRef.current) { const n = sim.byId[dragRef.current.id]; if (n.id !== 'self') { n.fx = null; n.fy = null; } reheat(0.2); }
    dragRef.current = null; panRef.current = null;
  };
  const onNodeDown = (e, id) => {
    e.stopPropagation();
    const rect = svgRef.current.getBoundingClientRect();
    const scale = (VW / rect.width) / view.k;
    const n = sim.byId[id];
    const px = (e.clientX - rect.left - rect.width / 2) * scale - view.tx / view.k;
    const py = (e.clientY - rect.top - rect.height / 2) * scale - view.ty / view.k;
    dragRef.current = { id, dx0: n.x - px, dy0: n.y - py, moved: false, startX: e.clientX, startY: e.clientY };
    n.fx = n.x; n.fy = n.y;
  };
  const onNodeUp = (e, id) => {
    const d = dragRef.current;
    const moved = d && (Math.abs(e.clientX - d.startX) + Math.abs(e.clientY - d.startY) > 4);
    if (!moved) onSelect && onSelect(selectedId === id ? null : id);
  };

  const onWheel = (e) => {
    e.preventDefault();
    const rect = svgRef.current.getBoundingClientRect();
    const mx = e.clientX - rect.left - rect.width / 2;
    const my = e.clientY - rect.top - rect.height / 2;
    setView(v => {
      const k = Math.min(2.6, Math.max(0.45, v.k * (e.deltaY < 0 ? 1.12 : 0.89)));
      const ratio = k / v.k;
      return { k, tx: mx - (mx - v.tx) * ratio, ty: my - (my - v.ty) * ratio };
    });
  };
  const zoomBy = (f) => setView(v => ({ ...v, k: Math.min(2.6, Math.max(0.45, v.k * f)) }));
  const reset = () => { setView({ k: 1, tx: 0, ty: 0 }); reheat(0.6); };

  React.useEffect(() => {
    const el = svgRef.current; if (!el) return;
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [view.k]);

  const labelVisible = (n) => showAllLabels || n.r >= 17 || n.id === selectedId || n.id === hoverId
    || (activeSet && activeSet.has(n.id) && !isDim(n.id));

  return (
    <div className="relative w-full overflow-hidden rounded-lg" style={{ height }}>
      <div className="absolute inset-0 hairline-grid opacity-[0.5]" />
      <svg ref={svgRef} viewBox={`0 0 ${VW} ${VH}`} className="absolute inset-0 w-full h-full touch-none select-none"
        style={{ cursor: panRef.current ? 'grabbing' : 'grab' }}
        onPointerDown={onBgDown} onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={onUp}>
        <defs>
          <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M0 1 L9 5 L0 9" fill="none" stroke="#94a3b8" strokeWidth="1.4" />
          </marker>
        </defs>
        <g transform={`translate(${VW / 2 + view.tx}, ${VH / 2 + view.ty}) scale(${view.k})`}>
          {/* edges */}
          {LINKS.map((l, i) => {
            const a = sim.byId[l.source], b = sim.byId[l.target];
            if (!a || !b) return null;
            const dim = edgeDim(l);
            const showLabel = !dim && (selectedId === l.source || selectedId === l.target || highlightIds);
            const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
            return (
              <g key={i} opacity={dim ? 0.08 : 1} style={{ transition: 'opacity .2s' }}>
                <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={dim ? '#cbd5e1' : '#94a3b8'} strokeWidth={dim ? 1 : 1.4} />
                {showLabel && (
                  <text x={mx} y={my - 3} textAnchor="middle" className="mono"
                    fontSize="8.5" fill="#64748b" paintOrder="stroke" stroke="#fff" strokeWidth="3" strokeLinejoin="round">
                    {REL[l.rel]?.label || l.rel}
                  </text>
                )}
              </g>
            );
          })}
          {/* nodes */}
          {sim.nodes.map(n => {
            const f = FAMILIES[n.family] || FAMILIES.aspiration;
            const dim = isDim(n.id);
            const sel = n.id === selectedId;
            const hov = n.id === hoverId;
            return (
              <g key={n.id} data-node transform={`translate(${n.x}, ${n.y})`}
                opacity={dim ? 0.2 : 1} style={{ transition: 'opacity .2s', cursor: 'pointer' }}
                onPointerDown={(e) => onNodeDown(e, n.id)} onPointerUp={(e) => onNodeUp(e, n.id)}
                onPointerEnter={() => onHover && onHover(n.id)} onPointerLeave={() => onHover && onHover(null)}>
                {(sel || hov) && <circle r={n.r + 7} fill="none" stroke={f.accent} strokeWidth="1.5" opacity={sel ? 0.9 : 0.4} />}
                <circle r={n.r} fill={n.family === 'self' ? f.accent : '#fff'}
                  stroke={f.accent} strokeWidth={n.family === 'self' ? 0 : 2}
                  strokeDasharray={f.dashed ? '3 3' : 'none'} />
                <g transform={`translate(${-n.r * 0.5}, ${-n.r * 0.5})`} style={{ color: n.family === 'self' ? '#fff' : f.accent }}>
                  <IconFor name={n.icon} size={n.r} />
                </g>
                {labelVisible(n) && (
                  <text x={0} y={n.r + 13} textAnchor="middle" fontSize="11.5" fontWeight="600" fill="#0f172a"
                    paintOrder="stroke" stroke="#fff" strokeWidth="3.5" strokeLinejoin="round">
                    {n.label.length > 26 ? n.label.slice(0, 24) + '…' : n.label}
                  </text>
                )}
              </g>
            );
          })}
        </g>
      </svg>

      {/* controls */}
      <div className="absolute right-3 bottom-3 flex flex-col gap-1.5">
        <CtrlBtn title="Zoom in" onClick={() => zoomBy(1.18)}><Icon.Plus size={15} /></CtrlBtn>
        <CtrlBtn title="Zoom out" onClick={() => zoomBy(0.85)}><Icon.Minus size={15} /></CtrlBtn>
        <CtrlBtn title="Reset & re-layout" onClick={reset}><Icon.RotateCw size={14} /></CtrlBtn>
      </div>
      <div className="absolute left-3 bottom-3 mono text-[9.5px] uppercase tracking-[0.12em] text-slate-400 bg-white/70 backdrop-blur rounded px-2 py-1 flex items-center gap-1.5 pointer-events-none">
        <Icon.Move size={11} /> drag · scroll to zoom · click a node
      </div>
    </div>
  );
}

function CtrlBtn({ children, onClick, title }) {
  return (
    <button title={title} onClick={onClick}
      className="h-8 w-8 rounded-md bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:border-slate-300 shadow-sm flex items-center justify-center transition-colors">
      {children}
    </button>
  );
}

window.GraphCanvas = GraphCanvas;
