// WAVE 1100 · D1 + D2 — /graph
// The career as one connected system. Interactive graph + a navigable entity inspector.

function NodeInspector({ id, onSelect }) {
  const node = NODE_BY_ID[id];
  const f = FAMILIES[node.family];
  const conns = neighbors(id);
  // group connections by relationship
  const groups = {};
  conns.forEach(e => { const k = (e.dir === 'out' ? '' : '← ') + (REL[e.rel]?.label || e.rel); (groups[k] = groups[k] || []).push(e); });

  return (
    <div className="flex flex-col h-full">
      <div className="px-5 py-4 border-b border-slate-200">
        <div className="flex items-start gap-3">
          <div className="h-11 w-11 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: node.family === 'self' ? f.accent : f.soft, color: node.family === 'self' ? '#fff' : f.accent }}>
            <IconFor name={node.icon} size={22} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="mono text-[9.5px] uppercase tracking-[0.14em]" style={{ color: f.accent }}>{node.type}</span>
              <span className="text-slate-300">·</span>
              <span className="mono text-[9.5px] uppercase tracking-[0.12em] text-slate-400">{f.label}</span>
            </div>
            <h3 className="text-[16px] font-semibold text-slate-900 tracking-tightish leading-tight mt-0.5">{node.label}</h3>
            <div className="text-[12px] text-slate-500 mt-0.5">{node.sub}</div>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2 flex-wrap">
          <Chip state={node.state} size="sm" />
          {node.match != null && <span className="mono text-[10px] uppercase tracking-[0.1em] text-slate-500 bg-slate-100 rounded px-1.5 py-0.5">{node.match}% match</span>}
          {(node.dims || []).map(d => (
            <span key={d} className="text-[10px] rounded px-1.5 py-0.5 bg-slate-100 text-slate-600">{window.DIM?.[d]?.label || d}</span>
          ))}
        </div>
        {node.attests && <p className="mt-3 text-[11.5px] text-slate-600 leading-snug">Will attest to <span className="font-medium text-slate-800">{node.attests}</span>.</p>}
      </div>

      <div className="px-5 py-3 flex items-center justify-between border-b border-slate-100">
        <span className="mono text-[10px] uppercase tracking-[0.14em] text-slate-500">{conns.length} connections</span>
        {id !== 'self' && <button onClick={() => onSelect('self')} className="mono text-[10px] uppercase tracking-[0.1em] text-slate-500 hover:text-slate-900 inline-flex items-center gap-1"><Icon.Crosshair size={11} /> back to you</button>}
      </div>

      <div className="flex-1 overflow-y-auto scroll-thin py-2">
        {Object.entries(groups).map(([rel, es]) => (
          <div key={rel} className="px-3 py-1.5">
            <div className="mono text-[9px] uppercase tracking-[0.14em] text-slate-400 px-2.5 mb-1">{rel} <span className="text-slate-300">· {es.length}</span></div>
            {es.map((e, i) => <NodeRef key={i} node={e.node} rel={e.rel} dir={e.dir} onClick={() => onSelect(e.id)} />)}
          </div>
        ))}
      </div>
    </div>
  );
}

function GraphOverviewPanel({ onSelect }) {
  // most-connected entities, by degree
  const ranked = [...NODES].map(n => ({ n, deg: (ADJ[n.id] || []).length })).sort((a, b) => b.deg - a.deg).slice(1, 7);
  return (
    <div className="flex flex-col h-full">
      <div className="px-5 py-4 border-b border-slate-200">
        <Eyebrow className="mb-1.5">The inspector</Eyebrow>
        <p className="text-[12.5px] text-slate-600 leading-[1.55]">Select any node to walk the graph. Every connection is a typed relationship you can follow — credential to institution, person to evidence, evidence to recognition.</p>
      </div>
      <div className="px-5 py-3.5 border-b border-slate-100">
        <FamilyLegend />
      </div>
      <div className="px-3 py-2 flex-1 overflow-y-auto scroll-thin">
        <div className="mono text-[9px] uppercase tracking-[0.14em] text-slate-400 px-4.5 mb-1 mt-1">Most-connected entities</div>
        {ranked.map(({ n, deg }) => (
          <div key={n.id} className="flex items-center gap-1">
            <div className="flex-1"><NodeRef node={n} onClick={() => onSelect(n.id)} /></div>
            <span className="mono text-[10px] text-slate-400 tabular-nums pr-3 flex-shrink-0">{deg}×</span>
          </div>
        ))}
      </div>
      <div className="px-5 py-3.5 border-t border-slate-200 bg-slate-50/60">
        <button onClick={() => onSelect('self')} className="w-full flex items-center justify-center gap-2 text-[12.5px] font-medium text-slate-700 hover:text-slate-900">
          <Icon.Crosshair size={14} /> Start from Macie Miller
        </button>
      </div>
    </div>
  );
}

function ViewGraph() {
  const route = useRoute();
  const [selected, setSelected] = React.useState(route.node || 'self');
  const [hover, setHover] = React.useState(null);

  React.useEffect(() => { if (route.node && route.node !== selected) setSelected(route.node); }, [route.node]);

  return (
    <div className="max-w-[1440px] mx-auto px-6 py-8 space-y-7">
      <div className="rise">
        <SurfaceIntro eyebrow="Career Graph · Wave 1100"
          title="A career is a connected system, not a list of records"
          sub="Every credential, institution, person, and piece of work is a first-class node. Every relationship between them is a typed, directed edge. This is the same owned ledger — projected as the graph it always was."
          right={<div className="hidden md:flex flex-col items-end gap-1">
            <div className="text-[28px] font-semibold text-slate-900 tabular-nums leading-none">{NODES.length}<span className="text-[15px] text-slate-400 ml-1">nodes</span></div>
            <div className="mono text-[10px] uppercase tracking-[0.12em] text-slate-400">{LINKS.length} relationships · 7 families</div>
          </div>} />
      </div>

      <div className="rise grid lg:grid-cols-12 gap-5 items-stretch" style={{ animationDelay: '80ms' }}>
        <div className="lg:col-span-8">
          <div className="border border-slate-200 rounded-lg bg-white overflow-hidden h-full flex flex-col">
            <div className="px-4 py-2.5 border-b border-slate-200 flex items-center justify-between gap-3">
              <FamilyLegend className="text-[10.5px]" />
              <span className="hidden sm:inline mono text-[9.5px] uppercase tracking-[0.12em] text-slate-400 flex-shrink-0">live force layout</span>
            </div>
            <GraphCanvas selectedId={selected} onSelect={(id) => setSelected(id)} hoverId={hover} onHover={setHover} height={580} />
          </div>
        </div>
        <div className="lg:col-span-4">
          <div className="border border-slate-200 rounded-lg bg-white overflow-hidden h-full" style={{ maxHeight: 640 }}>
            {selected ? <NodeInspector id={selected} onSelect={setSelected} /> : <GraphOverviewPanel onSelect={setSelected} />}
          </div>
        </div>
      </div>

      {/* D5 — graph everywhere: the principle, made concrete */}
      <section className="rise" style={{ animationDelay: '140ms' }}>
        <SectionHeader n="01" title="The graph is everywhere" sub="Isolated pages become one fabric. Each chain below is a path you can trace, end to end." right="organizations → people → evidence → recognition → opportunity" />
        <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4">
          {GRAPH_CHAINS.map(c => (
            <div key={c.id} className="border border-slate-200 rounded-lg bg-white p-4 flex flex-col">
              <div className="flex items-center gap-2 mb-3">
                <IconFor name={c.icon} size={15} className="text-slate-700" />
                <span className="text-[13px] font-semibold text-slate-900">{c.title}</span>
              </div>
              <div className="space-y-0 flex-1">
                {c.path.map((id, i) => {
                  const n = NODE_BY_ID[id]; const f = FAMILIES[n.family];
                  return (
                    <div key={id} className="relative pl-6 pb-3 last:pb-0">
                      {i < c.path.length - 1 && <span className="absolute left-[7px] top-4 bottom-0 w-px bg-slate-200" />}
                      <span className="absolute left-[1px] top-1 h-3.5 w-3.5 rounded-full ring-2 ring-white flex items-center justify-center" style={{ background: f.soft }}>
                        <span className="h-1.5 w-1.5 rounded-full" style={{ background: f.accent }} />
                      </span>
                      <button onClick={() => { setSelected(id); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="text-left group">
                        <span className="block text-[12px] font-medium text-slate-800 group-hover:text-slate-950 leading-tight">{n.label}</span>
                        <span className="block mono text-[9px] uppercase tracking-[0.1em] text-slate-400">{n.type}</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

// Concrete D5 chains — each is a real walk through the graph
const GRAPH_CHAINS = [
  { id: 'ch1', title: 'Institution → influence', icon: 'Building', path: ['o-ucla', 'p-vasquez', 'c-fellowship', 'h-distinction'] },
  { id: 'ch2', title: 'Evidence → recognition', icon: 'Microscope', path: ['r-cedar', 'pub-1', 'h-poster', 's-research'] },
  { id: 'ch3', title: 'Person → attestation', icon: 'Handshake', path: ['p-lee', 'r-cedar', 'r-protocol', 'h-service'] },
  { id: 'ch4', title: 'Credential → opportunity', icon: 'Route', path: ['c-fellowship', 'r-cedar', 'c-license', 'g-specialist'] },
];

window.ViewGraph = ViewGraph;
