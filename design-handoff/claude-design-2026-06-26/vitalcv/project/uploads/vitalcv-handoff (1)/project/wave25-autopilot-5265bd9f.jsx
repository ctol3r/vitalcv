// WAVE 25 · Career Autopilot v2 — components
// Calmer, ambient surface. ONE thing today + horizon + drift + this-week feed.

const POSTURE_CLS = {
  ambient:           { label: 'Ambient',           cls: 'border-emerald-700 text-emerald-800 bg-emerald-50' },
  'attention-needed':{ label: 'Attention needed',  cls: 'border-amber-700 text-amber-900 bg-amber-50' },
  urgent:            { label: 'Urgent',             cls: 'border-red-700 text-red-800 bg-red-50' },
};

function AutopilotV2Header({ clinician }) {
  const p = POSTURE_CLS[clinician.posture] || POSTURE_CLS.ambient;
  return (
    <div className="border border-slate-300 bg-white rounded-[3px] px-5 py-4 flex items-start justify-between gap-6 flex-wrap">
      <div className="min-w-0">
        <div className="mono text-[10px] uppercase tracking-[0.18em] text-slate-500">Career Autopilot · {clinician.asOf}</div>
        <h1 className="text-[24px] font-semibold tracking-[-0.02em] text-slate-900 leading-tight mt-1">
          {clinician.name}
        </h1>
        <div className="text-[12.5px] text-slate-700 mt-1 leading-[1.55] max-w-[60ch]">{clinician.postureSummary}</div>
        <div className="mono text-[10.5px] text-slate-500 mt-1.5 tabular-nums">
          NPI {clinician.npi} · monitoring since {clinician.monitoringSince} · last sync {clinician.lastSync}
        </div>
      </div>
      <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
        <span className={cn('mono text-[10px] uppercase tracking-[0.14em] border rounded-[3px] px-2 py-[3px] font-semibold', p.cls)}>
          [ {p.label} ]
        </span>
        <span className="mono text-[10px] uppercase tracking-[0.14em] border border-slate-900 text-slate-900 bg-white rounded-[3px] px-2 py-[3px] font-semibold">
          Trust {clinician.trustLevel} · {Math.round(clinician.trustScore * 100)}/100
        </span>
      </div>
    </div>
  );
}
window.AutopilotV2Header = AutopilotV2Header;

/* ---------- Today hero ---------- */
function AutopilotV2TodayHero({ today }) {
  return (
    <div className="border border-slate-900 bg-white rounded-[3px] overflow-hidden">
      <div className="px-5 py-2.5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
        <div className="mono text-[10px] uppercase tracking-[0.18em] text-slate-700">Today · one thing</div>
        <span className="mono text-[10px] text-slate-500">expires {today.expiresOn}</span>
      </div>
      <div className="px-5 py-5">
        <h2 className="text-[24px] font-semibold tracking-[-0.02em] text-slate-900 leading-tight">{today.title}</h2>
        <p className="text-[13px] text-slate-700 mt-1.5 leading-[1.55] max-w-[60ch]">{today.why}</p>
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
          <button className="text-left border border-slate-900 bg-slate-900 text-white rounded-[3px] px-4 py-3 hover:bg-black">
            <div className="mono text-[9.5px] uppercase tracking-[0.14em] text-slate-300">One-click</div>
            <div className="text-[13px] font-semibold mt-0.5 leading-snug">{today.oneClick}</div>
          </button>
          <button className="text-left border border-slate-300 bg-white text-slate-900 rounded-[3px] px-4 py-3 hover:bg-slate-50">
            <div className="mono text-[9.5px] uppercase tracking-[0.14em] text-slate-500">Browse alternatives</div>
            <div className="text-[13px] font-medium mt-0.5 leading-snug">{today.alternativeLabel}</div>
          </button>
        </div>
        <div className="mt-3 mono text-[10.5px] text-slate-500 leading-snug flex items-center gap-2">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-600" />
          {today.signal} · {today.estCompletion} · source: {today.source}
        </div>
      </div>
    </div>
  );
}
window.AutopilotV2TodayHero = AutopilotV2TodayHero;

/* ---------- Horizon ---------- */
const LANE_PILL = {
  system: { label: 'SYSTEM',  cls: 'border-blue-700 text-blue-800 bg-blue-50',     hint: 'we file this' },
  human:  { label: 'YOU',     cls: 'border-amber-700 text-amber-900 bg-amber-50',  hint: 'only you can do this' },
  watch:  { label: 'WATCH',   cls: 'border-slate-300 text-slate-600 bg-white',     hint: 'monitoring · no action' },
};

function AutopilotV2Horizon({ rows }) {
  const max = Math.max(...rows.map(r => r.days), 360);
  return (
    <div className="border border-slate-300 bg-white rounded-[3px]">
      <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-baseline justify-between">
        <div>
          <div className="mono text-[10px] uppercase tracking-[0.18em] text-slate-500">Horizon · 2 years</div>
          <div className="text-[12px] text-slate-700 mt-0.5">Lanes: <span className="text-blue-800 font-semibold">SYSTEM</span> we handle · <span className="text-amber-900 font-semibold">YOU</span> only you can · <span className="text-slate-600 font-semibold">WATCH</span> monitoring</div>
        </div>
        <span className="mono text-[10px] text-slate-500 tabular-nums">{rows.length} credentials</span>
      </div>
      <ul className="divide-y divide-slate-200">
        {rows.map(r => {
          const lane = LANE_PILL[r.lane];
          const pct = Math.min(100, (r.days / max) * 100);
          const overdue = r.days <= 0;
          return (
            <li key={r.id} className="grid grid-cols-[140px_1fr_180px_60px] items-center gap-4 px-4 py-3">
              <span className={cn('mono text-[9.5px] uppercase tracking-[0.14em] border rounded-[3px] px-1.5 py-[2px] font-semibold whitespace-nowrap text-center', lane.cls)}>
                {lane.label}
              </span>
              <div className="min-w-0">
                <div className="text-[12.5px] text-slate-900 font-medium leading-snug truncate">{r.label}</div>
                <div className="mono text-[10px] text-slate-500 mt-0.5 leading-snug truncate">{r.auth} · {r.note}</div>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                  <div className={cn('h-full', overdue ? 'bg-red-600' : r.days < 60 ? 'bg-amber-500' : r.lane === 'system' ? 'bg-blue-500' : 'bg-slate-700')}
                       style={{ width: pct + '%' }} />
                </div>
              </div>
              <div className={cn('mono text-[11px] tabular-nums text-right',
                overdue ? 'text-red-700 font-semibold' : r.days < 60 ? 'text-amber-800 font-semibold' : 'text-slate-700')}>
                {overdue ? 'now' : `${r.days}d`}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
window.AutopilotV2Horizon = AutopilotV2Horizon;

/* ---------- Drift score panel ---------- */
function AutopilotV2DriftPanel({ drift }) {
  return (
    <div className="border border-slate-300 bg-white rounded-[3px]">
      <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-baseline justify-between">
        <div>
          <div className="mono text-[10px] uppercase tracking-[0.18em] text-slate-500">Drift score</div>
          <div className="text-[12px] text-slate-700 mt-0.5">{drift.band} · refreshed {drift.asOf}</div>
        </div>
        <span className="mono text-[20px] font-semibold tabular-nums text-slate-900">{(drift.composite * 100).toFixed(0)}<span className="text-[12px] text-slate-500">/100</span></span>
      </div>
      <ul className="divide-y divide-slate-100">
        {drift.components.map(c => (
          <li key={c.id} className="grid grid-cols-[1fr_60px_50px] items-center gap-3 px-4 py-2.5">
            <div className="min-w-0">
              <div className="text-[11.5px] text-slate-900 leading-tight truncate">{c.label}</div>
              <div className="mono text-[10px] text-slate-500 mt-0.5 leading-snug truncate">{c.status} · {c.source}</div>
            </div>
            <div className="flex items-center gap-1">
              <div className="flex-1 h-1 bg-slate-200 rounded-full overflow-hidden">
                <div className={cn('h-full', c.score >= 0.95 ? 'bg-emerald-600' : c.score >= 0.85 ? 'bg-blue-600' : 'bg-amber-500')}
                     style={{ width: (c.score * 100) + '%' }} />
              </div>
            </div>
            <span className="mono text-[10px] text-slate-500 tabular-nums text-right whitespace-nowrap">w {Math.round(c.weight * 100)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
window.AutopilotV2DriftPanel = AutopilotV2DriftPanel;

/* ---------- Portability ---------- */
const PORT_STATUS_CLS = {
  home:     'border-slate-900 text-slate-900 bg-white',
  licensed: 'border-emerald-700 text-emerald-800 bg-emerald-50',
  compact:  'border-blue-700 text-blue-800 bg-blue-50',
  dormant:  'border-slate-300 text-slate-500 bg-white',
};
const PORT_STATUS_LBL = { home: 'HOME', licensed: 'LICENSED', compact: 'COMPACT', dormant: 'DORMANT' };

function AutopilotV2Portability({ rows }) {
  return (
    <div className="border border-slate-300 bg-white rounded-[3px]">
      <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
        <div className="mono text-[10px] uppercase tracking-[0.18em] text-slate-500">Where you could work</div>
        <div className="text-[12px] text-slate-700 mt-0.5">Time-to-practice if you needed to add a state, sorted by friction.</div>
      </div>
      <ul className="divide-y divide-slate-200">
        {rows.map(r => (
          <li key={r.state} className="grid grid-cols-[60px_1fr_90px_80px] items-center gap-3 px-4 py-2.5">
            <span className="mono text-[16px] font-semibold tabular-nums text-slate-900">{r.state}</span>
            <div className="min-w-0">
              <div className="text-[12.5px] text-slate-900 leading-tight truncate">{r.name}</div>
              <div className="mono text-[10px] text-slate-500 mt-0.5 leading-snug truncate">{r.note}</div>
            </div>
            <span className={cn('mono text-[9px] uppercase tracking-[0.14em] border rounded-[3px] px-1.5 py-[1px] font-semibold text-center',
              PORT_STATUS_CLS[r.status])}>
              {PORT_STATUS_LBL[r.status]}
            </span>
            <span className="mono text-[11px] text-slate-700 tabular-nums text-right">{r.ttp}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
window.AutopilotV2Portability = AutopilotV2Portability;

/* ---------- This week feed ---------- */
const WEEK_DOT = { monitor: 'bg-slate-400', auto: 'bg-blue-600', alert: 'bg-amber-600' };

function AutopilotV2ThisWeek({ rows }) {
  return (
    <div className="border border-slate-300 bg-white rounded-[3px]">
      <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
        <div className="mono text-[10px] uppercase tracking-[0.18em] text-slate-500">This week · receipt-backed</div>
        <div className="text-[12px] text-slate-700 mt-0.5">{rows.length} actions on your behalf · all logged.</div>
      </div>
      <ol className="divide-y divide-slate-100">
        {rows.map((e, i) => (
          <li key={i} className="px-4 py-2.5 flex items-start gap-3">
            <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5', WEEK_DOT[e.kind] || 'bg-slate-400')} />
            <div className="flex-1 min-w-0">
              <div className="text-[11.5px] text-slate-800 leading-snug">{e.what}</div>
              <div className="mono text-[10px] text-slate-500 mt-0.5 tabular-nums">{e.ts}</div>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
window.AutopilotV2ThisWeek = AutopilotV2ThisWeek;

/* ---------- Mailbox ---------- */
const MAILBOX_KIND = {
  sign:   { label: 'SIGN',    cls: 'border-slate-900 text-slate-900 bg-white' },
  review: { label: 'REVIEW',  cls: 'border-blue-700 text-blue-800 bg-blue-50' },
  attest: { label: 'ATTEST',  cls: 'border-amber-700 text-amber-900 bg-amber-50' },
};

function AutopilotV2Mailbox({ rows }) {
  return (
    <div className="border border-slate-300 bg-white rounded-[3px]">
      <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-baseline justify-between">
        <div className="mono text-[10px] uppercase tracking-[0.18em] text-slate-500">Mailbox · {rows.length}</div>
        <span className="mono text-[10px] text-slate-500">small backlog · no rush</span>
      </div>
      <ul className="divide-y divide-slate-200">
        {rows.map(r => {
          const k = MAILBOX_KIND[r.kind];
          return (
            <li key={r.id} className="px-4 py-3 flex items-start gap-3">
              <span className={cn('mono text-[9px] uppercase tracking-[0.14em] border rounded-[3px] px-1.5 py-[2px] font-semibold whitespace-nowrap mt-0.5', k.cls)}>
                {k.label}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-[12px] text-slate-900 leading-snug">{r.label}</div>
                <div className="mono text-[10px] text-slate-500 mt-0.5">{r.from} · {r.age}</div>
              </div>
              <button className="mono text-[10px] uppercase tracking-[0.12em] border border-slate-300 bg-white text-slate-700 rounded-[3px] px-2 py-1 hover:bg-slate-50 flex-shrink-0">
                Open
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
window.AutopilotV2Mailbox = AutopilotV2Mailbox;
