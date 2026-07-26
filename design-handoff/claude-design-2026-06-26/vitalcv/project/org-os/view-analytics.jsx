// ════════════════════════════════════════════════════════════════════════
// view-analytics.jsx — D5 · /org/analytics · Executive Analytics
// Time-to-start · Credential throughput · Readiness · Pipeline health · Freshness
// ════════════════════════════════════════════════════════════════════════

function ExecAnalytics({ onNav }) {
  return (
    <div className="space-y-6">
      <SecHead eyebrow="Executive analytics · trailing 8 periods" title="The trend behind the verdict"
        sub="Every metric here is a byproduct of one verified record doing more work. Faster starts, fresher evidence, fuller pipeline." />

      {/* ── headline KPIs ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-slate-200 border border-slate-200 rounded-lg overflow-hidden">
        {ANALYTICS_KPIS.map(k => (
          <div key={k.label} className="bg-white p-5">
            <Eyebrow>{k.label}</Eyebrow>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="text-[34px] font-semibold tracking-[-0.03em] text-slate-900 leading-none">{k.value}</span>
              <span className="text-[13px] text-slate-400 font-medium">{k.unit}</span>
            </div>
            <div className="mt-2.5 flex items-center gap-1.5">
              <span className={cx('inline-flex items-center gap-1 mono text-[11px] font-medium', tone('verified').text)}>
                {k.delta < 0 ? <Icon.TrendDown size={12} /> : <Icon.TrendUp size={12} />}
                {k.delta > 0 ? '+' : ''}{k.delta}%
              </span>
              <span className="text-[11px] text-slate-500">{k.deltaLabel}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-12 gap-5">

        {/* ── Time-to-start ──────────────────────────────────────────────── */}
        <ChartCard span="col-span-12 lg:col-span-7" eyebrow="Days from sourced to start" title="Time-to-start"
          right={<div className="text-right"><div className="text-[24px] font-semibold text-slate-900 leading-none">52<span className="text-[13px] text-slate-400">d</span></div><div className="text-[10.5px] text-slate-500 mt-0.5">median · June</div></div>}>
          <div className="relative">
            {/* baseline marker */}
            <div className="flex items-center justify-between mb-2 text-[10.5px]">
              <span className="mono uppercase tracking-[0.08em] text-slate-400">Lower is better</span>
              <span className="flex items-center gap-1.5 text-slate-500">
                <span className="inline-block w-4 h-px border-t border-dashed border-red-400" /> Industry baseline 119d
              </span>
            </div>
            <div className="relative" style={{ height: 140 }}>
              <div className="absolute inset-x-0" style={{ top: 6 }}>
                <div className="border-t border-dashed border-red-300" />
              </div>
              <Sparkline data={TTS_SERIES} h={140} stroke="#16a34a" fill="rgba(22,163,74,0.07)" />
            </div>
            <div className="flex justify-between mt-1.5">
              {TTS_SERIES.map(d => <span key={d.m} className="mono text-[9.5px] uppercase tracking-[0.04em] text-slate-400">{d.m}</span>)}
            </div>
            <div className="mt-3 pt-3 border-t border-slate-100 text-[11.5px] text-slate-500">
              <span className="text-emerald-700 font-medium">−56% vs industry.</span> Federal evidence is signed once and reused, so committee files open already verified.
            </div>
          </div>
        </ChartCard>

        {/* ── Credential throughput ──────────────────────────────────────── */}
        <ChartCard span="col-span-12 lg:col-span-5" eyebrow="Files cleared per week" title="Credential throughput"
          right={<div className="text-right"><div className="text-[24px] font-semibold text-slate-900 leading-none">27</div><div className="text-[10.5px] text-slate-500 mt-0.5">this week</div></div>}>
          <Bars data={THROUGHPUT} h={148} t="verified" labelKey="w" valKey="v" />
          <div className="mt-3 pt-3 border-t border-slate-100 text-[11.5px] text-slate-500">
            <span className="text-emerald-700 font-medium">+93% since W18.</span> Same MSO headcount, nearly double the cleared files.
          </div>
        </ChartCard>

        {/* ── Provider readiness over time ───────────────────────────────── */}
        <ChartCard span="col-span-12 lg:col-span-5" eyebrow="% of roster ready now" title="Provider readiness"
          right={<div className="text-right"><div className="text-[24px] font-semibold text-emerald-700 leading-none">87<span className="text-[13px] text-slate-400">%</span></div><div className="text-[10.5px] text-slate-500 mt-0.5">June</div></div>}>
          <div style={{ height: 140 }}>
            <Sparkline data={READINESS_SERIES} h={140} stroke="#0f172a" fill="rgba(15,23,42,0.05)" />
          </div>
          <div className="flex justify-between mt-1.5">
            {READINESS_SERIES.map(d => <span key={d.m} className="mono text-[9.5px] uppercase tracking-[0.04em] text-slate-400">{d.m}</span>)}
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 text-[11.5px] text-slate-500">
            <span className="text-emerald-700 font-medium">+13 pts since November.</span> Continuous monitoring catches lapses before they block work.
          </div>
        </ChartCard>

        {/* ── Pipeline health ────────────────────────────────────────────── */}
        <ChartCard span="col-span-12 lg:col-span-7" eyebrow="Candidates by stage" title="Pipeline health"
          right={<ActLink onClick={() => onNav('hiring')}>Command center</ActLink>}>
          <div className="space-y-2.5">
            {PIPELINE.map((s, i) => {
              const max = Math.max(...PIPELINE.map(x => x.count)) || 1;
              const t = i >= 3 ? 'verified' : 'slate';
              return (
                <div key={s.id} className="flex items-center gap-3">
                  <div className="w-28 flex-shrink-0 text-right">
                    <div className="text-[12px] font-medium text-slate-700">{s.label}</div>
                  </div>
                  <div className="flex-1 flex items-center gap-2">
                    <div className="flex-1 h-7 rounded-md bg-slate-100 overflow-hidden">
                      <div className={cx('h-full rounded-md flex items-center justify-end px-2', tone(t).bar)}
                        style={{ width: Math.max(8, (s.count / max) * 100) + '%' }}>
                        <span className="mono text-[11px] font-semibold text-white">{s.count}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 grid grid-cols-3 gap-3">
            <MiniKpi label="Conversion" value="68%" sub="sourced → start" />
            <MiniKpi label="Avg stage age" value="9.5d" sub="across pipeline" />
            <MiniKpi label="Offer accept" value="82%" sub="trailing 90d" />
          </div>
        </ChartCard>

        {/* ── Evidence freshness ─────────────────────────────────────────── */}
        <ChartCard span="col-span-12 lg:col-span-5" eyebrow="Days since last source verify" title="Evidence freshness">
          <div className="space-y-2">
            {FRESHNESS_DIST.map(f => (
              <div key={f.band} className="flex items-center gap-3">
                <span className="w-16 mono text-[11px] text-slate-500 text-right flex-shrink-0">{f.band}</span>
                <div className="flex-1 h-6 rounded-md bg-slate-100 overflow-hidden">
                  <div className={cx('h-full rounded-md', tone(f.tone).bar)} style={{ width: f.pct + '%' }} />
                </div>
                <span className="w-9 mono text-[11.5px] font-medium text-slate-900 text-right flex-shrink-0">{f.pct}%</span>
              </div>
            ))}
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 text-[11.5px] text-slate-500">
            <span className="text-slate-900 font-medium">75% verified within 30 days.</span> The record never goes stale silently — it re-pulls on a schedule.
          </div>
        </ChartCard>

      </div>

      {/* footer note */}
      <div className="flex items-center gap-2 text-[11.5px] text-slate-400 pt-1">
        <Icon.Info size={13} />
        <span>Figures reflect Meridian Health's live roster on VitalCV. Evidence is signed once, owned by the clinician, and verifiable outside the issuer.</span>
      </div>
    </div>
  );
}

function ChartCard({ span, eyebrow, title, right, children }) {
  return (
    <div className={span}>
      <OCard className="h-full flex flex-col">
        <div className="flex items-start justify-between mb-4 gap-3">
          <div>
            <Eyebrow className="mb-1">{eyebrow}</Eyebrow>
            <h3 className="text-[15px] font-semibold text-slate-900 tracking-[-0.01em]">{title}</h3>
          </div>
          {right}
        </div>
        <div className="flex-1">{children}</div>
      </OCard>
    </div>
  );
}

function MiniKpi({ label, value, sub }) {
  return (
    <div>
      <Eyebrow>{label}</Eyebrow>
      <div className="text-[17px] font-semibold text-slate-900 leading-none mt-1">{value}</div>
      <div className="text-[10.5px] text-slate-500 mt-1">{sub}</div>
    </div>
  );
}

window.ExecAnalytics = ExecAnalytics;
