// WAVE 1200 · D5 — /studio · Recommendation Studio (recommendations that emerge from the graph)

const IMPACT = { high: ['#34d895', 'High impact'], medium: ['#fbe33a', 'Medium'], low: ['#7cc6e8', 'Low'] };

function ViewStudio() {
  const [cat, setCat] = React.useState('all');
  const [sel, setSel] = React.useState('rec-1');
  const list = cat === 'all' ? RECOMMENDATIONS : RECOMMENDATIONS.filter(r => r.cat === cat);
  React.useEffect(() => { if (!list.find(r => r.id === sel)) setSel(list[0]?.id || null); }, [cat]);
  const rec = RECOMMENDATIONS.find(r => r.id === sel);
  const trace = rec?.traceId ? TRACES[rec.traceId] : null;
  const basisIds = rec ? ['self', ...rec.basis] : ['self'];

  const catCount = (id) => id === 'all' ? RECOMMENDATIONS.length : RECOMMENDATIONS.filter(r => r.cat === id).length;

  return (
    <div className="max-w-[1480px] mx-auto px-6 py-7 space-y-6">
      <SurfaceIntro eyebrow="Recommendation Studio · W1200-D5" title="Recommendations, emerged from the graph"
        sub="Not a feed of generic advice — each card is a conclusion the graph reached, cites the exact nodes it stands on, and links to its full reasoning path. No black boxes: if you can’t see why, it isn’t a recommendation."
        right={<div className="hidden md:flex items-center gap-2 mono text-[10px] uppercase tracking-[0.12em] text-slate-500 border border-white/10 rounded-md px-3 py-2"><Icon.Sparkles size={13} className="text-cyan-300" /> {RECOMMENDATIONS.length} active</div>} />

      {/* category chips */}
      <div className="flex flex-wrap gap-2">
        <CatChip active={cat === 'all'} onClick={() => setCat('all')} Icon={Icon.Layers} label="All" count={catCount('all')} />
        {REC_CATS.map(c => <CatChip key={c.id} active={cat === c.id} onClick={() => setCat(c.id)} Icon={Icon[c.Icon]} label={c.label} count={catCount(c.id)} />)}
      </div>

      <div className="grid lg:grid-cols-12 gap-5">
        {/* recommendation cards */}
        <div className="lg:col-span-8 space-y-3">
          {list.map(r => {
            const active = sel === r.id; const [ic, il] = IMPACT[r.impact];
            const catMeta = REC_CATS.find(c => c.id === r.cat);
            return (
              <button key={r.id} onClick={() => setSel(r.id)}
                className={cn('w-full text-left rounded-xl border p-4 transition-colors',
                  active ? 'border-cyan-400/45 bg-cyan-400/[0.05]' : 'border-white/[0.07] bg-[#141922] hover:border-white/18')}>
                <div className="flex items-start gap-3">
                  <span className="h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0 bg-white/[0.05] text-cyan-300"><IconFor name={catMeta?.Icon} size={17} /></span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <span className="text-[14px] font-semibold text-slate-50 leading-snug text-pretty">{r.title}</span>
                      <span className="mono text-[9.5px] uppercase tracking-[0.08em] px-1.5 py-0.5 rounded flex-shrink-0" style={{ color: ic, background: hexA(ic, 0.12) }}>{il}</span>
                    </div>
                    <p className="text-[12.5px] text-slate-400 leading-[1.55] mt-1.5 text-pretty">{r.rationale}</p>

                    {/* basis nodes */}
                    <div className="mt-3 flex flex-wrap items-center gap-1.5">
                      <span className="mono text-[9px] uppercase tracking-[0.12em] text-slate-600 mr-0.5">Built on</span>
                      {r.basis.map(id => { const n = UNIVERSE.byId[id]; if (!n) return null; const c = n.color || FAM_COLOR[n.family];
                        return <span key={id} className="inline-flex items-center gap-1 text-[10.5px] px-1.5 py-0.5 rounded" style={{ color: c, background: hexA(c, 0.1) }}><IconFor name={n.icon} size={10} />{n.label}</span>;
                      })}
                    </div>

                    <div className="mt-3 pt-3 border-t border-white/[0.06] flex items-center justify-between gap-3 flex-wrap">
                      <span className="inline-flex items-center gap-1.5 text-[12px] text-slate-300"><Icon.ArrowUpRight size={13} className="text-emerald-400" />{r.effect}</span>
                      <span className="flex items-center gap-2.5">
                        <span className="mono text-[10px] text-slate-500">confidence {r.confidence}%</span>
                        {r.traceId
                          ? <span className="inline-flex items-center gap-1 text-[11px] text-cyan-300" onClick={(e) => { e.stopPropagation(); window.__pathFocus = r.traceId; navTo('path', r.traceId); }}><Icon.GitBranch size={12} />reasoning</span>
                          : <span className="mono text-[10px] text-slate-600">direct from graph</span>}
                      </span>
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* context: graph + trace */}
        <div className="lg:col-span-4">
          <div className="lg:sticky lg:top-28 space-y-3">
            <Panel className="overflow-hidden">
              <PanelHead icon={Icon.Network} title="What it's built on" sub={rec ? `${rec.basis.length} basis nodes` : ''} />
              <UniverseGraph height={300} highlightIds={basisIds} fitTo={basisIds}
                settings={{ nodeSize: 1.15, linkThickness: 1.3, center: 0.6, repel: 1, linkForce: 0.06, linkDist: 1.1, labels: true }} />
            </Panel>

            {rec && (
              <Panel className="p-4">
                <div className="flex items-center gap-2 mb-2.5">
                  <span className="mono text-[10px] uppercase tracking-[0.14em] text-slate-500">Why this, why now</span>
                </div>
                <div className="space-y-2">
                  {rec.basis.map(id => { const n = UNIVERSE.byId[id]; if (!n) return null; return <NodeRef key={id} node={n} />; })}
                </div>
                {trace ? (
                  <Button size="sm" variant="primary" className="w-full mt-3" iconLeft={<Icon.GitBranch size={13} />}
                    onClick={() => { window.__pathFocus = trace.id; navTo('path', trace.id); }}>Open full reasoning path</Button>
                ) : (
                  <div className="mt-3 text-[11.5px] text-slate-500 flex items-start gap-2 leading-snug">
                    <Icon.Info size={13} className="text-cyan-300 flex-shrink-0 mt-0.5" />
                    A direct graph read — this recommendation follows from the basis nodes above without a multi-hop traversal.
                  </div>
                )}
              </Panel>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function CatChip({ active, onClick, Icon: I, label, count }) {
  return (
    <button onClick={onClick} className={cn('inline-flex items-center gap-2 text-[12.5px] px-3 h-9 rounded-lg border transition-colors whitespace-nowrap',
      active ? 'border-cyan-400/50 bg-cyan-400/[0.08] text-cyan-100' : 'border-white/8 bg-white/[0.03] text-slate-400 hover:border-white/20 hover:text-slate-200')}>
      {I && <I size={14} className={active ? 'text-cyan-300' : 'text-slate-500'} />}
      <span>{label}</span>
      <span className="mono text-[10px] tabular-nums opacity-70">{count}</span>
    </button>
  );
}

window.ViewStudio = ViewStudio;
