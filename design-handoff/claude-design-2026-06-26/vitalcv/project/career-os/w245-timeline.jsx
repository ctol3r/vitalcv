// W245 · D3 — Timeline experience (/career/timeline)
// One chronological spine: Career Events · Recognition Events · Trust Milestones.
// Filterable; every node dereferences to its source receipt.

const TL_TYPE = {
  event:       { label: 'Career event', node: 'bg-slate-900', ring: 'ring-slate-200', Icon: Icon.FileText },
  recognition: { label: 'Recognition',  node: 'bg-violet-600', ring: 'ring-violet-200', Icon: Icon.Award },
  milestone:   { label: 'Milestone',    node: 'bg-emerald-600', ring: 'ring-emerald-200', Icon: Icon.Flag },
};

function buildTimeline() {
  const out = [];
  window.EVENTS.forEach(e => out.push({
    type: 'event', date: e.date, year: e.year, title: e.title, org: e.org,
    detail: e.detail, state: e.state, dims: e.dims, receipt: e.receipt, icon: e.icon, dir: e.dir,
  }));
  window.RECOGNITION.forEach(r => out.push({
    type: 'recognition', date: r.date, year: r.year, title: r.title, org: r.conferrer,
    detail: r.blurb, state: 'conferred', dims: r.dims, receipt: r.receipt, selectivity: r.selectivity,
  }));
  window.MILESTONES.forEach(m => out.push({
    type: 'milestone', date: `${m.year}`, year: m.year, title: m.label, org: m.detail,
    detail: 'A permanent floor — this dimension never falls below this point once set.', state: 'verified', dims: [m.dim], milestone: true,
  }));
  return out.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

function ViewTimeline({ entity }) {
  const [filter, setFilter] = React.useState('all');
  const all = React.useMemo(buildTimeline, []);
  const items = filter === 'all' ? all : all.filter(i => i.type === filter);

  const counts = {
    all: all.length,
    event: all.filter(i => i.type === 'event').length,
    recognition: all.filter(i => i.type === 'recognition').length,
    milestone: all.filter(i => i.type === 'milestone').length,
  };
  const filters = [
    { id: 'all', label: 'All' },
    { id: 'event', label: 'Career events' },
    { id: 'recognition', label: 'Recognition' },
    { id: 'milestone', label: 'Milestones' },
  ];

  let lastYear = null;

  return (
    <div className="max-w-[1340px] mx-auto px-6 py-9">
      {/* Header */}
      <div className="rise">
        <Eyebrow className="mb-2">Career OS · Timeline</Eyebrow>
        <h1 className="text-[26px] font-semibold tracking-[-0.02em] text-slate-900 leading-tight">Everything that happened, in order</h1>
        <p className="text-[13px] text-slate-600 leading-[1.6] max-w-[80ch] mt-2">
          The career as a single chronological spine — dated, sourced events, conferred recognition, and the milestone floors that can never fall. Projected from the owned ledger; nothing here can be edited away by an employer.
        </p>
      </div>

      {/* Filters */}
      <div className="rise mt-6 flex items-center gap-2 flex-wrap" style={{ animationDelay: '40ms' }}>
        {filters.map(f => {
          const active = filter === f.id;
          const t = f.id !== 'all' ? TL_TYPE[f.id] : null;
          return (
            <button key={f.id} onClick={() => setFilter(f.id)}
              className={cn('inline-flex items-center gap-2 h-8 px-3 rounded-md text-[12px] font-medium transition-colors',
                active ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:border-slate-300')}>
              {t && <span className={cn('h-2 w-2 rounded-full', active ? 'bg-white' : t.node)} />}
              <span>{f.label}</span>
              <span className={cn('mono text-[10px] tabular-nums', active ? 'text-slate-300' : 'text-slate-400')}>{counts[f.id]}</span>
            </button>
          );
        })}
      </div>

      {/* Timeline rail */}
      <div className="rise mt-7 relative" style={{ animationDelay: '80ms' }}>
        <div className="absolute left-[15px] sm:left-[83px] top-1.5 bottom-1.5 w-px bg-slate-200" aria-hidden="true" />
        <div className="space-y-1">
          {items.map((it, idx) => {
            const t = TL_TYPE[it.type];
            const TI = t.Icon;
            const showYear = it.year !== lastYear;
            lastYear = it.year;
            return (
              <div key={idx}>
                {showYear && (
                  <div className="flex items-center gap-3 pt-5 pb-2 first:pt-0">
                    <div className="hidden sm:block w-[68px]" />
                    <div className="relative z-10 h-[31px] flex items-center">
                      <span className="mono text-[11px] font-semibold text-slate-900 bg-slate-100 rounded px-2 py-1 sm:ml-[-15px] sm:translate-x-[-50%]">{it.year}</span>
                    </div>
                  </div>
                )}
                <div className="flex items-stretch gap-3 sm:gap-4 group">
                  {/* date */}
                  <div className="hidden sm:flex w-[68px] flex-shrink-0 justify-end pt-3.5">
                    <span className="mono text-[10px] text-slate-400 uppercase tracking-[0.08em] tabular-nums">
                      {it.date.length > 4 ? it.date.slice(5) : '—'}
                    </span>
                  </div>
                  {/* node */}
                  <div className="relative flex-shrink-0 flex justify-center" style={{ width: 30 }}>
                    <span className={cn('relative z-10 mt-3.5 h-[30px] w-[30px] rounded-full ring-4 ring-white flex items-center justify-center text-white', t.node)}>
                      <TI size={13} />
                    </span>
                  </div>
                  {/* content */}
                  <div className="flex-1 min-w-0 pb-2">
                    <div className="border border-slate-200 rounded-lg bg-white p-4 group-hover:border-slate-300 transition-colors">
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[13.5px] font-semibold text-slate-900 leading-tight">{it.title}</span>
                            {it.milestone && <Icon.Anchor size={12} className="text-emerald-600 flex-shrink-0" title="Milestone floor" />}
                          </div>
                          <div className="text-[11.5px] text-slate-500 mt-0.5">{it.org}</div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {it.selectivity && <span className="mono text-[9px] uppercase tracking-[0.08em] text-violet-700">{it.selectivity}</span>}
                          <Chip state={it.state} size="sm" />
                        </div>
                      </div>
                      <p className="text-[11.5px] text-slate-500 leading-snug mt-2">{it.detail}</p>
                      <div className="mt-2.5 flex items-center gap-2 flex-wrap">
                        {(it.dims || []).map(d => (
                          <span key={d} className="mono text-[9px] uppercase tracking-[0.06em] text-slate-600 bg-slate-50 ring-1 ring-inset ring-slate-200 rounded px-1.5 py-0.5">
                            {(window.DIM[d] && window.DIM[d].label) || d}
                          </span>
                        ))}
                        {it.receipt && (
                          <span className="mono text-[9.5px] text-slate-400 inline-flex items-center gap-1 ml-auto">
                            <Icon.Link size={10} />{it.receipt}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="rise mt-8 border-t border-slate-200 pt-5 flex items-center gap-x-6 gap-y-2 flex-wrap mono text-[10px] uppercase tracking-[0.1em] text-slate-500">
        {Object.entries(TL_TYPE).map(([k, v]) => (
          <span key={k} className="inline-flex items-center gap-2"><span className={cn('h-2.5 w-2.5 rounded-full', v.node)} />{v.label}</span>
        ))}
        <span className="inline-flex items-center gap-2 ml-auto"><Icon.Anchor size={12} className="text-emerald-600" />floor · never falls</span>
      </div>
    </div>
  );
}

window.ViewTimeline = ViewTimeline;
