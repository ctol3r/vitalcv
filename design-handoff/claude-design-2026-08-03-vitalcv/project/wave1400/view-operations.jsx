// WAVE 1400 · D1 — /operations · OPERATIONS CENTER (mission control)
// The real-time command surface for an organization. Seven operational systems
// — readiness, risk, pipeline, mobility, compliance, staffing gaps, alerts —
// all derived live from the roster and the event ledger. The heartbeat keeps
// these numbers and the activity rail moving without a refresh.

function ViewOperations() {
  const { def, roster, events, terms } = useWorkspace();
  const agg = aggregates(def, roster);
  const queues = buildQueues(def, roster);
  const last = events[0];

  const kpis = [
    { label: 'In motion', value: agg.inMotion, color: 'var(--accent)', sub: `${terms.providerPl.toLowerCase()} mid-pipeline` },
    { label: 'Workforce readiness', value: agg.readinessAvg + '%', color: agg.readinessAvg >= 75 ? '#5ed6a4' : '#f0a93a', sub: 'aggregate, in-motion' },
    { label: 'At risk', value: agg.atRiskHigh, color: '#ec7a9b', sub: `${agg.blocked} blocked · ${agg.overdue} overdue` },
    { label: 'Nearly ready', value: agg.nearlyReady, color: '#5ed6a4', sub: 'readiness ≥ 85%' },
    { label: 'Expiring creds', value: agg.expiring, color: '#f0a93a', sub: 'license < 90 days' },
    { label: 'Needs attention', value: agg.escalations, color: '#ec7a9b', sub: 'escalated to leadership' },
  ];

  return (
    <div className="max-w-[1560px] mx-auto px-6 py-7 space-y-6">
      <SurfaceIntro eyebrow="Operations Center · W1400-D1"
        title={`${def.short} operations, live`}
        sub={`Mission control for ${def.name}. Every panel reads the live roster and the operational ledger — readiness, risk, pipeline, mobility, compliance and staffing all move in real time as the field acts. Work the alerts on the right; resolve them in Command.`}
        right={<LivePulse last={last} />} />

      {/* KPI strip */}
      <Panel className="rise">
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 divide-x divide-white/[0.06]">
          {kpis.map((k, i) => (
            <div key={i} className="px-5 py-4">
              <Stat label={k.label} value={k.value} color={k.color} sub={k.sub} />
            </div>
          ))}
        </div>
      </Panel>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* main column */}
        <div className="lg:col-span-2 space-y-6">
          <ReadinessPanel def={def} roster={roster} agg={agg} />
          <div className="grid sm:grid-cols-2 gap-6">
            <RiskPanel agg={agg} roster={roster} />
            <MobilityPanel events={events} def={def} />
          </div>
          <PipelinePanel def={def} roster={roster} terms={terms} />
          <div className="grid sm:grid-cols-2 gap-6">
            <CompliancePanel agg={agg} roster={roster} />
            <StaffingPanel agg={agg} terms={terms} />
          </div>
        </div>

        {/* alerts rail */}
        <div className="space-y-6">
          <AlertsRail queues={queues} roster={roster} def={def} agg={agg} />
          <LiveFeed events={events} def={def} />
        </div>
      </div>
    </div>
  );
}

function LivePulse({ last }) {
  return (
    <div className="hidden md:flex items-center gap-2.5 border border-white/10 rounded-md px-3 py-2">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 blink" />
      <span className="mono text-[10px] uppercase tracking-[0.12em] text-slate-400">real-time</span>
      {last && <span className="mono text-[10px] text-slate-600">· last {timeAgo(last.ts)}</span>}
    </div>
  );
}

function StatPanelHead({ icon, title, kicker, right }) {
  return <PanelHead icon={icon} title={title} sub={kicker} right={right} />;
}

/* ---- Workforce Readiness ---- */
function ReadinessPanel({ def, roster, agg }) {
  const inMotion = roster.filter(p => !p.isActive);
  const bands = [
    { label: 'Ready (≥85%)', tone: '#5ed6a4', n: inMotion.filter(p => p.readiness >= 85).length },
    { label: 'On track (70–84%)', tone: '#34d8e8', n: inMotion.filter(p => p.readiness >= 70 && p.readiness < 85).length },
    { label: 'Lagging (50–69%)', tone: '#f0a93a', n: inMotion.filter(p => p.readiness >= 50 && p.readiness < 70).length },
    { label: 'At risk (<50%)', tone: '#ec7a9b', n: inMotion.filter(p => p.readiness < 50).length },
  ];
  const total = inMotion.length || 1;
  return (
    <Panel>
      <StatPanelHead icon={Icon.Gauge} title="Workforce Readiness" kicker={`${agg.readinessAvg}% aggregate across ${inMotion.length} in motion`}
        right={<button onClick={() => navTo('queues')} className="mono text-[10px] uppercase tracking-[0.12em] text-slate-500 hover:accent-text transition-colors">work queue →</button>} />
      <div className="p-5">
        <div className="flex h-3 rounded-full overflow-hidden bg-white/[0.04]">
          {bands.map((b, i) => b.n > 0 && (
            <span key={i} title={`${b.label}: ${b.n}`} style={{ width: `${b.n / total * 100}%`, background: b.tone, transition: 'width .6s cubic-bezier(.2,.7,.2,1)' }} />
          ))}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
          {bands.map((b, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ background: b.tone }} />
              <div className="min-w-0">
                <div className="text-[16px] font-semibold tabular-nums leading-none" style={{ color: b.tone }}>{b.n}</div>
                <div className="text-[10px] text-slate-500 mt-1 leading-tight">{b.label}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Panel>
  );
}

/* ---- Credential Risk ---- */
function RiskPanel({ agg, roster }) {
  const total = roster.length || 1;
  const rows = [
    { k: 'high', label: 'High risk', n: agg.atRiskHigh },
    { k: 'med', label: 'Medium risk', n: agg.atRiskMed },
    { k: 'low', label: 'Low risk', n: total - agg.atRiskHigh - agg.atRiskMed },
  ];
  return (
    <Panel>
      <StatPanelHead icon={Icon.ShieldAlert} title="Credential Risk" kicker={`${agg.blocked} records carry a blocker`} />
      <div className="p-5 space-y-3.5">
        {rows.map(r => (
          <div key={r.k}>
            <div className="flex items-center justify-between text-[11.5px] mb-1.5">
              <span className="flex items-center gap-2 text-slate-300"><RiskDot risk={r.k} size={7} /> {r.label}</span>
              <span className="mono tabular-nums" style={{ color: RISK[r.k].c }}>{r.n}</span>
            </div>
            <Bar value={r.n} max={total} color={RISK[r.k].c} />
          </div>
        ))}
      </div>
    </Panel>
  );
}

/* ---- Provider Mobility ---- */
function MobilityPanel({ events, def }) {
  const moves = events.filter(e => ['stage_advanced', 'offer_accepted', 'recognition_updated'].includes(e.type));
  const recent = moves.slice(0, 5);
  return (
    <Panel>
      <StatPanelHead icon={Icon.Route} title="Provider Mobility" kicker={`${moves.length} stage moves logged`} />
      <div className="p-5">
        {recent.length === 0 && <div className="text-[12px] text-slate-500 py-3">No movement yet.</div>}
        <div className="space-y-2.5">
          {recent.map(e => {
            const ET = EVENT_TYPES[e.type] || {}; const EI = Icon[ET.icon] || Icon.ArrowRight;
            return (
              <div key={e.id} className="flex items-center gap-2.5 min-w-0">
                <span className="h-6 w-6 rounded-md flex items-center justify-center flex-shrink-0 accent-soft-bg accent-text"><EI size={12} /></span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[11.5px] text-slate-200 truncate">{e.subject}</span>
                  <span className="block text-[10px] text-slate-500 truncate">{e.detail}</span>
                </span>
                <span className="mono text-[9.5px] text-slate-600 flex-shrink-0">{timeAgo(e.ts)}</span>
              </div>
            );
          })}
        </div>
      </div>
    </Panel>
  );
}

/* ---- Hiring Pipeline funnel ---- */
function PipelinePanel({ def, roster, terms }) {
  const counts = def.stages.map((s, i) => roster.filter(p => p.stageIdx === i).length);
  const max = Math.max(1, ...counts.slice(0, -1));
  return (
    <Panel>
      <StatPanelHead icon={Icon.Filter} title="Hiring Pipeline" kicker={`${terms.providerPl} by stage, live`}
        right={<button onClick={() => navTo('command')} className="mono text-[10px] uppercase tracking-[0.12em] text-slate-500 hover:accent-text transition-colors">command →</button>} />
      <div className="p-5 overflow-x-auto scroll-thin">
        <div className="flex items-end gap-2 min-w-max h-[150px]">
          {def.stages.map((s, i) => {
            const n = counts[i]; const isLast = i === def.stages.length - 1;
            const h = isLast ? 1 : Math.max(0.06, n / max);
            const overdueN = roster.filter(p => p.stageIdx === i && p.overdue).length;
            return (
              <div key={s.id} className="flex flex-col items-center justify-end h-full" style={{ width: 78 }}>
                <span className="mono text-[12px] font-semibold tabular-nums mb-1.5" style={{ color: isLast ? '#5ed6a4' : 'var(--accent)' }}>{n}</span>
                <div className="w-full rounded-t-md relative overflow-hidden" style={{ height: `${h * 100}%`, minHeight: 8, background: isLast ? hexA('#5ed6a4', 0.22) : hexA(def.accent, 0.2), boxShadow: `inset 0 0 0 1px ${isLast ? hexA('#5ed6a4', 0.4) : 'var(--accent-ring)'}` }}>
                  {overdueN > 0 && <span className="absolute bottom-0 left-0 right-0 bg-rose-500/40" style={{ height: `${overdueN / Math.max(1, n) * 100}%` }} />}
                </div>
                <span className="mono text-[8.5px] uppercase tracking-[0.06em] text-slate-500 mt-2 text-center leading-tight h-7 flex items-start justify-center">{s.label}</span>
              </div>
            );
          })}
        </div>
        <div className="flex items-center gap-4 mt-2 mono text-[9.5px] text-slate-600">
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm accent-bg" /> in stage</span>
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-rose-500/60" /> past SLA</span>
        </div>
      </div>
    </Panel>
  );
}

/* ---- Compliance Health ---- */
function CompliancePanel({ agg, roster }) {
  const active = roster.filter(p => p.isActive);
  const expSoon = active.filter(p => p.licenseDays != null && p.licenseDays <= 30).length;
  const lapsed = active.filter(p => p.licenseDays != null && p.licenseDays < 0).length;
  const healthy = active.length - agg.expiring;
  const score = active.length ? Math.round(healthy / active.length * 100) : 100;
  return (
    <Panel>
      <StatPanelHead icon={Icon.ShieldCheck} title="Compliance Health" kicker={`${score}% of active roster current`} />
      <div className="p-5">
        <div className="flex items-center gap-4">
          <Ring value={score} color={score >= 90 ? '#5ed6a4' : score >= 75 ? '#f0a93a' : '#ec7a9b'} />
          <div className="space-y-2 text-[11.5px] flex-1">
            <Row label="Within 90 days" value={agg.expiring} c="#f0a93a" />
            <Row label="Within 30 days" value={expSoon} c="#ec7a9b" />
            <Row label="Lapsed" value={lapsed} c="#ec7a9b" />
          </div>
        </div>
      </div>
    </Panel>
  );
}
function Row({ label, value, c }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-400">{label}</span>
      <span className="mono tabular-nums font-medium" style={{ color: value > 0 ? c : '#5ed6a4' }}>{value}</span>
    </div>
  );
}
function Ring({ value, color, size = 76 }) {
  const r = (size - 10) / 2, c = 2 * Math.PI * r, off = c * (1 - value / 100);
  return (
    <svg width={size} height={size} className="flex-shrink-0 -rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="6" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={off} style={{ transition: 'stroke-dashoffset .6s cubic-bezier(.2,.7,.2,1)' }} />
      <text x="50%" y="50%" dy="0.35em" textAnchor="middle" className="rotate-90 mono" style={{ transformOrigin: 'center', fill: color, fontSize: 16, fontWeight: 600 }}>{value}%</text>
    </svg>
  );
}

/* ---- Staffing Gaps ---- */
function StaffingPanel({ agg, terms }) {
  const groups = agg.groups.slice().sort((a, b) => (b.risk - a.risk) || (b.motion - a.motion)).slice(0, 6);
  const max = Math.max(1, ...agg.groups.map(g => g.motion + g.active));
  return (
    <Panel>
      <StatPanelHead icon={Icon.Building} title="Staffing Gaps" kicker={`demand vs. active by ${terms.group.toLowerCase()}`} />
      <div className="p-5 space-y-3">
        {groups.map(g => (
          <div key={g.group}>
            <div className="flex items-center justify-between text-[11px] mb-1">
              <span className="text-slate-300 truncate flex items-center gap-1.5">{g.risk > 0 && <RiskDot risk="high" size={6} />}{g.group}</span>
              <span className="mono text-slate-500"><span className="accent-text">{g.motion}</span> in / <span className="text-emerald-300">{g.active}</span> active</span>
            </div>
            <Bar value={g.motion} max={max} color="var(--accent)" h={4} />
          </div>
        ))}
      </div>
    </Panel>
  );
}

/* ---- Active Alerts rail ---- */
function AlertsRail({ queues, roster, def, agg }) {
  // Build a prioritized list of the most urgent individual records.
  const alerts = roster.map(p => ({ ...p, score: priorityScore(p) }))
    .filter(p => p.score >= 40 || p.flagged)
    .sort((a, b) => b.score - a.score).slice(0, 7);
  return (
    <Panel className="overflow-hidden">
      <PanelHead icon={Icon.Siren} title="Active Alerts"
        sub={`${alerts.length} records need a decision now`}
        right={<Pill tone="rose">{agg.atRiskHigh} P1</Pill>} />
      <div className="divide-y divide-white/[0.05] max-h-[440px] overflow-y-auto scroll-thin">
        {alerts.map(p => {
          const reason = p.blockers.length ? (BLOCKERS.find(b => b.id === p.blockers[0]) || {}).label
            : p.overdue ? `${p.daysInStage - p.sla}d past SLA in ${def.stages[p.stageIdx].label}`
            : p.isActive && p.licenseDays <= 90 ? `License expires in ${p.licenseDays}d`
            : `Readiness ${p.readiness}%`;
          return (
            <button key={p.id} onClick={() => window.openRecord(p.id)} className="w-full text-left px-4 py-3 hover:bg-white/[0.03] transition-colors flex items-start gap-3">
              <PriorityTag score={p.score} />
              <div className="min-w-0 flex-1">
                <div className="text-[12px] font-medium text-slate-100 truncate">{p.name}</div>
                <div className="text-[10.5px] text-slate-500 truncate mt-0.5">{reason}</div>
              </div>
              <Icon.ArrowUpRight size={13} className="text-slate-600 mt-0.5 flex-shrink-0" />
            </button>
          );
        })}
        {alerts.length === 0 && <div className="px-4 py-8 text-center text-[12px] text-slate-500">All clear — nothing urgent.</div>}
      </div>
      <div className="px-4 py-2.5 border-t border-white/[0.06]">
        <Button size="sm" variant="dark" className="w-full" iconRight={<Icon.ArrowRight size={13} />} onClick={() => navTo('queues')}>Open all work queues</Button>
      </div>
    </Panel>
  );
}

/* ---- Live activity feed ---- */
function LiveFeed({ events, def }) {
  return (
    <Panel className="overflow-hidden">
      <PanelHead icon={Icon.Activity} title="Live activity"
        sub="streaming from the ledger"
        right={<button onClick={() => navTo('timeline')} className="mono text-[10px] uppercase tracking-[0.12em] text-slate-500 hover:accent-text transition-colors">all →</button>} />
      <div className="max-h-[360px] overflow-y-auto scroll-thin">
        {events.slice(0, 12).map((e, i) => {
          const ET = EVENT_TYPES[e.type] || {}; const EI = Icon[ET.icon] || Icon.Dot;
          return (
            <div key={e.id} className={cn('flex items-start gap-2.5 px-4 py-2.5 border-b border-white/[0.04]', i === 0 && 'bg-white/[0.02]')}>
              <span className="h-5 w-5 rounded flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: hexA('#7c8aa0', 0.12), color: '#a9b6c6' }}><EI size={11} /></span>
              <div className="min-w-0 flex-1">
                <div className="text-[11.5px] text-slate-200 leading-snug"><span className="font-medium">{ET.label || e.type}</span> <span className="text-slate-500">· {e.subject}</span></div>
                <div className="text-[10px] text-slate-600 mono mt-0.5">{e.actor ? (TEAM.find(t => t.id === e.actor) || {}).name || 'system' : 'system'} · {timeAgo(e.ts)}</div>
              </div>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

window.ViewOperations = ViewOperations;
