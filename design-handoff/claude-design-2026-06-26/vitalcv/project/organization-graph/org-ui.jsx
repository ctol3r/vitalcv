// ════════════════════════════════════════════════════════════════════════
// ORGANIZATION GRAPH — shell, navigation & shared primitives
// ════════════════════════════════════════════════════════════════════════

const gcn = (...xs) => xs.filter(Boolean).join(' ');

// Extra icons beyond the shared set
Object.assign(window.Icon, {
  Briefcase: (p) => (<svg {...{width:p.size||16,height:p.size||16}} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={p.strokeWidth||1.75} strokeLinecap="round" strokeLinejoin="round" className={p.className} aria-hidden="true"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>),
  Users:     (p) => (<svg {...{width:p.size||16,height:p.size||16}} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={p.strokeWidth||1.75} strokeLinecap="round" strokeLinejoin="round" className={p.className} aria-hidden="true"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>),
  Award:     (p) => (<svg {...{width:p.size||16,height:p.size||16}} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={p.strokeWidth||1.75} strokeLinecap="round" strokeLinejoin="round" className={p.className} aria-hidden="true"><circle cx="12" cy="8" r="6"/><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"/></svg>),
  ArrowLeft: (p) => (<svg {...{width:p.size||16,height:p.size||16}} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={p.strokeWidth||1.75} strokeLinecap="round" strokeLinejoin="round" className={p.className} aria-hidden="true"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>),
  Bed:       (p) => (<svg {...{width:p.size||16,height:p.size||16}} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={p.strokeWidth||1.75} strokeLinecap="round" strokeLinejoin="round" className={p.className} aria-hidden="true"><path d="M2 4v16M2 8h18a2 2 0 0 1 2 2v10M2 17h20M6 8v9"/><circle cx="8" cy="11.5" r="1.5"/></svg>),
  Building2: (p) => (<svg {...{width:p.size||16,height:p.size||16}} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={p.strokeWidth||1.75} strokeLinecap="round" strokeLinejoin="round" className={p.className} aria-hidden="true"><path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/><path d="M10 6h4M10 10h4M10 14h4M10 18h4"/></svg>),
  TrendUp:   (p) => (<svg {...{width:p.size||16,height:p.size||16}} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={p.strokeWidth||1.75} strokeLinecap="round" strokeLinejoin="round" className={p.className} aria-hidden="true"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>),
  Verified:  (p) => (<svg {...{width:p.size||16,height:p.size||16}} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={p.strokeWidth||1.75} strokeLinecap="round" strokeLinejoin="round" className={p.className} aria-hidden="true"><path d="m9 12 2 2 4-4"/><path d="M12 3l1.9 1.4 2.3-.3 1 2.1 2.1 1-.3 2.3L21 12l-1.4 1.9.3 2.3-2.1 1-1 2.1-2.3-.3L12 21l-1.9-1.4-2.3.3-1-2.1-2.1-1 .3-2.3L3 12l1.4-1.9-.3-2.3 2.1-1 1-2.1 2.3.3Z"/></svg>),
  Eye:       (p) => (<svg {...{width:p.size||16,height:p.size||16}} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={p.strokeWidth||1.75} strokeLinecap="round" strokeLinejoin="round" className={p.className} aria-hidden="true"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/><circle cx="12" cy="12" r="3"/></svg>),
});
const Ic = window.Icon;

// ── primitives (parity with the wallet) ────────────────────────────────────
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
      G.tierTone(tier), sm ? 'text-[9px] px-1 py-px' : 'text-[10px] px-1.5 py-0.5')} title={(W.TRUST_TIERS[tier]||{}).desc}>
      {tier}
    </span>
  );
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
function Stat({ value, label, accent = 'text-slate-900' }) {
  return (
    <div>
      <div className={gcn('text-[22px] font-semibold tracking-[-0.02em] tabular-nums leading-none', accent)}>{value}</div>
      <div className="mono text-[9.5px] uppercase tracking-[0.1em] text-slate-400 mt-1.5">{label}</div>
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

window.gcn = gcn; window.Card = Card; window.Eyebrow = Eyebrow; window.Btn = Btn;
window.TierBadge = TierBadge; window.VerifiedTag = VerifiedTag; window.Meter = Meter;
window.Stat = Stat; window.KV = KV;

// ── section header ──────────────────────────────────────────────────────────
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
window.SecHead = SecHead;

// Organization avatar tile
function OrgMark({ org, size = 40, className = '' }) {
  return (
    <span className={gcn('rounded-md bg-slate-900 text-white flex items-center justify-center font-semibold tracking-tight flex-none', className)}
      style={{ width: size, height: size, fontSize: size * 0.36 }}>
      {org.initials}
    </span>
  );
}
window.OrgMark = OrgMark;

// ── navigation ──────────────────────────────────────────────────────────────
const NAV = [
  { id: 'profile',       route: 'profile',       label: 'Profile',       icon: 'Building2', desc: 'Identity & facilities' },
  { id: 'opportunities', route: 'opportunities', label: 'Opportunities', icon: 'Briefcase', desc: 'Owned containers' },
  { id: 'timeline',      route: 'timeline',      label: 'Timeline',      icon: 'Activity',  desc: 'Milestones' },
  { id: 'trust',         route: 'trust',         label: 'Trust',         icon: 'ShieldCheck', desc: 'Verification & freshness' },
  { id: 'graph',         route: 'graph',         label: 'Relationships', icon: 'Network',   desc: 'Clinician ↔ org graph' },
];
window.NAV = NAV;

function Sidebar({ org, active, onNav }) {
  return (
    <aside className="hidden lg:flex flex-col w-[252px] flex-none border-r border-slate-200 bg-white sticky top-0 h-screen">
      <div className="px-5 h-[60px] flex items-center gap-2.5 border-b border-slate-200">
        <span className="relative h-6 w-6">
          <span className="absolute inset-0 bg-slate-900 rounded-[5px]" />
          <svg viewBox="0 0 20 20" className="absolute inset-0 h-6 w-6 text-white"><path d="M3 10h3l2-5 4 10 2-5h3" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </span>
        <div className="leading-none">
          <div className="text-[14.5px] font-semibold tracking-[-0.01em] text-slate-900">VitalCV<span className="text-slate-400 font-normal">/</span><span className="text-slate-500 font-normal">orgs</span></div>
        </div>
      </div>

      <div className="px-5 py-4 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <OrgMark org={org} size={42} className="rounded-lg" />
          <div className="min-w-0">
            <div className="text-[13.5px] font-semibold text-slate-900 leading-tight truncate flex items-center gap-1.5">{org.short}</div>
            <div className="mono text-[10.5px] text-slate-500 mt-0.5 truncate">{org.kind}</div>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-1.5 text-[11px] text-emerald-700">
          <Ic.Verified size={12} /> Identity verified · NPI {org.identity ? org.identity.orgNpi : org.orgNpi}
        </div>
      </div>

      <nav className="flex-1 px-3 py-3 space-y-0.5">
        {NAV.map(n => {
          const I = Ic[n.icon];
          const on = active === n.id || (active === 'container' && n.id === 'opportunities');
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
        <div className="mono text-[10px] uppercase tracking-[0.12em] text-slate-400 mb-2.5">At a glance</div>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-[12px]">
            <span className="flex items-center gap-2 text-slate-700"><Ic.Building2 size={13} className="text-slate-400" /> Facilities</span>
            <span className="mono font-semibold text-slate-900 tabular-nums">{org.stats.facilities}</span>
          </div>
          <div className="flex items-center justify-between text-[12px]">
            <span className="flex items-center gap-2 text-slate-700"><Ic.Users size={13} className="text-slate-400" /> Providers</span>
            <span className="mono font-semibold text-slate-900 tabular-nums">{org.stats.providers.toLocaleString()}</span>
          </div>
          <div className="flex items-center justify-between text-[12px]">
            <span className="flex items-center gap-2 text-slate-700"><Ic.Briefcase size={13} className="text-slate-400" /> Open reqs</span>
            <span className="mono font-semibold text-slate-900 tabular-nums">{org.stats.openReqs}</span>
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
        const I = Ic[n.icon]; const on = active === n.id || (active === 'container' && n.id === 'opportunities');
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

function PageHead({ icon, route, title, sub, actions }) {
  const I = Ic[icon];
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 mb-7">
      <div className="flex items-start gap-3.5">
        <div className="h-10 w-10 rounded-lg bg-slate-900 text-white flex items-center justify-center flex-none mt-0.5"><I size={18} /></div>
        <div>
          <div className="mono text-[10.5px] text-slate-400 tracking-[0.04em]">{route}</div>
          <h1 className="text-[24px] font-semibold tracking-[-0.02em] text-slate-900 leading-tight mt-0.5">{title}</h1>
          {sub && <p className="text-[13px] text-slate-500 mt-1 max-w-[66ch] leading-snug">{sub}</p>}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

window.Sidebar = Sidebar; window.MobileNav = MobileNav; window.PageHead = PageHead;
