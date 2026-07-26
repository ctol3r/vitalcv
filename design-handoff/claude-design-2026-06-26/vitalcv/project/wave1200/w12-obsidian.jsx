// WAVE 1200 — UNIVERSE GRAPH ENGINE (canvas, dark, Obsidian-style)
// Continuous force simulation rendered to <canvas>: charge repulsion + link
// springs + centering, additive-blended glowing links, degree-scaled nodes,
// pan / zoom / hover / select, and a live force-control panel. Hundreds of nodes.

const GraphCtx = { VW: 0, VH: 0 };

function useUniverseSim(nodes, edges, adj, params) {
  const ref = React.useRef(null);
  if (!ref.current) {
    const N = nodes.length;
    const famAngle = {}; const fams = [...new Set(nodes.map(n => n.family))];
    fams.forEach((f, i) => famAngle[f] = (i / fams.length) * Math.PI * 2);
    const sim = nodes.map((n, i) => {
      if (n.subject) return { ...n, x: 0, y: 0, vx: 0, vy: 0 };
      const a = (famAngle[n.family] || 0) + (Math.sin(i * 12.9898) * 1.4);
      const rad = 120 + ((i * 37) % 520);
      return { ...n, x: Math.cos(a) * rad, y: Math.sin(a) * rad * 0.82, vx: 0, vy: 0 };
    });
    const byId = Object.fromEntries(sim.map(n => [n.id, n]));
    const elinks = edges.map(e => ({ a: byId[e.s], b: byId[e.t], rel: e.rel })).filter(l => l.a && l.b);
    ref.current = { sim, byId, elinks };
    // pre-settle synchronously so first paint is structured
    presettle(ref.current, params, 230);
  }
  return ref.current;
}

function step(state, p, alpha) {
  const ns = state.sim, links = state.elinks;
  const REPEL = 5200 * p.repel, CUT = 300, CUT2 = CUT * CUT;
  // repulsion (O(n^2) with squared-distance cutoff)
  for (let i = 0; i < ns.length; i++) {
    const a = ns[i];
    for (let j = i + 1; j < ns.length; j++) {
      const b = ns[j];
      let dx = a.x - b.x, dy = a.y - b.y;
      let d2 = dx * dx + dy * dy;
      if (d2 > CUT2 || d2 === 0) { if (d2 === 0) { dx = (i - j) * 0.01 + 0.1; dy = 0.1; d2 = 0.02; } else continue; }
      const d = Math.sqrt(d2);
      let f = REPEL / d2; if (f > 40) f = 40; f *= (0.5 + 0.5 * alpha);
      const ux = dx / d, uy = dy / d;
      a.vx += ux * f; a.vy += uy * f; b.vx -= ux * f; b.vy -= uy * f;
    }
  }
  // link springs
  for (let i = 0; i < links.length; i++) {
    const a = links[i].a, b = links[i].b;
    let dx = b.x - a.x, dy = b.y - a.y;
    let d = Math.sqrt(dx * dx + dy * dy) || 1;
    const L = ((a.r + b.r) + 26) * p.linkDist;
    const f = (d - L) * p.linkForce * (0.6 + 0.4 * alpha);
    const ux = dx / d, uy = dy / d;
    a.vx += ux * f; a.vy += uy * f; b.vx -= ux * f; b.vy -= uy * f;
  }
  // centering gravity + integrate
  const g = p.center;
  for (let i = 0; i < ns.length; i++) {
    const n = ns[i];
    if (n.subject) { n.x = 0; n.y = 0; n.vx = 0; n.vy = 0; continue; }
    n.vx += (0 - n.x) * g * 0.01; n.vy += (0 - n.y) * g * 0.01;
    if (n.fx != null) { n.x = n.fx; n.vx = 0; } else { n.vx *= 0.82; n.x += Math.max(-30, Math.min(30, n.vx)); }
    if (n.fy != null) { n.y = n.fy; n.vy = 0; } else { n.vy *= 0.82; n.y += Math.max(-30, Math.min(30, n.vy)); }
  }
}
function presettle(state, p, iters) {
  let a = 1; for (let i = 0; i < iters && a > 0.02; i++) { step(state, p, a); a -= 1 / iters; }
  state.sim.forEach(n => { n.vx = 0; n.vy = 0; });
}

function UniverseGraph({
  nodes = UNIVERSE.nodes, edges = UNIVERSE.edges, adj = UNIVERSE.adj,
  height = 600, controls = false, selectedId = null, onSelect, highlightIds = null,
  search = '', filters = null, settings = null, fitTo = null, idle = true, dimWeak = true,
}) {
  const defaults = { nodeSize: 1, linkThickness: 1, center: 0.55, repel: 1, linkForce: 0.06, linkDist: 1, labels: true };
  const [localSet, setLocalSet] = React.useState(defaults);
  const set = settings || localSet;
  const paramsRef = React.useRef(set);
  paramsRef.current = { repel: set.repel, center: set.center, linkForce: set.linkForce, linkDist: set.linkDist };

  const state = useUniverseSim(nodes, edges, adj, paramsRef.current);
  const wrapRef = React.useRef(null);
  const canvasRef = React.useRef(null);
  const camRef = React.useRef({ x: 0, y: 0, k: 0.62 });
  const alphaRef = React.useRef(0.0);
  const rafRef = React.useRef(null);
  const hoverRef = React.useRef(null);
  const [hoverTick, setHoverTick] = React.useState(0);
  const pointer = React.useRef(null);
  const dragNode = React.useRef(null);

  // active / dim sets
  const hlSet = React.useMemo(() => highlightIds ? new Set(highlightIds) : null, [highlightIds]);
  const searchSet = React.useMemo(() => {
    const q = (search || '').trim().toLowerCase(); if (!q) return null;
    const s = new Set(); nodes.forEach(n => { if ((n.label + ' ' + (n.sub || '')).toLowerCase().includes(q)) s.add(n.id); }); return s;
  }, [search, nodes]);
  const famOff = React.useMemo(() => { if (!filters) return null; const s = new Set(); Object.entries(filters).forEach(([k, v]) => { if (!v) s.add(k); }); return s; }, [filters]);

  const selSet = React.useMemo(() => {
    if (!selectedId) return null; const s = new Set([selectedId]); (adj[selectedId] || []).forEach(id => s.add(id)); return s;
  }, [selectedId, adj]);

  const draw = React.useCallback(() => {
    const cv = canvasRef.current, wrap = wrapRef.current; if (!cv || !wrap) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = wrap.clientWidth, H = wrap.clientHeight;
    if (cv.width !== W * dpr || cv.height !== H * dpr) { cv.width = W * dpr; cv.height = H * dpr; cv.style.width = W + 'px'; cv.style.height = H + 'px'; }
    const ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#10141b'; ctx.fillRect(0, 0, W, H);
    const cam = camRef.current;
    const tx = W / 2 + cam.x, ty = H / 2 + cam.y, k = cam.k;
    const S = state.sim, byId = state.byId;

    const hover = hoverRef.current;
    const activeFocus = hover || selectedId;
    const focusSet = hlSet || searchSet || (activeFocus ? new Set([activeFocus, ...(adj[activeFocus] || [])]) : null);
    const isHidden = (n) => famOff && famOff.has(n.family);
    const isDim = (n) => { if (isHidden(n)) return true; if (!focusSet) return false; return !focusSet.has(n.id); };
    const nodeSizeMul = set.nodeSize, linkMul = set.linkThickness;

    // ---- links (additive glow) ----
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < state.elinks.length; i++) {
      const l = state.elinks[i]; const a = l.a, b = l.b;
      if (isHidden(a) || isHidden(b)) continue;
      const dim = focusSet ? !(focusSet.has(a.id) && focusSet.has(b.id)) : false;
      const ax = tx + a.x * k, ay = ty + a.y * k, bx = tx + b.x * k, by = ty + b.y * k;
      if ((ax < -50 && bx < -50) || (ax > W + 50 && bx > W + 50) || (ay < -50 && by < -50) || (ay > H + 50 && by > H + 50)) continue;
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by);
      if (dim) { ctx.strokeStyle = 'rgba(70,90,110,0.05)'; ctx.lineWidth = 0.5 * linkMul; }
      else if (focusSet) { ctx.strokeStyle = 'rgba(90,220,235,0.45)'; ctx.lineWidth = 1.1 * linkMul; }
      else { ctx.strokeStyle = 'rgba(54,150,170,0.13)'; ctx.lineWidth = 0.7 * linkMul; }
      ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';

    // ---- nodes ----
    const labelNodes = [];
    for (let i = 0; i < S.length; i++) {
      const n = S[i]; if (isHidden(n)) continue;
      const x = tx + n.x * k, y = ty + n.y * k;
      if (x < -40 || x > W + 40 || y < -40 || y > H + 40) continue;
      const dim = isDim(n);
      const r = Math.max(1.4, n.r * 0.5 * nodeSizeMul * k);
      const sel = n.id === selectedId, hov = n.id === hover, inFocus = focusSet && focusSet.has(n.id);
      // glow for hubs / focused
      if ((n.deg > 14 || sel || hov || (inFocus && hlSet)) && !dim) {
        ctx.beginPath(); ctx.arc(x, y, r + (sel || hov ? 9 : 5), 0, 7); ctx.fillStyle = hexA(n.color, sel || hov ? 0.28 : 0.14); ctx.fill();
      }
      ctx.beginPath(); ctx.arc(x, y, r, 0, 7);
      ctx.fillStyle = dim ? hexA(n.color, 0.16) : n.color; ctx.fill();
      if (n.subject) { ctx.lineWidth = 2; ctx.strokeStyle = '#fff'; ctx.stroke(); }
      else if (sel || hov) { ctx.lineWidth = 1.5; ctx.strokeStyle = '#e8f6ff'; ctx.stroke(); }
      if (!dim && set.labels && (n.deg > 16 || n.subject || sel || hov || (inFocus && hlSet && r > 3))) labelNodes.push({ n, x, y, r });
    }
    // ---- labels on top ----
    ctx.font = '600 11px Geist, system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    labelNodes.forEach(({ n, x, y, r }) => {
      const big = n.subject || n.id === selectedId || n.id === hover;
      const t = n.label.length > 30 ? n.label.slice(0, 28) + '…' : n.label;
      ctx.font = `600 ${big ? 12.5 : 10.5}px Geist, system-ui, sans-serif`;
      const w = ctx.measureText(t).width;
      ctx.fillStyle = 'rgba(8,11,16,0.72)'; ctx.fillRect(x - w / 2 - 4, y + r + 3, w + 8, big ? 17 : 15);
      ctx.fillStyle = big ? '#f1f7ff' : 'rgba(200,214,228,0.82)'; ctx.fillText(t, x, y + r + (big ? 5 : 4));
    });
  }, [state, set, hlSet, searchSet, famOff, selectedId, adj]);

  // animation loop
  const loop = React.useCallback(() => {
    if (alphaRef.current > 0.005) { step(state, paramsRef.current, alphaRef.current); alphaRef.current *= 0.965; }
    draw();
    if (alphaRef.current > 0.005 || dragNode.current) rafRef.current = requestAnimationFrame(loop);
    else rafRef.current = null;
  }, [state, draw]);
  const kick = React.useCallback((v = 0.4) => { alphaRef.current = Math.max(alphaRef.current, v); if (!rafRef.current) rafRef.current = requestAnimationFrame(loop); }, [loop]);

  React.useEffect(() => { draw(); }, [draw]);
  React.useEffect(() => { kick(0.7); }, []); // initial gentle settle
  React.useEffect(() => () => cancelAnimationFrame(rafRef.current), []);
  React.useEffect(() => { kick(0.55); }, [set.repel, set.center, set.linkForce, set.linkDist]);
  React.useEffect(() => { const on = () => draw(); window.addEventListener('resize', on); return () => window.removeEventListener('resize', on); }, [draw]);
  React.useEffect(() => { draw(); }, [hoverTick]);

  // fit camera to a set of ids
  React.useEffect(() => {
    if (!fitTo || !fitTo.length) return;
    const pts = fitTo.map(id => state.byId[id]).filter(Boolean); if (!pts.length) return;
    let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
    pts.forEach(n => { minX = Math.min(minX, n.x); maxX = Math.max(maxX, n.x); minY = Math.min(minY, n.y); maxY = Math.max(maxY, n.y); });
    const wrap = wrapRef.current; if (!wrap) return;
    const W = wrap.clientWidth, H = wrap.clientHeight;
    const bw = Math.max(120, maxX - minX), bh = Math.max(120, maxY - minY);
    const k = Math.min(2.2, Math.max(0.4, Math.min(W / (bw + 160), H / (bh + 160))));
    const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
    const from = { ...camRef.current }; const to = { x: -cx * k, y: -cy * k, k };
    const t0 = performance.now();
    const anim = () => { const t = Math.min(1, (performance.now() - t0) / 520); const e = 1 - Math.pow(1 - t, 3);
      camRef.current = { x: from.x + (to.x - from.x) * e, y: from.y + (to.y - from.y) * e, k: from.k + (to.k - from.k) * e };
      draw(); if (t < 1) requestAnimationFrame(anim); };
    requestAnimationFrame(anim);
  }, [fitTo, state, draw]);

  // ---- pointer helpers ----
  const toWorld = (cx, cy) => { const wrap = wrapRef.current, cam = camRef.current; const rect = wrap.getBoundingClientRect(); const W = rect.width, H = rect.height; return { x: (cx - rect.left - W / 2 - cam.x) / cam.k, y: (cy - rect.top - H / 2 - cam.y) / cam.k }; };
  const hitTest = (cx, cy) => {
    const w = toWorld(cx, cy); const S = state.sim; let best = null, bd = 1e9;
    for (let i = 0; i < S.length; i++) { const n = S[i]; if (famOff && famOff.has(n.family)) continue; const dx = n.x - w.x, dy = n.y - w.y; const d = dx * dx + dy * dy; const rr = Math.max(6, n.r) ** 2; if (d < rr && d < bd) { bd = d; best = n; } }
    return best;
  };
  const onDown = (e) => {
    const hit = hitTest(e.clientX, e.clientY);
    if (hit && !hit.subject) { dragNode.current = { id: hit.id, moved: false, sx: e.clientX, sy: e.clientY }; hit.fx = hit.x; hit.fy = hit.y; }
    else if (hit && hit.subject) { dragNode.current = { id: hit.id, moved: false, sx: e.clientX, sy: e.clientY, lock: true }; }
    else pointer.current = { x: e.clientX, y: e.clientY, camx: camRef.current.x, camy: camRef.current.y };
    wrapRef.current.setPointerCapture?.(e.pointerId);
  };
  const onMoveP = (e) => {
    if (dragNode.current) {
      const d = dragNode.current; if (Math.abs(e.clientX - d.sx) + Math.abs(e.clientY - d.sy) > 3) d.moved = true;
      if (!d.lock) { const w = toWorld(e.clientX, e.clientY); const n = state.byId[d.id]; n.fx = w.x; n.fy = w.y; kick(0.25); }
    } else if (pointer.current) {
      camRef.current = { ...camRef.current, x: pointer.current.camx + (e.clientX - pointer.current.x), y: pointer.current.camy + (e.clientY - pointer.current.y) }; draw();
    } else {
      const hit = hitTest(e.clientX, e.clientY); const id = hit ? hit.id : null;
      if (id !== hoverRef.current) { hoverRef.current = id; wrapRef.current.style.cursor = id ? 'pointer' : 'grab'; setHoverTick(t => t + 1); }
    }
  };
  const onUpP = (e) => {
    if (dragNode.current) { const d = dragNode.current; const n = state.byId[d.id]; if (!d.lock) { n.fx = null; n.fy = null; } if (!d.moved && onSelect) onSelect(selectedId === d.id ? null : d.id); kick(0.2); }
    dragNode.current = null; pointer.current = null;
  };
  const onWheel = (e) => {
    e.preventDefault(); const wrap = wrapRef.current, rect = wrap.getBoundingClientRect();
    const mx = e.clientX - rect.left - rect.width / 2, my = e.clientY - rect.top - rect.height / 2;
    const cam = camRef.current; const k = Math.min(3.5, Math.max(0.28, cam.k * (e.deltaY < 0 ? 1.12 : 0.89)));
    const ratio = k / cam.k; camRef.current = { k, x: mx - (mx - cam.x) * ratio, y: my - (my - cam.y) * ratio }; draw();
  };
  React.useEffect(() => { const el = wrapRef.current; if (!el) return; el.addEventListener('wheel', onWheel, { passive: false }); return () => el.removeEventListener('wheel', onWheel); }, []);

  const zoomBtn = (f) => { const cam = camRef.current; camRef.current = { ...cam, k: Math.min(3.5, Math.max(0.28, cam.k * f)) }; draw(); };
  const reset = () => { camRef.current = { x: 0, y: 0, k: 0.62 }; kick(0.6); };

  const hoverNode = hoverRef.current ? state.byId[hoverRef.current] : null;

  return (
    <div ref={wrapRef} className="relative w-full overflow-hidden select-none" style={{ height, background: '#10141b', cursor: 'grab' }}
      onPointerDown={onDown} onPointerMove={onMoveP} onPointerUp={onUpP} onPointerLeave={onUpP}>
      <canvas ref={canvasRef} className="absolute inset-0 block touch-none" />

      {controls && <GraphControls set={set} setSet={settings ? null : setLocalSet} filters={filters} />}

      {/* zoom controls */}
      <div className="absolute right-3 bottom-3 flex flex-col gap-1.5 z-10">
        <CtrlDark title="Zoom in" onClick={() => zoomBtn(1.18)}><Icon.Plus size={15} /></CtrlDark>
        <CtrlDark title="Zoom out" onClick={() => zoomBtn(0.85)}><Icon.Minus size={15} /></CtrlDark>
        <CtrlDark title="Reset view" onClick={reset}><Icon.RotateCw size={14} /></CtrlDark>
      </div>

      {/* hover readout */}
      {hoverNode && (
        <div className="absolute left-3 top-3 z-10 pointer-events-none bg-slate-950/85 backdrop-blur border border-white/10 rounded-md px-3 py-2 max-w-[240px]">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ background: hoverNode.color }} />
            <span className="text-[12px] font-semibold text-slate-100 truncate">{hoverNode.label}</span>
          </div>
          <div className="mono text-[9.5px] uppercase tracking-[0.1em] text-slate-500 mt-1">{hoverNode.type} · {hoverNode.deg} links</div>
        </div>
      )}
    </div>
  );
}

function CtrlDark({ children, onClick, title }) {
  return (
    <button title={title} onClick={onClick}
      className="h-8 w-8 rounded-md bg-slate-900/80 border border-white/10 text-slate-400 hover:text-white hover:border-white/25 backdrop-blur flex items-center justify-center transition-colors">
      {children}
    </button>
  );
}

/* ---------- Obsidian-style control panel ---------- */
function Slider({ label, value, min, max, step, onChange }) {
  return (
    <label className="block">
      <span className="text-[11px] text-slate-400">{label}</span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(parseFloat(e.target.value))}
        className="w-full mt-1 accent-cyan-400 h-1 cursor-pointer" />
    </label>
  );
}
function Toggle({ label, on, onChange }) {
  return (
    <button onClick={() => onChange(!on)} className="w-full flex items-center justify-between py-1 group">
      <span className="text-[11.5px] text-slate-300 group-hover:text-white">{label}</span>
      <span className={cn('relative h-[18px] w-[32px] rounded-full transition-colors', on ? 'bg-cyan-500/80' : 'bg-slate-700')}>
        <span className={cn('absolute top-[2px] h-[14px] w-[14px] rounded-full bg-white transition-all', on ? 'left-[16px]' : 'left-[2px]')} />
      </span>
    </button>
  );
}
function GraphControls({ set, setSet, filters }) {
  const [open, setOpen] = React.useState(true);
  const u = (k, v) => setSet && setSet(s => ({ ...s, [k]: v }));
  if (!setSet) return null;
  return (
    <div className="absolute left-3 top-3 z-10 w-[210px] bg-slate-950/80 backdrop-blur-md border border-white/10 rounded-lg overflow-hidden">
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between px-3 py-2 border-b border-white/10">
        <span className="mono text-[10px] uppercase tracking-[0.16em] text-slate-400 flex items-center gap-1.5"><Icon.Share2 size={12} /> Graph view</span>
        <Icon.ChevronDown size={13} className={cn('text-slate-500 transition-transform', !open && '-rotate-90')} />
      </button>
      {open && (
        <div className="p-3 space-y-3.5 max-h-[60vh] overflow-y-auto scroll-thin">
          <div>
            <div className="mono text-[9px] uppercase tracking-[0.16em] text-slate-500 mb-1.5">Display</div>
            <Toggle label="Labels" on={set.labels} onChange={v => u('labels', v)} />
            <div className="mt-2 space-y-2.5">
              <Slider label="Node size" value={set.nodeSize} min={0.4} max={2} step={0.05} onChange={v => u('nodeSize', v)} />
              <Slider label="Link thickness" value={set.linkThickness} min={0.4} max={2.5} step={0.05} onChange={v => u('linkThickness', v)} />
            </div>
          </div>
          <div className="pt-3 border-t border-white/10">
            <div className="mono text-[9px] uppercase tracking-[0.16em] text-slate-500 mb-2">Forces</div>
            <div className="space-y-2.5">
              <Slider label="Center force" value={set.center} min={0} max={1.5} step={0.05} onChange={v => u('center', v)} />
              <Slider label="Repel force" value={set.repel} min={0.2} max={2.6} step={0.05} onChange={v => u('repel', v)} />
              <Slider label="Link force" value={set.linkForce} min={0.01} max={0.18} step={0.005} onChange={v => u('linkForce', v)} />
              <Slider label="Link distance" value={set.linkDist} min={0.5} max={2.4} step={0.05} onChange={v => u('linkDist', v)} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function hexA(hex, a) {
  const h = hex.replace('#', ''); const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}

window.UniverseGraph = UniverseGraph;
window.hexA = hexA;
