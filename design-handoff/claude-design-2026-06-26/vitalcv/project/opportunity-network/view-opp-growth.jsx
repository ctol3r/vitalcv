// ════════════════════════════════════════════════════════════════════════
// D5 · NETWORK EFFECT SURFACE — career growth feed
// New opportunities unlocked · new evidence recognized · trust milestones.
// The proof that evidence compounds: every verified proof widens the network.
// ════════════════════════════════════════════════════════════════════════

const GROWTH_KIND = {
  unlock:   { label: 'Opportunity unlocked', dot: 'bg-emerald-500', ring: 'ring-emerald-100', icon: 'text-emerald-600', soft: 'bg-emerald-50' },
  evidence: { label: 'Evidence recognized',  dot: 'bg-sky-500',     ring: 'ring-sky-100',     icon: 'text-sky-600',     soft: 'bg-sky-50' },
  trust:    { label: 'Trust milestone',       dot: 'bg-indigo-500',  ring: 'ring-indigo-100',  icon: 'text-indigo-600',  soft: 'bg-indigo-50' },
  network:  { label: 'Network observation',   dot: 'bg-slate-400',   ring: 'ring-slate-100',   icon: 'text-slate-500',   soft: 'bg-slate-100' },
};

function GrowthEvent({ e, first, last }) {
  const k = GROWTH_KIND[e.kind];
  const I = Ic[e.icon];
  return (
    <div className="relative pl-12">
      {/* rail node */}
      <span className={ocn('absolute left-[14px] top-1 h-7 w-7 rounded-full flex items-center justify-center ring-4 ring-white', k.soft)}>
        <I size={14} className={k.icon} />
      </span>
      <div className={ocn('pb-6', last && 'pb-0')}>
        <div className="flex items-center gap-2 flex-wrap">
          <span className={ocn('mono text-[9.5px] uppercase tracking-[0.1em]', k.icon)}>{k.label}</span>
          <span className="mono text-[10.5px] text-slate-400">· {e.date}</span>
        </div>
        <div className="text-[14px] font-semibold text-slate-900 tracking-[-0.01em] mt-1 leading-snug">{e.head}</div>
        <p className="text-[12.5px] text-slate-500 mt-1 leading-[1.5] max-w-[64ch]">{e.body}</p>
        {/* cause → effect chip row */}
        <div className="mt-2.5 flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1.5 rounded-md bg-white border border-slate-200 px-2 py-1 text-[11px] text-slate-600">
            <Ic.ShieldCheck size={11} className="text-slate-400" /> {e.cause}
          </span>
          <Ic.ArrowRight size={13} className="text-slate-300" />
          <span className={ocn('inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium', k.soft, k.icon)}>
            <Ic.Sparkles size={11} /> {e.effect}
          </span>
        </div>
      </div>
    </div>
  );
}

function StatTile({ icon, n, label, sub, tone }) {
  const I = Ic[icon];
  return (
    <div className="p-5 flex flex-col justify-center">
      <div className="flex items-center gap-2">
        <I size={14} className={tone} />
        <span className="mono text-[9.5px] uppercase tracking-[0.1em] text-slate-400">{label}</span>
      </div>
      <div className="flex items-baseline gap-2 mt-1.5">
        <span className="text-[32px] font-semibold text-slate-900 tracking-[-0.03em] tabular-nums leading-none">{n}</span>
        <span className="text-[11.5px] text-slate-500">{sub}</span>
      </div>
    </div>
  );
}

function ViewGrowth({ onNav, onOpen }) {
  const s = O.summary();
  const feed = O.GROWTH;

  return (
    <div>
      <PageHead icon="TrendUp" route="vitalcv.health/opportunities/growth" title="Your career is compounding"
        sub="This is the network effect made visible: every proof you verify is recognized, lifts your trust, and widens the set of opportunities that find you."
        actions={<Btn variant="outline" sm iconLeft={<Ic.Compass size={14} />} onClick={() => onNav('recommend')}>What’s next</Btn>} />

      {/* network-effect stat band */}
      <Card className="overflow-hidden mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-slate-200">
          <StatTile icon="Unlock" n={`+${s.unlockedThisMonth}`} label="Opportunities unlocked" sub="this month" tone="text-emerald-600" />
          <StatTile icon="ShieldCheck" n={s.evidenceRecognized} label="Evidence recognized" sub="verified proofs" tone="text-sky-600" />
          <StatTile icon="Gauge" n={s.trustMilestones} label="Trust milestones" sub="dimensions strong" tone="text-indigo-600" />
        </div>
      </Card>

      <div className="grid grid-cols-12 gap-6">
        {/* feed */}
        <div className="col-span-12 lg:col-span-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[13px] font-semibold text-slate-700">Growth feed</h2>
            <span className="mono text-[10.5px] text-slate-400 uppercase tracking-[0.08em]">newest first</span>
          </div>
          <Card className="p-5">
            <div className="relative">
              <div className="absolute left-[27px] top-2 bottom-2 w-px bg-slate-200" />
              {feed.map((e, i) => (
                <GrowthEvent key={e.id} e={e} first={i === 0} last={i === feed.length - 1} />
              ))}
            </div>
          </Card>
        </div>

        {/* right rail */}
        <div className="col-span-12 lg:col-span-4 space-y-6">
          {/* how the network grows */}
          <Card className="overflow-hidden">
            <SecHead icon="Network" title="How your network grows" />
            <div className="px-5 py-4 space-y-3.5">
              {[
                { I: 'ShieldCheck', t: 'You verify a proof', d: 'A source of record confirms a credential into your owned ledger.' },
                { I: 'Gauge', t: 'Your trust lifts', d: 'The matching dimension rises against the field median.' },
                { I: 'Unlock', t: 'Roles open to you', d: 'Opportunities that needed that proof now project as ready.' },
                { I: 'Network', t: 'Systems observe you', d: 'Each re-use is a cross-observation that compounds standing.' },
              ].map((step, i) => (
                <div key={i} className="flex items-start gap-3">
                  <span className="mono text-[10px] text-slate-400 mt-0.5 w-4 flex-none">{i + 1}</span>
                  <span className="h-7 w-7 rounded-md bg-slate-100 flex items-center justify-center flex-none">
                    {React.createElement(Ic[step.I], { size: 14, className: 'text-slate-600' })}
                  </span>
                  <div className="min-w-0">
                    <div className="text-[12.5px] font-medium text-slate-800 leading-tight">{step.t}</div>
                    <div className="text-[11.5px] text-slate-500 leading-snug mt-0.5">{step.d}</div>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* next unlock teaser */}
          <Card className="overflow-hidden">
            <SecHead icon="Zap" title="Your next unlock" />
            <div className="px-5 py-4">
              <div className="text-[13px] text-slate-700 leading-snug">
                Verify your <span className="font-semibold text-slate-900">DEA registration</span> and the network projects <span className="font-semibold text-emerald-700">32 new first-assist roles</span> as ready — the single highest-leverage step available to you.
              </div>
              <button onClick={() => onNav('recommend')} className="mt-3 inline-flex items-center gap-1.5 text-[12px] font-medium text-slate-700 hover:text-slate-900">
                <Ic.Compass size={13} /> See the step <Ic.ArrowRight size={13} />
              </button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

window.ViewGrowth = ViewGrowth;
