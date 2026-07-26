// ════════════════════════════════════════════════════════════════════════
// D4 · CAREER RECOMMENDATIONS — suggested next steps
// Each step is an action → produces evidence → unlocks opportunities.
// Ranked by priority: renew now · high-value gap · growth.
// ════════════════════════════════════════════════════════════════════════

const PRIORITY = {
  now:    { label: 'Do now', chip: 'bg-orange-50 text-orange-700 ring-orange-600/20', dot: 'bg-orange-500', order: 0 },
  high:   { label: 'High value', chip: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20', dot: 'bg-emerald-500', order: 1 },
  med:    { label: 'Worthwhile', chip: 'bg-sky-50 text-sky-700 ring-sky-600/20', dot: 'bg-sky-500', order: 2 },
  growth: { label: 'Growth path', chip: 'bg-slate-100 text-slate-600 ring-slate-300', dot: 'bg-slate-400', order: 3 },
};

function RecCard({ rec, onNav }) {
  const I = Ic[rec.icon];
  const pr = PRIORITY[rec.priority];
  const trustDims = (rec.affects.trust || []).map(id => W.TRUST_DIMENSIONS.find(d => d.id === id)).filter(Boolean);
  return (
    <Card className="overflow-hidden">
      <div className="p-5">
        <div className="flex items-start gap-4">
          <span className="h-11 w-11 rounded-lg bg-slate-900 text-white flex items-center justify-center flex-none"><I size={19} /></span>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-[16px] font-semibold text-slate-900 tracking-[-0.01em] leading-tight">{rec.title}</h3>
                  <span className={ocn('inline-flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.06em] rounded-full ring-1 ring-inset px-1.5 py-0.5', pr.chip)}>
                    <span className={ocn('h-1.5 w-1.5 rounded-full', pr.dot)} /> {pr.label}
                  </span>
                </div>
                <div className="mono text-[10.5px] text-slate-400 uppercase tracking-[0.08em] mt-1">{rec.kind}</div>
              </div>
            </div>
            <p className="text-[13px] text-slate-600 mt-2.5 leading-[1.5] max-w-[60ch]">{rec.why}</p>
          </div>
        </div>

        {/* produces → unlocks: the causal chain */}
        <div className="mt-4 ml-0 sm:ml-15 grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] items-stretch gap-3">
          <div className="rounded-lg bg-slate-50 border border-slate-200 px-3.5 py-3">
            <div className="mono text-[9.5px] uppercase tracking-[0.1em] text-slate-400 mb-1">Produces</div>
            <div className="text-[12.5px] text-slate-700 leading-snug">{rec.produces}</div>
            {trustDims.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {trustDims.map(d => (
                  <span key={d.id} className="inline-flex items-center gap-1 text-[10.5px] text-slate-500">
                    <Ic.Gauge size={10} /> {d.label}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="hidden sm:flex items-center justify-center text-slate-300"><Ic.ArrowRight size={18} /></div>
          <div className={ocn('rounded-lg border px-3.5 py-3', rec.unlocks > 0 ? 'bg-emerald-50/50 border-emerald-200' : 'bg-amber-50/50 border-amber-200')}>
            <div className="mono text-[9.5px] uppercase tracking-[0.1em] text-slate-400 mb-1">{rec.unlocks > 0 ? 'Unlocks' : 'Protects'}</div>
            <div className="flex items-baseline gap-1.5">
              <span className={ocn('text-[22px] font-semibold tabular-nums tracking-[-0.02em]', rec.unlocks > 0 ? 'text-emerald-700' : 'text-amber-700')}>
                {rec.unlocks > 0 ? rec.unlocks : rec.protects}
              </span>
              <span className="text-[12px] text-slate-600">{rec.unlocks > 0 ? 'new opportunities' : 'ready roles kept live'}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="px-5 py-3 bg-slate-50/60 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4 text-[11.5px] text-slate-500">
          <span className="flex items-center gap-1.5"><Ic.Clock size={12} className="text-slate-400" />{rec.effort}</span>
          <span className="flex items-center gap-1.5"><Ic.CreditCard size={12} className="text-slate-400" />{rec.cost}</span>
          <span className="flex items-center gap-1.5"><Ic.Calendar size={12} className="text-slate-400" />{rec.horizon}</span>
        </div>
        <Btn variant="outline" sm iconRight={<Ic.ArrowRight size={13} />}>{rec.cta}</Btn>
      </div>
    </Card>
  );
}

function ViewRecommend({ onNav }) {
  const recs = [...O.RECOMMENDATIONS].sort((a, b) => PRIORITY[a.priority].order - PRIORITY[b.priority].order);
  const totalUnlock = O.RECOMMENDATIONS.reduce((s, r) => s + r.unlocks, 0);
  const s = O.summary();

  return (
    <div>
      <PageHead icon="Compass" route="vitalcv.health/opportunities/next" title="Your next steps"
        sub="The shortest path from where you are to where you’re trying to go. Each step produces real evidence — and evidence is what opens the network."
        actions={<Btn variant="outline" sm iconLeft={<Ic.Briefcase size={14} />} onClick={() => onNav('home')}>Back to opportunities</Btn>} />

      {/* summary band */}
      <Card className="overflow-hidden mb-6">
        <div className="grid grid-cols-12">
          <div className="col-span-12 md:col-span-6 p-6 border-b md:border-b-0 md:border-r border-slate-200">
            <Eyebrow>If you complete these steps</Eyebrow>
            <div className="mt-2 text-[24px] font-semibold text-slate-900 tracking-[-0.02em] leading-[1.2]">
              You could open <span className="text-emerald-600">{totalUnlock}+ opportunities</span> beyond the {s.ready} you’re ready for today.
            </div>
            <p className="text-[12.5px] text-slate-500 mt-3 max-w-[50ch] leading-snug">Steps are ordered by value per hour of effort — protect what’s ready first, then chase the highest-leverage gaps.</p>
          </div>
          <div className="col-span-12 md:col-span-6 grid grid-cols-3 divide-x divide-slate-200">
            {[
              { n: O.RECOMMENDATIONS.filter(r => r.priority === 'now').length, label: 'Do now', I: 'AlertTri', tone: 'text-orange-600' },
              { n: O.RECOMMENDATIONS.filter(r => ['high','med'].includes(r.priority)).length, label: 'High value', I: 'Zap', tone: 'text-emerald-600' },
              { n: O.RECOMMENDATIONS.filter(r => r.priority === 'growth').length, label: 'Growth path', I: 'TrendUp', tone: 'text-slate-500' },
            ].map((c, i) => (
              <div key={i} className="p-5 flex flex-col justify-center">
                <div className="flex items-center gap-1.5 mono text-[9.5px] uppercase tracking-[0.1em] text-slate-400">
                  {React.createElement(Ic[c.I], { size: 12, className: c.tone })} {c.label}
                </div>
                <div className="text-[30px] font-semibold text-slate-900 tracking-[-0.03em] tabular-nums mt-1">{c.n}</div>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* steps */}
      <div className="space-y-3.5">
        {recs.map(rec => <RecCard key={rec.id} rec={rec} onNav={onNav} />)}
      </div>

      <div className="mt-6 flex items-center justify-center">
        <button onClick={() => onNav('growth')} className="inline-flex items-center gap-2 text-[12.5px] text-slate-500 hover:text-slate-900">
          <Ic.TrendUp size={14} /> See how past steps already changed your network <Ic.ArrowRight size={13} />
        </button>
      </div>
    </div>
  );
}

window.ViewRecommend = ViewRecommend;
