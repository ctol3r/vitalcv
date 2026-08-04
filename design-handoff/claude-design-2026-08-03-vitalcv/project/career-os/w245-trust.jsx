// W245 · D4 — Trust experience (/career/trust)
// Trust Origins (where belief comes from) · Trust Dimensions (how it's computed) · Trust History (the audit trail).

const TIER_META = {
  T4: { label: 'T4 · Primary-sealed', chip: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20', desc: 'Cryptographically sealed by the issuing authority' },
  T3: { label: 'T3 · Authority-direct', chip: 'bg-slate-100 text-slate-700 ring-slate-300', desc: 'Read directly from the issuing or state authority' },
  T2: { label: 'T2 · Program-attested', chip: 'bg-slate-100 text-slate-600 ring-slate-300', desc: 'Attested by an affiliated program or institution' },
};

function ViewTrust({ entity }) {
  const sources = window.EVIDENCE_SOURCES;
  const dims = window.TRUST_DIMENSIONS;
  const history = window.TRUST_HISTORY;
  const h = computeHealth();

  // group sources by tier
  const tiers = ['T4', 'T3', 'T2'];
  const byTier = tiers.map(t => ({ tier: t, items: sources.filter(s => s.tier === t) })).filter(g => g.items.length);

  const histKind = {
    refresh:     { label: 'Re-read',      Icon: Icon.Activity },
    corroborate: { label: 'Corroborated', Icon: Icon.CheckCircle },
    decay:       { label: 'Freshness',    Icon: Icon.Clock },
    network:     { label: 'Federated',    Icon: Icon.Network },
    resolve:     { label: 'Resolved',     Icon: Icon.Info },
  };

  return (
    <div className="max-w-[1340px] mx-auto px-6 py-9 space-y-9">
      {/* Header */}
      <div className="rise grid lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-8">
          <Eyebrow className="mb-2">Career OS · Trust</Eyebrow>
          <h1 className="text-[26px] font-semibold tracking-[-0.02em] text-slate-900 leading-tight">How trusted is this record — and why</h1>
          <p className="text-[13px] text-slate-600 leading-[1.6] max-w-[80ch] mt-2">
            Trust is not a badge VitalCV grants — it is the belief evidence earns from its own sources. This is where that belief originates, the four axes it is computed along, and the full audit trail of every re-read.
          </p>
        </div>
        <div className="lg:col-span-4">
          <div className="border border-slate-200 rounded-xl bg-slate-950 text-white p-5">
            <div className="flex items-center gap-2 mb-3">
              <Icon.ShieldCheck size={15} className="text-emerald-400" />
              <span className="mono text-[10px] uppercase tracking-[0.14em] text-slate-400">Trust strength</span>
            </div>
            <div className="flex items-end gap-2">
              <span className="text-[40px] font-semibold tracking-[-0.03em] leading-none tabular-nums">{h.trustStrength}</span>
              <span className="mono text-[11px] text-slate-400 mb-1.5">/ 100 · high</span>
            </div>
            <p className="text-[11.5px] text-slate-400 leading-snug mt-3">
              Computed live from provenance, corroboration, freshness, and coverage. Every point traces to a primary source — none is asserted.
            </p>
          </div>
        </div>
      </div>

      {/* Trust Dimensions */}
      <section className="rise" style={{ animationDelay: '60ms' }}>
        <SectionHeader n="01" title="Trust dimensions" sub="The four axes belief is computed along — distinct from what a clinician is credible at." right="how trust is built" />
        <div className="grid sm:grid-cols-2 gap-4">
          {dims.map(d => (
            <div key={d.key} className="border border-slate-200 rounded-lg bg-white p-5">
              <div className="flex items-center justify-between gap-3 mb-2">
                <span className="text-[14px] font-semibold text-slate-900">{d.label}</span>
                <span className="mono text-[13px] text-slate-900 tabular-nums">{d.value}</span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-600 rounded-full" style={{ width: `${d.value}%` }} />
              </div>
              <p className="text-[11.5px] text-slate-500 leading-snug mt-3">{d.blurb}</p>
              <div className="mono text-[10px] text-slate-700 mt-2.5 inline-flex items-center gap-1.5">
                <Icon.Check size={12} className="text-emerald-600" />{d.note}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Trust Origins */}
      <section className="rise" style={{ animationDelay: '120ms' }}>
        <SectionHeader n="02" title="Trust origins" sub="Where belief comes from — the primary sources that feed every dimension, by tier." right={`${sources.length} sources`} />
        <div className="space-y-5">
          {byTier.map(g => {
            const tm = TIER_META[g.tier];
            return (
              <div key={g.tier}>
                <div className="flex items-center gap-3 mb-2.5">
                  <span className={cn('mono text-[9.5px] uppercase tracking-[0.1em] font-medium rounded-full ring-1 ring-inset px-2 py-1', tm.chip)}>{tm.label}</span>
                  <span className="text-[11.5px] text-slate-500">{tm.desc}</span>
                </div>
                <div className="border border-slate-200 rounded-lg bg-white overflow-hidden divide-y divide-slate-100">
                  {g.items.map(s => {
                    const gated = s.state === 'access';
                    return (
                      <div key={s.id} className="px-5 py-3.5 flex items-center gap-4 flex-wrap">
                        <div className={cn('h-9 w-9 rounded-md ring-1 ring-inset flex items-center justify-center flex-shrink-0',
                          gated ? 'bg-indigo-50 ring-indigo-600/20' : 'bg-slate-50 ring-slate-200')}>
                          {gated ? <Icon.Lock size={15} className="text-indigo-700" /> : <Icon.Globe size={15} className="text-slate-700" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-[13px] font-semibold text-slate-900">{s.label}</div>
                          <div className="text-[11px] text-slate-500 mt-0.5">{s.authority}</div>
                        </div>
                        <div className="hidden md:flex items-center gap-1.5 flex-wrap max-w-[220px]">
                          {s.feeds.map(f => (
                            <span key={f} className="mono text-[9px] uppercase tracking-[0.06em] text-slate-600 bg-slate-50 ring-1 ring-inset ring-slate-200 rounded px-1.5 py-0.5">
                              {(window.DIM[f] && window.DIM[f].label) || f}
                            </span>
                          ))}
                        </div>
                        <div className="text-right min-w-[88px]">
                          <div className="mono text-[10px] text-slate-400 uppercase tracking-[0.1em]">Last read</div>
                          <div className="text-[11.5px] text-slate-700 mt-0.5">{s.last}</div>
                        </div>
                        {gated
                          ? <Chip state="access" size="sm" />
                          : <span className="mono text-[10px] text-slate-500 tabular-nums flex-shrink-0">{s.count} fact{s.count !== 1 ? 's' : ''}</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Trust History */}
      <section className="rise" style={{ animationDelay: '180ms' }}>
        <SectionHeader n="03" title="Trust history" sub="Every re-read, corroboration, and freshness check — the audit trail belief is built on." right={`${history.length} entries`} />
        <div className="border border-slate-200 rounded-lg bg-white divide-y divide-slate-100">
          {history.map((hh, i) => {
            const k = histKind[hh.kind] || histKind.refresh;
            const KI = k.Icon;
            const tone = { ok: 'text-emerald-600', warn: 'text-amber-600', info: 'text-indigo-600', muted: 'text-slate-400' }[hh.tone];
            return (
              <div key={i} className="px-5 py-3.5 flex items-start gap-3.5">
                <div className="h-8 w-8 rounded-md bg-slate-50 ring-1 ring-inset ring-slate-200 flex items-center justify-center flex-shrink-0">
                  <KI size={15} className={tone} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[12.5px] font-semibold text-slate-900">{hh.source}</span>
                    <span className="mono text-[9px] uppercase tracking-[0.1em] text-slate-400">{k.label}</span>
                    <span className="mono text-[10px] text-slate-400 ml-auto tabular-nums">{hh.t}</span>
                  </div>
                  <p className="text-[12px] text-slate-600 leading-snug mt-0.5">{hh.msg}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <div className="border-t border-slate-200 pt-5 text-center">
        <p className="text-[12px] text-slate-500 max-w-[68ch] mx-auto leading-[1.6]">
          Trust here is <span className="text-slate-900 font-medium">earned from sources, decays with time, and is re-read continuously</span> — never a static stamp. That is why a clinician's record can be trusted at a hospital's front door.
        </p>
      </div>
    </div>
  );
}

window.ViewTrust = ViewTrust;
