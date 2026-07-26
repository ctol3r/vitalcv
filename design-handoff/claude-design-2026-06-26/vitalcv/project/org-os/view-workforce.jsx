// ════════════════════════════════════════════════════════════════════════
// view-workforce.jsx — D4 · /org/workforce · Workforce Health
// Expiring licenses · Credential gaps · Coverage risks · High-value · Retention
// ════════════════════════════════════════════════════════════════════════

function WorkforceHealth({ onNav }) {
  return (
    <div className="space-y-6">
      <SecHead eyebrow="Workforce health · live monitoring" title="What needs attention"
        sub="The system watches every credential continuously. These are the items that move your readiness number — ranked by urgency." />

      {/* ── Retention / health strip ──────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-px bg-slate-200 border border-slate-200 rounded-lg overflow-hidden">
        <Stat label="Avg tenure" value={(RETENTION.avgTenure / 12).toFixed(1)} unit="yr" sub="Across working roster" t="slate" />
        <Stat label="Anchored providers" value={RETENTION.anchored} sub="High-value · 5yr+ tenure" t="verified" />
        <Stat label="At-risk credentials" value={RETENTION.atRisk} sub="High-value · license &lt; 90d" t="watch" />
        <Stat label="Flight risk" value={RETENTION.flightRisk} sub="Locum · short horizon" t="gap" />
        <Stat label="Blocked from work" value={READINESS.blocked} sub="Privileges should hold" t="blocked" />
      </div>

      <div className="grid grid-cols-12 gap-5">

        {/* ── Expiring licenses ────────────────────────────────────────── */}
        <Panel span="col-span-12 lg:col-span-6" icon={Icon.Calendar} title="Expiring licenses"
          badge={`${EXPIRING.length} within 120 days`} badgeTone={EXPIRING.some(p => p.licDays < 0) ? 'blocked' : 'watch'}>
          <div className="divide-y divide-slate-100">
            {EXPIRING.map(p => {
              const t = p.licDays < 0 ? 'blocked' : p.licDays < 45 ? 'gap' : 'watch';
              return (
                <div key={p.id} className="py-2.5 flex items-center gap-3">
                  <Avatar initials={p.initials} size="sm" />
                  <div className="flex-1 min-w-0">
                    <div className="text-[12.5px] font-medium text-slate-900 truncate">{p.name}, {p.role}</div>
                    <div className="text-[11px] text-slate-500 truncate">{p.licType} · {p.licState} · {FAC_NAME[p.fac]}</div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className={cx('mono text-[13px] font-medium leading-none', tone(t).text)}>
                      {p.licDays < 0 ? `${Math.abs(p.licDays)}d ago` : `${p.licDays}d`}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">{p.licDays < 0 ? 'expired' : 'remaining'}</div>
                  </div>
                  <button className="text-[11px] font-medium text-slate-600 hover:text-slate-900 whitespace-nowrap flex-shrink-0">
                    {p.licDays < 0 ? 'Hold' : 'Renew'} →
                  </button>
                </div>
              );
            })}
          </div>
        </Panel>

        {/* ── Credential gaps ──────────────────────────────────────────── */}
        <Panel span="col-span-12 lg:col-span-6" icon={Icon.AlertTri} title="Credential gaps"
          badge={`${CRED_GAPS.length} open`} badgeTone="gap">
          <div className="divide-y divide-slate-100">
            {CRED_GAPS.map(p => (
              <div key={p.id} className="py-2.5 flex items-center gap-3">
                <Avatar initials={p.initials} size="sm" />
                <div className="flex-1 min-w-0">
                  <div className="text-[12.5px] font-medium text-slate-900 truncate">{p.name}, {p.role}</div>
                  <div className="text-[11px] text-orange-700 truncate">{p.gap}</div>
                </div>
                <div className="text-right flex-shrink-0 hidden sm:block">
                  <div className="mono text-[10.5px] text-slate-400">{FAC_NAME[p.fac]}</div>
                </div>
                <button className="text-[11px] font-medium text-slate-600 hover:text-slate-900 whitespace-nowrap flex-shrink-0">Resolve →</button>
              </div>
            ))}
          </div>
        </Panel>

        {/* ── Coverage risks ───────────────────────────────────────────── */}
        <Panel span="col-span-12 lg:col-span-7" icon={Icon.Users} title="Coverage risks"
          badge={`${COVERAGE.filter(c => c.risk === 'high').length} units below target`} badgeTone="blocked">
          <div className="divide-y divide-slate-100">
            {COVERAGE.map((c, i) => {
              const pct = (c.staffed / c.target) * 100;
              const t = c.risk === 'high' ? 'gap' : c.risk === 'watch' ? 'watch' : 'verified';
              return (
                <div key={i} className="py-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="min-w-0">
                      <span className="text-[12.5px] font-medium text-slate-900">{c.unit}</span>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="mono text-[12px] font-medium text-slate-900">{c.staffed}<span className="text-slate-400">/{c.target}</span></span>
                      <Pill t={t} dot={false}>{c.risk}</Pill>
                    </div>
                  </div>
                  <Meter value={pct} t={t} h="h-2" />
                  <div className="text-[11px] text-slate-500 mt-1.5">{c.note}</div>
                </div>
              );
            })}
          </div>
        </Panel>

        {/* ── High-value providers + retention ──────────────────────────── */}
        <Panel span="col-span-12 lg:col-span-5" icon={Icon.Heart} title="High-value providers"
          badge={`${HIGH_VALUE.length} flagged`} badgeTone="verified"
          right={<ActLink onClick={() => onNav('providers')}>Directory</ActLink>}>
          <div className="divide-y divide-slate-100">
            {HIGH_VALUE.slice(0, 7).map(p => {
              const rt = { anchored: 'verified', stable: 'verified', 'at-risk': 'watch', 'flight-risk': 'gap' }[p.retention];
              const rl = { anchored: 'Anchored', stable: 'Stable', 'at-risk': 'At risk', 'flight-risk': 'Flight risk' }[p.retention];
              return (
                <div key={p.id} className="py-2.5 flex items-center gap-3">
                  <Avatar initials={p.initials} size="sm" />
                  <div className="flex-1 min-w-0">
                    <div className="text-[12.5px] font-medium text-slate-900 truncate">{p.name}, {p.role}</div>
                    <div className="text-[11px] text-slate-500 truncate">{p.spec} · {(p.tenure / 12).toFixed(1)}yr tenure</div>
                  </div>
                  <span className={cx('mono text-[12px] font-medium flex-shrink-0', tone('verified').text)}>T{p.trust}</span>
                  <Pill t={rt} dot={rt !== 'verified'}>{rl}</Pill>
                </div>
              );
            })}
          </div>
        </Panel>

      </div>
    </div>
  );
}

function Panel({ span, icon: I, title, badge, badgeTone = 'slate', right, children }) {
  return (
    <div className={span}>
      <OCard pad={false} className="h-full overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="h-7 w-7 rounded-md bg-slate-100 text-slate-700 flex items-center justify-center flex-shrink-0">
              <I size={14} strokeWidth={2} />
            </div>
            <h3 className="text-[13.5px] font-semibold text-slate-900 truncate">{title}</h3>
            {badge && <Pill t={badgeTone} dot={false}>{badge}</Pill>}
          </div>
          {right}
        </div>
        <div className="px-5 py-1.5">{children}</div>
      </OCard>
    </div>
  );
}

window.WorkforceHealth = WorkforceHealth;
