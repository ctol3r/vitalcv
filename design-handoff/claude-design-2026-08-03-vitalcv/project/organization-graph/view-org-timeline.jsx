// ════════════════════════════════════════════════════════════════════════
// W265-D2 · ORGANIZATION TIMELINE — /organizations/[id]/timeline
// Hiring · Leadership · Recognition milestones, source-bound on one spine.
// ════════════════════════════════════════════════════════════════════════

function TimelineFilter({ value, onChange, counts }) {
  const opts = [
    { id: 'all', label: 'All', dot: 'bg-slate-400' },
    { id: 'hiring', label: 'Hiring', dot: 'bg-emerald-500' },
    { id: 'leadership', label: 'Leadership', dot: 'bg-indigo-500' },
    { id: 'recognition', label: 'Recognition', dot: 'bg-amber-500' },
  ];
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {opts.map(o => {
        const on = value === o.id;
        return (
          <button key={o.id} onClick={() => onChange(o.id)}
            className={gcn('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11.5px] font-medium transition-colors',
              on ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300')}>
            <span className={gcn('h-1.5 w-1.5 rounded-full', on ? 'bg-white' : o.dot)} />
            {o.label}
            <span className={gcn('mono tabular-nums', on ? 'text-slate-300' : 'text-slate-400')}>{counts[o.id]}</span>
          </button>
        );
      })}
    </div>
  );
}

function TimelineEvent({ e, last }) {
  const k = G.TIMELINE_KIND[e.kind];
  const I = Ic[k.icon];
  return (
    <div className="relative flex gap-4">
      {/* spine */}
      <div className="flex flex-col items-center flex-none w-9">
        <div className={gcn('h-9 w-9 rounded-full flex items-center justify-center ring-4 ring-white', 'bg-white border border-slate-200')}>
          <span className={gcn('h-7 w-7 rounded-full flex items-center justify-center', k.chip.split(' ').filter(c => c.startsWith('bg-') || c.startsWith('text-')).join(' '))}>
            <I size={14} />
          </span>
        </div>
        {!last && <div className="w-px flex-1 bg-slate-200 my-1" />}
      </div>
      {/* card */}
      <div className={gcn('min-w-0 flex-1', last ? 'pb-0' : 'pb-6')}>
        <div className="rounded-lg border border-slate-200 bg-white p-4 hover:border-slate-300 transition-colors">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={gcn('mono text-[9.5px] uppercase tracking-[0.1em] rounded-full ring-1 ring-inset px-1.5 py-0.5', k.chip)}>{k.label}</span>
                {e.clinician && <span className="mono text-[9.5px] uppercase tracking-[0.08em] text-slate-500 bg-slate-100 rounded-full px-1.5 py-0.5 inline-flex items-center gap-1"><Ic.User size={9} />Clinician edge</span>}
              </div>
              <h3 className="text-[14px] font-semibold text-slate-900 tracking-[-0.01em] leading-tight mt-1.5">{e.title}</h3>
              <p className="text-[12px] text-slate-500 mt-1 leading-snug">{e.detail}</p>
            </div>
            <div className="flex-none text-right">
              <div className="mono text-[11.5px] text-slate-600 tabular-nums">{e.date}</div>
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center gap-2 text-[11px] text-slate-400">
            <Ic.Verified size={12} className="text-emerald-500" />
            <span>Source-bound</span>
            <span className="text-slate-300">·</span>
            <span className="text-slate-600 font-medium">{e.source}</span>
            <TierBadge tier={e.tier} sm />
          </div>
        </div>
      </div>
    </div>
  );
}

function ViewTimeline({ org, onNav }) {
  const [filter, setFilter] = React.useState('all');
  const all = G.TIMELINE;
  const counts = {
    all: all.length,
    hiring: all.filter(e => e.kind === 'hiring').length,
    leadership: all.filter(e => e.kind === 'leadership').length,
    recognition: all.filter(e => e.kind === 'recognition').length,
  };
  const events = filter === 'all' ? all : all.filter(e => e.kind === filter);

  // group by year
  const years = [];
  events.forEach(e => { if (!years.find(y => y.year === e.year)) years.push({ year: e.year, items: [] }); });
  events.forEach(e => years.find(y => y.year === e.year).items.push(e));

  return (
    <div>
      <PageHead icon="Activity" route={`organizations/${org.id}/timeline`} title={`${org.short} · Organization timeline`}
        sub="Hiring, leadership and recognition milestones — every event bound to the source that confirmed it, on one verified spine."
        actions={<Btn variant="outline" sm iconLeft={<Ic.ArrowLeft size={14} />} onClick={() => onNav('profile')}>Profile</Btn>} />

      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <TimelineFilter value={filter} onChange={setFilter} counts={counts} />
        <span className="mono text-[10.5px] text-slate-400 uppercase tracking-[0.08em]">{events.length} milestone{events.length !== 1 && 's'}</span>
      </div>

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 lg:col-span-8">
          {years.map((y) => (
            <div key={y.year} className="mb-2">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-[13px] font-semibold text-slate-900 tabular-nums">{y.year}</span>
                <span className="h-px flex-1 bg-slate-200" />
              </div>
              <div>
                {y.items.map((e, i) => (
                  <TimelineEvent key={e.id} e={e} last={i === y.items.length - 1} />
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* legend / summary rail */}
        <div className="col-span-12 lg:col-span-4 space-y-6">
          <Card>
            <SecHead icon="Layers" title="Milestone types" />
            <div className="px-5 py-4 space-y-3.5">
              {Object.entries(G.TIMELINE_KIND).map(([id, k]) => {
                const I = Ic[k.icon];
                return (
                  <div key={id} className="flex items-start gap-3">
                    <span className={gcn('h-7 w-7 rounded-full flex items-center justify-center flex-none', k.chip.split(' ').filter(c => c.startsWith('bg-') || c.startsWith('text-')).join(' '))}><I size={13} /></span>
                    <div className="min-w-0">
                      <div className="text-[12.5px] font-medium text-slate-800 leading-tight">{k.label}</div>
                      <div className="text-[11px] text-slate-400 leading-tight">{counts[id]} on record</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          <Card className="bg-slate-900 border-slate-900 text-white overflow-hidden">
            <div className="p-5">
              <Eyebrow className="text-slate-400">How this timeline is built</Eyebrow>
              <p className="text-[13px] text-slate-200 mt-2.5 leading-relaxed">
                Every milestone is an <span className="text-white font-medium">event of record</span> — recorded once, bound to the source that confirmed it. Hiring events that involve a verified clinician carry that edge straight into the relationship graph.
              </p>
              <button onClick={() => onNav('graph')} className="mt-4 inline-flex items-center gap-1.5 text-[12.5px] font-medium text-emerald-400 hover:text-emerald-300">
                <Ic.Network size={14} /> See the clinician edges <Ic.ArrowRight size={13} />
              </button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

window.ViewTimeline = ViewTimeline;
