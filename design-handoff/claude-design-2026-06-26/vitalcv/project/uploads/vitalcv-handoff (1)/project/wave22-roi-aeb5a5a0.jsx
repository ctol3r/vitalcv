// WAVE 22 · ROI Console v2 components
// Pilot-revenue surface. Per-pilot rather than FY-system.
//
// Conventions:
//  - Every projected number gets an inline qualifier from LABEL_QUALIFIER_V2.
//  - Dollar lines render only when ORG.defaultWageUsd is non-null.
//  - "Verified" is reserved for PSV claims; we use "Confirmed" for receipts.
//  - Comparisons are always "vs. your baseline of Nd" — never industry average.

/* ---------- Status pip ---------- */
const ROI_V2_STATUS_META = {
  'on-track':  { label: 'On track',   cls: 'text-emerald-700 bg-emerald-50 ring-emerald-600/20', dot: 'bg-emerald-600' },
  'trailing':  { label: 'Trailing',   cls: 'text-amber-800 bg-amber-50 ring-amber-600/20',       dot: 'bg-amber-500' },
  'blocked':   { label: 'Blocked',    cls: 'text-rose-700 bg-rose-50 ring-rose-600/20',          dot: 'bg-rose-500' },
  'complete':  { label: 'Complete',   cls: 'text-slate-700 bg-slate-100 ring-slate-300',          dot: 'bg-slate-500' },
};
window.ROI_V2_STATUS_META = ROI_V2_STATUS_META;

function RoiStatusPip({ state }) {
  const m = ROI_V2_STATUS_META[state] || ROI_V2_STATUS_META['on-track'];
  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[2px] ring-1 ring-inset text-[10.5px] font-medium uppercase tracking-[0.06em]',
      m.cls
    )}>
      <span className={cn('h-1.5 w-1.5 rounded-full', m.dot)} />
      {m.label}
    </span>
  );
}

/* ---------- Console header ---------- */
function RoiConsoleHeader({ pilot, status, onExport }) {
  const elapsedPct = Math.round((pilot.daysElapsed / pilot.pilotWindowDays) * 100);
  return (
    <div className="border border-slate-200 rounded-[3px] bg-white px-6 py-5">
      <div className="flex items-start justify-between gap-6 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="mono text-[10.5px] uppercase tracking-[0.14em] text-slate-500">
              ROI Console · {pilot.pilotId}
            </span>
            <RoiStatusPip state={status.state} />
          </div>
          <h1 className="text-[26px] font-semibold tracking-[-0.018em] text-slate-900 leading-tight">
            {pilot.orgName}
          </h1>
          <p className="mt-1 text-[12.5px] text-slate-600 leading-[1.55] max-w-[68ch]">
            {status.summary}
          </p>
          <div className="mt-2 mono text-[10.5px] text-slate-500">
            Started {pilot.pilotStartedAt} · As of {status.asOf}
          </div>
        </div>
        <div className="flex-shrink-0 min-w-[240px]">
          <div className="flex items-center justify-between mb-1.5">
            <span className="mono text-[10.5px] uppercase tracking-[0.14em] text-slate-500">
              Pilot window · {pilot.daysElapsed} of {pilot.pilotWindowDays}d
            </span>
            <span className="mono text-[11px] tabular-nums text-slate-700">{elapsedPct}%</span>
          </div>
          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div className={cn('h-full',
              status.state === 'blocked' ? 'bg-rose-500' :
              status.state === 'trailing' ? 'bg-amber-500' :
              status.state === 'complete' ? 'bg-slate-500' : 'bg-emerald-600'
            )} style={{ width: `${elapsedPct}%` }} />
          </div>
          {onExport && (
            <div className="mt-3 flex items-center gap-2 justify-end">
              {ROI_V2_EXPORTS.map(ex => (
                <button
                  key={ex.id}
                  type="button"
                  onClick={() => onExport(ex.id)}
                  title={ex.sub}
                  className="mono text-[10.5px] uppercase tracking-[0.14em] text-slate-700 hover:text-slate-900 hover:underline"
                >
                  {ex.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------- Headline metric card ---------- */
function HeadlineMetric({ label, value, unit, qualifier, sub, accent }) {
  return (
    <div className={cn(
      'border rounded-[3px] bg-white px-5 py-4',
      accent ? 'border-slate-900' : 'border-slate-200'
    )}>
      <div className="mono text-[10.5px] uppercase tracking-[0.14em] text-slate-500 mb-1.5">
        {label}
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="text-[28px] font-semibold tracking-[-0.018em] text-slate-900 leading-none tabular-nums">
          {value}
        </span>
        {unit && <span className="text-[13px] text-slate-600">{unit}</span>}
      </div>
      {sub && <div className="mt-1.5 text-[12px] text-slate-700">{sub}</div>}
      {qualifier && (
        <div className="mt-1 mono text-[10.5px] text-slate-500">
          {qualifier}
        </div>
      )}
    </div>
  );
}

/* ---------- Headline strip ---------- */
function RoiHeadlineStrip({ pilot, decisions, hours, ttfd }) {
  const wage = pilot.defaultWageUsd;
  const dollarsK = wage != null ? Math.round((hours.observedSavedHours * wage) / 100) / 10 : null;
  const projDollarsK = wage != null ? Math.round((hours.projectedTotalHoursAt30d * wage) / 100) / 10 : null;

  return (
    <div className="grid grid-cols-12 gap-3">
      <div className="col-span-12 md:col-span-3">
        <HeadlineMetric
          label="Decisions logged"
          value={decisions.decided.toLocaleString()}
          unit={`of ${decisions.staged} staged`}
          sub={`${decisions.acceptedFirstPass} accepted first-pass · ${decisions.disputed} disputed`}
          qualifier={LABEL_QUALIFIER_V2.decisions}
          accent
        />
      </div>
      <div className="col-span-12 md:col-span-3">
        <HeadlineMetric
          label="Reviewer-hours saved"
          value={`${hours.observedSavedHours}h`}
          sub={`Projecting ~${hours.projectedTotalHoursAt30d}h at 30d`}
          qualifier={LABEL_QUALIFIER_V2.hours}
        />
      </div>
      <div className="col-span-12 md:col-span-3">
        {wage != null ? (
          <HeadlineMetric
            label="At your default wage"
            value={`$${dollarsK}K`}
            sub={`Projecting ~$${projDollarsK}K at 30d · ${wage}/hr`}
            qualifier={LABEL_QUALIFIER_V2.dollars}
          />
        ) : (
          <div className="border border-dashed border-slate-300 rounded-[3px] bg-slate-50/40 px-5 py-4 h-full">
            <div className="mono text-[10.5px] uppercase tracking-[0.14em] text-slate-500 mb-1.5">
              Dollar equivalents
            </div>
            <p className="text-[12px] text-slate-600 leading-[1.55]">
              Add a default wage in Activation Step&nbsp;1 to see dollar equivalents. Hours-only is fine — the math doesn't change.
            </p>
          </div>
        )}
      </div>
      <div className="col-span-12 md:col-span-3">
        <HeadlineMetric
          label="Time to first decision"
          value={`${ttfd.pilotMedianHours}h`}
          unit="median"
          sub={`${ttfd.speedupVsBaselineX}× faster vs. your baseline of ${ttfd.baselineDays}d`}
          qualifier={LABEL_QUALIFIER_V2.vsBaseline}
        />
      </div>
    </div>
  );
}

/* ---------- Decision-flow funnel (small, observed) ---------- */
function DecisionFlowFunnel({ decisions }) {
  const rows = [
    { id: 'staged',     label: 'Staged in Inbox',         count: decisions.staged,             cls: 'bg-slate-300' },
    { id: 'decided',    label: 'Decisions logged',         count: decisions.decided,           cls: 'bg-slate-700' },
    { id: 'accepted',   label: 'Accepted first-pass',      count: decisions.acceptedFirstPass, cls: 'bg-emerald-600' },
    { id: 'refreshed',  label: 'Refreshed then accepted',  count: decisions.refreshedAndAccepted, cls: 'bg-amber-500' },
    { id: 'disputed',   label: 'Disputed',                 count: decisions.disputed,          cls: 'bg-rose-500' },
  ];
  const max = Math.max(...rows.map(r => r.count), 1);
  return (
    <div className="border border-slate-200 rounded-[3px] bg-white">
      <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon.Layers size={13} className="text-slate-700" />
          <span className="text-[13px] font-semibold text-slate-900">Decision flow this pilot</span>
        </div>
        <span className="mono text-[10.5px] uppercase tracking-[0.14em] text-slate-500">
          observed · receipt-derived
        </span>
      </div>
      <ul className="divide-y divide-slate-100">
        {rows.map(r => (
          <li key={r.id} className="px-5 py-2.5 grid grid-cols-12 gap-3 items-center">
            <div className="col-span-4 text-[12.5px] text-slate-700">{r.label}</div>
            <div className="col-span-6">
              <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div className={cn('h-full', r.cls)} style={{ width: `${(r.count / max) * 100}%` }} />
              </div>
            </div>
            <div className="col-span-2 text-right mono text-[12px] tabular-nums text-slate-900">
              {r.count}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ---------- Day-by-day timeline chart (SVG) ---------- */
function RoiTimelineChart({ timeline, decisions }) {
  const W = 720, H = 200, padL = 36, padR = 16, padT = 16, padB = 28;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const max = Math.max(...timeline.map(d => Math.max(d.observed ?? 0, d.projected ?? 0)), 12);
  const xStep = innerW / (timeline.length - 1);

  const xy = (i, v) => [padL + i * xStep, padT + innerH - (v / max) * innerH];

  const obsPts = timeline.map((d, i) => d.observed != null ? xy(i, d.observed) : null);
  const projPts = timeline.map((d, i) => d.projected != null ? xy(i, d.projected) : null);

  const obsPath = obsPts.filter(Boolean).map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0]},${p[1]}`).join(' ');
  const projPath = projPts.filter(Boolean).map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0]},${p[1]}`).join(' ');

  const todayIdx = timeline.findIndex(d => d.isToday);

  return (
    <div className="border border-slate-200 rounded-[3px] bg-white">
      <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon.Activity size={13} className="text-slate-700" />
          <span className="text-[13px] font-semibold text-slate-900">Decisions per day</span>
        </div>
        <div className="flex items-center gap-3 mono text-[10.5px] uppercase tracking-[0.14em]">
          <span className="inline-flex items-center gap-1.5 text-slate-700">
            <span className="h-0.5 w-4 bg-slate-900" /> observed
          </span>
          <span className="inline-flex items-center gap-1.5 text-slate-500">
            <span className="h-0.5 w-4 border-t border-dashed border-slate-500" /> projected
          </span>
        </div>
      </div>
      <div className="px-2 py-3">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto block">
          {/* Y axis grid */}
          {[0, 0.25, 0.5, 0.75, 1].map(t => {
            const y = padT + innerH - t * innerH;
            const v = Math.round(max * t);
            return (
              <g key={t}>
                <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="#f1f5f9" strokeWidth="1" />
                <text x={padL - 6} y={y + 3} fontSize="9" textAnchor="end" fill="#94a3b8" fontFamily="JetBrains Mono, monospace">
                  {v}
                </text>
              </g>
            );
          })}

          {/* X axis ticks */}
          {timeline.filter((_, i) => i % 5 === 0 || i === timeline.length - 1).map((d) => {
            const i = timeline.indexOf(d);
            const [x] = xy(i, 0);
            return (
              <text key={d.day} x={x} y={H - 8} fontSize="9" textAnchor="middle" fill="#94a3b8" fontFamily="JetBrains Mono, monospace">
                d{d.day}
              </text>
            );
          })}

          {/* Today marker */}
          {todayIdx >= 0 && (
            <line
              x1={padL + todayIdx * xStep}
              y1={padT}
              x2={padL + todayIdx * xStep}
              y2={padT + innerH}
              stroke="#cbd5e1"
              strokeDasharray="3 2"
              strokeWidth="1"
            />
          )}

          {/* Projected path */}
          {projPath && <path d={projPath} fill="none" stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="4 3" />}
          {/* Observed path */}
          {obsPath && <path d={obsPath} fill="none" stroke="#0f172a" strokeWidth="1.75" />}

          {/* Observed dots */}
          {obsPts.map((p, i) => p && (
            <circle key={i} cx={p[0]} cy={p[1]} r="2.5" fill="#0f172a" />
          ))}
        </svg>
      </div>
      <div className="px-5 py-2 border-t border-slate-100 mono text-[10.5px] text-slate-500 leading-[1.55]">
        Running daily rate: {decisions.dailyDecisionRate.toFixed(1)} decisions/day · last 3 days: {decisions.dailyRateLast3.toFixed(1)}/day. {LABEL_QUALIFIER_V2.rate}.
      </div>
    </div>
  );
}

/* ---------- Per-lane breakdown table ---------- */
function LaneBreakdownTable({ lanes, pilot }) {
  const wage = pilot.defaultWageUsd;
  return (
    <div className="border border-slate-200 rounded-[3px] bg-white overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon.Network size={13} className="text-slate-700" />
          <span className="text-[13px] font-semibold text-slate-900">Where value is coming from</span>
        </div>
        <span className="mono text-[10.5px] uppercase tracking-[0.14em] text-slate-500">
          per-lane · receipt-derived
        </span>
      </div>
      <table className="w-full text-[12.5px]">
        <thead>
          <tr className="bg-slate-50/60 text-slate-500 mono text-[10.5px] uppercase tracking-[0.12em]">
            <th className="text-left px-5 py-2 font-medium">Lane</th>
            <th className="text-right px-3 py-2 font-medium">Decided</th>
            <th className="text-right px-3 py-2 font-medium">Confirmed</th>
            <th className="text-right px-3 py-2 font-medium">Refreshed</th>
            <th className="text-right px-3 py-2 font-medium">Contradicted</th>
            <th className="text-right px-3 py-2 font-medium">Hours saved</th>
            {wage != null && <th className="text-right px-5 py-2 font-medium">$ at wage</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {lanes.map(l => {
            const dollars = wage != null ? Math.round(l.hoursSaved * wage) : null;
            return (
              <tr key={l.laneId} className="text-slate-800">
                <td className="px-5 py-2.5">
                  <div className="font-medium text-slate-900">{l.laneName}</div>
                  <div className="mono text-[10.5px] text-slate-500">
                    {Math.round(l.pctOfTotal * 100)}% of pilot value
                  </div>
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums">{l.decided}</td>
                <td className="px-3 py-2.5 text-right tabular-nums text-emerald-700">{l.confirmed}</td>
                <td className="px-3 py-2.5 text-right tabular-nums text-amber-700">{l.refreshed}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{l.contradicted}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{l.hoursSaved.toFixed(1)}h</td>
                {wage != null && (
                  <td className="px-5 py-2.5 text-right tabular-nums">${dollars.toLocaleString()}</td>
                )}
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="bg-slate-50/40 text-slate-700 mono text-[11px]">
            <td className="px-5 py-2 uppercase tracking-[0.12em] text-slate-500">Total</td>
            <td className="px-3 py-2 text-right tabular-nums">{lanes.reduce((s, l) => s + l.decided, 0)}</td>
            <td className="px-3 py-2 text-right tabular-nums">{lanes.reduce((s, l) => s + l.confirmed, 0)}</td>
            <td className="px-3 py-2 text-right tabular-nums">{lanes.reduce((s, l) => s + l.refreshed, 0)}</td>
            <td className="px-3 py-2 text-right tabular-nums">{lanes.reduce((s, l) => s + l.contradicted, 0)}</td>
            <td className="px-3 py-2 text-right tabular-nums">{lanes.reduce((s, l) => s + l.hoursSaved, 0).toFixed(1)}h</td>
            {wage != null && (
              <td className="px-5 py-2 text-right tabular-nums">
                ${lanes.reduce((s, l) => s + Math.round(l.hoursSaved * wage), 0).toLocaleString()}
              </td>
            )}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

/* ---------- Per-decision compare card ---------- */
function PerDecisionCompare({ pilot, hours, cost }) {
  const wage = pilot.defaultWageUsd;
  const baselineMin = cost.baselineMinutesPerDecision;
  const pilotMin = cost.pilotMinutesPerDecision;
  const ratio = baselineMin / pilotMin;
  const baselineDollars = wage != null ? Math.round((baselineMin / 60) * wage * 100) / 100 : null;
  const pilotDollars = wage != null ? Math.round((pilotMin / 60) * wage * 100) / 100 : null;

  return (
    <div className="border border-slate-200 rounded-[3px] bg-white">
      <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon.Clock size={13} className="text-slate-700" />
          <span className="text-[13px] font-semibold text-slate-900">Per-decision compare</span>
        </div>
        <span className="mono text-[10.5px] uppercase tracking-[0.14em] text-slate-500">
          your legacy process vs. this pilot
        </span>
      </div>
      <div className="grid grid-cols-2 divide-x divide-slate-100">
        <div className="px-5 py-4">
          <div className="mono text-[10.5px] uppercase tracking-[0.14em] text-slate-500 mb-1">
            Your baseline
          </div>
          <div className="text-[24px] font-semibold tracking-[-0.015em] text-slate-900 tabular-nums leading-none">
            {baselineMin}<span className="text-[14px] text-slate-500 font-normal ml-1">min</span>
          </div>
          {baselineDollars != null && (
            <div className="mt-1 text-[12px] text-slate-600">≈ ${baselineDollars.toFixed(2)} / decision</div>
          )}
          <div className="mt-2 mono text-[10.5px] text-slate-500">{LABEL_QUALIFIER_V2.baseline}</div>
        </div>
        <div className="px-5 py-4 bg-emerald-50/30">
          <div className="mono text-[10.5px] uppercase tracking-[0.14em] text-emerald-800 mb-1">
            This pilot
          </div>
          <div className="text-[24px] font-semibold tracking-[-0.015em] text-slate-900 tabular-nums leading-none">
            {pilotMin}<span className="text-[14px] text-slate-500 font-normal ml-1">min</span>
          </div>
          {pilotDollars != null && (
            <div className="mt-1 text-[12px] text-slate-600">≈ ${pilotDollars.toFixed(2)} / decision</div>
          )}
          <div className="mt-2 mono text-[10.5px] text-emerald-800">
            {ratio.toFixed(1)}× faster · {LABEL_QUALIFIER_V2.vsBaseline}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- TTFD sparkline ---------- */
function TtfdSparkline({ ttfd }) {
  const samples = ttfd.hourSamplesByDay;
  const W = 320, H = 64;
  const min = Math.min(...samples), max = Math.max(...samples);
  const range = Math.max(max - min, 1);
  const xStep = W / (samples.length - 1);
  const path = samples.map((v, i) => {
    const x = i * xStep;
    const y = H - 6 - ((v - min) / range) * (H - 12);
    return `${i === 0 ? 'M' : 'L'}${x},${y}`;
  }).join(' ');
  return (
    <div className="border border-slate-200 rounded-[3px] bg-white p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="mono text-[10.5px] uppercase tracking-[0.14em] text-slate-500">
          Time to first decision · daily median
        </div>
        <div className="mono text-[10.5px] tabular-nums text-slate-700">
          p10 {ttfd.pilotP10Hours}h · p50 {ttfd.pilotMedianHours}h · p90 {ttfd.pilotP90Hours}h
        </div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto block">
        <path d={path} fill="none" stroke="#0f172a" strokeWidth="1.5" />
        {samples.map((v, i) => {
          const x = i * xStep;
          const y = H - 6 - ((v - min) / range) * (H - 12);
          return <circle key={i} cx={x} cy={y} r="1.6" fill="#0f172a" />;
        })}
      </svg>
      <div className="mt-1 mono text-[10.5px] text-slate-500">
        Hours per decision · {ttfd.speedupVsBaselineX}× faster than your {ttfd.baselineDays}d baseline · {LABEL_QUALIFIER_V2.vsBaseline}
      </div>
    </div>
  );
}

/* ---------- Methodology panel (collapsible) ---------- */
function MethodologyPanel({ rows }) {
  const [open, setOpen] = React.useState(false);
  return (
    <div className="border border-slate-200 rounded-[3px] bg-white">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-3 text-left hover:bg-slate-50/60"
      >
        <div className="flex items-center gap-2">
          <Icon.Info size={13} className="text-slate-700" />
          <span className="text-[13px] font-semibold text-slate-900">How this math works</span>
        </div>
        <Icon.ChevronRight size={14} className={cn('text-slate-400 transition-transform', open && 'rotate-90')} />
      </button>
      {open && (
        <div className="border-t border-slate-100 divide-y divide-slate-100">
          {rows.map(r => (
            <div key={r.k} className="px-5 py-3 grid grid-cols-12 gap-3">
              <div className="col-span-3 mono text-[10.5px] uppercase tracking-[0.12em] text-slate-500 pt-0.5">{r.k}</div>
              <div className="col-span-9">
                <div className="mono text-[12px] text-slate-900">{r.v}</div>
                <p className="mt-0.5 text-[12px] text-slate-600 leading-[1.55]">{r.note}</p>
              </div>
            </div>
          ))}
          <div className="px-5 py-3 mono text-[10.5px] text-slate-500 leading-[1.55]">
            We do not extrapolate beyond the pilot window. We do not benchmark against industry averages — only against the baseline you entered at activation.
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- Hours-only banner (rendered when wage is null) ---------- */
function HoursOnlyBanner({ pilot, onAddWage }) {
  if (pilot.defaultWageUsd != null) return null;
  return (
    <div className="border border-slate-200 rounded-[3px] bg-amber-50/40 px-5 py-3 flex items-center justify-between gap-4">
      <div className="text-[12.5px] text-amber-900 leading-[1.55]">
        <span className="mono uppercase tracking-[0.14em] text-[10.5px] mr-2 text-amber-800">Hours-only mode</span>
        You haven't set a default wage. ROI is rendered in reviewer-hours throughout this console — the math is identical, just no dollar conversion.
      </div>
      {onAddWage && (
        <Button variant="secondary" size="sm" onClick={onAddWage}>
          Add wage in Activation
        </Button>
      )}
    </div>
  );
}

window.RoiStatusPip = RoiStatusPip;
window.RoiConsoleHeader = RoiConsoleHeader;
window.HeadlineMetric = HeadlineMetric;
window.RoiHeadlineStrip = RoiHeadlineStrip;
window.DecisionFlowFunnel = DecisionFlowFunnel;
window.RoiTimelineChart = RoiTimelineChart;
window.LaneBreakdownTable = LaneBreakdownTable;
window.PerDecisionCompare = PerDecisionCompare;
window.TtfdSparkline = TtfdSparkline;
window.MethodologyPanel = MethodologyPanel;
window.HoursOnlyBanner = HoursOnlyBanner;
