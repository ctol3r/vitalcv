// WAVE 20 · Inbox v2 — Knowledge Inbox Triage Workspace · Components
//
// Three-column triage workspace. v2 explicitly classify-only (no verify CTA).
// Adds source-feed sidebar, age + tier filters, multi-select bulk dispositions.
// Reuses Wave 19's ConfidenceBadge for tier annotation.

/* ---------- Source-feed sidebar ---------- */
function InboxSourceSidebar({ sources, activeSourceId, onSelectSource, counts }) {
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  return (
    <Card className="p-0 overflow-hidden h-full">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
        <div className="mono text-[10.5px] uppercase tracking-[0.14em] text-slate-500">Source feeds</div>
        <span className="mono text-[10.5px] text-slate-400 tabular-nums">{total} pending</span>
      </div>
      <ul className="divide-y divide-slate-100">
        <li>
          <button
            onClick={() => onSelectSource(null)}
            className={cn(
              'w-full text-left px-4 py-2.5 flex items-center justify-between hover:bg-slate-50 transition-colors',
              activeSourceId === null && 'bg-slate-50'
            )}
          >
            <div>
              <div className="text-[13px] font-medium text-slate-900">All sources</div>
              <div className="text-[11px] text-slate-500">Combined feed</div>
            </div>
            <span className="mono text-[11px] text-slate-700 tabular-nums">{total}</span>
          </button>
        </li>
        {sources.map(s => {
          const c = counts[s.id] || 0;
          const active = activeSourceId === s.id;
          return (
            <li key={s.id}>
              <button
                onClick={() => onSelectSource(s.id)}
                className={cn(
                  'w-full text-left px-4 py-2.5 flex items-center justify-between hover:bg-slate-50 transition-colors',
                  active && 'bg-slate-50'
                )}
              >
                <div className="min-w-0">
                  <div className="text-[13px] font-medium text-slate-900 truncate">{s.name}</div>
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                    <span>{s.scope}</span>
                    <span className="text-slate-300">·</span>
                    <span className="mono">{s.lastFetched}</span>
                    {s.state === 'degraded' && (
                      <>
                        <span className="text-slate-300">·</span>
                        <span className="text-amber-700">degraded</span>
                      </>
                    )}
                  </div>
                </div>
                <span className={cn(
                  'mono text-[11px] tabular-nums shrink-0 ml-2',
                  c > 0 ? 'text-slate-900' : 'text-slate-400'
                )}>{c}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

/* ---------- Filter chips row ---------- */
function InboxFilterChips({ stage, onStageChange, ageWindow, onAgeChange, tier, onTierChange, classifyOnlyNote = true }) {
  const stageBtn = (id, label) => (
    <button
      key={id}
      onClick={() => onStageChange(id)}
      className={cn(
        'px-3 py-1.5 mono text-[11px] uppercase tracking-[0.08em] rounded-md ring-1 transition-colors',
        stage === id
          ? 'bg-slate-900 text-white ring-slate-900'
          : 'bg-white text-slate-700 ring-slate-300 hover:bg-slate-50'
      )}
    >
      {label}
    </button>
  );

  const tierBtn = (id, label) => (
    <button
      key={id}
      onClick={() => onTierChange(id === tier ? null : id)}
      className={cn(
        'px-2.5 py-1 mono text-[11px] uppercase tracking-[0.08em] rounded-md ring-1 transition-colors',
        tier === id
          ? 'bg-slate-900 text-white ring-slate-900'
          : 'bg-white text-slate-700 ring-slate-300 hover:bg-slate-50'
      )}
    >
      {label}
    </button>
  );

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-1">
        {stageBtn('incoming', 'Incoming')}
        {stageBtn('triaged',  'Triaged')}
        {stageBtn('resolved', 'Resolved')}
      </div>
      <div className="h-5 w-px bg-slate-200" />
      <div className="flex items-center gap-1.5">
        <span className="mono text-[10.5px] uppercase tracking-[0.12em] text-slate-500">Age</span>
        <select
          value={ageWindow}
          onChange={(e) => onAgeChange(e.target.value)}
          className="mono text-[11px] uppercase tracking-[0.08em] rounded-md ring-1 ring-slate-300 bg-white px-2 py-1"
        >
          <option value="all">All</option>
          {window.INBOX_FILTERS_AGE_WINDOWS.map(w => (
            <option key={w.id} value={w.id}>{w.label}</option>
          ))}
        </select>
      </div>
      <div className="h-5 w-px bg-slate-200" />
      <div className="flex items-center gap-1.5">
        <span className="mono text-[10.5px] uppercase tracking-[0.12em] text-slate-500">Tier</span>
        {tierBtn('verified',     'V')}
        {tierBtn('inferred',     'I')}
        {tierBtn('unknown',      '?')}
        {tierBtn('contradicted', '⑂')}
      </div>
      {classifyOnlyNote && (
        <div className="ml-auto flex items-center gap-1.5 text-[11px] text-slate-500">
          <Icon.Info size={12} className="text-slate-400" />
          <span>Inbox classifies; verification happens in primary-source lanes</span>
        </div>
      )}
    </div>
  );
}

/* ---------- Item list ---------- */
function InboxItemList({ items, selectedIds, onToggleSelect, focusedId, onFocus }) {
  if (items.length === 0) {
    return (
      <div className="text-center py-12 text-[13px] text-slate-500">
        <Icon.Inbox size={28} className="mx-auto mb-2 text-slate-300" />
        <div className="font-medium text-slate-700 mb-0.5">Inbox clear</div>
        <div className="text-[12px]">No items match the current filters.</div>
      </div>
    );
  }
  return (
    <ul className="divide-y divide-slate-100">
      {items.map(item => {
        const tcfg = window.INBOX_ITEM_TYPES[item.type] || { label: item.type, glyph: '·', cls: 'bg-slate-100 text-slate-700 ring-slate-300' };
        const selected = selectedIds.includes(item.id);
        const focused = focusedId === item.id;
        return (
          <li key={item.id}>
            <div
              className={cn(
                'group relative flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors',
                focused ? 'bg-indigo-50/60' : 'hover:bg-slate-50',
              )}
              onClick={() => onFocus(item.id)}
            >
              <input
                type="checkbox"
                checked={selected}
                onChange={(e) => { e.stopPropagation(); onToggleSelect(item.id); }}
                onClick={(e) => e.stopPropagation()}
                className="mt-1 shrink-0 rounded border-slate-300"
                aria-label={`Select ${item.id}`}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                  <span className={cn(
                    'mono text-[10px] uppercase tracking-[0.1em] px-1.5 py-0.5 rounded ring-1',
                    tcfg.cls
                  )}>
                    <span className="mr-1">{tcfg.glyph}</span>{tcfg.label}
                  </span>
                  <ConfidenceBadge tier={item.tier} size="xs" />
                  {item.sourceDegraded && (
                    <span className="mono text-[10px] uppercase tracking-[0.08em] text-amber-700">source-degraded</span>
                  )}
                  <span className="text-[11px] text-slate-400 mono ml-auto tabular-nums">{item.age}</span>
                </div>
                <div className="text-[13.5px] text-slate-900 leading-snug">{item.summary}</div>
                <div className="mt-1 flex items-center gap-2 text-[11px] text-slate-500">
                  <span className="font-medium">{item.subjectRef.display}</span>
                  <span className="text-slate-300">·</span>
                  <span className="mono tabular-nums">NPI {item.subjectRef.npi}</span>
                  <span className="text-slate-300">·</span>
                  <span>{(window.INBOX_SOURCES.find(s => s.id === item.sourceId) || {}).name || item.sourceId}</span>
                </div>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/* ---------- Bulk action bar ---------- */
function BulkActionBar({ count, onDispose, onClear }) {
  if (count === 0) return null;
  return (
    <div className="sticky bottom-4 z-10 mx-auto max-w-2xl">
      <div className="bg-slate-900 text-white rounded-xl shadow-lg ring-1 ring-slate-700 px-4 py-2.5 flex items-center gap-3">
        <span className="mono text-[11.5px] uppercase tracking-[0.12em] tabular-nums">{count} selected</span>
        <div className="h-4 w-px bg-slate-700" />
        <div className="flex items-center gap-1.5 flex-wrap">
          {window.INBOX_DISPOSITIONS.map(d => (
            <button
              key={d.id}
              onClick={() => onDispose(d.id)}
              title={d.hint}
              className="mono text-[11px] uppercase tracking-[0.08em] px-2.5 py-1 rounded-md ring-1 ring-slate-700 bg-slate-800 hover:bg-slate-700 transition-colors"
            >
              {d.label}
            </button>
          ))}
        </div>
        <button
          onClick={onClear}
          className="ml-auto text-[12px] text-slate-300 hover:text-white"
        >
          Clear
        </button>
      </div>
    </div>
  );
}

/* ---------- Detail panel ---------- */
function InboxDetailPanel({ item, onDispose, onClose }) {
  if (!item) {
    return (
      <Card className="p-6 h-full flex items-center justify-center">
        <div className="text-center text-slate-500">
          <Icon.Inbox size={32} className="mx-auto mb-2 text-slate-300" />
          <div className="text-[13px] font-medium text-slate-700">Select an item to inspect</div>
          <div className="text-[12px] mt-1">Evidence + suggested disposition appear here.</div>
        </div>
      </Card>
    );
  }
  const tcfg = window.INBOX_ITEM_TYPES[item.type] || { label: item.type, glyph: '·', cls: 'bg-slate-100' };
  const src = window.INBOX_SOURCES.find(s => s.id === item.sourceId) || { name: item.sourceId };
  const disposed = item.stage === 'resolved';
  return (
    <Card className="p-0 overflow-hidden flex flex-col h-full">
      <div className="px-5 py-4 border-b border-slate-100">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1.5">
              <span className={cn('mono text-[10px] uppercase tracking-[0.1em] px-1.5 py-0.5 rounded ring-1', tcfg.cls)}>
                <span className="mr-1">{tcfg.glyph}</span>{tcfg.label}
              </span>
              <ConfidenceBadge tier={item.tier} size="sm" />
              {disposed && (
                <span className="mono text-[10.5px] uppercase tracking-[0.08em] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20">
                  resolved
                </span>
              )}
            </div>
            <h3 className="text-[15.5px] font-semibold text-slate-900 leading-snug">{item.summary}</h3>
            <div className="mt-1 text-[12px] text-slate-500">
              <span className="font-medium text-slate-700">{item.subjectRef.display}</span>
              <span className="mx-1.5 text-slate-300">·</span>
              <span className="mono tabular-nums">NPI {item.subjectRef.npi}</span>
            </div>
          </div>
          {onClose && (
            <button onClick={onClose} className="text-slate-400 hover:text-slate-700 shrink-0" aria-label="Close detail">
              <Icon.X size={18} />
            </button>
          )}
        </div>
      </div>

      <div className="px-5 py-4 flex-1 overflow-y-auto space-y-5">
        {/* Source meta */}
        <section>
          <div className="mono text-[10.5px] uppercase tracking-[0.14em] text-slate-500 mb-2">Source</div>
          <div className="rounded-lg ring-1 ring-slate-200 bg-slate-50 px-3 py-2.5 flex items-center justify-between">
            <div>
              <div className="text-[13px] font-medium text-slate-900">{src.name}</div>
              <div className="text-[11px] text-slate-500">{src.scope}</div>
            </div>
            <div className="text-right">
              <div className="mono text-[10.5px] uppercase tracking-[0.08em] text-slate-500">last fetched</div>
              <div className="mono text-[12px] text-slate-900 tabular-nums">{src.lastFetched}</div>
            </div>
          </div>
        </section>

        {/* Evidence */}
        <section>
          <div className="mono text-[10.5px] uppercase tracking-[0.14em] text-slate-500 mb-2">Evidence</div>
          <dl className="rounded-lg ring-1 ring-slate-200 divide-y divide-slate-100">
            {(item.evidence || []).map((e, i) => (
              <div key={i} className="grid grid-cols-3 gap-3 px-3 py-2">
                <dt className="text-[11.5px] uppercase tracking-[0.06em] text-slate-500 col-span-1">{e.k}</dt>
                <dd className={cn(
                  'col-span-2 text-[12.5px] text-slate-900',
                  e.mono && 'mono tabular-nums'
                )}>{e.v}</dd>
              </div>
            ))}
          </dl>
        </section>

        {/* Classification disclaimer */}
        <section className="rounded-lg bg-amber-50 ring-1 ring-amber-600/20 px-3 py-2.5 text-[11.5px] text-amber-900 leading-relaxed">
          <div className="flex items-start gap-2">
            <Icon.Info size={13} className="mt-0.5 shrink-0" />
            <span>
              The inbox <strong>classifies</strong> incoming records. Tier elevation to <em>verified</em> happens
              in the primary-source lane workflow, not here. Accepting routes this item into the staged profile
              for downstream review.
            </span>
          </div>
        </section>
      </div>

      {/* Disposition footer */}
      {!disposed ? (
        <div className="px-5 py-3 border-t border-slate-100 bg-white">
          <div className="mono text-[10.5px] uppercase tracking-[0.14em] text-slate-500 mb-2">
            Disposition · suggested: <span className="text-slate-900">{item.suggestedDisposition}</span>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {window.INBOX_DISPOSITIONS.map(d => (
              <button
                key={d.id}
                onClick={() => onDispose(item.id, d.id)}
                title={d.hint}
                className={cn(
                  'mono text-[11px] uppercase tracking-[0.08em] px-2.5 py-1.5 rounded-md ring-1 transition-colors',
                  d.id === item.suggestedDisposition
                    ? 'bg-slate-900 text-white ring-slate-900 hover:bg-slate-800'
                    : 'bg-white text-slate-700 ring-slate-300 hover:bg-slate-50'
                )}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 text-[12px] text-slate-600">
          <span className="font-medium">Resolved {item.resolvedAt}</span> · disposition: <span className="mono">{item.disposition}</span> · recordedBy: <span className="mono">{item.resolvedBy}</span>
        </div>
      )}
    </Card>
  );
}

/* ---------- Source-feed health overview ---------- */
function SourceFeedHealth({ sources }) {
  return (
    <Card className="p-5">
      <div className="flex items-end justify-between mb-3">
        <div>
          <div className="mono text-[10.5px] uppercase tracking-[0.14em] text-slate-500 mb-1">Source feed health</div>
          <h3 className="text-[14px] font-semibold text-slate-900">Last fetch + state per feed</h3>
        </div>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        {sources.map(s => (
          <div key={s.id} className="rounded-lg ring-1 ring-slate-200 px-3 py-2.5">
            <div className="text-[12px] font-medium text-slate-900 truncate">{s.name}</div>
            <div className="mt-1 flex items-center justify-between text-[11px]">
              <span className="mono tabular-nums text-slate-500">{s.lastFetched}</span>
              <span className={cn(
                'mono uppercase tracking-[0.08em] text-[10px] px-1.5 py-0.5 rounded ring-1',
                s.state === 'fresh'    && 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
                s.state === 'degraded' && 'bg-amber-50 text-amber-700 ring-amber-600/20',
              )}>{s.state}</span>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

window.InboxSourceSidebar = InboxSourceSidebar;
window.InboxFilterChips = InboxFilterChips;
window.InboxItemList = InboxItemList;
window.BulkActionBar = BulkActionBar;
window.InboxDetailPanel = InboxDetailPanel;
window.SourceFeedHealth = SourceFeedHealth;
