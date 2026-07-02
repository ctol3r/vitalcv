// ════════════════════════════════════════════════════════════════════════
// D3 · MY TIMELINE — your career of record. Career · Recognition · Trust events,
// every one source-bound. The owned ledger reputation is projected from.
// ════════════════════════════════════════════════════════════════════════

const KIND_META = {
  career:      { label: 'Career',      dot: 'bg-slate-900',   icon: 'Building', text: 'text-slate-700' },
  recognition: { label: 'Recognition', dot: 'bg-indigo-500',  icon: 'Award',    text: 'text-indigo-700' },
  trust:       { label: 'Trust',       dot: 'bg-emerald-500', icon: 'ShieldCheck', text: 'text-emerald-700' },
};

function ViewTimeline() {
  const [kind, setKind] = React.useState('all');
  const counts = {
    all: W.TIMELINE.length,
    career: W.TIMELINE.filter(t => t.kind === 'career').length,
    recognition: W.TIMELINE.filter(t => t.kind === 'recognition').length,
    trust: W.TIMELINE.filter(t => t.kind === 'trust').length,
  };
  const list = kind === 'all' ? W.TIMELINE : W.TIMELINE.filter(t => t.kind === kind);

  // group by year
  const years = [];
  list.forEach(t => {
    let g = years.find(y => y.year === t.year);
    if (!g) { g = { year: t.year, items: [] }; years.push(g); }
    g.items.push(t);
  });

  return (
    <div>
      <PageHead icon="Activity" route="vitalcv.health/wallet/timeline" title="My Timeline"
        sub="Career milestones, conferred recognition, and verification events — in one owned record."
        actions={<Btn variant="outline" sm iconLeft={<Ic.Download size={14} />}>Export timeline</Btn>} />

      {/* kind filter */}
      <div className="flex flex-wrap items-center gap-2 mb-6">
        <FilterPill id="all" cur={kind} set={setKind} label="All" n={counts.all} />
        {Object.entries(KIND_META).map(([id, m]) => (
          <FilterPill key={id} id={id} cur={kind} set={setKind} label={`${m.label} Events`} n={counts[id]} dot={m.dot} />
        ))}
      </div>

      <div className="grid grid-cols-12 gap-8">
        {/* timeline */}
        <div className="col-span-12 lg:col-span-8">
          {years.map(g => (
            <div key={g.year} className="mb-2">
              <div className="flex items-center gap-3 mb-3">
                <div className="mono text-[12px] font-semibold text-slate-900 tracking-[0.04em]">{g.year}</div>
                <div className="flex-1 h-px bg-slate-200" />
                <div className="mono text-[10px] text-slate-400">{g.items.length} event{g.items.length !== 1 && 's'}</div>
              </div>
              <div className="relative pl-7 pb-5">
                <div className="absolute left-[9px] top-1 bottom-3 w-px bg-slate-200" />
                {g.items.map(t => {
                  const m = KIND_META[t.kind]; const I = Ic[m.icon];
                  return (
                    <div key={t.id} className="relative pb-5 last:pb-0 group">
                      <span className={wcn('absolute -left-7 top-0.5 h-[18px] w-[18px] rounded-full ring-4 ring-white flex items-center justify-center', m.dot)}>
                        <I size={9} className="text-white" strokeWidth={2.5} />
                      </span>
                      <div className="border border-slate-200 rounded-lg px-4 py-3 bg-white group-hover:border-slate-300 transition-colors">
                        <div className="flex items-start justify-between gap-3">
                          <div className="text-[14px] font-semibold text-slate-900 leading-tight">{t.title}</div>
                          <div className="mono text-[10.5px] text-slate-400 flex-none mt-0.5">{t.date}</div>
                        </div>
                        <div className="text-[12.5px] text-slate-600 mt-1 leading-snug">{t.detail}</div>
                        <div className="flex items-center gap-2 mt-2.5">
                          <span className={wcn('mono text-[9.5px] uppercase tracking-[0.1em]', m.text)}>{m.label}</span>
                          <span className="text-slate-300">·</span>
                          <span className="mono text-[10px] text-slate-400">{t.source}</span>
                          <TierBadge tier={t.tier} sm />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* side: legend + how-it-works */}
        <div className="col-span-12 lg:col-span-4 space-y-5">
          <Card className="p-5">
            <div className="flex items-center gap-2 mb-3"><Ic.Layers size={15} className="text-slate-700" /><div className="text-[13px] font-semibold text-slate-900">Three kinds of event</div></div>
            <div className="space-y-3">
              {Object.entries(KIND_META).map(([id, m]) => (
                <div key={id} className="flex items-start gap-2.5">
                  <span className={wcn('mt-1 h-2.5 w-2.5 rounded-full flex-none', m.dot)} />
                  <div>
                    <div className="text-[12.5px] font-medium text-slate-900">{m.label} events</div>
                    <div className="text-[11.5px] text-slate-500 leading-snug">{EVENT_DESC[id]}</div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
          <Card className="p-5">
            <div className="flex items-center gap-2 mb-2"><Ic.Wallet size={15} className="text-slate-700" /><div className="text-[13px] font-semibold text-slate-900">This record is yours</div></div>
            <p className="text-[12.5px] text-slate-600 leading-[1.55]">No employer keeps this. It is projected from evidence you own, so it <span className="text-slate-900 font-medium">survives every job change</span> — it recomputes, it never resets.</p>
          </Card>
        </div>
      </div>
    </div>
  );
}

const EVENT_DESC = {
  career: 'Jobs, training, enumeration — the facts of where you have practiced.',
  recognition: 'Certifications and honors a third party conferred — never self-claimed.',
  trust: 'Verifications passed and standing held — the ledger staying fresh.',
};

function FilterPill({ id, cur, set, label, n, dot }) {
  const on = cur === id;
  return (
    <button onClick={() => set(id)}
      className={wcn('inline-flex items-center gap-2 h-8 px-3 rounded-md border text-[12.5px] font-medium transition-colors',
        on ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-300 hover:border-slate-400')}>
      {dot && <span className={wcn('h-1.5 w-1.5 rounded-full', dot)} />}
      {label}
      <span className={wcn('mono text-[10px]', on ? 'text-slate-300' : 'text-slate-400')}>{n}</span>
    </button>
  );
}

window.ViewTimeline = ViewTimeline;
