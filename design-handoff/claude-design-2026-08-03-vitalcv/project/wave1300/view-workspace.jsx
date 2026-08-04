// WAVE 1300 · D1 — /workspace · WORKSPACE ENGINE
// Each organization is a workspace. The workspace configures terminology,
// workflow, roles, dashboards and navigation. This surface shows the active
// workspace's whole configuration and lets you reshape its core vocabulary —
// every other surface re-renders from what you set here.

function ViewWorkspace() {
  const { def, cfg, terms } = useWorkspace();
  const I = Icon[def.icon] || Icon.Building;

  const systems = [
    { id: 'workflows',  label: 'Workflow',    Icon: Icon.Workflow, count: `${cfg.stages.length} stages`,    sub: terms.workflow },
    { id: 'roles',      label: 'Roles',       Icon: Icon.Users,    count: `${cfg.roleIds.length} roles`,     sub: 'Each with its own workspace' },
    { id: 'dashboards', label: 'Dashboards',  Icon: Icon.Grid,     count: `${cfg.dashboard.length} widgets`, sub: 'Composed per organization' },
    { id: 'automation', label: 'Automation',  Icon: Icon.Zap,      count: `${cfg.automations.length} rules`, sub: `${cfg.automations.filter(a => a.enabled).length} active` },
  ];

  return (
    <div className="max-w-[1520px] mx-auto px-6 py-7 space-y-7">
      <SurfaceIntro eyebrow="Workspace Engine · W1300-D1"
        title="One platform. Every organization shapes its own."
        sub="VitalCV is configurable infrastructure. An organization picks a workspace and that workspace defines its terminology, workflow, roles, dashboards and navigation — nothing is hardcoded. Switch the workspace in the header and the entire product re-renders to fit a different workforce model."
        right={<div className="hidden md:flex items-center gap-2 mono text-[10px] uppercase tracking-[0.12em] text-slate-500 border border-white/10 rounded-md px-3 py-2"><Icon.Boxes size={13} className="accent-text" /> {WORKSPACES.length} workspaces</div>} />

      {/* active workspace hero */}
      <Panel className="overflow-hidden rise">
        <div className="p-6 flex flex-wrap items-start gap-6 justify-between" style={{ background: `linear-gradient(180deg, ${hexA(def.accent, 0.07)}, transparent 60%)` }}>
          <div className="flex items-start gap-4 min-w-0">
            <span className="h-14 w-14 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: hexA(def.accent, 0.16), color: def.accent }}><I size={28} /></span>
            <div className="min-w-0">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-[22px] font-semibold tracking-[-0.01em] text-slate-50">{def.name}</h2>
                <Pill tone="accent">{def.type}</Pill>
              </div>
              <p className="text-[13px] text-slate-400 mt-1.5 max-w-[60ch] text-pretty">
                Active workspace. This configuration governs how {def.stats.providers.toLocaleString()} {terms.providerPl.toLowerCase()} move through {def.stats.groups} {terms.groupPl.toLowerCase()}.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-7">
            <Stat label={terms.providerPl} value={def.stats.providers.toLocaleString()} />
            <Stat label="Active" value={def.stats.active.toLocaleString()} color="#5ed6a4" />
            <Stat label={terms.groupPl} value={def.stats.groups} />
          </div>
        </div>
      </Panel>

      {/* the five configurable systems */}
      <div>
        <SectionLabel>This workspace configures</SectionLabel>
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <TerminologyCard def={def} terms={terms} />
          {systems.map(sys => (
            <button key={sys.id} onClick={() => navTo(sys.id)}
              className="text-left rounded-xl border border-white/[0.08] bg-[#141922] p-4 hover:border-white/20 transition-colors group">
              <div className="flex items-center justify-between">
                <span className="h-9 w-9 rounded-lg flex items-center justify-center accent-soft-bg accent-text"><sys.Icon size={17} /></span>
                <Icon.ArrowUpRight size={15} className="text-slate-600 group-hover:accent-text transition-colors" />
              </div>
              <div className="mt-3 text-[14px] font-semibold text-slate-100">{sys.label}</div>
              <div className="text-[12px] accent-text font-medium tabular-nums mt-0.5">{sys.count}</div>
              <div className="text-[11.5px] text-slate-500 mt-1.5 leading-snug truncate">{sys.sub}</div>
            </button>
          ))}
        </div>
      </div>

      {/* workflow preview strip */}
      <Panel className="overflow-hidden">
        <PanelHead icon={Icon.Workflow} title={`${terms.workflow} pipeline`} sub="The configured path a record travels — rearrange it in Workflows"
          right={<Button size="sm" variant="outline" iconRight={<Icon.ArrowRight size={13} />} onClick={() => navTo('workflows')}>Open builder</Button>} />
        <div className="p-5 overflow-x-auto scroll-thin">
          <div className="flex items-center gap-1.5 min-w-max">
            {cfg.stages.map((s, i) => (
              <React.Fragment key={s.id}>
                <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3.5 py-2.5 min-w-[130px]">
                  <div className="mono text-[9px] uppercase tracking-[0.12em] text-slate-600">Stage {String(i + 1).padStart(2, '0')}</div>
                  <div className="text-[12.5px] font-semibold text-slate-100 mt-1 leading-tight">{s.label}</div>
                  <div className="mt-1.5"><RoleBadge roleId={s.owner} /></div>
                </div>
                {i < cfg.stages.length - 1 && <Icon.ChevronRight size={15} className="text-slate-700 flex-shrink-0" />}
              </React.Fragment>
            ))}
          </div>
        </div>
      </Panel>

      {/* org gallery — proof that no two configs match */}
      <div>
        <SectionLabel right={<span className="mono text-[10px] text-slate-600">click to switch</span>}>Every organization, a different shape</SectionLabel>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {WORKSPACES.map(w => {
            const WI = Icon[w.icon] || Icon.Building; const active = w.id === def.id;
            return (
              <button key={w.id} onClick={() => { Store.set({ activeWs: w.id }); navTo('workspace'); }}
                className={cn('text-left rounded-xl border p-4 transition-colors', active ? 'bg-white/[0.04]' : 'border-white/[0.07] bg-[#141922] hover:border-white/18')}
                style={active ? { borderColor: hexA(w.accent, 0.5) } : undefined}>
                <div className="flex items-start justify-between gap-2">
                  <span className="h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: hexA(w.accent, 0.16), color: w.accent }}><WI size={17} /></span>
                  {active ? <Pill tone="accent">active</Pill> : <span className="mono text-[9px] uppercase tracking-[0.12em] text-slate-600 mt-1">{w.short}</span>}
                </div>
                <div className="mt-3 text-[13.5px] font-semibold text-slate-100 leading-tight">{w.name}</div>
                <div className="text-[11px] text-slate-500 mt-0.5">{w.type}</div>
                <div className="mt-3 pt-3 border-t border-white/[0.06] flex flex-wrap gap-x-3 gap-y-1 mono text-[10px] text-slate-500">
                  <span><span className="text-slate-300">{w.terms.providerPl}</span></span>
                  <span className="text-slate-700">·</span>
                  <span>{w.stages.length} stages</span>
                  <span className="text-slate-700">·</span>
                  <span>{w.roleIds.length} roles</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ---------- Editable terminology card ---------- */
function TerminologyCard({ def, terms }) {
  const [editing, setEditing] = React.useState(false);
  const fields = [
    { key: 'provider', label: 'Person' },
    { key: 'group', label: 'Org unit' },
    { key: 'record', label: 'Record' },
    { key: 'workflow', label: 'Workflow' },
  ];
  const setTerm = (key, value) => {
    Store.patchWs(def.id, w => ({ terms: { ...w.terms, [key]: value, [key + 'Pl']: key === 'provider' || key === 'group' ? value + (value.endsWith('s') ? '' : 's') : w.terms[key + 'Pl'] } }));
  };
  return (
    <div className="rounded-xl border border-white/[0.08] bg-[#141922] p-4">
      <div className="flex items-center justify-between">
        <span className="h-9 w-9 rounded-lg flex items-center justify-center accent-soft-bg accent-text"><Icon.Quote size={16} /></span>
        <button onClick={() => setEditing(e => !e)} className="text-slate-500 hover:accent-text transition-colors" title="Edit terminology">
          {editing ? <Icon.Check size={15} /> : <Icon.Pencil size={14} />}
        </button>
      </div>
      <div className="mt-3 text-[14px] font-semibold text-slate-100">Terminology</div>
      <div className="text-[11.5px] text-slate-500 mt-0.5 mb-2.5">Words this org uses</div>
      <div className="space-y-1.5">
        {fields.map(f => (
          <div key={f.key} className="flex items-center justify-between gap-2">
            <span className="mono text-[9.5px] uppercase tracking-[0.1em] text-slate-600 flex-shrink-0">{f.label}</span>
            {editing ? (
              <input value={terms[f.key]} onChange={e => setTerm(f.key, e.target.value)}
                className="w-[92px] bg-white/[0.04] border border-white/12 focus:border-white/30 rounded px-1.5 py-0.5 text-[11.5px] text-right text-slate-100 outline-none" />
            ) : (
              <span className="text-[12px] font-medium text-slate-200 truncate">{terms[f.key]}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

window.ViewWorkspace = ViewWorkspace;
