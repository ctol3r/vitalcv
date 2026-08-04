// WAVE 1400 · D5 — /executive · EXECUTIVE VIEW
// Leadership doesn't read queues — it asks questions. This surface answers the
// five that matter, each from the same live roster and ledger the operators
// work: hiring velocity, where delays sit, which groups are at risk, who's
// nearly ready, and what needs a leader's hand today.

function ViewExecutive() {
  const { def, roster, events, terms } = useWorkspace();
  const agg = aggregates(def, roster);

  // Q1 — hiring velocity
  const activations = events.filter(e => e.type === 'recognition_updated' || (e.type === 'stage_advanced' && /active|in-network|on assignment/i.test(e.detail))).length;
  const accepted = events.filter(e => e.type === 'offer_accepted').length;
  const targetWeekly = Math.max(6, Math.round(agg.inMotion * 0.12));
  const velocityPct = Math.min(140, Math.round((activations + accepted) / targetWeekly * 100));

  // Q2 — delays by stage (SLA breaches)
  const stageDelay = def.stages.map((s, i) => {
    const inStage = roster.filter(p => p.stageIdx === i);
    const over = inStage.filter(p => p.overdue);
    const avgOver = over.length ? Math.round(over.reduce((a, p) => a + (p.daysInStage - p.sla), 0) / over.length) : 0;
    return { label: s.label, idx: i, total: inStage.length, over: over.length, avgOver, sla: s.sla };
  }).filter(s => s.sla > 0).sort((a, b) => b.over - a.over);
  const worstStage = stageDelay[0];

  // Q3 — departments at risk
  const groups = agg.groups.map(g => ({ ...g, riskPct: g.motion ? Math.round(g.risk / g.motion * 100) : 0 })).sort((a, b) => b.risk - a.risk || b.motion - a.motion);
  const atRiskGroups = groups.filter(g => g.risk > 0);

  // Q4 — nearly ready
  const nearly = roster.filter(p => !p.isActive && p.readiness >= 85).map(p => ({ ...p, score: priorityScore(p) })).sort((a, b) => b.readiness - a.readiness);

  // Q5 — needs attention
  const attention = roster.map(p => ({ ...p, score: priorityScore(p) })).filter(p => p.flagged || p.score >= 70).sort((a, b) => b.score - a.score);

  return (
    <div className="max-w-[1560px] mx-auto px-6 py-7 space-y-6">
      <SurfaceIntro eyebrow="Executive View · W1400-D5"
        title={`${def.short} — the view from leadership`}
        sub={`Five questions, answered from live operations. No spreadsheets, no status meetings — the same events the team works produce the picture leadership sees.`}
        right={<div className="hidden md:flex items-center gap-2 mono text-[10px] uppercase tracking-[0.12em] text-slate-500 border border-white/10 rounded-md px-3 py-2"><Icon.Award size={13} className="accent-text" /> {def.type}</div>} />

      {/* headline band */}
      <Panel className="rise overflow-hidden">
        <div className="grid grid-cols-2 lg:grid-cols-4 divide-x divide-white/[0.06]" style={{ background: 'linear-gradient(180deg, var(--accent-glow), transparent 80%)' }}>
          <BigStat label="Hiring velocity" value={velocityPct + '%'} sub="of weekly target" tone={velocityPct >= 100 ? '#5ed6a4' : velocityPct >= 75 ? '#f0a93a' : '#ec7a9b'} />
          <BigStat label="Workforce readiness" value={agg.readinessAvg + '%'} sub={`${agg.inMotion} in motion`} tone={agg.readinessAvg >= 75 ? '#5ed6a4' : '#f0a93a'} />
          <BigStat label="Groups at risk" value={atRiskGroups.length} sub={`of ${groups.length} ${terms.groupPl.toLowerCase()}`} tone={atRiskGroups.length === 0 ? '#5ed6a4' : '#ec7a9b'} />
          <BigStat label="Needs attention" value={attention.length} sub="leadership decisions" tone={attention.length === 0 ? '#5ed6a4' : '#ec7a9b'} />
        </div>
      </Panel>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Q1 */}
        <QuestionCard n="01" q="Are we hiring fast enough?"
          verdict={velocityPct >= 100 ? { t: 'On pace', tone: 'emerald' } : velocityPct >= 75 ? { t: 'Slightly behind', tone: 'amber' } : { t: 'Behind target', tone: 'rose' }}>
          <div className="flex items-center gap-5">
            <Ring2 value={Math.min(100, velocityPct)} label={velocityPct + '%'} tone={velocityPct >= 100 ? '#5ed6a4' : velocityPct >= 75 ? '#f0a93a' : '#ec7a9b'} />
            <div className="space-y-2 text-[12px] flex-1">
              <ExecRow label="Activations & accepts logged" value={activations + accepted} />
              <ExecRow label="Weekly target" value={targetWeekly} />
              <ExecRow label="In-motion pipeline" value={agg.inMotion} />
              <ExecRow label="Nearly ready to add" value={agg.nearlyReady} c="#5ed6a4" />
            </div>
          </div>
        </QuestionCard>

        {/* Q2 */}
        <QuestionCard n="02" q="Where are delays occurring?"
          verdict={worstStage && worstStage.over > 0 ? { t: worstStage.label, tone: 'rose' } : { t: 'No SLA breaches', tone: 'emerald' }}>
          <div className="space-y-2.5">
            {stageDelay.slice(0, 5).map(s => (
              <div key={s.idx}>
                <div className="flex items-center justify-between text-[11.5px] mb-1">
                  <span className="text-slate-300 truncate">{s.label}</span>
                  <span className="mono text-slate-500">{s.over > 0 ? <span className="text-rose-300">{s.over} over · +{s.avgOver}d avg</span> : <span className="text-emerald-300">on time</span>}</span>
                </div>
                <Bar value={s.over} max={Math.max(1, ...stageDelay.map(x => x.over), s.total)} color={s.over > 0 ? '#ec7a9b' : '#5ed6a4'} h={4} />
              </div>
            ))}
            {stageDelay.length === 0 && <div className="text-[12px] text-slate-500">No timed stages in this pipeline.</div>}
          </div>
        </QuestionCard>

        {/* Q3 */}
        <QuestionCard n="03" q={`Which ${terms.groupPl.toLowerCase()} are at risk?`}
          verdict={atRiskGroups.length ? { t: `${atRiskGroups.length} flagged`, tone: 'rose' } : { t: 'All healthy', tone: 'emerald' }}>
          <div className="space-y-2">
            {groups.slice(0, 6).map(g => (
              <div key={g.group} className="flex items-center gap-3">
                <span className="w-2 flex-shrink-0">{g.risk > 0 && <RiskDot risk="high" size={7} />}</span>
                <span className="text-[12px] text-slate-200 flex-1 min-w-0 truncate">{g.group}</span>
                <span className="mono text-[10.5px] text-slate-500">{g.motion} in motion</span>
                <span className="w-16 text-right mono text-[11px] tabular-nums" style={{ color: g.risk > 0 ? '#ec7a9b' : '#5ed6a4' }}>{g.risk > 0 ? `${g.risk} risk` : 'clear'}</span>
              </div>
            ))}
          </div>
        </QuestionCard>

        {/* Q4 */}
        <QuestionCard n="04" q="Which records are nearly ready?"
          verdict={{ t: `${nearly.length} ready soon`, tone: nearly.length ? 'emerald' : 'slate' }}>
          <div className="space-y-1.5 max-h-[210px] overflow-y-auto scroll-thin">
            {nearly.length === 0 && <div className="text-[12px] text-slate-500">None above 85% yet.</div>}
            {nearly.slice(0, 8).map(p => (
              <button key={p.id} onClick={() => window.openRecord(p.id)} className="w-full flex items-center gap-3 text-left hover:bg-white/[0.03] rounded-md px-2 py-1.5 -mx-2 transition-colors group">
                <span className="text-[12px] font-medium text-slate-200 flex-1 min-w-0 truncate group-hover:accent-text transition-colors">{p.name}</span>
                <span className="mono text-[10px] text-slate-500 truncate hidden sm:block">{def.stages[p.stageIdx].label}</span>
                <span className="w-20"><Bar value={p.readiness} color="#5ed6a4" h={4} /></span>
                <span className="mono text-[11px] tabular-nums text-emerald-300 w-9 text-right">{p.readiness}%</span>
              </button>
            ))}
          </div>
        </QuestionCard>
      </div>

      {/* Q5 — full width */}
      <Panel className="overflow-hidden">
        <PanelHead icon={Icon.Siren} title="What requires leadership attention?" sub="escalations and P1 records — resolve or delegate today"
          right={<Pill tone={attention.length ? 'rose' : 'emerald'}>{attention.length} items</Pill>} />
        {attention.length === 0 ? (
          <div className="px-5 py-10 text-center text-[13px] text-slate-500">Nothing needs leadership right now. The team has it.</div>
        ) : (
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-px bg-white/[0.05]">
            {attention.slice(0, 9).map(p => {
              const reason = p.flagged ? 'Escalated to leadership'
                : p.blockers.length ? (BLOCKERS.find(b => b.id === p.blockers[0]) || {}).label
                : p.overdue ? `${p.daysInStage - p.sla}d past SLA` : `Readiness ${p.readiness}%`;
              return (
                <button key={p.id} onClick={() => window.openRecord(p.id)} className="bg-[#141922] hover:bg-[#171d27] transition-colors p-4 text-left">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0"><RiskDot risk={p.risk} /><span className="text-[12.5px] font-medium text-slate-100 truncate">{p.name}</span></div>
                    <PriorityTag score={p.score} />
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1.5 truncate">{reason}</div>
                  <div className="flex items-center justify-between mt-2.5">
                    <span className="mono text-[10px] text-slate-500">{def.stages[p.stageIdx].label}</span>
                    <span className="inline-flex items-center gap-1 text-[10.5px] accent-text">Open <Icon.ArrowUpRight size={11} /></span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
        <div className="px-5 py-2.5 border-t border-white/[0.06] flex items-center justify-between">
          <span className="mono text-[10px] text-slate-500">routed from the same ledger the team works</span>
          <Button size="xs" variant="dark" iconRight={<Icon.ArrowRight size={12} />} onClick={() => navTo('command')}>Go to Command</Button>
        </div>
      </Panel>
    </div>
  );
}

function BigStat({ label, value, sub, tone }) {
  return (
    <div className="px-5 py-5">
      <div className="mono text-[9.5px] uppercase tracking-[0.14em] text-slate-500">{label}</div>
      <div className="text-[34px] font-semibold tabular-nums leading-none mt-2" style={{ color: tone }}>{value}</div>
      <div className="text-[11px] text-slate-500 mt-1.5">{sub}</div>
    </div>
  );
}
function QuestionCard({ n, q, verdict, children }) {
  const v = verdict || {};
  const tone = { emerald: 'emerald', amber: 'amber', rose: 'rose', slate: 'slate' }[v.tone] || 'slate';
  return (
    <Panel className="overflow-hidden">
      <div className="px-5 py-4 border-b border-white/[0.07] flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <span className="mono text-[11px] accent-text mt-0.5">{n}</span>
          <h3 className="text-[15px] font-semibold text-slate-100 tracking-[-0.01em] leading-snug">{q}</h3>
        </div>
        {v.t && <Pill tone={tone}>{v.t}</Pill>}
      </div>
      <div className="p-5">{children}</div>
    </Panel>
  );
}
function ExecRow({ label, value, c }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-400">{label}</span>
      <span className="mono tabular-nums font-medium" style={{ color: c || '#e6ecf3' }}>{value}</span>
    </div>
  );
}
function Ring2({ value, label, tone, size = 92 }) {
  const r = (size - 12) / 2, c = 2 * Math.PI * r, off = c * (1 - value / 100);
  return (
    <svg width={size} height={size} className="flex-shrink-0 -rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="7" />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={tone} strokeWidth="7" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={off} style={{ transition: 'stroke-dashoffset .6s cubic-bezier(.2,.7,.2,1)' }} />
      <text x="50%" y="50%" dy="0.34em" textAnchor="middle" className="rotate-90 mono" style={{ transformOrigin: 'center', fill: tone, fontSize: 19, fontWeight: 600 }}>{label}</text>
    </svg>
  );
}

window.ViewExecutive = ViewExecutive;
