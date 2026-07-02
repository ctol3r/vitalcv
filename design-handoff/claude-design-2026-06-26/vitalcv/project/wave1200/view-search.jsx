// WAVE 1200 · D1 — /search · Global Search (graph-aware results across every entity type)

function ViewSearch() {
  const [q, setQ] = React.useState('');
  const [facet, setFacet] = React.useState('all');
  const [selected, setSelected] = React.useState(null);

  // universe-wide hop distance from the subject (computed once)
  const hops = React.useMemo(() => {
    const d = { self: 0 }; let fr = ['self'], h = 0;
    while (fr.length) { const nx = []; fr.forEach(id => (UNIVERSE.adj[id] || []).forEach(t => { if (d[t] == null) { d[t] = h + 1; nx.push(t); } })); fr = nx; h++; }
    return d;
  }, []);

  const facetTest = React.useMemo(() => Object.fromEntries(SEARCH_FACETS.map(f => [f.id, f.test])), []);

  const results = React.useMemo(() => {
    const query = q.trim().toLowerCase();
    let rows = UNIVERSE.nodes.filter(n => n.id !== 'self');
    if (facet !== 'all') rows = rows.filter(n => facetTest[facet] && facetTest[facet](n));
    if (query) rows = rows.filter(n => (n.label + ' ' + (n.sub || '') + ' ' + n.type).toLowerCase().includes(query));
    rows = rows.map(n => {
      const lbl = n.label.toLowerCase();
      const rel = lbl === query ? 100 : lbl.startsWith(query) ? 60 : lbl.includes(query) ? 30 : 10;
      return { n, score: rel + Math.min(20, n.deg) + (query ? 0 : (n.curated ? 30 : 0)) };
    }).sort((a, b) => b.score - a.score);
    return rows;
  }, [q, facet, facetTest]);

  const facetCounts = React.useMemo(() => {
    const query = q.trim().toLowerCase();
    const base = UNIVERSE.nodes.filter(n => n.id !== 'self' && (!query || (n.label + ' ' + (n.sub || '')).toLowerCase().includes(query)));
    const counts = { all: base.length };
    SEARCH_FACETS.forEach(f => counts[f.id] = base.filter(f.test).length);
    return counts;
  }, [q]);

  const highlightIds = React.useMemo(() => results.slice(0, 60).map(r => r.n.id), [results]);
  const node = selected ? UNIVERSE.byId[selected] : null;
  const fitTo = React.useMemo(() => node ? [node.id, ...(UNIVERSE.adj[node.id] || [])] : null, [node]);

  const facetOf = (n) => SEARCH_FACETS.find(f => f.test(n));

  return (
    <div className="max-w-[1480px] mx-auto px-6 py-7 space-y-6">
      <SurfaceIntro eyebrow="Global Search · W1200-D1" title="Search everything in the graph"
        sub="People, organizations, evidence, licenses, certifications, research, mentorship, opportunities — one index over every node. Results are graph-aware: each carries its degree, its distance from you, and where it sits in the universe." />

      {/* search bar */}
      <div className="relative">
        <Icon.Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
        <input autoFocus value={q} onChange={e => { setQ(e.target.value); setSelected(null); }}
          placeholder="Search clinicians, institutions, licenses, publications, opportunities…"
          className="w-full h-13 pl-12 pr-4 py-3.5 bg-[#141922] border border-white/12 focus:border-cyan-400/50 rounded-xl text-[15px] text-slate-100 placeholder:text-slate-600 outline-none transition-colors" />
        <div className="absolute right-4 top-1/2 -translate-y-1/2 mono text-[10px] uppercase tracking-[0.12em] text-slate-500">{results.length} results</div>
      </div>
      {!q && (
        <div className="flex flex-wrap items-center gap-2 -mt-2">
          <span className="mono text-[10px] uppercase tracking-[0.12em] text-slate-600">Try</span>
          {SEARCH_SUGGESTIONS.map(s => (
            <button key={s} onClick={() => setQ(s)} className="text-[12px] px-2.5 py-1 rounded-full bg-white/[0.04] border border-white/8 text-slate-300 hover:border-cyan-400/40 hover:text-white transition-colors">{s}</button>
          ))}
        </div>
      )}

      <div className="grid lg:grid-cols-12 gap-5">
        {/* facet rail */}
        <div className="lg:col-span-3 space-y-1">
          <div className="mono text-[10px] uppercase tracking-[0.14em] text-slate-500 px-1 mb-2">Entity type</div>
          <FacetRow active={facet === 'all'} onClick={() => setFacet('all')} Icon={Icon.Layers} label="Everything" count={facetCounts.all} />
          {SEARCH_FACETS.map(f => (
            <FacetRow key={f.id} active={facet === f.id} onClick={() => setFacet(f.id)} Icon={Icon[f.Icon]} label={f.label} count={facetCounts[f.id]} />
          ))}
        </div>

        {/* results */}
        <div className="lg:col-span-5 space-y-2">
          {results.length === 0 && (
            <Panel className="p-8 text-center text-slate-500 text-[13px]">No nodes match <span className="text-slate-300">“{q}”</span>{facet !== 'all' && ' in this type'}.</Panel>
          )}
          {results.slice(0, 40).map(({ n }) => {
            const f = facetOf(n); const active = selected === n.id;
            return (
              <button key={n.id} onClick={() => setSelected(active ? null : n.id)}
                className={cn('w-full text-left rounded-xl border p-3 flex items-center gap-3 transition-colors',
                  active ? 'border-cyan-400/50 bg-cyan-400/[0.06]' : 'border-white/[0.07] bg-[#141922] hover:border-white/20')}>
                <span className="h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: hexA(n.color, 0.14), color: n.color }}>
                  <IconFor name={n.icon} size={16} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-semibold text-slate-100 truncate">{n.label}</span>
                  <span className="block text-[11px] text-slate-500 truncate">{n.sub}</span>
                </span>
                <span className="flex flex-col items-end gap-1 flex-shrink-0">
                  {f && <Tag color={n.color}>{f.label}</Tag>}
                  <span className="mono text-[9.5px] text-slate-600">{n.deg} links · {hops[n.id] != null ? `${hops[n.id]} hop${hops[n.id] === 1 ? '' : 's'}` : 'far'}</span>
                </span>
              </button>
            );
          })}
          {results.length > 40 && <div className="text-center text-[11px] text-slate-600 py-2">+{results.length - 40} more — refine your query</div>}
        </div>

        {/* graph context */}
        <div className="lg:col-span-4 space-y-3">
          <Panel className="overflow-hidden">
            <PanelHead icon={Icon.Share2} title="In the graph" sub={node ? 'Selected node + neighborhood' : `${highlightIds.length} matches highlighted`} />
            <UniverseGraph height={300} selectedId={selected} onSelect={setSelected}
              highlightIds={selected ? null : highlightIds} fitTo={fitTo} settings={{ nodeSize: 1, linkThickness: 1, center: 0.6, repel: 1, linkForce: 0.06, linkDist: 1, labels: true }} />
          </Panel>
          {node ? (
            <Panel className="p-4">
              <div className="flex items-start gap-3">
                <span className="h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: hexA(node.color, 0.16), color: node.color }}><IconFor name={node.icon} size={18} /></span>
                <div className="min-w-0">
                  <div className="text-[14px] font-semibold text-slate-50 text-pretty">{node.label}</div>
                  <div className="text-[11px] text-slate-500">{node.sub}</div>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                <MiniStat label="Links" value={node.deg} />
                <MiniStat label="Distance" value={hops[node.id] != null ? `${hops[node.id]}` : '—'} unit="hops" />
                <MiniStat label="Type" value={node.family === 'institution' ? 'Org' : node.family === 'person' ? 'Person' : node.type.split(' ')[0]} small />
              </div>
              <div className="mt-3 pt-3 border-t border-white/[0.07] flex gap-2">
                <Button size="sm" variant="outline" className="flex-1" iconLeft={<Icon.Network size={13} />} onClick={() => navTo('graph')}>Open in graph</Button>
              </div>
            </Panel>
          ) : (
            <Panel className="p-4 text-[12px] text-slate-500 leading-relaxed">
              <Icon.Info size={15} className="text-cyan-300 mb-2" />
              Select a result to focus its neighborhood. The graph shows how each match connects to the rest of the profession — search is just a lens onto the universe.
            </Panel>
          )}
        </div>
      </div>
    </div>
  );
}

function FacetRow({ active, onClick, Icon: I, label, count }) {
  return (
    <button onClick={onClick} className={cn('w-full flex items-center gap-2.5 px-3 h-10 rounded-lg text-[13px] transition-colors whitespace-nowrap',
      active ? 'bg-white/[0.08] text-slate-50' : 'text-slate-400 hover:text-slate-100 hover:bg-white/[0.04]')}>
      {I && <I size={15} className={active ? 'text-cyan-300' : 'text-slate-500'} />}
      <span className="flex-1 text-left">{label}</span>
      <span className={cn('mono text-[11px] tabular-nums', active ? 'text-slate-300' : 'text-slate-600')}>{count}</span>
    </button>
  );
}
function MiniStat({ label, value, unit, small }) {
  return (
    <div className="bg-white/[0.03] rounded-lg py-2">
      <div className={cn('font-semibold text-slate-100 tabular-nums', small ? 'text-[12px] pt-1' : 'text-[18px]')}>{value}{unit && <span className="text-[10px] text-slate-500 ml-0.5">{unit}</span>}</div>
      <div className="mono text-[8.5px] uppercase tracking-[0.12em] text-slate-600 mt-0.5">{label}</div>
    </div>
  );
}

window.ViewSearch = ViewSearch;
