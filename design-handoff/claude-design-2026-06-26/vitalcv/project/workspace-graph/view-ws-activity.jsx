// ════════════════════════════════════════════════════════════════════════
// W275-D4 · SHARED ACTIVITY FEED  —  /workspace/[id]/activity
// One feed every side reads: Evidence verified · Trust milestone reached ·
// Mobility unlocked · Opportunity created (+ member joins).
// ════════════════════════════════════════════════════════════════════════

const FILTERS = [
  { id: 'all',         label: 'All' },
  { id: 'evidence',    label: 'Evidence' },
  { id: 'trust',       label: 'Trust' },
  { id: 'mobility',    label: 'Mobility' },
  { id: 'opportunity', label: 'Opportunities' },
];

function ActivityCard({ a }) {
  const t = W.ACTIVITY_TYPE[a.type]; const I = Ic[t.icon];
  const party = W.PARTY[a.party];
  return (
    <div className="relative pl-12">
      {/* node on the rail */}
      <span className={gcn('absolute left-[14px] top-1 h-7 w-7 rounded-full flex items-center justify-center ring-4 ring-[#f7f8fa]', t.soft)}>
        <I size={14} />
      </span>
      <div className="bg-white border border-slate-200 rounded-lg p-4 hover:border-slate-300 transition-colors">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[13.5px] font-semibold text-slate-900 tracking-[-0.01em]">{a.title}</span>
              {a.tier && <TierBadge tier={a.tier} sm />}
            </div>
            <div className="text-[12.5px] text-slate-600 leading-snug mt-1 max-w-[62ch]">{a.detail}</div>
          </div>
          <span className="mono text-[10.5px] text-slate-400 flex-none">{a.t}</span>
        </div>
        <div className="flex items-center gap-2 mt-3 flex-wrap">
          <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-500">
            <span className={gcn('h-4 w-4 rounded-full text-white flex items-center justify-center text-[7.5px] font-semibold flex-none',
              a.party === 'clinician' ? 'bg-emerald-600' : a.party === 'recruiter' ? 'bg-indigo-600' : 'bg-slate-700')}>
              {a.actor.split(' ').map(w => w[0]).slice(0, 2).join('')}
            </span>
            {a.actor}
          </span>
          <span className="text-slate-300">·</span>
          <PartyChip party={a.party} sm />
          {a.source && <><span className="text-slate-300">·</span><span className="mono text-[10.5px] text-slate-400">{a.source}</span></>}
          {a.ref && <><span className="text-slate-300">·</span><span className="mono text-[10.5px] text-slate-500">{a.ref}</span></>}
        </div>
      </div>
    </div>
  );
}

function ViewActivity({ ws, onNav }) {
  const [filter, setFilter] = React.useState('all');
  const all = W.activityFor(ws.id);
  const items = filter === 'all' ? all : all.filter(a => a.type === filter);

  // group by day, preserving order
  const days = [];
  items.forEach(a => {
    let d = days.find(x => x.day === a.day);
    if (!d) { d = { day: a.day, items: [] }; days.push(d); }
    d.items.push(a);
  });

  const counts = {};
  FILTERS.forEach(f => { counts[f.id] = f.id === 'all' ? all.length : all.filter(a => a.type === f.id).length; });

  return (
    <div>
      <PageHead icon="Activity" route={'/workspace/' + ws.id + '/activity'}
        title="Activity"
        sub="One shared feed. Every side — clinician, organization, recruiter — reads the same verified events, in the same order."
        actions={<Btn variant="outline" sm iconLeft={<Ic.Download size={14} />}>Export</Btn>} />

      {/* the four canonical event types as legend */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {['evidence','trust','mobility','opportunity'].map(k => {
          const t = W.ACTIVITY_TYPE[k]; const I = Ic[t.icon];
          return (
            <Card key={k} className="px-4 py-3.5">
              <div className="flex items-center justify-between">
                <span className={gcn('h-8 w-8 rounded-md flex items-center justify-center', t.soft)}><I size={15} /></span>
                <span className="mono text-[18px] font-semibold text-slate-900 tabular-nums">{counts[k]}</span>
              </div>
              <div className="text-[12px] font-medium text-slate-900 mt-2.5">{t.label}</div>
            </Card>
          );
        })}
      </div>

      {/* filter bar */}
      <div className="flex items-center gap-1.5 mb-6 flex-wrap">
        {FILTERS.map(f => (
          <button key={f.id} onClick={() => setFilter(f.id)}
            className={gcn('inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-medium transition-colors',
              filter === f.id ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50')}>
            {f.label}<span className={gcn('mono text-[10px] tabular-nums', filter === f.id ? 'text-slate-400' : 'text-slate-400')}>{counts[f.id]}</span>
          </button>
        ))}
      </div>

      {/* feed */}
      {days.length === 0 ? (
        <Card className="p-10 text-center text-[13px] text-slate-500">No activity of this type in this workspace.</Card>
      ) : (
        <div className="space-y-7">
          {days.map(d => (
            <div key={d.day}>
              <div className="flex items-center gap-3 mb-3">
                <span className="mono text-[10.5px] uppercase tracking-[0.14em] text-slate-400">{d.day}</span>
                <span className="h-px flex-1 bg-slate-200" />
              </div>
              <div className="relative">
                {/* rail */}
                <span className="absolute left-[27px] top-2 bottom-2 w-px bg-slate-200" />
                <div className="space-y-3">
                  {d.items.map(a => <ActivityCard key={a.id} a={a} />)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

window.ViewActivity = ViewActivity;
