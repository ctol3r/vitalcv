// WAVE 1300 · D2 — /workspace/workflows · WORKFLOW BUILDER
// A visual pipeline editor. Drag to reorder stages, rename them, assign an
// owning role and an SLA, add or remove stages. The pipeline you build here is
// the path every record travels — and it drives the funnel, dashboards and
// automation targets across the workspace.

function ViewWorkflows() {
  const { def, cfg, terms } = useWorkspace();
  const stages = cfg.stages;
  const [dragId, setDragId] = React.useState(null);
  const [overId, setOverId] = React.useState(null);

  const setStages = (next) => Store.patchWs(def.id, w => ({ stages: typeof next === 'function' ? next(w.stages) : next }));
  const patchStage = (id, patch) => setStages(ss => ss.map(s => s.id === id ? { ...s, ...patch } : s));
  const removeStage = (id) => setStages(ss => ss.filter(s => s.id !== id));
  const move = (id, dir) => setStages(ss => {
    const i = ss.findIndex(s => s.id === id); const j = i + dir;
    if (i < 0 || j < 0 || j >= ss.length) return ss;
    const copy = [...ss]; [copy[i], copy[j]] = [copy[j], copy[i]]; return copy;
  });
  const addStage = () => setStages(ss => [...ss, { id: 'st' + Date.now().toString(36), label: 'New stage', owner: def.roleIds[0], sla: 7 }]);

  const onDrop = (targetId) => {
    if (!dragId || dragId === targetId) { setDragId(null); setOverId(null); return; }
    setStages(ss => {
      const from = ss.findIndex(s => s.id === dragId), to = ss.findIndex(s => s.id === targetId);
      const copy = [...ss]; const [m] = copy.splice(from, 1); copy.splice(to, 0, m); return copy;
    });
    setDragId(null); setOverId(null);
  };

  const totalSla = stages.reduce((a, s) => a + (s.sla || 0), 0);
  const ownerSet = [...new Set(stages.map(s => s.owner))];

  return (
    <div className="max-w-[1520px] mx-auto px-6 py-7 space-y-6">
      <SurfaceIntro eyebrow="Workflow Builder · W1300-D2"
        title={`Build the ${terms.workflow.toLowerCase()} pipeline`}
        sub={`Drag stages to reorder, rename them, assign an owning role and an SLA. Organizations rearrange this freely — a staffing agency's pipeline looks nothing like an academic medical center's. ${terms.providerPl} flow through exactly the stages you define here.`}
        right={<Button size="sm" iconLeft={<Icon.Plus size={14} />} onClick={addStage}>Add stage</Button>} />

      <div className="grid lg:grid-cols-12 gap-5">
        {/* editor */}
        <div className="lg:col-span-7 space-y-2.5">
          <SectionLabel right={<span className="mono text-[10px] text-slate-600">{stages.length} stages · drag to reorder</span>}>Pipeline editor</SectionLabel>
          {stages.map((s, i) => {
            const isLast = i === stages.length - 1;
            return (
              <div key={s.id}>
                <div draggable onDragStart={() => setDragId(s.id)} onDragEnd={() => { setDragId(null); setOverId(null); }}
                  onDragOver={e => { e.preventDefault(); if (overId !== s.id) setOverId(s.id); }}
                  onDrop={() => onDrop(s.id)}
                  className={cn('group rounded-xl border bg-[#141922] p-3.5 transition-all',
                    dragId === s.id ? 'opacity-40' : '',
                    overId === s.id && dragId && dragId !== s.id ? 'accent-border' : 'border-white/[0.08]')}>
                  <div className="flex items-start gap-3">
                    <div className="flex flex-col items-center gap-1 pt-0.5">
                      <span className="cursor-grab active:cursor-grabbing text-slate-600 hover:text-slate-300" title="Drag to reorder"><Icon.Grip size={16} /></span>
                      <span className="mono text-[9px] text-slate-600 tabular-nums">{String(i + 1).padStart(2, '0')}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <input value={s.label} onChange={e => patchStage(s.id, { label: e.target.value })}
                        className="w-full bg-transparent text-[14px] font-semibold text-slate-100 outline-none border-b border-transparent focus:border-white/20 pb-0.5" />
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-2.5">
                        {/* owner role */}
                        <label className="flex items-center gap-1.5">
                          <span className="mono text-[9px] uppercase tracking-[0.1em] text-slate-600">Owner</span>
                          <select value={s.owner} onChange={e => patchStage(s.id, { owner: e.target.value })}
                            className="bg-white/[0.04] border border-white/12 focus:border-white/30 rounded px-2 py-1 text-[11.5px] text-slate-200 outline-none cursor-pointer">
                            {def.roleIds.map(rid => <option key={rid} value={rid} className="bg-[#11161e]">{ROLES[rid]?.label}</option>)}
                          </select>
                        </label>
                        {/* sla */}
                        <label className="flex items-center gap-1.5">
                          <span className="mono text-[9px] uppercase tracking-[0.1em] text-slate-600">SLA</span>
                          <input type="number" min="0" value={s.sla} onChange={e => patchStage(s.id, { sla: Math.max(0, parseInt(e.target.value) || 0) })}
                            className="w-14 bg-white/[0.04] border border-white/12 focus:border-white/30 rounded px-1.5 py-1 text-[11.5px] text-slate-200 outline-none tabular-nums" />
                          <span className="text-[11px] text-slate-500">{s.sla === 0 ? 'terminal' : 'days'}</span>
                        </label>
                      </div>
                    </div>
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => move(s.id, -1)} disabled={i === 0} className="h-7 w-7 rounded-md text-slate-500 hover:text-white hover:bg-white/5 disabled:opacity-25 flex items-center justify-center"><Icon.ArrowUp size={14} /></button>
                      <button onClick={() => move(s.id, 1)} disabled={isLast} className="h-7 w-7 rounded-md text-slate-500 hover:text-white hover:bg-white/5 disabled:opacity-25 flex items-center justify-center"><Icon.ArrowDown size={14} /></button>
                      <button onClick={() => removeStage(s.id)} disabled={stages.length <= 2} className="h-7 w-7 rounded-md text-slate-500 hover:text-rose-300 hover:bg-rose-500/10 disabled:opacity-25 flex items-center justify-center" title={stages.length <= 2 ? 'A pipeline needs at least 2 stages' : 'Remove stage'}><Icon.Trash size={13} /></button>
                    </div>
                  </div>
                </div>
                {!isLast && <div className="flex justify-center py-1"><Icon.ChevronDown size={15} className="text-slate-700" /></div>}
              </div>
            );
          })}
          <button onClick={addStage} className="w-full rounded-xl border border-dashed border-white/12 hover:border-white/25 hover:bg-white/[0.02] py-3.5 text-[12.5px] text-slate-500 hover:text-slate-300 transition-colors flex items-center justify-center gap-2">
            <Icon.Plus size={14} /> Add a stage
          </button>
        </div>

        {/* live preview */}
        <div className="lg:col-span-5">
          <div className="lg:sticky lg:top-32 space-y-4">
            <Panel className="overflow-hidden">
              <PanelHead icon={Icon.Filter} title="Live funnel" sub={`Volume across ${stages.length} stages`} />
              <div className="p-4 space-y-2">
                {stages.map((s, i) => {
                  const vol = stageVolume(def.id, i, def.stats.providers);
                  const max = stageVolume(def.id, 0, def.stats.providers);
                  return (
                    <div key={s.id}>
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-[12px] text-slate-300 truncate">{s.label}</span>
                        <span className="mono text-[11px] text-slate-400 tabular-nums flex-shrink-0">{vol.toLocaleString()}</span>
                      </div>
                      <Bar value={vol} max={max} h={6} />
                    </div>
                  );
                })}
              </div>
            </Panel>

            <Panel className="p-4">
              <SectionLabel>Pipeline summary</SectionLabel>
              <div className="grid grid-cols-2 gap-4">
                <Stat label="Stages" value={stages.length} />
                <Stat label="Target cycle" value={totalSla} unit="days" />
              </div>
              <div className="mt-4 pt-4 border-t border-white/[0.06]">
                <div className="mono text-[9.5px] uppercase tracking-[0.12em] text-slate-600 mb-2">Owning roles</div>
                <div className="flex flex-wrap gap-2">
                  {ownerSet.map(rid => <div key={rid} className="rounded-lg border border-white/8 bg-white/[0.03] px-2 py-1.5"><RoleBadge roleId={rid} /></div>)}
                </div>
              </div>
              <div className="mt-4 text-[11.5px] text-slate-500 flex items-start gap-2 leading-snug">
                <Icon.Info size={13} className="accent-text flex-shrink-0 mt-0.5" />
                Reordering here changes the funnel, the dashboard stage widgets, and every automation that targets a stage.
              </div>
            </Panel>
          </div>
        </div>
      </div>
    </div>
  );
}

window.ViewWorkflows = ViewWorkflows;
