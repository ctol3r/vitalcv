// VIEW · Inbox v2 — three-column triage workspace
// Layout: [Source feed sidebar] · [Item list + filters] · [Detail panel]

function ViewInboxV2() {
  const items = window.INBOX_ITEMS || [];
  const sources = window.INBOX_SOURCES || [];

  const [activeSourceId, setActiveSourceId] = React.useState(null);
  const [stage, setStage]         = React.useState('incoming');
  const [ageWindow, setAgeWindow] = React.useState('all');
  const [tier, setTier]           = React.useState(null);
  const [selectedIds, setSelectedIds] = React.useState([]);
  const [focusedId, setFocusedId]   = React.useState(items[0]?.id || null);
  const [localItems, setLocalItems] = React.useState(items);

  // Filter
  const visible = React.useMemo(() => {
    return localItems.filter(it => {
      if (it.stage !== stage) return false;
      if (activeSourceId && it.sourceId !== activeSourceId) return false;
      if (tier && it.tier !== tier) return false;
      if (ageWindow !== 'all') {
        // Crude string-based match for demo: 'm ago' / 'h ago' / 'd ago'
        const a = it.age || '';
        if (ageWindow === '1h'  && !/m ago$/.test(a)) return false;
        if (ageWindow === '24h' && !/(m ago|h ago)$/.test(a)) return false;
        if (ageWindow === '7d'  && /[0-9]+w ago$/.test(a)) return false;
        if (ageWindow === 'older' && !/w ago$|y ago$/.test(a)) return false;
      }
      return true;
    });
  }, [localItems, stage, activeSourceId, tier, ageWindow]);

  // Counts per source — only for current stage
  const counts = React.useMemo(() => {
    const map = {};
    sources.forEach(s => { map[s.id] = 0; });
    localItems.forEach(it => {
      if (it.stage !== stage) return;
      map[it.sourceId] = (map[it.sourceId] || 0) + 1;
    });
    return map;
  }, [localItems, sources, stage]);

  const focused = visible.find(i => i.id === focusedId) || null;

  const toggleSelect = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const dispose = (idOrIds, dispositionId) => {
    const ids = Array.isArray(idOrIds) ? idOrIds : [idOrIds];
    setLocalItems(prev => prev.map(it => {
      if (!ids.includes(it.id)) return it;
      const newStage = dispositionId === 'snooze' ? 'incoming' : 'resolved';
      return {
        ...it,
        stage: newStage,
        disposition: dispositionId,
        resolvedAt: newStage === 'resolved' ? 'just now' : it.resolvedAt,
        resolvedBy: newStage === 'resolved' ? 'demo' : it.resolvedBy,
      };
    }));
    setSelectedIds([]);
  };

  const bulkDispose = (dispositionId) => dispose(selectedIds, dispositionId);

  // Header counts
  const stageCounts = React.useMemo(() => {
    const c = { incoming: 0, triaged: 0, resolved: 0 };
    localItems.forEach(it => { if (c[it.stage] != null) c[it.stage]++; });
    return c;
  }, [localItems]);

  return (
    <div className="max-w-[1500px] mx-auto px-6 py-8">
      {/* Header */}
      <header className="mb-6">
        <div className="flex items-end justify-between flex-wrap gap-4 mb-3">
          <div>
            <div className="mono text-[10.5px] uppercase tracking-[0.14em] text-slate-500 mb-1">06 · Knowledge Inbox</div>
            <h1 className="text-[26px] font-semibold text-slate-900 tracking-tight">Triage workspace</h1>
            <p className="text-[13px] text-slate-600 mt-1 max-w-2xl">
              Incoming records from registries, partners, and clinician uploads. The inbox classifies and routes —
              verification belongs to the lane workflow, not here.
            </p>
          </div>
          <div className="flex items-center gap-4 mono text-[10.5px] uppercase tracking-[0.12em]">
            <div className="text-slate-500">Pending across feeds: <span className="text-slate-900 tabular-nums">{stageCounts.incoming}</span></div>
            <div className="text-slate-500">Triaged: <span className="text-slate-900 tabular-nums">{stageCounts.triaged}</span></div>
            <div className="text-slate-500">Resolved: <span className="text-slate-900 tabular-nums">{stageCounts.resolved}</span></div>
          </div>
        </div>

        {/* Source feed health overview */}
        <SourceFeedHealth sources={sources} />
      </header>

      {/* Three-column layout */}
      <div className="grid grid-cols-12 gap-5">
        {/* Source sidebar */}
        <div className="col-span-12 lg:col-span-3">
          <InboxSourceSidebar
            sources={sources}
            activeSourceId={activeSourceId}
            onSelectSource={setActiveSourceId}
            counts={counts}
          />
        </div>

        {/* Item list */}
        <div className="col-span-12 lg:col-span-5">
          <Card className="p-0 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100">
              <InboxFilterChips
                stage={stage} onStageChange={(s) => { setStage(s); setSelectedIds([]); }}
                ageWindow={ageWindow} onAgeChange={setAgeWindow}
                tier={tier} onTierChange={setTier}
                classifyOnlyNote={false}
              />
            </div>
            <InboxItemList
              items={visible}
              selectedIds={selectedIds}
              onToggleSelect={toggleSelect}
              focusedId={focusedId}
              onFocus={setFocusedId}
            />
          </Card>
          <div className="mt-3 text-[11.5px] text-slate-500 flex items-center gap-1.5">
            <Icon.Info size={12} className="text-slate-400" />
            <span>The inbox classifies; verification happens in primary-source lanes.</span>
          </div>
        </div>

        {/* Detail panel */}
        <div className="col-span-12 lg:col-span-4">
          <InboxDetailPanel item={focused} onDispose={(id, d) => dispose(id, d)} />
        </div>
      </div>

      <BulkActionBar count={selectedIds.length} onDispose={bulkDispose} onClear={() => setSelectedIds([])} />
    </div>
  );
}

window.ViewInboxV2 = ViewInboxV2;
