// Wave 8 — Strict Acceptance UX
// Components: AcceptanceGateBanner, PSVChecklist, RequirementsSummary, GateStamp.

/* ---------- Gate stamp ----------
 * A rectangular notarial mark that stamps the header.
 * Two modes: 'open' (ready for acceptance) and 'closed' (not ready).
 */
function GateStamp({ state = 'closed', size = 86 }) {
  const closed = state === 'closed';
  const stroke = closed ? '#b45309' : '#047857';
  const fill   = closed ? '#fffbeb' : '#ecfdf5';
  const deepInk = closed ? '#78350f' : '#064e3b';
  const w = size * 1.35, h = size;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} className="select-none" aria-hidden="true">
      <rect x="1" y="1" width={w-2} height={h-2} fill={fill} stroke={stroke} strokeWidth="1.4" />
      <rect x="4" y="4" width={w-8} height={h-8} fill="none" stroke={stroke} strokeWidth="0.5" strokeDasharray="2 2" opacity="0.6" />

      {/* Title bar */}
      <rect x="1" y="1" width={w-2} height={h*0.28} fill={stroke} />
      <text x={w/2} y={h*0.2} textAnchor="middle" fontFamily="Geist Mono, monospace" fontSize={h*0.13} fontWeight="700" fill="#fff" letterSpacing="2">
        {closed ? 'NOT READY' : 'READY'}
      </text>

      {/* Body */}
      <text x={w/2} y={h*0.5} textAnchor="middle" fontFamily="Geist Mono, monospace" fontSize={h*0.1} fill={deepInk} letterSpacing="1.5">
        ACCEPTANCE GATE
      </text>
      <text x={w/2} y={h*0.65} textAnchor="middle" fontFamily="Geist Mono, monospace" fontSize={h*0.08} fill={deepInk} letterSpacing="1">
        NCQA CR §3
      </text>

      {/* Footer — ruleset ID */}
      <line x1={w*0.1} y1={h*0.75} x2={w*0.9} y2={h*0.75} stroke={stroke} strokeWidth="0.5" />
      <text x={w/2} y={h*0.88} textAnchor="middle" fontFamily="Geist Mono, monospace" fontSize={h*0.085} fill={deepInk}>
        VCV-PSV-2026.04
      </text>
    </svg>
  );
}
window.GateStamp = GateStamp;

/* ---------- Status pill for a PSV rule ---------- */
function PSVStatusPill({ status }) {
  const map = {
    met:       { label: 'MET',      cls: 'text-emerald-700 bg-emerald-50 border-emerald-600/40' },
    pending:   { label: 'IN FLIGHT',cls: 'text-amber-700  bg-amber-50  border-amber-600/40' },
    unmet:     { label: 'UNMET',    cls: 'text-slate-700  bg-white      border-slate-300' },
    blocking:  { label: 'BLOCKING', cls: 'text-red-700    bg-red-50     border-red-600/40' },
    not_applicable: { label: 'N/A', cls: 'text-slate-500  bg-slate-50   border-slate-200' },
  };
  const m = map[status] || map.unmet;
  return (
    <span className={cn('mono text-[9.5px] uppercase tracking-[0.14em] border rounded px-1.5 py-[2px] whitespace-nowrap', m.cls)}>
      [ {m.label} ]
    </span>
  );
}
window.PSVStatusPill = PSVStatusPill;

/* ---------- Actor chip ---------- */
function ActorChip({ actor }) {
  const map = {
    auto:      { label: 'Automatic',   icon: Icon.Activity, tone: 'text-slate-600 border-slate-300' },
    employer:  { label: 'Employer action', icon: Icon.Building, tone: 'text-indigo-700 border-indigo-600/30' },
    clinician: { label: 'Clinician action', icon: Icon.Fingerprint, tone: 'text-slate-700 border-slate-400/40' },
  };
  const m = map[actor] || map.auto;
  const I = m.icon;
  return (
    <span className={cn('mono inline-flex items-center gap-1 text-[9.5px] uppercase tracking-[0.12em] border rounded px-1.5 py-[2px] whitespace-nowrap bg-white', m.tone)}>
      {I && <I size={9} />}
      <span>{m.label}</span>
    </span>
  );
}
window.ActorChip = ActorChip;

/* ---------- PSV Checklist table ----------
 * The strict table. Every required rule, every actor, every miss.
 */
function PSVChecklist({ gate, onRequestAction }) {
  if (!gate) return null;
  return (
    <div className="border border-slate-900 rounded-md bg-white overflow-hidden">
      {/* Header bar */}
      <div className="bg-slate-950 text-slate-100 px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon.Stamp size={13} className="text-slate-300" />
          <span className="mono text-[10.5px] uppercase tracking-[0.14em] text-slate-100">Primary-Source Verification Checklist</span>
        </div>
        <div className="flex items-center gap-2.5">
          <span className="mono text-[9.5px] uppercase tracking-[0.14em] text-slate-400">Ruleset</span>
          <span className="mono text-[10.5px] text-emerald-300 tabular-nums">{gate.ruleset.id}</span>
          <span className="mono text-[9.5px] text-slate-500">· v{gate.ruleset.version}</span>
        </div>
      </div>

      {/* Column head */}
      <div className="grid grid-cols-[40px_1fr_90px_130px_110px_110px] gap-0 bg-slate-50 border-b border-slate-200 mono text-[9.5px] uppercase tracking-[0.12em] text-slate-500">
        <div className="px-3 py-2">#</div>
        <div className="px-3 py-2">Requirement</div>
        <div className="px-3 py-2 text-center">Min tier</div>
        <div className="px-3 py-2">Actor</div>
        <div className="px-3 py-2">Standard</div>
        <div className="px-3 py-2 text-right">Status</div>
      </div>

      {/* Rows */}
      <ul>
        {gate.checks.map((c, i) => {
          const r = c.rule;
          const rowTone =
            c.status === 'met'      ? 'bg-white' :
            c.status === 'pending'  ? 'bg-amber-50/40' :
            c.status === 'blocking' ? 'bg-red-50/40' :
            c.status === 'not_applicable' ? 'bg-slate-50/70' :
            'bg-white';
          return (
            <li key={r.id} className={cn('grid grid-cols-[40px_1fr_90px_130px_110px_110px] gap-0 border-b border-slate-100 last:border-b-0', rowTone)}>
              <div className="px-3 py-3 mono text-[10.5px] text-slate-400 tabular-nums">{String(i+1).padStart(2, '0')}</div>
              <div className="px-3 py-3 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[12.5px] font-medium text-slate-900">{r.label}</span>
                  {!r.required && <span className="mono text-[9px] uppercase tracking-[0.12em] text-slate-400 border border-slate-200 rounded px-1 py-[1px]">OPTIONAL</span>}
                </div>
                {c.reason && c.status !== 'met' && (
                  <div className="text-[11.5px] text-slate-500 mt-0.5 leading-snug">{c.reason}</div>
                )}
              </div>
              <div className="px-3 py-3 flex items-center justify-center">
                <TrustTierBadge tier={r.minTier} showBar={false} />
              </div>
              <div className="px-3 py-3 flex items-center">
                <ActorChip actor={r.actor} />
              </div>
              <div className="px-3 py-3 mono text-[10px] text-slate-500 uppercase tracking-[0.08em] leading-tight">
                {r.standard}
              </div>
              <div className="px-3 py-3 flex items-center justify-end">
                <PSVStatusPill status={c.status} />
              </div>
            </li>
          );
        })}
      </ul>

      {/* Footer */}
      <div className="bg-slate-50 border-t border-slate-200 px-4 py-2.5 flex items-center justify-between">
        <div className="mono text-[10px] text-slate-500">
          {gate.counts.met} of {gate.counts.required} required requirements met
          {gate.counts.pending > 0 && <span> · <span className="text-amber-700">{gate.counts.pending} in flight</span></span>}
          {gate.counts.unmet > 0   && <span> · <span className="text-slate-900 font-medium">{gate.counts.unmet} unmet</span></span>}
          {gate.counts.blocking > 0 && <span> · <span className="text-red-700 font-medium">{gate.counts.blocking} blocking</span></span>}
        </div>
        <div className="mono text-[10px] text-slate-500">
          Effective {gate.ruleset.effective} · {gate.ruleset.standard}
        </div>
      </div>
    </div>
  );
}
window.PSVChecklist = PSVChecklist;

/* ---------- Acceptance Gate Banner ----------
 * Prominent state at the top of the Employer Console before decision.
 * Open (ready) → permissive, emerald tone
 * Closed (not ready) → authoritative, amber tone, lists blockers crisply
 */
function AcceptanceGateBanner({ gate, onInvokeAccess, onScrollToChecklist }) {
  if (!gate) return null;
  const ready = gate.ready;
  const blocks = gate.checks.filter(c => c.status === 'unmet' || c.status === 'blocking');
  const pendings = gate.checks.filter(c => c.status === 'pending');
  const employerBlocks = blocks.filter(c => c.rule.actor === 'employer');
  const clinicianBlocks = blocks.filter(c => c.rule.actor === 'clinician');
  const autoBlocks = blocks.filter(c => c.rule.actor === 'auto');

  const headerCls = ready
    ? 'border-emerald-700 bg-emerald-50/30'
    : 'border-amber-700 bg-amber-50/30';

  return (
    <div className={cn('relative border-[1.5px] rounded-md bg-white overflow-hidden mb-6', headerCls)}>
      <div className={cn('h-1', ready
        ? 'bg-gradient-to-r from-emerald-800 via-emerald-600 to-emerald-800'
        : 'bg-gradient-to-r from-amber-800 via-amber-600 to-amber-800')}
      />
      <div className="p-5 md:p-6 grid grid-cols-12 gap-5 items-start">
        <div className="col-span-12 md:col-span-2 flex md:justify-start justify-center">
          <GateStamp state={ready ? 'open' : 'closed'} size={80} />
        </div>

        <div className="col-span-12 md:col-span-7">
          <div className="mono text-[10px] uppercase tracking-[0.2em] text-slate-500">
            Acceptance Gate · NCQA CR §3
          </div>
          <h2 className="text-[22px] md:text-[24px] font-semibold tracking-[-0.02em] text-slate-900 leading-[1.15] mt-1">
            {ready
              ? 'All required primary-source verifications are satisfied.'
              : 'Not ready for acceptance — required verifications are unmet.'}
          </h2>
          <p className="text-[12.5px] text-slate-600 mt-2 leading-[1.55] max-w-[640px]">
            {ready
              ? 'This packet clears the published ruleset. You may accept as the system of record without exception.'
              : 'VitalCV will not permit acceptance until the checklist below is cleared. This enforces the same standard your MSO is audited against.'}
          </p>

          {/* Progress bar */}
          <div className="mt-4">
            <div className="flex items-center justify-between mb-1.5">
              <span className="mono text-[10px] uppercase tracking-[0.14em] text-slate-500">Required verifications</span>
              <span className="mono text-[11px] text-slate-900 tabular-nums">
                {gate.counts.met}<span className="text-slate-400"> / {gate.counts.required}</span>
              </span>
            </div>
            <div className="h-2 bg-slate-100 rounded-[2px] overflow-hidden flex">
              {gate.checks.filter(c => c.rule.required).map((c, i) => (
                <div key={i}
                  className={cn('h-full border-r border-white last:border-r-0',
                    c.status === 'met' && 'bg-emerald-600',
                    c.status === 'pending' && 'bg-amber-500',
                    c.status === 'unmet' && 'bg-slate-200',
                    c.status === 'blocking' && 'bg-red-600',
                  )}
                  style={{ width: `${100 / gate.counts.required}%` }}
                  title={`${c.rule.label} — ${c.status}`}
                />
              ))}
            </div>
          </div>

          {!ready && (
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-2">
              <BlockerTally tone="indigo"  count={employerBlocks.length}  label="Employer action" sub="Invoke gated source" />
              <BlockerTally tone="slate"   count={clinicianBlocks.length} label="Clinician action" sub="Pending clinician" />
              <BlockerTally tone="amber"   count={pendings.length}        label="In flight"        sub="Auto-updating" />
            </div>
          )}
        </div>

        {/* Action column */}
        <div className="col-span-12 md:col-span-3">
          <div className={cn('rounded-md border p-3.5',
            ready ? 'border-emerald-700 bg-emerald-50' : 'border-slate-900 bg-slate-950 text-slate-100')}>
            <div className={cn('mono text-[9.5px] uppercase tracking-[0.14em]',
              ready ? 'text-emerald-700' : 'text-slate-400')}>
              Decision status
            </div>
            <div className={cn('text-[15px] font-semibold leading-tight mt-1',
              ready ? 'text-emerald-900' : 'text-white')}>
              {ready ? 'Accept enabled' : 'Accept locked'}
            </div>
            {!ready && (
              <div className="mono text-[10.5px] text-slate-400 mt-1.5 leading-snug">
                The Accept action is disabled until the checklist is cleared. Other decisions
                (request info, refresh, reject) remain available.
              </div>
            )}
            <button
              type="button"
              onClick={onScrollToChecklist}
              className={cn('mt-3 w-full inline-flex items-center justify-between rounded px-2.5 py-1.5 text-[11.5px] font-medium',
                ready ? 'bg-white border border-emerald-700 text-emerald-800 hover:bg-emerald-50'
                     : 'bg-slate-900 ring-1 ring-inset ring-slate-700 text-white hover:bg-slate-800')}>
              <span>{ready ? 'Review ruleset' : 'Jump to checklist'}</span>
              <Icon.ArrowDown size={12} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
window.AcceptanceGateBanner = AcceptanceGateBanner;

function BlockerTally({ count, label, sub, tone = 'slate' }) {
  const toneMap = {
    slate:   { ring: 'ring-slate-300',   text: 'text-slate-900',   count: 'text-slate-900' },
    indigo:  { ring: 'ring-indigo-600/30', text: 'text-indigo-900', count: 'text-indigo-700' },
    amber:   { ring: 'ring-amber-600/30',  text: 'text-amber-900',  count: 'text-amber-700' },
  };
  const t = toneMap[tone] || toneMap.slate;
  return (
    <div className={cn('bg-white rounded border ring-1 ring-inset p-2.5', t.ring, 'border-transparent')}>
      <div className="flex items-baseline gap-1.5">
        <span className={cn('mono text-[20px] font-semibold tabular-nums', t.count)}>{String(count).padStart(2, '0')}</span>
        <span className="mono text-[9.5px] uppercase tracking-[0.14em] text-slate-500">{label}</span>
      </div>
      <div className="text-[11px] text-slate-500 mt-0.5">{sub}</div>
    </div>
  );
}
window.BlockerTally = BlockerTally;

/* ---------- Requirements summary (compact, for sidebars / clinician view) ---------- */
function RequirementsSummary({ gate, compact = false }) {
  if (!gate) return null;
  const unmet = gate.checks.filter(c => c.status !== 'met' && c.status !== 'not_applicable');
  return (
    <div className="border border-slate-200 bg-white rounded-md overflow-hidden">
      <div className="px-4 py-2.5 border-b border-slate-200 bg-slate-50/60 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon.Stamp size={13} className="text-slate-700" />
          <span className="text-[12.5px] font-semibold text-slate-900">What's required before acceptance</span>
        </div>
        <span className="mono text-[9.5px] uppercase tracking-[0.14em] text-slate-500">{gate.counts.met}/{gate.counts.required}</span>
      </div>
      <ul>
        {gate.checks.filter(c => c.rule.required).map((c, i, arr) => (
          <li key={c.rule.id} className={cn('px-4 py-2.5 flex items-start gap-3', i < arr.length - 1 && 'border-b border-slate-100')}>
            <div className={cn('h-4 w-4 rounded-sm border flex items-center justify-center flex-shrink-0 mt-[2px]',
              c.status === 'met'      && 'bg-emerald-600 border-emerald-600',
              c.status === 'pending'  && 'bg-amber-50 border-amber-500',
              c.status === 'unmet'    && 'bg-white border-slate-400',
              c.status === 'blocking' && 'bg-red-600 border-red-600',
            )}>
              {c.status === 'met' && <Icon.Check size={11} className="text-white" strokeWidth={3} />}
              {c.status === 'blocking' && <Icon.X size={10} className="text-white" strokeWidth={3} />}
              {c.status === 'pending' && <span className="h-1 w-1 rounded-full bg-amber-600 pulse-soft" />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={cn('text-[12.5px]',
                  c.status === 'met' ? 'text-slate-500 line-through decoration-slate-300' : 'text-slate-900 font-medium')}>
                  {c.rule.label}
                </span>
                <TrustTierBadge tier={c.rule.minTier} size="sm" showBar={false} />
              </div>
              {c.status !== 'met' && (
                <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1.5">
                  <ActorChip actor={c.rule.actor} />
                  {c.reason && <span className="truncate">{c.reason}</span>}
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>
      <div className="border-t border-slate-200 bg-slate-50 px-4 py-2 mono text-[9.5px] text-slate-500 uppercase tracking-[0.12em] flex items-center justify-between">
        <span>Ruleset · {gate.ruleset.id}</span>
        <span className="text-slate-400">v{gate.ruleset.version}</span>
      </div>
    </div>
  );
}
window.RequirementsSummary = RequirementsSummary;
