// WAVE 1300 · D5 — /automation · AUTOMATION STUDIO
// Everything is event-driven. Organizations define rules: WHEN something
// happens in the workspace, THEN do something. Evidence changes → notify
// recruiter. Readiness drops → notify credentialing. License expires → create
// a task. Toggle, edit, add — the workspace runs on the rules you write here.

function ViewAutomation() {
  const { def, cfg, terms } = useWorkspace();
  const rules = cfg.automations;

  const setRules = (next) => Store.patchWs(def.id, w => ({ automations: typeof next === 'function' ? next(w.automations) : next }));
  const patchRule = (id, patch) => setRules(rs => rs.map(r => r.id === id ? { ...r, ...patch } : r));
  const removeRule = (id) => setRules(rs => rs.filter(r => r.id !== id));
  const addRule = () => setRules(rs => [...rs, { id: 'r' + Date.now().toString(36), event: 'evidence_changed', action: 'notify_recruiter', target: 'Any ' + terms.provider.toLowerCase(), enabled: true }]);

  const activeCount = rules.filter(r => r.enabled).length;
  const stageTargets = cfg.stages.map(s => s.label);

  return (
    <div className="max-w-[1520px] mx-auto px-6 py-7 space-y-6">
      <SurfaceIntro eyebrow="Automation Studio · W1300-D5"
        title="Wire the workspace to run itself"
        sub="Every rule is event-driven: WHEN something changes, THEN something happens. The workforce model decides which events matter and what they trigger — a staffing agency reacts to stalled submissions, a payer to readiness dropping below ninety percent. Build the rules; the workspace runs on them."
        right={<Button size="sm" iconLeft={<Icon.Plus size={14} />} onClick={addRule}>New rule</Button>} />

      {/* meta strip */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="rounded-lg border border-white/10 bg-[#141922] px-4 py-2.5 flex items-center gap-6">
          <Stat label="Rules" value={rules.length} />
          <span className="h-8 w-px bg-white/10" />
          <Stat label="Active" value={activeCount} color="#5ed6a4" />
          <span className="h-8 w-px bg-white/10" />
          <Stat label="Paused" value={rules.length - activeCount} color="#7c8aa0" />
        </div>
        <div className="text-[12px] text-slate-500 flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400 blink" />Listening on {Object.keys(EVENTS).length} workspace events</div>
      </div>

      {/* rules */}
      <div className="space-y-3">
        <SectionLabel right={<span className="mono text-[10px] text-slate-600">{rules.length} rules</span>}>Automation rules</SectionLabel>
        {rules.length === 0 && (
          <div className="rounded-xl border border-dashed border-white/12 py-16 text-center">
            <Icon.Zap size={22} className="text-slate-600 mx-auto" />
            <div className="text-[13px] text-slate-400 mt-3">No automations yet</div>
            <Button size="sm" variant="outline" className="mt-4" iconLeft={<Icon.Plus size={13} />} onClick={addRule}>Create the first rule</Button>
          </div>
        )}
        {rules.map(r => {
          const ev = EVENTS[r.event], ac = ACTIONS[r.action];
          const EvI = Icon[ev?.icon] || Icon.Activity, AcI = Icon[ac?.icon] || Icon.Bell;
          return (
            <div key={r.id} className={cn('group rounded-xl border bg-[#141922] p-4 transition-colors', r.enabled ? 'border-white/[0.08]' : 'border-white/[0.05] opacity-65')}>
              <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                {/* WHEN */}
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <span className="h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: hexA('#f0a93a', 0.13), color: '#f0a93a' }}><EvI size={19} /></span>
                  <div className="min-w-0 flex-1">
                    <div className="mono text-[9px] uppercase tracking-[0.14em] text-slate-600 mb-1">When</div>
                    <select value={r.event} onChange={e => patchRule(r.id, { event: e.target.value })}
                      className="w-full bg-white/[0.04] border border-white/12 focus:border-white/30 rounded px-2 py-1.5 text-[12.5px] font-medium text-slate-100 outline-none cursor-pointer">
                      {Object.values(EVENTS).map(e => <option key={e.id} value={e.id} className="bg-[#11161e]">{e.label}</option>)}
                    </select>
                  </div>
                </div>

                {/* arrow */}
                <div className="flex items-center gap-2 lg:flex-col lg:gap-0 flex-shrink-0 self-center">
                  <span className="h-7 w-7 rounded-full border border-white/12 flex items-center justify-center accent-text"><Icon.ArrowRight size={14} className="lg:hidden" /><Icon.ArrowDown size={14} className="hidden lg:block" /></span>
                </div>

                {/* THEN */}
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <span className="h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0 accent-soft-bg accent-text"><AcI size={19} /></span>
                  <div className="min-w-0 flex-1">
                    <div className="mono text-[9px] uppercase tracking-[0.14em] text-slate-600 mb-1">Then</div>
                    <select value={r.action} onChange={e => patchRule(r.id, { action: e.target.value })}
                      className="w-full bg-white/[0.04] border border-white/12 focus:border-white/30 rounded px-2 py-1.5 text-[12.5px] font-medium text-slate-100 outline-none cursor-pointer">
                      {Object.values(ACTIONS).map(a => <option key={a.id} value={a.id} className="bg-[#11161e]">{a.label}</option>)}
                    </select>
                  </div>
                </div>

                {/* scope */}
                <div className="flex-1 min-w-0">
                  <div className="mono text-[9px] uppercase tracking-[0.14em] text-slate-600 mb-1">Scope</div>
                  <input list={`scope-${r.id}`} value={r.target} onChange={e => patchRule(r.id, { target: e.target.value })}
                    className="w-full bg-white/[0.04] border border-white/12 focus:border-white/30 rounded px-2 py-1.5 text-[12.5px] text-slate-200 outline-none" placeholder="Applies to…" />
                  <datalist id={`scope-${r.id}`}>
                    <option value={`Any ${terms.provider.toLowerCase()}`} />
                    {stageTargets.map(t => <option key={t} value={t} />)}
                  </datalist>
                </div>

                {/* controls */}
                <div className="flex items-center gap-3 flex-shrink-0 self-center">
                  <div className="flex items-center gap-2">
                    <Toggle on={r.enabled} onChange={v => patchRule(r.id, { enabled: v })} size="sm" />
                    <span className="mono text-[9.5px] uppercase tracking-[0.1em] w-9" style={{ color: r.enabled ? '#5ed6a4' : '#7c8aa0' }}>{r.enabled ? 'live' : 'off'}</span>
                  </div>
                  <button onClick={() => removeRule(r.id)} className="h-8 w-8 rounded-md text-slate-600 hover:text-rose-300 hover:bg-rose-500/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><Icon.Trash size={14} /></button>
                </div>
              </div>
            </div>
          );
        })}
        <button onClick={addRule} className="w-full rounded-xl border border-dashed border-white/12 hover:border-white/25 hover:bg-white/[0.02] py-3.5 text-[12.5px] text-slate-500 hover:text-slate-300 transition-colors flex items-center justify-center gap-2">
          <Icon.Plus size={14} /> Add an automation rule
        </button>
      </div>

      {/* vocabulary reference */}
      <div className="grid md:grid-cols-2 gap-4">
        <Panel>
          <PanelHead icon={Icon.Activity} title="Events the workspace emits" sub="Triggers you can listen for" />
          <div className="p-3 grid sm:grid-cols-2 gap-1.5">
            {Object.values(EVENTS).map(e => { const EI = Icon[e.icon] || Icon.Dot; const used = rules.some(r => r.event === e.id && r.enabled);
              return (
                <div key={e.id} className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg bg-white/[0.02]">
                  <span className="h-7 w-7 rounded-md flex items-center justify-center flex-shrink-0" style={{ background: hexA('#f0a93a', 0.12), color: '#f0a93a' }}><EI size={14} /></span>
                  <span className="text-[12px] text-slate-300 flex-1 min-w-0 truncate">{e.label}</span>
                  {used && <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 flex-shrink-0" title="In use" />}
                </div>
              );
            })}
          </div>
        </Panel>
        <Panel>
          <PanelHead icon={Icon.Wand} title="Actions it can take" sub="What a rule can do" />
          <div className="p-3 grid sm:grid-cols-2 gap-1.5">
            {Object.values(ACTIONS).map(a => { const AI = Icon[a.icon] || Icon.Dot; const used = rules.some(r => r.action === a.id && r.enabled);
              return (
                <div key={a.id} className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg bg-white/[0.02]">
                  <span className="h-7 w-7 rounded-md flex items-center justify-center flex-shrink-0 accent-soft-bg accent-text"><AI size={14} /></span>
                  <span className="text-[12px] text-slate-300 flex-1 min-w-0 truncate">{a.label}</span>
                  {used && <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 flex-shrink-0" title="In use" />}
                </div>
              );
            })}
          </div>
        </Panel>
      </div>
    </div>
  );
}

window.ViewAutomation = ViewAutomation;
