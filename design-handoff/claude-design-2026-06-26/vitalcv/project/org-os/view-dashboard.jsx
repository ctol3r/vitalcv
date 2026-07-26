// ════════════════════════════════════════════════════════════════════════
// view-dashboard.jsx — D1 · /org · Organization Dashboard
// The 30-second verdict: "Is my workforce ready?"
// ════════════════════════════════════════════════════════════════════════

function OrgDashboard({ onNav }) {
  const R = READINESS;
  const segs = [
    { t: 'ready', value: R.ready, label: 'Ready' },
    { t: 'watch', value: R.watch, label: 'Watch' },
    { t: 'gap', value: R.gap, label: 'Action needed' },
    { t: 'blocked', value: R.blocked, label: 'Blocked' },
  ];

  return (
    <div className="space-y-7">

      {/* ── VERDICT HERO ─────────────────────────────────────────────── */}
      <OCard pad={false} className="overflow-hidden">
        <div className="grid grid-cols-12">
          {/* answer */}
          <div className="col-span-12 lg:col-span-8 p-7 lg:border-r border-slate-200">
            <div className="flex items-center gap-2 mb-4">
              <span className="h-2 w-2 rounded-full bg-emerald-600" />
              <Eyebrow>Workforce readiness · live · {NOW_LABEL}</Eyebrow>
            </div>
            <div className="flex items-start gap-6 flex-wrap">
              <Gauge value={VERDICT.pct} t={VERDICT.tone} label="ready now" size={140} />
              <div className="flex-1 min-w-[280px]">
                <h1 className="text-[30px] font-semibold tracking-[-0.02em] text-slate-900 leading-[1.08]">
                  {VERDICT.headline}.
                </h1>
                <p className="text-[14px] text-slate-600 mt-2.5 leading-relaxed max-w-[520px]">
                  {VERDICT.line}
                </p>
                <div className="mt-5">
                  <div className="flex items-center justify-between mb-1.5">
                    <Eyebrow>Roster composition · {ORG.totalProviders} providers</Eyebrow>
                  </div>
                  <StackBar segments={segs} h="h-3.5" />
                  <div className="flex flex-wrap gap-x-5 gap-y-1.5 mt-2.5">
                    {segs.map(s => (
                      <div key={s.label} className="flex items-center gap-1.5">
                        <span className={cx('h-2 w-2 rounded-full', tone(s.t).dot)} />
                        <span className="text-[12px] text-slate-600">{s.label}</span>
                        <span className="mono text-[12px] font-medium text-slate-900 tabular-nums">{s.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
          {/* the two numbers that matter */}
          <div className="col-span-12 lg:col-span-4 grid grid-rows-2 divide-y divide-slate-200">
            <button onClick={() => onNav('workforce')} className="text-left p-6 hover:bg-slate-50 transition-colors group">
              <Eyebrow>Cannot work today</Eyebrow>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-[40px] font-semibold tracking-[-0.03em] text-red-700 leading-none">{R.blocked}</span>
                <span className="text-[13px] text-slate-500">providers blocked</span>
              </div>
              <div className="mt-3 flex items-center gap-1.5 text-[11.5px] text-slate-500 group-hover:text-slate-900">
                Expired license · exclusion · suspension <Icon.ArrowRight size={12} />
              </div>
            </button>
            <button onClick={() => onNav('workforce')} className="text-left p-6 hover:bg-slate-50 transition-colors group">
              <Eyebrow>Need action this week</Eyebrow>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-[40px] font-semibold tracking-[-0.03em] text-orange-700 leading-none">{R.gap}</span>
                <span className="text-[13px] text-slate-500">credential gaps</span>
              </div>
              <div className="mt-3 flex items-center gap-1.5 text-[11.5px] text-slate-500 group-hover:text-slate-900">
                Stale evidence · missing DEA · CME <Icon.ArrowRight size={12} />
              </div>
            </button>
          </div>
        </div>
      </OCard>

      {/* ── OVERVIEW GRID ────────────────────────────────────────────── */}
      <div>
        <SecHead eyebrow="At a glance" title="Organization overview"
          sub="Six surfaces, one source of truth. Every number traces to a signed federal record owned by the clinician." />
        <div className="grid grid-cols-12 gap-4">

          {/* Provider Readiness */}
          <OverviewTile span="lg:col-span-4" icon={Icon.Gauge} title="Provider Readiness" onNav={() => onNav('providers')} cta="Open directory">
            <div className="flex items-end justify-between">
              <div>
                <div className="text-[32px] font-semibold tracking-[-0.02em] text-slate-900 leading-none">{R.readyPct}%</div>
                <div className="text-[12px] text-slate-500 mt-1.5">{R.ready} of {ORG.totalProviders} ready now</div>
              </div>
              <div className="w-[120px]"><Sparkline data={READINESS_SERIES} h={44} stroke="#16a34a" fill="rgba(22,163,74,0.08)" /></div>
            </div>
            <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-1.5 text-[11.5px]">
              <Icon.TrendUp size={13} className="text-emerald-600" />
              <span className="text-slate-600">+13 pts since November</span>
            </div>
          </OverviewTile>

          {/* Hiring Pipeline */}
          <OverviewTile span="lg:col-span-4" icon={Icon.Briefcase} title="Hiring Pipeline" onNav={() => onNav('hiring')} cta="Command center">
            <div className="text-[32px] font-semibold tracking-[-0.02em] text-slate-900 leading-none">{CANDIDATES.length}</div>
            <div className="text-[12px] text-slate-500 mt-1.5">candidates in flight</div>
            <div className="mt-3 flex items-center gap-1">
              {PIPELINE.map(s => (
                <div key={s.id} className="flex-1 text-center">
                  <div className={cx('h-7 rounded-[3px] flex items-center justify-center mono text-[12px] font-medium',
                    s.count ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-400')}>{s.count}</div>
                  <div className="text-[8.5px] mono uppercase tracking-[0.04em] text-slate-400 mt-1 leading-tight">{s.label.split(' ')[0]}</div>
                </div>
              ))}
            </div>
          </OverviewTile>

          {/* Credential Health */}
          <OverviewTile span="lg:col-span-4" icon={Icon.ShieldCheck} title="Credential Health" onNav={() => onNav('workforce')} cta="Workforce health">
            <div className="flex items-end justify-between">
              <div>
                <div className="text-[32px] font-semibold tracking-[-0.02em] text-slate-900 leading-none">75<span className="text-[16px] text-slate-400">%</span></div>
                <div className="text-[12px] text-slate-500 mt-1.5">evidence verified &lt; 30 days</div>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-slate-100 grid grid-cols-2 gap-2">
              <MiniStat n={EXPIRING.length} label="licenses expiring ≤120d" t="watch" />
              <MiniStat n={CRED_GAPS.length} label="open credential gaps" t="gap" />
            </div>
          </OverviewTile>

          {/* Trust Score */}
          <OverviewTile span="lg:col-span-4" icon={Icon.Fingerprint} title="Trust Score" onNav={() => onNav('analytics')} cta="Analytics">
            <div className="flex items-end justify-between">
              <div>
                <div className="text-[32px] font-semibold tracking-[-0.02em] text-emerald-700 leading-none">
                  {Math.round(PROVIDERS.reduce((s, p) => s + p.trust, 0) / PROVIDERS.length)}
                </div>
                <div className="text-[12px] text-slate-500 mt-1.5">org composite · federal-backed</div>
              </div>
              <Pill t="verified" dot={false}>92nd pctl</Pill>
            </div>
            <div className="mt-3 pt-3 border-t border-slate-100 text-[11.5px] text-slate-500 leading-snug">
              Source confirmation × evidence depth × continuity. Verifiable outside Meridian.
            </div>
          </OverviewTile>

          {/* Compliance Status */}
          <OverviewTile span="lg:col-span-4" icon={Icon.ClipboardCheck} title="Compliance Status" onNav={() => onNav('workforce')} cta="Detail">
            <div className="space-y-2 mt-0.5">
              <ComplianceRow label="OIG / LEIE exclusions" value="0 hits" t="verified" />
              <ComplianceRow label="PECOS / Medicare enrolled" value="838 / 842" t="verified" />
              <ComplianceRow label="Active license on file" value="841 / 842" t="watch" />
              <ComplianceRow label="NCQA CR §3 ruleset" value="Enforced" t="verified" />
            </div>
          </OverviewTile>

          {/* Upcoming Risks */}
          <OverviewTile span="lg:col-span-4" icon={Icon.AlertTri} title="Upcoming Risks" onNav={() => onNav('workforce')} cta="Mitigate">
            <div className="flex items-end gap-2">
              <span className="text-[32px] font-semibold tracking-[-0.02em] text-slate-900 leading-none">{RISKS.length}</span>
              <span className="text-[12px] text-slate-500 mb-1">flagged · {RISKS.filter(r => r.sev === 'high').length} high severity</span>
            </div>
            <div className="mt-3 pt-3 border-t border-slate-100 space-y-1.5">
              {RISKS.slice(0, 2).map((r, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className={cx('h-1.5 w-1.5 rounded-full mt-1.5 flex-shrink-0', tone(r.sev).dot)} />
                  <span className="text-[11.5px] text-slate-600 leading-snug">{r.title}</span>
                </div>
              ))}
            </div>
          </OverviewTile>

        </div>
      </div>

      {/* ── UPCOMING RISKS detail ───────────────────────────────────── */}
      <div>
        <SecHead eyebrow="Next 72 hours" title="Upcoming risks"
          right={<ActLink onClick={() => onNav('workforce')}>All workforce health</ActLink>} />
        <OCard pad={false} className="overflow-hidden divide-y divide-slate-100">
          {RISKS.map((r, i) => (
            <div key={i} className="px-5 py-4 flex items-center gap-4 hover:bg-slate-50 transition-colors">
              <div className={cx('h-9 w-9 rounded-md flex items-center justify-center ring-1 ring-inset flex-shrink-0', tone(r.sev).soft)}>
                <Icon.AlertTri size={15} strokeWidth={2.1} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="text-[13.5px] font-semibold text-slate-900">{r.title}</span>
                  <Pill t={r.sev} dot={false}>{r.sev === 'high' ? 'High' : 'Watch'}</Pill>
                </div>
                <div className="text-[12px] text-slate-500 mt-0.5">{r.who} · {r.why}</div>
              </div>
              <div className="text-right flex-shrink-0 hidden sm:block">
                <div className="mono text-[11px] text-slate-400 uppercase tracking-[0.1em]">{r.in === 0 ? 'Now' : `in ${r.in}h`}</div>
              </div>
              <button className="text-[11.5px] font-medium text-slate-600 hover:text-slate-900 whitespace-nowrap flex-shrink-0">{r.action} →</button>
            </div>
          ))}
        </OCard>
      </div>

    </div>
  );
}

function OverviewTile({ span, icon: I, title, children, onNav, cta }) {
  return (
    <div className={cx('col-span-12 md:col-span-6', span)}>
      <OCard className="h-full flex flex-col hover:border-slate-300 transition-colors">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="h-7 w-7 rounded-md bg-slate-100 text-slate-700 flex items-center justify-center">
              <I size={14} strokeWidth={2} />
            </div>
            <h3 className="text-[13.5px] font-semibold text-slate-900">{title}</h3>
          </div>
        </div>
        <div className="flex-1">{children}</div>
        <button onClick={onNav} className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11.5px] font-medium text-slate-600 hover:text-slate-900 group">
          <span>{cta}</span>
          <Icon.ArrowRight size={13} className="group-hover:translate-x-0.5 transition-transform" />
        </button>
      </OCard>
    </div>
  );
}

function MiniStat({ n, label, t }) {
  return (
    <div>
      <div className={cx('text-[18px] font-semibold leading-none', tone(t).text)}>{n}</div>
      <div className="text-[10.5px] text-slate-500 mt-1 leading-tight">{label}</div>
    </div>
  );
}

function ComplianceRow({ label, value, t }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[12px] text-slate-600">{label}</span>
      <span className={cx('mono text-[11.5px] font-medium flex items-center gap-1.5', tone(t).text)}>
        <span className={cx('h-1.5 w-1.5 rounded-full', tone(t).dot)} />{value}
      </span>
    </div>
  );
}

window.OrgDashboard = OrgDashboard;
