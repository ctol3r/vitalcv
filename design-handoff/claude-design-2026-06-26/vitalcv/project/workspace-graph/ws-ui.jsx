// ════════════════════════════════════════════════════════════════════════
// WORKSPACE GRAPH — shell, navigation, workspace switcher (D5) & primitives
// ════════════════════════════════════════════════════════════════════════

const gcn = (...xs) => xs.filter(Boolean).join(' ');

// Extra icons beyond the shared set
Object.assign(window.Icon, {
  Briefcase: (p) => (<svg {...{width:p.size||16,height:p.size||16}} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={p.strokeWidth||1.75} strokeLinecap="round" strokeLinejoin="round" className={p.className} aria-hidden="true"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>),
  Users:     (p) => (<svg {...{width:p.size||16,height:p.size||16}} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={p.strokeWidth||1.75} strokeLinecap="round" strokeLinejoin="round" className={p.className} aria-hidden="true"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>),
  Award:     (p) => (<svg {...{width:p.size||16,height:p.size||16}} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={p.strokeWidth||1.75} strokeLinecap="round" strokeLinejoin="round" className={p.className} aria-hidden="true"><circle cx="12" cy="8" r="6"/><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"/></svg>),
  Verified:  (p) => (<svg {...{width:p.size||16,height:p.size||16}} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={p.strokeWidth||1.75} strokeLinecap="round" strokeLinejoin="round" className={p.className} aria-hidden="true"><path d="m9 12 2 2 4-4"/><path d="M12 3l1.9 1.4 2.3-.3 1 2.1 2.1 1-.3 2.3L21 12l-1.4 1.9.3 2.3-2.1 1-1 2.1-2.3-.3L12 21l-1.9-1.4-2.3.3-1-2.1-2.1-1 .3-2.3L3 12l1.4-1.9-.3-2.3 2.1-1 1-2.1 2.3.3Z"/></svg>),
  Home:      (p) => (<svg {...{width:p.size||16,height:p.size||16}} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={p.strokeWidth||1.75} strokeLinecap="round" strokeLinejoin="round" className={p.className} aria-hidden="true"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M9 21v-6h6v6"/></svg>),
  Check2:    (p) => (<svg {...{width:p.size||16,height:p.size||16}} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={p.strokeWidth||2} strokeLinecap="round" strokeLinejoin="round" className={p.className} aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>),
  Eye:       (p) => (<svg {...{width:p.size||16,height:p.size||16}} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={p.strokeWidth||1.75} strokeLinecap="round" strokeLinejoin="round" className={p.className} aria-hidden="true"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/><circle cx="12" cy="12" r="3"/></svg>),
});
const Ic = window.Icon;

// ── primitives (parity with the org graph & wallet) ─────────────────────────
function Card({ children, className = '', ...rest }) {
  return <div className={gcn('bg-white border border-slate-200 rounded-lg', className)} {...rest}>{children}</div>;
}
function Eyebrow({ children, className = '' }) {
  return <div className={gcn('mono text-[10px] uppercase tracking-[0.16em] text-slate-500', className)}>{children}</div>;
}
function Btn({ variant = 'primary', sm, children, className = '', iconLeft, iconRight, ...rest }) {
  const variants = {
    primary: 'bg-slate-900 text-white hover:bg-black',
    outline: 'bg-white text-slate-900 border border-slate-300 hover:bg-slate-50 hover:border-slate-400',
    ghost:   'bg-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100',
  };
  return (
    <button className={gcn('inline-flex items-center justify-center gap-2 font-medium tracking-[-0.01em] rounded-md transition-colors',
      sm ? 'text-[12px] h-8 px-3' : 'text-[13px] h-9 px-3.5', variants[variant], className)} {...rest}>
      {iconLeft}<span>{children}</span>{iconRight}
    </button>
  );
}
function TierBadge({ tier, sm }) {
  if (!tier) return null;
  return (
    <span className={gcn('mono inline-flex items-center rounded border bg-white font-semibold tracking-[0.05em]',
      W.tierTone(tier), sm ? 'text-[9px] px-1 py-px' : 'text-[10px] px-1.5 py-0.5')}>{tier}</span>
  );
}
function StatusChip({ chip, dot, children, sm }) {
  return (
    <span className={gcn('inline-flex items-center gap-1.5 rounded-full ring-1 ring-inset font-medium', chip,
      sm ? 'text-[10px] px-1.5 py-0.5' : 'text-[11px] px-2 py-0.5')}>
      {dot && <span className={gcn('rounded-full', dot, sm ? 'h-1 w-1' : 'h-1.5 w-1.5')} />}{children}
    </span>
  );
}
function PartyChip({ party, sm }) {
  const p = W.PARTY[party]; if (!p) return null;
  return <StatusChip chip={p.chip} dot={p.dot} sm={sm}>{p.label}</StatusChip>;
}
function VerifiedTag({ children = 'Verified', sm }) {
  return (
    <span className={gcn('inline-flex items-center gap-1 rounded-full bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20 font-medium',
      sm ? 'text-[10px] px-1.5 py-0.5' : 'text-[11px] px-2 py-0.5')}>
      <Ic.Verified size={sm ? 10 : 12} /> {children}
    </span>
  );
}
function Meter({ pct, fill = 'bg-slate-900', h = 'h-1.5' }) {
  return (
    <div className={gcn('relative w-full rounded-sm bg-slate-100 overflow-hidden', h)}>
      <div className={gcn('absolute inset-y-0 left-0 rounded-sm transition-all duration-700', fill)} style={{ width: pct + '%' }} />
    </div>
  );
}
function Stat({ value, label, accent = 'text-slate-900', sub }) {
  return (
    <div>
      <div className={gcn('text-[22px] font-semibold tracking-[-0.02em] tabular-nums leading-none', accent)}>{value}</div>
      <div className="mono text-[9.5px] uppercase tracking-[0.1em] text-slate-400 mt-1.5">{label}</div>
      {sub && <div className="text-[11px] text-slate-500 mt-0.5">{sub}</div>}
    </div>
  );
}
function KV({ k, v, mono }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2 border-b border-slate-100 last:border-0">
      <span className="text-[12px] text-slate-500 flex-none">{k}</span>
      <span className={gcn('text-[12.5px] text-slate-800 text-right', mono && 'mono tabular-nums text-[12px]')}>{v}</span>
    </div>
  );
}
function Avatar({ initials, party, size = 36, you }) {
  const tone = party === 'clinician' ? 'bg-emerald-600' : party === 'recruiter' ? 'bg-indigo-600' : 'bg-slate-800';
  return (
    <span className="relative flex-none" style={{ width: size, height: size }}>
      <span className={gcn('rounded-lg text-white flex items-center justify-center font-semibold tracking-tight w-full h-full', tone)}
        style={{ fontSize: size * 0.38 }}>{initials}</span>
      {you && <span className="absolute -bottom-1 -right-1 bg-white rounded-full p-px"><span className="block h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white" /></span>}
    </span>
  );
}

// ── section header (card) ────────────────────────────────────────────────────
function SecHead({ icon, title, sub, right, fallbackIcon }) {
  const I = window.Icon[icon] || window.Icon[fallbackIcon] || window.Icon.Activity;
  return (
    <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2.5 min-w-0">
        <I size={15} className="text-slate-700 flex-none" />
        <div className="min-w-0">
          <h2 className="text-[14px] font-semibold text-slate-900 tracking-[-0.01em] leading-tight">{title}</h2>
          {sub && <div className="text-[11.5px] text-slate-400 leading-tight mt-0.5 truncate">{sub}</div>}
        </div>
      </div>
      {right}
    </div>
  );
}

// ── page header ──────────────────────────────────────────────────────────────
function PageHead({ icon, route, title, sub, actions }) {
  const I = Ic[icon];
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 mb-7">
      <div className="flex items-start gap-3.5">
        <div className="h-10 w-10 rounded-lg bg-slate-900 text-white flex items-center justify-center flex-none mt-0.5"><I size={18} /></div>
        <div>
          <div className="mono text-[10.5px] text-slate-400 tracking-[0.04em]">{route}</div>
          <h1 className="text-[24px] font-semibold tracking-[-0.02em] text-slate-900 leading-tight mt-0.5">{title}</h1>
          {sub && <p className="text-[13px] text-slate-500 mt-1 max-w-[68ch] leading-snug">{sub}</p>}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

Object.assign(window, { gcn, Card, Eyebrow, Btn, TierBadge, StatusChip, PartyChip, VerifiedTag, Meter, Stat, KV, Avatar, SecHead, PageHead });

// ── relationship lockup — the spine of the whole product ─────────────────────
// Person ↔ Workspace ↔ Organization ↔ Opportunity, rendered as a live chain.
function RelationSpine({ ws }) {
  const nodes = [
    { icon: 'User', label: 'Person', value: 'Macie Miller', tone: 'emerald' },
    { icon: 'Layers', label: 'Workspace', value: ws.short, tone: 'slate', focal: true },
    { icon: 'Building', label: 'Organization', value: W.ORG.short, tone: 'slate' },
    { icon: 'Briefcase', label: 'Opportunity', value: ws.stats.opportunities + ' open', tone: 'amber' },
  ];
  const toneMap = {
    emerald: 'text-emerald-700 ring-emerald-600/20 bg-emerald-50',
    slate: 'text-slate-700 ring-slate-300 bg-slate-50',
    amber: 'text-amber-700 ring-amber-600/20 bg-amber-50',
  };
  return (
    <div className="flex items-stretch gap-0 overflow-x-auto">
      {nodes.map((n, i) => {
        const I = Ic[n.icon];
        return (
          <React.Fragment key={n.label}>
            <div className={gcn('flex-1 min-w-[120px] rounded-lg ring-1 ring-inset px-3.5 py-3', toneMap[n.tone], n.focal && 'ring-2')}>
              <div className="flex items-center gap-1.5">
                <I size={13} />
                <span className="mono text-[9.5px] uppercase tracking-[0.12em]">{n.label}</span>
              </div>
              <div className="text-[13px] font-semibold text-slate-900 mt-1.5 truncate">{n.value}</div>
            </div>
            {i < nodes.length - 1 && (
              <div className="flex items-center px-1.5 text-slate-300 flex-none">
                <Ic.ArrowRight size={15} />
              </div>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}
window.RelationSpine = RelationSpine;

// ── navigation ────────────────────────────────────────────────────────────────
const NAV = [
  { id: 'home',      route: 'home',         label: 'Workspace',    icon: 'Home',     desc: 'Shared operating surface' },
  { id: 'org',       route: 'organization', label: 'Organization', icon: 'Building',  desc: 'Profile · trust · talent' },
  { id: 'clinician', route: 'clinicians',   label: 'Clinician',    icon: 'User',      desc: 'Career · readiness · mobility' },
  { id: 'activity',  route: 'activity',     label: 'Activity',     icon: 'Activity',  desc: 'Shared feed' },
];
window.NAV = NAV;

// ── W275-D5 · Workspace switcher ──────────────────────────────────────────────
function WorkspaceSwitcher({ ws, onSwitch }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef(null);
  React.useEffect(() => {
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDoc); return () => document.removeEventListener('mousedown', onDoc);
  }, []);
  const type = W.WS_TYPE[ws.type];
  const TIcon = Ic[type.icon];
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(o => !o)}
        className={gcn('w-full flex items-center gap-2.5 rounded-lg border px-2.5 py-2.5 text-left transition-colors',
          open ? 'border-slate-300 bg-slate-50' : 'border-slate-200 bg-white hover:bg-slate-50')}>
        <span className="h-9 w-9 rounded-lg bg-slate-900 text-white flex items-center justify-center font-semibold text-[13px] flex-none">{ws.initials}</span>
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] font-semibold text-slate-900 leading-tight truncate">{ws.short}</span>
          <span className="flex items-center gap-1 mt-0.5"><TIcon size={11} className={type.tint} /><span className={gcn('text-[10.5px] leading-none', type.tint)}>{type.label}</span></span>
        </span>
        <Ic.ChevronDown size={15} className={gcn('text-slate-400 flex-none transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute z-50 left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden">
          <div className="px-3 py-2 border-b border-slate-100 mono text-[9.5px] uppercase tracking-[0.14em] text-slate-400">Switch workspace</div>
          {W.WORKSPACES.map(w => {
            const wt = W.WS_TYPE[w.type]; const WI = Ic[wt.icon]; const on = w.id === ws.id;
            return (
              <button key={w.id} onClick={() => { onSwitch(w.id); setOpen(false); }}
                className={gcn('w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors border-b border-slate-50 last:border-0',
                  on ? 'bg-slate-50' : 'hover:bg-slate-50')}>
                <span className={gcn('h-8 w-8 rounded-lg flex items-center justify-center font-semibold text-[12px] flex-none',
                  on ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600')}>{w.initials}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[12.5px] font-medium text-slate-900 leading-tight truncate">{w.short}</span>
                  <span className="flex items-center gap-1 mt-0.5"><WI size={10} className={wt.tint} /><span className={gcn('text-[10px] leading-none', wt.tint)}>{wt.label}</span></span>
                </span>
                {on && <Ic.Check2 size={15} className="text-slate-900 flex-none" />}
              </button>
            );
          })}
          <div className="px-3 py-2 border-t border-slate-100">
            <span className="flex items-center gap-1.5 text-[11px] text-slate-400"><Ic.Layers size={12} /> One person, many rooms · one passport</span>
          </div>
        </div>
      )}
    </div>
  );
}
window.WorkspaceSwitcher = WorkspaceSwitcher;

// ── sidebar ────────────────────────────────────────────────────────────────────
function Sidebar({ ws, active, onNav, onSwitch }) {
  const members = W.membersFor(ws.id);
  const sideCounts = ws.sides.map(s => ({ s, n: members.filter(m => m.party === s).length })).filter(x => x.n);
  return (
    <aside className="hidden lg:flex flex-col w-[256px] flex-none border-r border-slate-200 bg-white sticky top-0 h-screen">
      <div className="px-4 h-[60px] flex items-center gap-2.5 border-b border-slate-200">
        <span className="relative h-6 w-6 flex-none">
          <span className="absolute inset-0 bg-slate-900 rounded-[5px]" />
          <svg viewBox="0 0 20 20" className="absolute inset-0 h-6 w-6 text-white"><path d="M3 10h3l2-5 4 10 2-5h3" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </span>
        <div className="text-[14.5px] font-semibold tracking-[-0.01em] text-slate-900">VitalCV<span className="text-slate-400 font-normal">/</span><span className="text-slate-500 font-normal">workspace</span></div>
      </div>

      <div className="px-3 pt-3 pb-2">
        <WorkspaceSwitcher ws={ws} onSwitch={onSwitch} />
      </div>

      <div className="px-3 pb-1">
        <div className="flex items-center gap-1.5 flex-wrap px-1">
          {sideCounts.map(({ s, n }) => (
            <span key={s} className={gcn('inline-flex items-center gap-1 rounded-full ring-1 ring-inset px-1.5 py-0.5 text-[10px] font-medium', W.PARTY[s].chip)}>
              <span className={gcn('h-1 w-1 rounded-full', W.PARTY[s].dot)} />{W.PARTY[s].label} {n}
            </span>
          ))}
        </div>
      </div>

      <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
        {NAV.map(n => {
          const I = Ic[n.icon]; const on = active === n.id;
          return (
            <button key={n.id} onClick={() => onNav(n.id)}
              className={gcn('group w-full text-left px-3 py-2 rounded-md flex items-center gap-3 transition-colors',
                on ? 'bg-slate-100 text-slate-900' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900')}>
              <I size={16} className={on ? 'text-slate-900' : 'text-slate-400 group-hover:text-slate-600'} />
              <div className="min-w-0">
                <div className="text-[13px] font-medium leading-tight">{n.label}</div>
                <div className="text-[11px] text-slate-400 leading-tight truncate">{n.desc}</div>
              </div>
            </button>
          );
        })}
      </nav>

      <div className="px-5 py-4 border-t border-slate-200">
        <div className="mono text-[10px] uppercase tracking-[0.12em] text-slate-400 mb-2.5">This workspace</div>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-[12px]">
            <span className="flex items-center gap-2 text-slate-700"><Ic.Users size={13} className="text-slate-400" /> Members</span>
            <span className="mono font-semibold text-slate-900 tabular-nums">{ws.stats.members}</span>
          </div>
          <div className="flex items-center justify-between text-[12px]">
            <span className="flex items-center gap-2 text-slate-700"><Ic.Briefcase size={13} className="text-slate-400" /> Opportunities</span>
            <span className="mono font-semibold text-slate-900 tabular-nums">{ws.stats.opportunities}</span>
          </div>
          <div className="flex items-center justify-between text-[12px]">
            <span className="flex items-center gap-2 text-slate-700"><Ic.ShieldCheck size={13} className="text-slate-400" /> Evidence</span>
            <span className="mono font-semibold text-slate-900 tabular-nums">{ws.stats.evidence}</span>
          </div>
        </div>
      </div>
    </aside>
  );
}

function MobileNav({ active, onNav }) {
  return (
    <div className="lg:hidden sticky top-8 z-20 bg-white border-b border-slate-200 flex overflow-x-auto">
      {NAV.map(n => {
        const I = Ic[n.icon]; const on = active === n.id;
        return (
          <button key={n.id} onClick={() => onNav(n.id)}
            className={gcn('flex-none px-4 py-3 flex items-center gap-2 text-[12.5px] font-medium border-b-2 transition-colors',
              on ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-500')}>
            <I size={15} /> {n.label}
          </button>
        );
      })}
    </div>
  );
}

window.Sidebar = Sidebar; window.MobileNav = MobileNav;
