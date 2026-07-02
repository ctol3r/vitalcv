// WAVE 1300 · D3 — /roles · ROLE ENGINE
// Configurable roles. Each role carries a set of capabilities, a landing
// surface, and — because capabilities gate navigation — its own workspace.
// Toggle a capability and the role's workspace preview re-renders to match.

function roleNav(caps) {
  // which surfaces this role's workspace exposes, derived from capabilities
  const has = (c) => caps.includes(c);
  const nav = [];
  if (has('configure_wf') || has('configure_dash') || has('manage_roles') || has('manage_automation')) nav.push('workspace');
  nav.push('dashboards'); // everyone gets a dashboard
  if (has('edit_pipeline') || has('configure_wf') || has('approve')) nav.push('workflows');
  if (has('manage_roles')) nav.push('roles');
  if (has('manage_automation')) nav.push('automation');
  return [...new Set(nav)];
}

function ViewRoles() {
  const { def, cfg } = useWorkspace();
  const [sel, setSel] = React.useState(cfg.roleIds[0]);
  const [adding, setAdding] = React.useState(false);
  React.useEffect(() => { if (!cfg.roleIds.includes(sel)) setSel(cfg.roleIds[0]); }, [cfg.roleIds, sel]);

  const caps = cfg.caps[sel] || [];
  const role = ROLES[sel];

  const toggleCap = (capId) => Store.patchWs(def.id, w => {
    const cur = w.caps[sel] || [];
    const next = cur.includes(capId) ? cur.filter(c => c !== capId) : [...cur, capId];
    return { caps: { ...w.caps, [sel]: next } };
  });
  const setLanding = (surf) => { /* landing stored on role def locally via store */ Store.patchWs(def.id, w => ({ caps: w.caps, landing: { ...(w.landing || {}), [sel]: surf } })); };
  const addRole = (rid) => {
    Store.patchWs(def.id, w => ({ roleIds: [...w.roleIds, rid], caps: { ...w.caps, [rid]: [...(DEFAULT_CAPS[rid] || [])] } }));
    setSel(rid); setAdding(false);
  };
  const removeRole = (rid) => {
    Store.patchWs(def.id, w => ({ roleIds: w.roleIds.filter(r => r !== rid) }));
  };

  const available = Object.keys(ROLES).filter(r => !cfg.roleIds.includes(r));
  const landing = (cfg.landing && cfg.landing[sel]) || role?.landing || 'dashboards';
  const nav = roleNav(caps);
  const capGroups = ['Read', 'Act', 'Configure'];

  return (
    <div className="max-w-[1520px] mx-auto px-6 py-7 space-y-6">
      <SurfaceIntro eyebrow="Role Engine · W1300-D3"
        title="Configurable roles, each with its own workspace"
        sub="Define who does what. A role is a set of capabilities and a landing surface — and because capabilities gate navigation, every role effectively gets a different product. Toggle a permission and watch the role's workspace preview change."
        right={<div className="hidden md:flex items-center gap-2 mono text-[10px] uppercase tracking-[0.12em] text-slate-500 border border-white/10 rounded-md px-3 py-2"><Icon.Users size={13} className="accent-text" /> {cfg.roleIds.length} roles</div>} />

      <div className="grid lg:grid-cols-12 gap-5">
        {/* role list */}
        <div className="lg:col-span-4 space-y-2.5">
          <SectionLabel right={available.length > 0 ? <button onClick={() => setAdding(a => !a)} className="mono text-[10px] accent-text hover:underline flex items-center gap-1"><Icon.Plus size={12} />add</button> : null}>Roles in this workspace</SectionLabel>
          {adding && (
            <div className="rounded-xl border border-white/12 bg-[#11161e] p-2 space-y-1">
              <div className="mono text-[9px] uppercase tracking-[0.12em] text-slate-500 px-1.5 py-1">Add from role library</div>
              {available.map(rid => { const r = ROLES[rid]; const RI = Icon[r.icon] || Icon.User; return (
                <button key={rid} onClick={() => addRole(rid)} className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-white/[0.05] text-left">
                  <span className="h-6 w-6 rounded-md flex items-center justify-center accent-soft-bg accent-text flex-shrink-0"><RI size={12} /></span>
                  <span className="text-[12px] text-slate-200">{r.label}</span>
                </button>
              ); })}
            </div>
          )}
          {cfg.roleIds.map(rid => {
            const r = ROLES[rid]; const RI = Icon[r.icon] || Icon.User; const active = sel === rid;
            const rc = (cfg.caps[rid] || []).length;
            return (
              <button key={rid} onClick={() => setSel(rid)}
                className={cn('group w-full text-left rounded-xl border p-3.5 transition-colors', active ? 'accent-border bg-white/[0.04]' : 'border-white/[0.07] bg-[#141922] hover:border-white/18')}>
                <div className="flex items-center gap-3">
                  <span className={cn('h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0', active ? 'accent-bg text-slate-950' : 'accent-soft-bg accent-text')}><RI size={17} /></span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13.5px] font-semibold text-slate-100 leading-tight">{r.label}</div>
                    <div className="text-[11px] text-slate-500 truncate">{r.scope}</div>
                  </div>
                  <span className="mono text-[10px] text-slate-500 tabular-nums flex-shrink-0">{rc} caps</span>
                </div>
              </button>
            );
          })}
        </div>

        {/* role detail */}
        <div className="lg:col-span-8 space-y-4">
          {role && (
            <>
              <Panel className="overflow-hidden">
                <div className="p-5 flex items-start justify-between gap-4" style={{ background: `linear-gradient(180deg, var(--accent-glow), transparent 70%)` }}>
                  <div className="flex items-start gap-3.5 min-w-0">
                    <span className="h-12 w-12 rounded-xl flex items-center justify-center accent-soft-bg accent-text flex-shrink-0">{React.createElement(Icon[role.icon] || Icon.User, { size: 24 })}</span>
                    <div className="min-w-0">
                      <h2 className="text-[19px] font-semibold text-slate-50 leading-tight">{role.label}</h2>
                      <p className="text-[12.5px] text-slate-400 mt-0.5">{role.scope}</p>
                    </div>
                  </div>
                  {cfg.roleIds.length > 1 && (
                    <Button size="sm" variant="danger" iconLeft={<Icon.Trash size={13} />} onClick={() => removeRole(sel)}>Remove</Button>
                  )}
                </div>
              </Panel>

              {/* capability matrix */}
              <Panel>
                <PanelHead icon={Icon.Sliders} title="Capabilities" sub={`${caps.length} of ${CAPABILITIES.length} granted`} />
                <div className="p-5 space-y-5">
                  {capGroups.map(group => (
                    <div key={group}>
                      <div className="mono text-[9.5px] uppercase tracking-[0.14em] text-slate-600 mb-2.5">{group}</div>
                      <div className="space-y-1.5">
                        {CAPABILITIES.filter(c => c.group === group).map(c => {
                          const on = caps.includes(c.id);
                          return (
                            <div key={c.id} className="flex items-center justify-between gap-3 py-1.5 px-2.5 rounded-lg hover:bg-white/[0.02]">
                              <div className="flex items-center gap-2.5 min-w-0">
                                {c.id === 'view_pii'
                                  ? <Icon.Lock size={14} className={on ? 'text-amber-400' : 'text-slate-600'} />
                                  : <Icon.Check size={14} className={on ? 'accent-text' : 'text-slate-700'} />}
                                <span className={cn('text-[12.5px]', on ? 'text-slate-200' : 'text-slate-500')}>{c.label}</span>
                              </div>
                              <Toggle on={on} onChange={() => toggleCap(c.id)} size="sm" />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </Panel>
            </>
          )}
        </div>
      </div>

      {/* role workspace preview — full width */}
      {role && (
        <Panel className="overflow-hidden">
          <PanelHead icon={Icon.Boxes} title={`${role.label}'s workspace`} sub="Generated from this role's capabilities — what they actually see"
            right={<div className="flex items-center gap-2"><span className="mono text-[10px] text-slate-500">lands on</span>
              <select value={landing} onChange={e => setLanding(e.target.value)} className="bg-white/[0.04] border border-white/12 focus:border-white/30 rounded px-2 py-1 text-[11.5px] text-slate-200 outline-none cursor-pointer">
                {nav.map(n => <option key={n} value={n} className="bg-[#11161e]">{SURFACES.find(s => s.id === n)?.label}</option>)}
              </select></div>} />
          <div className="p-5">
            {/* mock chrome */}
            <div className="rounded-xl border border-white/10 overflow-hidden">
              <div className="bg-black/30 px-4 h-11 flex items-center gap-4 border-b border-white/[0.06]">
                <span className="flex items-center gap-2"><span className="h-4 w-4 rounded accent-bg" /><span className="text-[12px] font-semibold text-slate-200">VitalCV</span></span>
                <div className="flex items-center gap-0.5">
                  {SURFACES.map(sf => {
                    const visible = nav.includes(sf.id); const isLanding = sf.id === landing; const SI = Icon[sf.Icon] || Icon.Dot;
                    return (
                      <span key={sf.id} className={cn('flex items-center gap-1.5 px-2.5 h-7 rounded-md text-[11.5px]',
                        !visible ? 'opacity-25 text-slate-600' : isLanding ? 'accent-soft-bg accent-text font-medium' : 'text-slate-400')}>
                        <SI size={12} />{sf.label}
                        {!visible && <Icon.Lock size={9} />}
                      </span>
                    );
                  })}
                </div>
              </div>
              <div className="p-5 bg-[#10141b] min-h-[120px]">
                <div className="mono text-[9.5px] uppercase tracking-[0.14em] text-slate-600 mb-3">{SURFACES.find(s => s.id === landing)?.label} · landing surface</div>
                <div className="grid sm:grid-cols-3 gap-3">
                  {caps.includes('view_evidence') && <PreviewTile icon={Icon.FileText} label="Evidence & sources" />}
                  {caps.includes('view_pii') ? <PreviewTile icon={Icon.User} label="Protected identifiers" tone="amber" /> : <PreviewTile icon={Icon.EyeOff} label="Identifiers hidden" tone="muted" />}
                  {caps.includes('edit_pipeline') && <PreviewTile icon={Icon.Workflow} label="Move records" />}
                  {caps.includes('approve') && <PreviewTile icon={Icon.Stamp} label="Approve readiness" />}
                  {caps.includes('configure_dash') && <PreviewTile icon={Icon.Grid} label="Compose dashboards" />}
                  {caps.includes('manage_automation') && <PreviewTile icon={Icon.Zap} label="Automation rules" />}
                  {caps.length === 0 && <div className="col-span-3 text-[12px] text-slate-500 py-6 text-center">No capabilities granted — this role sees a read-only shell.</div>}
                </div>
              </div>
            </div>
          </div>
        </Panel>
      )}
    </div>
  );
}

function PreviewTile({ icon: I, label, tone = 'accent' }) {
  const cls = tone === 'amber' ? 'text-amber-300 bg-amber-500/10' : tone === 'muted' ? 'text-slate-500 bg-white/[0.03]' : 'accent-text accent-soft-bg';
  return (
    <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 flex items-center gap-2.5">
      <span className={cn('h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0', cls)}><I size={15} /></span>
      <span className="text-[12px] text-slate-300">{label}</span>
    </div>
  );
}

window.ViewRoles = ViewRoles;
