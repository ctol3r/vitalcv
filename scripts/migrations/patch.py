with open('/Users/christoler/vitalcv/apps/web/components/intelligence-ops/dashboard-surface.tsx', 'r') as f:
    text = f.read()

prefix = text.split('  return (\n    <OperationsShell')[0]

new_render = """  return (
    <div className="flex flex-col h-screen min-h-0 w-full overflow-hidden bg-[var(--vt-bg)] text-[var(--vt-text-1)] font-sans">
      {/* ZONE A — SIGNAL HEADER */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-[var(--vt-border)] bg-[var(--vt-surface)] px-5">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="relative flex h-2 w-2 items-center justify-center">
              <span className="absolute h-full w-full animate-ping rounded-full bg-[var(--vt-critical)] opacity-75"></span>
              <span className="relative h-2 w-2 rounded-full bg-[var(--vt-critical)]"></span>
            </div>
            <span className="text-[10px] font-semibold uppercase tracking-widest text-[var(--vt-text-1)]">
              System Live
            </span>
          </div>
          <div className="h-4 w-px bg-[var(--vt-border)]"></div>
          <div className="flex gap-5 text-[10px] font-mono uppercase tracking-widest text-[var(--vt-text-3)]">
            <span className="flex items-center gap-2"><span className="text-[var(--vt-text-1)]">{providers.data?.total ?? 0}</span> PROVIDERS</span>
            <span className="flex items-center gap-2"><span className="text-[var(--vt-text-1)]">{findings.data?.total ?? 0}</span> FINDINGS</span>
            <span className="flex items-center gap-2"><span className="text-[var(--vt-text-1)]">{storylines.data?.total ?? 0}</span> STORYLINES</span>
          </div>
        </div>
        <div className="flex items-center gap-5">
          <form
            className="flex items-center gap-2 rounded-sm border border-[var(--vt-border)] bg-[var(--vt-surface-dim)] px-2 py-1 transition-colors focus-within:border-[var(--vt-text-3)]"
            onSubmit={(event) => {
              event.preventDefault();
              pushDashboard((params) => {
                const trimmed = draftQuery.trim();
                if (trimmed.length > 0) {
                  params.set('q', trimmed);
                } else {
                  params.delete('q');
                }
                params.delete('npi');
                params.delete('findingId');
                params.delete('storylineId');
                params.delete('panel');
              });
            }}
          >
            <Search className="h-3.5 w-3.5 text-[var(--vt-text-3)]" />
            <input
              value={draftQuery}
              onChange={(event) => setDraftQuery(event.target.value)}
              placeholder="Search scope..."
              className="w-48 bg-transparent text-xs text-[var(--vt-text-1)] outline-none placeholder:text-[var(--vt-text-3)]"
            />
          </form>

          <div className="h-4 w-px bg-[var(--vt-border)]"></div>

          <span className="text-[10px] text-[var(--vt-text-3)] uppercase tracking-widest">
            Last seen {providers.lastUpdated ? formatRelativeTime(providers.lastUpdated) : '...'}
          </span>
          <button 
            type="button" 
            onClick={refreshAll}
            className="flex items-center justify-center rounded-sm text-[var(--vt-text-3)] transition hover:text-[var(--vt-text-1)]"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>
      </header>

      {/* ZONE B & C AREA */}
      <main className="flex flex-1 min-h-0 overflow-hidden">
        {/* ZONE B — PRIMARY WORK AREA */}
        <section className="flex flex-1 flex-col overflow-y-auto border-r border-[var(--vt-border)] bg-[var(--vt-surface-dim)]">
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[var(--vt-border)] bg-[var(--vt-surface)]/95 px-5 py-3 backdrop-blur-sm">
            <h1 className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--vt-text-1)]">Signal Queue</h1>
            <div className="flex items-center gap-1 rounded-sm border border-[var(--vt-border)] p-0.5 bg-[var(--vt-surface-dim)]">
              <button className="rounded-[2px] bg-[var(--vt-surface-2)] px-3 py-1 text-[9px] font-semibold tracking-widest uppercase text-[var(--vt-text-1)] shadow-sm">Ranked</button>
              <button className="rounded-[2px] px-3 py-1 text-[9px] font-semibold tracking-widest uppercase text-[var(--vt-text-3)] transition hover:text-[var(--vt-text-1)]">Latest</button>
              <button className="rounded-[2px] px-3 py-1 text-[9px] font-semibold tracking-widest uppercase text-[var(--vt-text-3)] transition hover:text-[var(--vt-text-1)]">Critical Only</button>
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] lg:gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
            {/* Findings List */}
            <div className="flex flex-col gap-2 relative">
              {findingsUnavailable ? (
                <SurfaceErrorState
                  title="Signals unavailable"
                  description={findings.error ?? 'Signal queue failed to load'}
                  onRetry={findings.refresh}
                />
              ) : (findings.data?.findings ?? []).length > 0 ? (
                (findings.data?.findings ?? []).map((finding) => {
                  const active = selectedFinding?.id === finding.id;
                  
                  let railColor = "bg-[var(--vt-border)]";
                  if (['critical', 'outage', 'revoked'].includes(finding.severity.toLowerCase())) railColor = "bg-[var(--vt-critical)]";
                  else if (['high', 'escalated'].includes(finding.severity.toLowerCase())) railColor = "bg-[var(--vt-warning)]";
                  else if (['low', 'verified', 'healthy'].includes(finding.severity.toLowerCase())) railColor = "bg-[var(--vt-success)]";
                  else if (['medium', 'pending'].includes(finding.severity.toLowerCase())) railColor = "bg-[var(--vt-info)]";
                  
                  return (
                    <button
                      key={finding.id}
                      type="button"
                      onClick={() => setFindingScope(finding)}
                      className={`group relative w-full flex-col overflow-hidden rounded-sm border bg-[var(--vt-surface)] text-left transition-all hover:-translate-y-[1px] ${
                        active ? 'border-[var(--vt-border)] shadow-[0_4px_12px_rgba(0,0,0,0.1)] ring-1 ring-inset ring-[var(--vt-info)]' : 'border-[var(--vt-border)] hover:border-[var(--vt-text-3)] hover:shadow-md'
                      }`}
                    >
                      <div className="flex h-full">
                        <div className={`w-[3px] shrink-0 transition-opacity ${active ? 'opacity-100' : 'opacity-60'} ${railColor}`} />
                        <div className="flex flex-1 flex-col p-3.5">
                          <div className="flex items-start justify-between gap-4">
                            <div>
                               <p className="mb-1 text-[9px] font-semibold uppercase tracking-widest text-[var(--vt-text-3)]">
                                 {finding.providerNpi ? `Provider ${finding.providerNpi}` : 'Global Signal'}
                               </p>
                               <p className={`text-sm font-medium leading-snug ${active ? 'text-[var(--vt-text-1)]' : 'text-[var(--vt-text-1)]'}`}>
                                 {finding.summary || finding.title}
                               </p>
                            </div>
                            <span className="shrink-0 rounded-[2px] border border-[var(--vt-border)] bg-[var(--vt-surface-dim)] px-1.5 py-0.5 text-[9px] uppercase tracking-widest text-[var(--vt-text-3)]">
                              {finding.findingType.replace(/_/g, ' ')}
                            </span>
                          </div>
                          
                          <div className="mt-3.5 flex items-center justify-between border-t border-[var(--vt-border)]/50 pt-2.5">
                             <div className="flex items-center gap-2 pl-0.5">
                               <div className="h-1 w-12 overflow-hidden rounded-full bg-[var(--vt-surface-2)]">
                                 <div className={`h-full transition-colors duration-300 ${active ? 'bg-[var(--vt-info)]' : 'bg-[var(--vt-text-3)] group-hover:bg-[#A3A3A3]'}`} style={{ width: `${Math.round(finding.confidence * 100)}%` }} />
                               </div>
                               <span className="text-[9px] font-mono tracking-widest text-[var(--vt-text-3)]">{Math.round(finding.confidence * 100)}%</span>
                             </div>
                             <div className="flex items-center gap-2">
                               {finding.storylineTitle && (
                                 <span className="rounded-[2px] border border-[var(--vt-border)]/50 bg-[var(--vt-surface-2)] px-1.5 py-0.5 text-[9px] uppercase tracking-widest text-[var(--vt-text-2)]">
                                   {finding.storylineTitle}
                                 </span>
                               )}
                               <span className="text-[9px] uppercase tracking-widest text-[var(--vt-text-3)]">
                                 {formatRelativeTime(finding.createdAt)}
                               </span>
                             </div>
                          </div>
                        </div>
                      </div>
                      {active && <div className="absolute inset-0 pointer-events-none rounded-sm bg-[var(--vt-info)]/5" />}
                    </button>
                  );
                })
              ) : (
                <div className="flex h-full flex-col items-center justify-center p-12 text-center">
                  <div className="mb-4 flex h-6 w-6 items-center justify-center">
                    <span className="absolute h-6 w-6 animate-ping rounded-full bg-[var(--vt-text-3)] opacity-20"></span>
                    <span className="relative h-2 w-2 rounded-full bg-[var(--vt-text-3)] opacity-50"></span>
                  </div>
                  <p className="text-[10px] uppercase tracking-widest text-[var(--vt-text-3)]">System warming — generating intelligence</p>
                </div>
              )}
            </div>
            
            {/* Graph Preview */}
            <div className="hidden lg:block relative rounded-sm border border-[var(--vt-border)] bg-black shadow-inner overflow-hidden">
              <div className="absolute left-3 top-3 z-10 pointer-events-none">
                 <p className="text-[9px] uppercase tracking-[0.2em] text-[var(--vt-text-2)] mix-blend-difference">Network Context</p>
              </div>
              <GraphWorkbenchPanel
                graph={graph.data}
                providers={providers.data?.providers ?? []}
                selectedProvider={selectedProvider}
                selectedFindingId={selectedFinding?.id ?? selectedFindingId}
                selectedStorylineId={selectedStoryline?.id ?? selectedStorylineId}
                openFullGraphHref={openFullGraphHref}
                loading={graph.loading}
                error={graph.error}
                onRetry={graph.refresh}
                onSelectProvider={(provider) => setProviderScope(provider.npi)}
                focusNodeId={copilotFocusNodeId}
                highlightNodeId={copilotHighlightNodeId}
                highlightNodeIds={useMemo(() => {
                  if (!findings.data?.findings || !graph.data?.nodes) return [];
                  const npis = new Set(findings.data.findings.map(f => f.providerNpi).filter(Boolean));
                  return graph.data.nodes.filter(n => npis.has(n.id) || npis.has(n.metadata?.npi as string)).map(n => n.id);
                }, [findings.data?.findings, graph.data?.nodes])}
                onSelectGraphNode={setCopilotFocusNodeId}
              />
            </div>
          </div>
        </section>

        {/* ZONE C — CONTEXT / ACTION RAIL */}
        <aside className="no-scrollbar flex w-[380px] shrink-0 flex-col overflow-y-auto border-l border-[var(--vt-border)] bg-[var(--vt-surface)] p-5 z-20 shadow-[-10px_0_30px_rgba(0,0,0,0.2)]">
          <div className="flex flex-col gap-6">
            <WorkbenchCopilotPanel
              provider={selectedProvider}
              finding={selectedFinding}
              storyline={selectedStoryline}
              onNavigateToNpi={setProviderScope}
              onSelectFinding={selectFindingById}
              onSelectStoryline={selectStorylineById}
              onFocusGraphNode={(nodeId) => {
                setCopilotFocusNodeId(nodeId);
                pushDashboard((params) => {
                  params.set('panel', 'graph');
                });
              }}
              onHighlightGraphNode={(nodeId) => {
                setCopilotHighlightNodeId(nodeId);
                pushDashboard((params) => {
                  params.set('panel', 'graph');
                });
              }}
              onOpenEvidence={openEvidenceForFinding}
              context={copilotContext}
            />

            {selectedProvider && (
              <div className="space-y-3 pt-5 border-t border-[var(--vt-border)]/50">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--vt-text-3)]">Provider Profile</p>
                  <span className={`text-base font-semibold tabular-nums ${trustScoreColor(selectedProvider.trustScore)}`}>
                    {selectedProvider.trustScore}
                  </span>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-[var(--vt-text-1)]">{selectedProvider.name}</h3>
                  <p className="text-[10px] uppercase tracking-widest text-[var(--vt-text-2)] font-mono mt-0.5">NPI {selectedProvider.npi}</p>
                </div>
                <p className="text-xs leading-relaxed text-[var(--vt-text-2)] line-clamp-4">{selectedProvider.summary}</p>
                
                <div className="flex flex-wrap gap-2 pt-2">
                  <EntityLink href={`/providers/${selectedProvider.npi}?from=${encodeURIComponent(currentHref)}`} label="View Full Profile" />
                  <EntityLink href={buildIntelligenceHref('investigations', { npi: selectedProvider.npi })} label="Launch Investigation" />
                </div>
              </div>
            )}
            
            {selectedStoryline && (
              <div className="space-y-3 pt-5 border-t border-[var(--vt-border)]/50">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--vt-text-3)]">Active Storyline</p>
                </div>
                <h3 className="text-sm font-medium text-[var(--vt-text-1)]">{selectedStoryline.title}</h3>
                <p className="text-xs leading-relaxed text-[var(--vt-text-2)] line-clamp-4">{selectedStoryline.whyItMatters}</p>
                <div className="pt-2">
                  <EntityLink href={`/storylines/${selectedStoryline.id}?from=${encodeURIComponent(currentHref)}`} label="Analyze Cluster" />
                </div>
              </div>
            )}

            {!selectedProvider && !selectedStoryline && (
               <div className="flex flex-col items-center justify-center pt-8 opacity-40">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--vt-text-3)] text-center">Select signal to load context</p>
               </div>
            )}
          </div>
        </aside>
      </main>
    </div>
  );
}
"""

with open('/Users/christoler/vitalcv/apps/web/components/intelligence-ops/dashboard-surface.tsx', 'w') as f:
    f.write(prefix + new_render)
