// WAVE 1200 · GRAPH — the career universe (Obsidian-style dense graph hero)

function ViewGraph() {
  const [selected, setSelected] = React.useState(null);
  const [filters, setFilters] = React.useState({ person: true, institution: true, credential: true, work: true, honor: true, aspiration: true });
  const node = selected ? UNIVERSE.byId[selected] : null;

  const neighborGroups = React.useMemo(() => {
    if (!node) return [];
    const ids = UNIVERSE.adj[node.id] || [];
    const groups = {};
    ids.forEach(id => { const n = UNIVERSE.byId[id]; if (!n) return; (groups[n.family] = groups[n.family] || []).push(n); });
    return LEGEND.filter(l => groups[l.family]).map(l => ({ label: l.label, family: l.family, nodes: groups[l.family] }));
  }, [node]);

  return (
    <div className="relative">
      {/* hero header band */}
      <div className="max-w-[1480px] mx-auto px-6 pt-7 pb-4">
        <SurfaceIntro
          eyebrow="Career Graph · Wave 1200"
          title="The whole profession, as one graph"
          sub="Every clinician, institution, credential, and piece of evidence is a node; every relationship is a typed edge. This is the substrate the reasoning engine operates on — search, questions, paths, and recommendations are all projections of this single graph."
          right={
            <div className="hidden md:flex items-center gap-2 mono text-[10px] uppercase tracking-[0.12em] text-slate-500 border border-white/10 rounded-md px-3 py-2">
              <Icon.Network size={13} className="text-cyan-300" /> {UNIVERSE.nodes.length} nodes · {UNIVERSE.edges.length} edges
            </div>
          } />
      </div>

      {/* graph stage */}
      <div className="max-w-[1480px] mx-auto px-6 pb-8">
        <div className="relative rounded-2xl overflow-hidden border border-white/[0.08]" style={{ boxShadow: '0 1px 0 rgba(255,255,255,0.04) inset' }}>
          <UniverseGraph height="calc(100vh - 230px)" controls selectedId={selected} onSelect={setSelected}
            filters={filters} />

          {/* legend (bottom-left, above hover readout offset) */}
          <div className="absolute left-3 bottom-3 z-10 bg-slate-950/70 backdrop-blur border border-white/10 rounded-lg px-3 py-2 hidden sm:block">
            <Legend filters={filters} setFilters={setFilters} />
          </div>

          {/* settings note */}
          <div className="absolute right-3 top-3 z-10 mono text-[9.5px] uppercase tracking-[0.12em] text-slate-500 bg-slate-950/60 backdrop-blur rounded px-2 py-1 hidden md:flex items-center gap-1.5 pointer-events-none">
            <Icon.Move size={11} /> drag · scroll to zoom · click a node
          </div>

          {/* inspector */}
          {node && (
            <div className="absolute right-3 bottom-3 top-3 z-20 w-[320px] max-w-[88vw] rise" style={{ animationDuration: '.32s' }}>
              <div className="h-full bg-[#11161f]/95 backdrop-blur-md border border-white/12 rounded-xl flex flex-col overflow-hidden">
                <div className="px-4 py-3.5 border-b border-white/[0.07] flex items-start gap-3">
                  <span className="h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: hexA(node.color, 0.16), color: node.color }}>
                    <IconFor name={node.icon} size={18} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[14px] font-semibold text-slate-50 leading-tight text-pretty">{node.label}</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">{node.sub}</div>
                  </div>
                  <button onClick={() => setSelected(null)} className="text-slate-500 hover:text-white p-1 -m-1"><Icon.X size={15} /></button>
                </div>
                <div className="px-4 py-3 border-b border-white/[0.07] flex flex-wrap items-center gap-2">
                  <Tag color={node.color}>{node.type}</Tag>
                  {node.state && STATE_META[node.state] && <Chip state={node.state} size="sm" />}
                  <span className="mono text-[10px] text-slate-500 ml-auto">{node.deg} links</span>
                </div>
                <div className="flex-1 overflow-y-auto scroll-thin p-3 space-y-3">
                  {neighborGroups.map(g => (
                    <div key={g.family}>
                      <div className="flex items-center gap-1.5 px-1.5 mb-1">
                        <FamilyDot family={g.family} size={7} />
                        <span className="mono text-[9px] uppercase tracking-[0.14em] text-slate-500">{g.label}</span>
                        <span className="mono text-[9px] text-slate-600">· {g.nodes.length}</span>
                      </div>
                      {g.nodes.slice(0, 8).map(nn => <NodeRef key={nn.id} node={nn} onClick={() => setSelected(nn.id)} />)}
                      {g.nodes.length > 8 && <div className="px-2.5 text-[10.5px] text-slate-600">+{g.nodes.length - 8} more</div>}
                    </div>
                  ))}
                </div>
                <div className="p-3 border-t border-white/[0.07] flex gap-2">
                  <Button size="sm" variant="primary" className="flex-1" iconLeft={<Icon.GitBranch size={13} />} onClick={() => navTo('path')}>Explain</Button>
                  <Button size="sm" variant="outline" className="flex-1" iconLeft={<Icon.Sparkles size={13} />} onClick={() => navTo('studio')}>Recommend</Button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* family breakdown strip */}
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          {LEGEND.map(l => {
            const count = UNIVERSE.nodes.filter(n => n.family === l.family).length;
            return (
              <Panel key={l.family} className="px-3.5 py-3">
                <div className="flex items-center gap-2 mb-1.5"><FamilyDot family={l.family} /><span className="text-[11px] text-slate-400">{l.label}</span></div>
                <div className="text-[22px] font-semibold tabular-nums" style={{ color: FAM_COLOR[l.family] }}>{count}</div>
              </Panel>
            );
          })}
        </div>
      </div>
    </div>
  );
}

window.ViewGraph = ViewGraph;
