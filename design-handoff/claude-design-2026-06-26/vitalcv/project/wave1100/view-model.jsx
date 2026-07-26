// WAVE 1100 · D2 — /model
// The unified entity model: every object first-class, every relationship typed.

function ViewModel() {
  const relUsage = React.useMemo(() => {
    const u = {}; LINKS.forEach(l => { u[l.rel] = (u[l.rel] || 0) + 1; });
    return Object.entries(REL).map(([k, v]) => ({ key: k, ...v, n: u[k] || 0 })).filter(r => r.n > 0).sort((a, b) => b.n - a.n);
  }, []);

  return (
    <div className="max-w-[1440px] mx-auto px-6 py-8 space-y-7">
      <div className="rise">
        <SurfaceIntro eyebrow="Unified Entity Model · Wave 1100"
          title="Every object is first-class. Every relationship is typed."
          sub="A person, an organization, a license, a publication, a skill — none is a field buried inside a record. Each is its own entity with its own identity, and the lines between them carry meaning. This is what lets the platform model a career instead of merely storing one."
          right={<div className="hidden md:flex flex-col items-end gap-1">
            <div className="text-[28px] font-semibold text-slate-900 tabular-nums leading-none">{ENTITY_TYPES.reduce((a, t) => a + t.count, 0)}</div>
            <div className="mono text-[10px] uppercase tracking-[0.12em] text-slate-400">entities · {relUsage.length} relationship types</div>
          </div>} />
      </div>

      {/* entity families */}
      <section className="rise" style={{ animationDelay: '80ms' }}>
        <SectionHeader n="01" title="The entity families" sub="Seven families, every one a node type the graph can reason over." right="first-class objects" />
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Object.entries(FAMILIES).map(([key, f]) => {
            const items = NODES.filter(n => n.family === key);
            return (
              <div key={key} className="border border-slate-200 rounded-lg bg-white overflow-hidden flex flex-col">
                <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between" style={{ background: f.dashed ? '#f8fafc' : `${f.soft}66` }}>
                  <div className="flex items-center gap-2">
                    <FamilyDot family={key} size={11} />
                    <span className="text-[13px] font-semibold text-slate-900">{f.label}</span>
                  </div>
                  <span className="mono text-[11px] tabular-nums" style={{ color: f.accent }}>{items.length}</span>
                </div>
                <div className="p-2 flex-1">
                  {items.map(n => (
                    <a key={n.id} href={`#/graph/${n.id}`} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-slate-50 group">
                      <IconFor name={n.icon} size={13} style={{ color: f.accent }} className="flex-shrink-0" />
                      <span className="text-[12px] text-slate-700 group-hover:text-slate-950 truncate flex-1">{n.label}</span>
                      <span className="mono text-[8.5px] uppercase tracking-[0.1em] text-slate-400 flex-shrink-0">{n.type}</span>
                    </a>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* relationship vocabulary */}
      <section className="rise" style={{ animationDelay: '120ms' }}>
        <SectionHeader n="02" title="The relationship vocabulary" sub="Edges are not generic links — each carries a verb the graph understands." right={`${relUsage.length} edge types`} />
        <div className="border border-slate-200 rounded-lg bg-white overflow-hidden">
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 divide-y sm:divide-y-0 divide-slate-100">
            {relUsage.map((r, i) => (
              <div key={r.key} className={cn('px-5 py-3.5 flex items-center gap-3', i % 3 !== 2 && 'lg:border-r border-slate-100', i % 2 !== 1 && 'sm:border-r lg:border-r-0')}>
                <Icon.Share2 size={14} className="text-slate-400 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <span className="mono text-[12px] font-medium text-slate-900">{r.label}</span>
                  <span className="block text-[10.5px] text-slate-500">subject {r.verb} object</span>
                </div>
                <span className="mono text-[11px] text-slate-400 tabular-nums flex-shrink-0">{r.n}×</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* the principle — D5 */}
      <section className="rise" style={{ animationDelay: '160ms' }}>
        <div className="border border-slate-900 rounded-lg bg-slate-950 text-white overflow-hidden">
          <div className="px-6 py-6 grid md:grid-cols-2 gap-6 items-center">
            <div>
              <Eyebrow className="text-slate-400 mb-2.5">The shift · Wave 1100</Eyebrow>
              <h3 className="text-[20px] font-semibold tracking-tightish leading-tight">From isolated records to a connected system</h3>
              <p className="text-[13px] text-slate-300 leading-[1.6] mt-3 text-pretty">A platform that stores a career answers "what happened." A platform that models one answers "how is it connected, what does it support, and where can it go." The same owned ledger now reads as a graph — and the graph is everywhere.</p>
              <div className="mt-5 flex gap-2.5 flex-wrap">
                <Button variant="outline" className="bg-white text-slate-900 border-white hover:bg-slate-100" iconLeft={<Icon.Share2 size={14} />} onClick={() => navTo('graph')}>Open the graph</Button>
                <Button variant="outline" className="bg-transparent text-white border-white/30 hover:bg-white/10" iconLeft={<Icon.Search size={14} />} onClick={() => navTo('explorer')}>Ask a question</Button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { k: 'Records', v: 'CRUD', d: 'rows in a table' },
                { k: 'Relationships', v: `${LINKS.length}`, d: 'typed, directed edges' },
                { k: 'Navigable', v: '100%', d: 'every node reachable' },
                { k: 'Score', v: 'None', d: 'a topology instead' },
              ].map(s => (
                <div key={s.k} className="rounded-lg bg-white/5 border border-white/10 p-3.5">
                  <div className="mono text-[9px] uppercase tracking-[0.14em] text-slate-400">{s.k}</div>
                  <div className="text-[22px] font-semibold tracking-tight mt-1">{s.v}</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">{s.d}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

window.ViewModel = ViewModel;
