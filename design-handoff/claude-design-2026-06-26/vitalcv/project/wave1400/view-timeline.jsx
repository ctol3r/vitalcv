// WAVE 1400 · D4 — /timeline · EVENT TIMELINE (immutable audit trail)
// Every operational action is observable. The ledger is append-only: events
// carry a monotonic sequence number, are frozen on write, and are never edited
// or deleted. This surface replays the whole chain — filterable by type, actor
// and record — so any state the organization reaches can be explained by the
// events that produced it.

function ViewTimeline() {
  const { def, events, roster } = useWorkspace();
  const [typeF, setTypeF] = React.useState('all');
  const [actorF, setActorF] = React.useState('all');
  const [q, setQ] = React.useState('');
  const [onlyManual, setOnlyManual] = React.useState(false);

  let rows = events;
  if (typeF !== 'all') rows = rows.filter(e => e.type === typeF);
  if (actorF !== 'all') rows = rows.filter(e => actorF === 'system' ? !e.actor : e.actor === actorF);
  if (onlyManual) rows = rows.filter(e => !e.system);
  if (q.trim()) { const t = q.toLowerCase(); rows = rows.filter(e => (e.subject || '').toLowerCase().includes(t) || (e.detail || '').toLowerCase().includes(t)); }

  // group by day
  const groups = [];
  const dayKey = (ts) => { const dt = new Date(ts); return dt.toDateString(); };
  rows.forEach(e => {
    const k = dayKey(e.ts);
    let g = groups.find(x => x.k === k);
    if (!g) { g = { k, ts: e.ts, items: [] }; groups.push(g); }
    g.items.push(e);
  });
  const dayLabel = (ts) => {
    const d = new Date(ts), today = new Date(), yest = new Date(Date.now() - 864e5);
    if (d.toDateString() === today.toDateString()) return 'Today';
    if (d.toDateString() === yest.toDateString()) return 'Yesterday';
    return d.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
  };

  const manualCount = events.filter(e => !e.system).length;
  const typeCounts = {};
  events.forEach(e => typeCounts[e.type] = (typeCounts[e.type] || 0) + 1);
  const topTypes = Object.entries(typeCounts).sort((a, b) => b[1] - a[1]).slice(0, 6);

  return (
    <div className="max-w-[1560px] mx-auto px-6 py-7 space-y-6">
      <SurfaceIntro eyebrow="Event Timeline · W1400-D4"
        title="Every action, observable and immutable"
        sub="The operational ledger for this organization. Each event is appended with a sequence number and frozen on write — nothing here can be edited or removed. Filter the chain to audit any record, any operator, any action."
        right={<div className="hidden md:flex items-center gap-4 border border-white/10 rounded-md px-4 py-2.5">
          <Stat label="Events" value={events.length} />
          <span className="h-8 w-px bg-white/10" />
          <Stat label="Operator actions" value={manualCount} color="#5ed6a4" />
        </div>} />

      {/* type distribution strip */}
      <Panel>
        <div className="px-5 py-3 flex items-center gap-3 flex-wrap">
          <span className="mono text-[9.5px] uppercase tracking-[0.14em] text-slate-500">Ledger composition</span>
          <div className="flex items-center gap-2 flex-wrap">
            {topTypes.map(([t, n]) => {
              const ET = EVENT_TYPES[t] || {}; const EI = Icon[ET.icon] || Icon.Dot;
              return <span key={t} className="inline-flex items-center gap-1.5 text-[11px] text-slate-400 bg-white/[0.03] rounded-full px-2.5 py-1 border border-white/[0.06]"><EI size={11} className="accent-text" /> {ET.label} <span className="mono text-slate-500">{n}</span></span>;
            })}
          </div>
        </div>
      </Panel>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">
        {/* the chain */}
        <Panel className="overflow-hidden">
          <div className="px-4 py-3 border-b border-white/[0.07] flex items-center gap-2.5 flex-wrap">
            <div className="relative flex-1 min-w-[160px]">
              <Icon.Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search records or details…"
                className="w-full h-8 pl-8 pr-3 bg-white/[0.04] border border-white/10 focus:border-white/30 rounded-md text-[12px] text-slate-100 outline-none placeholder:text-slate-600" />
            </div>
            <TSelect value={typeF} onChange={setTypeF} options={[['all', 'All types'], ...Object.entries(EVENT_TYPES).map(([k, v]) => [k, v.label])]} />
            <TSelect value={actorF} onChange={setActorF} options={[['all', 'All actors'], ['system', 'System / field'], ...TEAM.map(u => [u.id, u.name])]} />
            <button onClick={() => setOnlyManual(v => !v)} className={cn('h-8 px-2.5 rounded-md text-[11.5px] border transition-colors flex items-center gap-1.5', onlyManual ? 'accent-bg text-slate-950 border-transparent' : 'border-white/10 text-slate-300 hover:border-white/25')}>
              <Icon.User size={12} /> Operator only
            </button>
          </div>

          <div className="max-h-[680px] overflow-y-auto scroll-thin">
            {groups.length === 0 && <div className="px-5 py-12 text-center text-[13px] text-slate-500">No events match this filter.</div>}
            {groups.map(g => (
              <div key={g.k}>
                <div className="sticky top-0 z-10 bg-[#11161e]/95 backdrop-blur px-5 py-2 border-b border-white/[0.06] flex items-center justify-between">
                  <span className="mono text-[10px] uppercase tracking-[0.14em] text-slate-400">{dayLabel(g.ts)}</span>
                  <span className="mono text-[9.5px] text-slate-600">{g.items.length} events</span>
                </div>
                <div className="px-5 py-2">
                  {g.items.map((e, i) => <EventRow key={e.id} e={e} last={i === g.items.length - 1} />)}
                </div>
              </div>
            ))}
          </div>
          <div className="px-5 py-2.5 border-t border-white/[0.06] mono text-[10px] text-slate-500 flex items-center justify-between">
            <span>{rows.length} events shown · newest first</span>
            <span className="flex items-center gap-1.5"><Icon.Lock size={11} /> append-only · frozen on write</span>
          </div>
        </Panel>

        {/* immutability explainer */}
        <div className="space-y-6">
          <Panel className="overflow-hidden">
            <div className="p-5" style={{ background: 'linear-gradient(180deg, var(--accent-glow), transparent 70%)' }}>
              <span className="h-10 w-10 rounded-xl flex items-center justify-center accent-soft-bg accent-text mb-3"><Icon.Lock size={18} /></span>
              <div className="text-[14px] font-semibold text-slate-100">Why immutable</div>
              <p className="text-[11.5px] text-slate-400 mt-1.5 leading-snug text-pretty">A workforce decision is only trustworthy if you can prove how it was reached. Every action appends a frozen event with a sequence number and an actor — the record's state is always the sum of its events, and the trail can never be quietly rewritten.</p>
            </div>
            <div className="px-5 py-4 border-t border-white/[0.07] space-y-3">
              {[
                ['Hash', 'Sequenced', 'Monotonic seq per event — gaps are detectable.'],
                ['User', 'Attributed', 'Every action names the operator who took it.'],
                ['Lock', 'Append-only', 'Events are frozen; no edits, no deletes.'],
                ['Repeat', 'Replayable', 'Re-derive any state from the chain alone.'],
              ].map(([ic, t, d]) => {
                const I = Icon[ic] || Icon.Dot;
                return (
                  <div key={t} className="flex items-start gap-2.5">
                    <span className="h-6 w-6 rounded-md flex items-center justify-center accent-soft-bg accent-text flex-shrink-0"><I size={12} /></span>
                    <div><div className="text-[12px] font-medium text-slate-200">{t}</div><div className="text-[10.5px] text-slate-500 leading-snug">{d}</div></div>
                  </div>
                );
              })}
            </div>
          </Panel>

          <Panel>
            <PanelHead icon={Icon.Activity} title="Throughput" sub="last 24h on the ledger" />
            <div className="p-5">
              <ThroughputSpark events={events} />
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function EventRow({ e, last }) {
  const ET = EVENT_TYPES[e.type] || {}; const EI = Icon[ET.icon] || Icon.Dot;
  const tone = { emerald: '#5ed6a4', accent: '#34d8e8', amber: '#f0a93a', rose: '#ec7a9b', slate: '#8b97a8' }[ET.tone] || '#8b97a8';
  const actor = e.actor ? (TEAM.find(t => t.id === e.actor) || {}).name : null;
  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center flex-shrink-0">
        <span className="h-7 w-7 rounded-full flex items-center justify-center" style={{ background: hexA(tone, 0.14), color: tone }}><EI size={13} /></span>
        {!last && <span className="w-px flex-1 bg-white/[0.08] my-1" />}
      </div>
      <div className="min-w-0 flex-1 pb-3.5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[12.5px] font-medium text-slate-100">{ET.label || e.type}</span>
          {e.subject && <button onClick={() => window.openRecord(e.subjectId)} className="text-[11.5px] text-slate-400 hover:accent-text transition-colors">· {e.subject}</button>}
          {!e.actor && <Pill tone="slate">system</Pill>}
        </div>
        <div className="text-[11px] text-slate-500 mt-0.5 text-pretty">{e.detail}</div>
        <div className="flex items-center gap-2 mono text-[9.5px] text-slate-600 mt-1">
          <span className="text-slate-500">#{e.seq}</span>
          <span>·</span>
          {actor ? <span className="flex items-center gap-1"><Avatar userId={e.actor} size={13} /> {actor}</span> : <span>field / automated</span>}
          <span>·</span>
          <span>{clockTime(e.ts)} · {timeAgo(e.ts)}</span>
        </div>
      </div>
    </div>
  );
}

function ThroughputSpark({ events }) {
  // bucket events into the last 12 two-hour windows
  const now = Date.now(), span = 2 * 3600 * 1000, buckets = new Array(12).fill(0);
  events.forEach(e => { const age = now - e.ts; const idx = 11 - Math.floor(age / span); if (idx >= 0 && idx < 12) buckets[idx]++; });
  const max = Math.max(1, ...buckets);
  return (
    <div>
      <div className="flex items-end gap-1.5 h-[70px]">
        {buckets.map((b, i) => (
          <div key={i} className="flex-1 rounded-t" style={{ height: `${Math.max(4, b / max * 100)}%`, background: i === 11 ? 'var(--accent)' : 'var(--accent-soft)', boxShadow: 'inset 0 0 0 1px var(--accent-ring)' }} title={`${b} events`} />
        ))}
      </div>
      <div className="flex items-center justify-between mono text-[9px] text-slate-600 mt-2">
        <span>-24h</span><span>now</span>
      </div>
    </div>
  );
}

function TSelect({ value, onChange, options }) {
  return (
    <div className="relative">
      <select value={value} onChange={e => onChange(e.target.value)}
        className="appearance-none h-8 pl-2.5 pr-7 bg-white/[0.04] border border-white/10 hover:border-white/20 focus:border-white/30 rounded-md text-[11.5px] text-slate-200 outline-none cursor-pointer max-w-[150px]">
        {options.map(([v, l]) => <option key={v} value={v} className="bg-[#141922]">{l}</option>)}
      </select>
      <Icon.ChevronDown size={13} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
    </div>
  );
}

window.ViewTimeline = ViewTimeline;
