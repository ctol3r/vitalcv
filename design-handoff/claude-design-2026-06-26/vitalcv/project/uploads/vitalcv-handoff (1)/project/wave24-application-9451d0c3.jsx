// WAVE 24 · Application Active State — components
// Active composition surface: section rail, body, autofill drawer, submit gate.

/* ---------- Top header ---------- */
function AppV2Header({ meta, sections }) {
  const totals = sections.reduce((acc, s) => ({
    required: acc.required + s.required,
    filled: acc.filled + s.filled,
    conflicts: acc.conflicts + s.conflicts,
    autofilled: acc.autofilled + s.autofilled,
  }), { required: 0, filled: 0, conflicts: 0, autofilled: 0 });
  const pct = Math.round((totals.filled / totals.required) * 100);
  return (
    <div className="border border-slate-300 bg-white rounded-[3px]">
      <div className="px-5 py-4 border-b border-slate-200 flex items-start justify-between gap-6 flex-wrap">
        <div>
          <div className="mono text-[10px] uppercase tracking-[0.18em] text-slate-500">Application Packet · Active</div>
          <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-slate-900 leading-tight mt-1">
            {meta.applicationType} → {meta.destination}
          </h1>
          <div className="mono text-[11px] text-slate-500 tabular-nums mt-1">
            {meta.id} · {meta.packetVersion} · last saved {meta.lastSaved}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="mono text-[10px] uppercase tracking-[0.14em] border border-slate-300 bg-white text-slate-700 rounded-[3px] px-2 py-[3px]">
            ⟳ autosave · every {meta.autosaveSeconds}s
          </span>
          <button className="mono text-[11px] uppercase tracking-[0.12em] border border-slate-300 bg-white text-slate-700 rounded-[3px] px-2.5 py-1.5 hover:bg-slate-50">
            Save &amp; resume later
          </button>
          <button disabled className="mono text-[11px] uppercase tracking-[0.12em] border border-slate-400 bg-slate-100 text-slate-400 rounded-[3px] px-2.5 py-1.5 cursor-not-allowed">
            Submit packet · gated
          </button>
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-px bg-slate-200 border-t border-slate-200">
        <AppV2Stat label="Overall fill"   value={`${pct}%`}             sub={`${totals.filled}/${totals.required} required fields`} />
        <AppV2Stat label="Autofilled"      value={String(totals.autofilled)} sub="from primary sources" />
        <AppV2Stat label="Open conflicts"  value={String(totals.conflicts)}  sub={totals.conflicts ? 'must resolve before submit' : 'none'} tone={totals.conflicts ? 'fail' : 'ok'} />
        <AppV2Stat label="Active time"     value={`${meta.activeMinutes}m`}  sub={`${meta.sessionsCount} sessions`} />
        <AppV2Stat label="Target submit"   value={meta.expectedSubmitBy}     sub="self-set deadline" />
      </div>
    </div>
  );
}
window.AppV2Header = AppV2Header;

function AppV2Stat({ label, value, sub, tone }) {
  const toneCls = tone === 'fail' ? 'bg-red-50' : tone === 'warn' ? 'bg-amber-50' : 'bg-white';
  const valueCls = tone === 'fail' ? 'text-red-900' : tone === 'warn' ? 'text-amber-900' : 'text-slate-900';
  return (
    <div className={cn('px-4 py-3', toneCls)}>
      <div className="mono text-[9.5px] uppercase tracking-[0.14em] text-slate-500">{label}</div>
      <div className={cn('text-[22px] font-semibold tracking-[-0.02em] tabular-nums mt-0.5', valueCls)}>{value}</div>
      <div className="mono text-[10px] text-slate-500 mt-0.5">{sub}</div>
    </div>
  );
}

/* ---------- Section rail ---------- */
const SECTION_STATE_BADGE = {
  complete:    { label: 'COMPLETE',    cls: 'border-emerald-700 text-emerald-800 bg-emerald-50' },
  ready:       { label: 'READY',       cls: 'border-slate-900 text-slate-900 bg-white' },
  in_progress: { label: 'IN PROGRESS', cls: 'border-amber-700 text-amber-900 bg-amber-50' },
  blocked:     { label: 'BLOCKED',     cls: 'border-red-700 text-red-800 bg-red-50' },
  not_started: { label: 'NOT STARTED', cls: 'border-slate-300 text-slate-500 bg-white' },
};

function AppV2SectionRail({ sections, activeId, onSelect }) {
  return (
    <div className="border border-slate-300 bg-white rounded-[3px] overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
        <div className="mono text-[9.5px] uppercase tracking-[0.18em] text-slate-500">Sections · 10</div>
      </div>
      <ol>
        {sections.map((s, i) => {
          const active = activeId === s.id;
          const badge = SECTION_STATE_BADGE[s.state];
          const pct = s.required ? Math.round((s.filled / s.required) * 100) : 0;
          return (
            <li key={s.id}>
              <button onClick={() => onSelect && onSelect(s.id)}
                className={cn('w-full text-left px-4 py-3 border-l-2 transition-colors',
                  i < sections.length - 1 && 'border-b border-slate-100',
                  active ? 'bg-slate-50 border-l-slate-900' : 'border-l-transparent hover:bg-slate-50/70')}>
                <div className="flex items-baseline justify-between gap-2">
                  <div className="flex items-baseline gap-2 min-w-0">
                    <span className="mono text-[10px] text-slate-400 tabular-nums">{s.n}</span>
                    <span className={cn('text-[12.5px] leading-tight truncate',
                      active ? 'text-slate-900 font-medium' : 'text-slate-800')}>{s.label}</span>
                  </div>
                  <span className={cn('mono text-[8.5px] uppercase tracking-[0.14em] border rounded-[3px] px-1 py-[1px] font-semibold whitespace-nowrap', badge.cls)}>
                    {badge.label}
                  </span>
                </div>
                <div className="mt-1.5 flex items-center gap-2">
                  <div className="flex-1 h-1 bg-slate-200 rounded-full overflow-hidden">
                    <div className={cn('h-full',
                      s.state === 'complete' ? 'bg-emerald-600'
                      : s.state === 'blocked' ? 'bg-red-600'
                      : 'bg-slate-900')} style={{ width: pct + '%' }} />
                  </div>
                  <span className="mono text-[10px] text-slate-500 tabular-nums whitespace-nowrap">{s.filled}/{s.required}</span>
                </div>
                {(s.conflicts > 0 || s.autofilled > 0) && (
                  <div className="mt-1.5 flex items-center gap-2 mono text-[9.5px] text-slate-500">
                    {s.autofilled > 0 && <span>↘ {s.autofilled} autofilled</span>}
                    {s.conflicts > 0 && <span className="text-red-700 font-semibold">⚠ {s.conflicts} conflict</span>}
                  </div>
                )}
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
window.AppV2SectionRail = AppV2SectionRail;

/* ---------- Section body ---------- */
function AppV2SectionBody({ section, onResolveConflict }) {
  return (
    <div className="border border-slate-300 bg-white rounded-[3px]">
      <div className="px-5 py-4 border-b border-slate-200 flex items-baseline justify-between gap-4 flex-wrap">
        <div>
          <div className="mono text-[10px] uppercase tracking-[0.18em] text-slate-500">Section {section.n}</div>
          <h2 className="text-[18px] font-semibold tracking-[-0.02em] text-slate-900 mt-0.5">{section.label}</h2>
          {section.subtitle && <p className="text-[12px] text-slate-600 mt-1 max-w-[60ch] leading-[1.55]">{section.subtitle}</p>}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button className="mono text-[11px] uppercase tracking-[0.12em] border border-slate-300 bg-white text-slate-700 rounded-[3px] px-2.5 py-1.5 hover:bg-slate-50">Print section</button>
          <button className="mono text-[11px] uppercase tracking-[0.12em] border border-slate-900 bg-slate-900 text-white rounded-[3px] px-2.5 py-1.5 hover:bg-black">Initial &amp; certify</button>
        </div>
      </div>
      <ul className="divide-y divide-slate-200">
        {section.rows.map(r => <AppV2Row key={r.id} row={r} onResolveConflict={onResolveConflict} />)}
      </ul>
    </div>
  );
}
window.AppV2SectionBody = AppV2SectionBody;

const ROW_STATE_PILL = {
  filled:     { label: 'FILLED',     cls: 'border-slate-900 text-slate-900 bg-white' },
  autofilled: { label: 'AUTOFILLED', cls: 'border-blue-700 text-blue-800 bg-blue-50' },
  empty:      { label: 'EMPTY',      cls: 'border-slate-300 text-slate-400 bg-white' },
  conflict:   { label: 'CONFLICT',   cls: 'border-red-700 text-red-800 bg-red-50' },
  stale:      { label: 'STALE',      cls: 'border-amber-700 text-amber-900 bg-amber-50' },
};

function AppV2Row({ row, onResolveConflict }) {
  const pill = ROW_STATE_PILL[row.state];
  return (
    <li className="grid grid-cols-[200px_1fr_120px] items-start">
      <div className="px-4 py-3 border-r border-slate-200 bg-slate-50/60">
        <div className="mono text-[10px] tabular-nums text-slate-400">{row.id}</div>
        <div className="text-[11.5px] text-slate-700 leading-snug mt-0.5">{row.label}</div>
      </div>
      <div className="px-4 py-3">
        {row.state === 'conflict' ? (
          <ConflictResolver row={row} onResolve={onResolveConflict} />
        ) : row.state === 'empty' ? (
          <EmptyRowInput row={row} />
        ) : (
          <FilledRow row={row} />
        )}
      </div>
      <div className="px-3 py-3 border-l border-slate-200 flex flex-col items-center gap-1.5">
        <span className={cn('mono text-[9px] uppercase tracking-[0.14em] border rounded-[3px] px-1.5 py-[2px] font-semibold whitespace-nowrap', pill.cls)}>
          [ {pill.label} ]
        </span>
        {row.attested && (
          <span className="mono text-[8.5px] uppercase tracking-[0.14em] text-emerald-700">✓ attested</span>
        )}
      </div>
    </li>
  );
}

function FilledRow({ row }) {
  return (
    <>
      <div className="text-[13px] text-slate-900 leading-snug font-medium tabular-nums">{row.value}</div>
      <div className="mono text-[10px] text-slate-500 mt-1 leading-snug flex items-center gap-1.5">
        <span className={cn('inline-block w-1.5 h-1.5 rounded-full',
          row.source_kind === 'primary' ? 'bg-emerald-600'
          : row.source_kind === 'document' ? 'bg-blue-600'
          : 'bg-slate-400')} />
        {row.source}
      </div>
      {row.hint && (
        <div className={cn('mt-2 border-l-2 pl-3 pr-3 py-1.5 text-[11px] leading-snug',
          row.state === 'stale' ? 'border-amber-600 bg-amber-50 text-amber-900'
          : 'border-slate-300 bg-slate-50 text-slate-700')}>
          {row.hint}
        </div>
      )}
    </>
  );
}

function EmptyRowInput({ row }) {
  return (
    <>
      <div className="h-8 border border-dashed border-slate-400 bg-slate-50 rounded px-2 flex items-center">
        <span className="text-[11.5px] text-slate-400">Enter {row.label.toLowerCase()}…</span>
      </div>
      {row.hint && (
        <div className="mt-2 border-l-2 border-slate-400 pl-3 pr-3 py-1.5 text-[11px] text-slate-700 bg-slate-50 leading-snug">
          {row.hint}
        </div>
      )}
    </>
  );
}

function ConflictResolver({ row, onResolve }) {
  const [picked, setPicked] = React.useState(null);
  return (
    <div>
      <div className="mono text-[10px] uppercase tracking-[0.14em] text-red-800 font-semibold">⚠ Sources disagree</div>
      <div className="text-[11.5px] text-slate-700 mt-0.5 leading-snug">{row.conflict.message}</div>
      <div className="mt-2 grid gap-1.5">
        {row.conflict.choices.map(c => {
          const sel = picked === c.id;
          return (
            <button key={c.id} onClick={() => { setPicked(c.id); onResolve && onResolve(row.id, c.id); }}
              className={cn('text-left border rounded-[3px] px-3 py-2 transition-colors flex items-start gap-3',
                sel ? 'border-slate-900 bg-slate-50' : 'border-slate-300 bg-white hover:bg-slate-50')}>
              <span className={cn('mt-0.5 h-3 w-3 rounded-full border-2 flex-shrink-0',
                sel ? 'border-slate-900 bg-slate-900' : 'border-slate-400 bg-white')} />
              <span className="flex-1 min-w-0">
                <span className="block text-[12.5px] text-slate-900 font-medium tabular-nums">{c.label}</span>
                <span className="mono text-[10px] text-slate-500 mt-0.5 flex items-center gap-1.5">
                  <span className={cn('inline-block w-1.5 h-1.5 rounded-full',
                    c.source_kind === 'primary' ? 'bg-emerald-600' : 'bg-slate-400')} />
                  {c.source}
                  {c.recommended && <span className="ml-1 text-emerald-700 font-semibold">· recommended</span>}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- Autofill drawer ---------- */
function AppV2AutofillDrawer({ suggestions }) {
  return (
    <div className="border border-slate-300 bg-white rounded-[3px]">
      <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-baseline justify-between">
        <div>
          <div className="mono text-[10px] uppercase tracking-[0.18em] text-slate-500">Autofill from Inbox</div>
          <div className="text-[12px] text-slate-700 mt-0.5">{suggestions.length} suggestions ready · review each before applying</div>
        </div>
        <span className="mono text-[10px] text-slate-500">primary sources only</span>
      </div>
      <ul className="divide-y divide-slate-200">
        {suggestions.map(s => (
          <li key={s.id} className="px-4 py-3">
            <div className="flex items-baseline justify-between gap-3">
              <div className="min-w-0">
                <div className="mono text-[9.5px] uppercase tracking-[0.14em] text-slate-500">→ {s.targetRow} · {s.targetLabel}</div>
                <div className="text-[12.5px] text-slate-900 font-medium mt-0.5 leading-snug tabular-nums">{s.value}</div>
              </div>
              <span className={cn('mono text-[9px] uppercase tracking-[0.14em] border rounded-[3px] px-1.5 py-[1px] font-semibold whitespace-nowrap',
                s.confidence === 'high' ? 'border-emerald-700 text-emerald-800 bg-emerald-50'
                : 'border-amber-700 text-amber-900 bg-amber-50')}>
                {s.confidence}
              </span>
            </div>
            <div className="mono text-[10px] text-slate-500 mt-1.5 leading-snug">↘ {s.source}</div>
            <div className="mt-2 flex items-center gap-2">
              <button className="mono text-[10px] uppercase tracking-[0.12em] border border-slate-900 bg-slate-900 text-white rounded-[3px] px-2 py-1 hover:bg-black">Apply</button>
              <button className="mono text-[10px] uppercase tracking-[0.12em] border border-slate-300 bg-white text-slate-700 rounded-[3px] px-2 py-1 hover:bg-slate-50">Dismiss</button>
              <span className="mono text-[9.5px] text-slate-500">extracts: {s.extractedFields.join(', ')}</span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
window.AppV2AutofillDrawer = AppV2AutofillDrawer;

/* ---------- Submit gate ---------- */
const GATE_PILL = {
  pass:    { label: '✓ pass',    cls: 'border-emerald-700 text-emerald-800 bg-emerald-50' },
  warn:    { label: '⚠ warn',    cls: 'border-amber-700 text-amber-900 bg-amber-50' },
  partial: { label: '◐ partial', cls: 'border-amber-700 text-amber-900 bg-amber-50' },
  fail:    { label: '✕ fail',    cls: 'border-red-700 text-red-800 bg-red-50' },
};

function AppV2SubmitGate({ items }) {
  const fails = items.filter(i => i.state === 'fail').length;
  const warns = items.filter(i => i.state === 'warn' || i.state === 'partial').length;
  const passes = items.filter(i => i.state === 'pass').length;
  const ready = fails === 0 && warns === 0;
  return (
    <div className="border border-slate-900 bg-white rounded-[3px]">
      <div className={cn('px-4 py-3 border-b border-slate-200',
        ready ? 'bg-emerald-50' : fails > 0 ? 'bg-red-50' : 'bg-amber-50')}>
        <div className="mono text-[10px] uppercase tracking-[0.18em] text-slate-700">Submit gate</div>
        <div className="text-[14px] text-slate-900 font-semibold mt-0.5 leading-tight">
          {ready ? 'Ready to seal & submit'
            : fails > 0 ? `Not ready · ${fails} blocker${fails === 1 ? '' : 's'}`
            : `Almost ready · ${warns} warning${warns === 1 ? '' : 's'}`}
        </div>
        <div className="mono text-[10.5px] text-slate-600 mt-1 tabular-nums">
          {passes}/{items.length} pass · {warns} warn · {fails} fail
        </div>
      </div>
      <ul className="divide-y divide-slate-200">
        {items.map(i => {
          const pill = GATE_PILL[i.state];
          return (
            <li key={i.id} className="px-4 py-2.5 flex items-start gap-3">
              <span className={cn('mono text-[9px] uppercase tracking-[0.14em] border rounded-[3px] px-1.5 py-[2px] font-semibold whitespace-nowrap mt-0.5', pill.cls)}>
                {pill.label}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-[12px] text-slate-900 leading-snug">{i.label}</div>
                <div className="mono text-[10px] text-slate-500 mt-0.5 leading-snug">{i.detail}</div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
window.AppV2SubmitGate = AppV2SubmitGate;

/* ---------- Activity feed ---------- */
const ACTIVITY_DOT = {
  edit:      'bg-slate-700',
  autofill:  'bg-blue-600',
  conflict:  'bg-red-600',
  stale:     'bg-amber-600',
  milestone: 'bg-emerald-600',
  session:   'bg-slate-400',
};

function AppV2ActivityFeed({ events }) {
  return (
    <div className="border border-slate-300 bg-white rounded-[3px]">
      <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
        <div className="mono text-[10px] uppercase tracking-[0.18em] text-slate-500">Activity · last 7 days</div>
      </div>
      <ol className="divide-y divide-slate-100">
        {events.map((e, i) => (
          <li key={i} className="px-4 py-2.5 flex items-start gap-3">
            <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5', ACTIVITY_DOT[e.kind] || 'bg-slate-400')} />
            <div className="flex-1 min-w-0">
              <div className="text-[12px] text-slate-800 leading-snug">{e.what}</div>
              <div className="mono text-[10px] text-slate-500 mt-0.5 tabular-nums">
                {e.who} · {e.ts}
              </div>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
window.AppV2ActivityFeed = AppV2ActivityFeed;
