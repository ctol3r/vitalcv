// ════════════════════════════════════════════════════════════════════════
// W265-D3 · ORGANIZATION TRUST — /organizations/[id]/trust
// Verification sources · Trust indicators · Freshness indicators
// Trust is projected from source-bound verification, never one stored score.
// ════════════════════════════════════════════════════════════════════════

function FreshBar({ pct, state }) {
  const fill = state === 'verified' ? 'bg-emerald-500' : state === 'aging' ? 'bg-amber-500' : state === 'expiring' ? 'bg-orange-500' : 'bg-slate-300';
  return (
    <div className="relative w-full rounded-full bg-slate-100 overflow-hidden h-1.5">
      <div className={gcn('absolute inset-y-0 left-0 rounded-full transition-all duration-700', fill)} style={{ width: pct + '%' }} />
    </div>
  );
}

function SourceRow({ s }) {
  const st = G.TRUST_STATE[s.state] || G.TRUST_STATE.verified;
  return (
    <div className="px-5 py-3.5 border-b border-slate-100 last:border-0">
      <div className="flex items-start gap-3">
        <span className={gcn('h-9 w-9 rounded-md flex items-center justify-center flex-none mt-0.5',
          s.state === 'verified' ? 'bg-emerald-50 text-emerald-600' : s.state === 'expiring' ? 'bg-orange-50 text-orange-600' : 'bg-amber-50 text-amber-600')}>
          <Ic.ShieldCheck size={16} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[13px] font-semibold text-slate-900 leading-tight">{s.name}</span>
            <TierBadge tier={s.tier} sm />
          </div>
          <div className="text-[11.5px] text-slate-500 leading-tight mt-0.5">{s.org}</div>
          <div className="text-[11.5px] text-slate-600 mt-1">Confirms <span className="text-slate-800">{s.confirms}</span></div>
        </div>
        <div className="flex-none text-right">
          <div className={gcn('mono text-[11px] tabular-nums', st.text)}>{s.last}</div>
          <div className="mono text-[10px] text-slate-400 mt-0.5">{s.cadence}</div>
        </div>
      </div>
      <div className="mt-2.5 flex items-center gap-3">
        <FreshBar pct={s.fresh} state={s.state} />
        <span className="mono text-[10.5px] text-slate-400 tabular-nums flex-none w-[58px] text-right">{s.fresh}% fresh</span>
      </div>
    </div>
  );
}

function IndicatorRow({ ind }) {
  const st = G.TRUST_STATE[ind.state] || G.TRUST_STATE.strong;
  return (
    <div className="flex items-start gap-3 px-5 py-3.5 border-b border-slate-100 last:border-0">
      <span className={gcn('h-2 w-2 rounded-full flex-none mt-1.5', st.dot, ind.state === 'expiring' && 'pulse-soft')} />
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-medium text-slate-900 leading-tight">{ind.label}</div>
        <div className="text-[11.5px] text-slate-500 leading-snug mt-0.5">{ind.note}</div>
      </div>
      <div className="flex-none text-right">
        <div className={gcn('text-[11px] font-medium', st.text)}>{st.label}</div>
        <div className="mono text-[10.5px] text-slate-400 mt-0.5">{ind.value}</div>
      </div>
    </div>
  );
}

const FRESH_TONE = {
  ok: 'text-emerald-500', warn: 'text-orange-500', info: 'text-sky-500', muted: 'text-slate-300',
};

function ViewTrust({ org, onNav }) {
  const strong = G.TRUST_INDICATORS.filter(i => i.state === 'strong').length;
  const attention = G.TRUST_INDICATORS.length - strong;
  const verifiedSources = G.TRUST_SOURCES.filter(s => s.state === 'verified').length;

  return (
    <div>
      <PageHead icon="ShieldCheck" route={`organizations/${org.id}/trust`} title={`${org.short} · Organization trust`}
        sub="Trust is a profile, not a number. Each indicator projects from a primary source with its own freshness — the only thing measured is how current the evidence is."
        actions={<Btn variant="outline" sm iconLeft={<Ic.ArrowLeft size={14} />} onClick={() => onNav('profile')}>Profile</Btn>} />

      {/* headline */}
      <Card className="overflow-hidden mb-6">
        <div className="grid grid-cols-12">
          <div className="col-span-12 md:col-span-7 p-6 border-b md:border-b-0 md:border-r border-slate-200">
            <Eyebrow>Trust standing</Eyebrow>
            <div className="mt-2 text-[24px] sm:text-[27px] font-semibold text-slate-900 tracking-[-0.02em] leading-[1.18]">
              Identity, enrollment and accreditation are <span className="text-emerald-600">verified</span> at primary source.
            </div>
            <p className="text-[13px] text-slate-500 mt-3 max-w-[54ch] leading-snug">
              One recognition — the ACS Level II trauma verification — renews in 49 days and is the only signal asking for attention.
            </p>
          </div>
          <div className="col-span-12 md:col-span-5 grid grid-cols-3 divide-x divide-slate-200">
            {[
              { n: verifiedSources, label: 'Sources verified', dot: 'bg-emerald-500', text: 'text-emerald-700' },
              { n: strong, label: 'Indicators strong', dot: 'bg-emerald-500', text: 'text-emerald-700' },
              { n: attention, label: 'Need attention', dot: 'bg-amber-500', text: 'text-amber-700' },
            ].map((c, i) => (
              <div key={i} className="p-5 flex flex-col justify-center">
                <div className="flex items-center gap-1.5">
                  <span className={gcn('h-1.5 w-1.5 rounded-full', c.dot)} />
                  <span className="mono text-[9px] uppercase tracking-[0.08em] text-slate-400">{c.label}</span>
                </div>
                <div className={gcn('text-[32px] font-semibold tracking-[-0.03em] tabular-nums mt-1', c.text)}>{c.n}</div>
              </div>
            ))}
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-12 gap-6">
        {/* verification sources */}
        <div className="col-span-12 lg:col-span-7 space-y-6">
          <Card>
            <SecHead icon="Layers" title="Verification sources" sub="Authorities that confirm this organization, with live freshness" />
            <div>{G.TRUST_SOURCES.map(s => <SourceRow key={s.id} s={s} />)}</div>
          </Card>
        </div>

        {/* indicators + freshness */}
        <div className="col-span-12 lg:col-span-5 space-y-6">
          <Card>
            <SecHead icon="Gauge" title="Trust indicators" sub="Projected signals, not a score" />
            <div>{G.TRUST_INDICATORS.map(ind => <IndicatorRow key={ind.id} ind={ind} />)}</div>
          </Card>

          <Card>
            <SecHead icon="Clock" title="Freshness ledger" sub="Recent verification events" />
            <div className="px-5 py-4 space-y-3.5">
              {G.FRESHNESS.map((f, i) => (
                <div key={i} className="flex items-start gap-3">
                  <Ic.Dot size={14} className={gcn('flex-none mt-0.5', FRESH_TONE[f.tone])} />
                  <div className="min-w-0">
                    <div className="text-[12px] text-slate-700 leading-snug">{f.msg}</div>
                    <div className="mono text-[10px] text-slate-400 mt-1 flex items-center gap-1.5">
                      <span>{f.t}</span><span className="text-slate-300">·</span><span className="text-slate-500">{f.src}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="bg-slate-50/60">
            <div className="p-5">
              <div className="flex items-center gap-2 text-slate-700">
                <Ic.Info size={15} />
                <span className="text-[12.5px] font-semibold">Why no trust score</span>
              </div>
              <p className="text-[12px] text-slate-500 mt-2 leading-relaxed">
                A single number would collapse independent signals into a guess. VitalCV keeps each authority distinct so a buyer can replay exactly what was checked, by whom, and how recently.
              </p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

window.ViewTrust = ViewTrust;
