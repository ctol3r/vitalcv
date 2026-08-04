// ════════════════════════════════════════════════════════════════════════
// CAREER WALLET — shell, navigation & shared primitives
// ════════════════════════════════════════════════════════════════════════

const wcn = (...xs) => xs.filter(Boolean).join(' ');

// Extra icons beyond the shared set
Object.assign(window.Icon, {
  Wallet:  (p) => (<svg {...{width:p.size||16,height:p.size||16}} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={p.strokeWidth||1.75} strokeLinecap="round" strokeLinejoin="round" className={p.className} aria-hidden="true"><path d="M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M16 12h.01"/><path d="M21 9h-5a3 3 0 0 0 0 6h5"/></svg>),
  Share2:  (p) => (<svg {...{width:p.size||16,height:p.size||16}} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={p.strokeWidth||1.75} strokeLinecap="round" strokeLinejoin="round" className={p.className} aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>),
  Plus:    (p) => (<svg {...{width:p.size||16,height:p.size||16}} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={p.strokeWidth||1.75} strokeLinecap="round" strokeLinejoin="round" className={p.className} aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>),
  Eye:     (p) => (<svg {...{width:p.size||16,height:p.size||16}} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={p.strokeWidth||1.75} strokeLinecap="round" strokeLinejoin="round" className={p.className} aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>),
  Award:   (p) => (<svg {...{width:p.size||16,height:p.size||16}} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={p.strokeWidth||1.75} strokeLinecap="round" strokeLinejoin="round" className={p.className} aria-hidden="true"><circle cx="12" cy="8" r="6"/><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"/></svg>),
  Trash:   (p) => (<svg {...{width:p.size||16,height:p.size||16}} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={p.strokeWidth||1.75} strokeLinecap="round" strokeLinejoin="round" className={p.className} aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>),
  QrCode:  (p) => (<svg {...{width:p.size||16,height:p.size||16}} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={p.strokeWidth||1.75} strokeLinecap="round" strokeLinejoin="round" className={p.className} aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3M21 14v.01M14 21h.01M17 21h4v-4"/></svg>),
});
const Ic = window.Icon;

// ── status meta for wallet evidence states ────────────────────────────────
const WSTATE = {
  verified: { label: 'Verified', chip: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20', dot: 'bg-emerald-600', bar: 'bg-emerald-600', text: 'text-emerald-700', Icon: Ic.Check },
  pending:  { label: 'In flight', chip: 'bg-amber-50 text-amber-800 ring-amber-600/20',     dot: 'bg-amber-500',  bar: 'bg-amber-500',  text: 'text-amber-800',  Icon: Ic.Clock },
  expiring: { label: 'Expiring',  chip: 'bg-orange-50 text-orange-700 ring-orange-600/20',  dot: 'bg-orange-500', bar: 'bg-orange-500', text: 'text-orange-700', Icon: Ic.AlertTri },
  missing:  { label: 'Missing',   chip: 'bg-slate-100 text-slate-600 ring-slate-300',        dot: 'bg-slate-400',  bar: 'bg-slate-300',  text: 'text-slate-600',  Icon: Ic.Plus },
};
window.WSTATE = WSTATE;

const DIM_STATE = {
  strong:   { label: 'Strong',   text: 'text-emerald-700', fill: 'bg-slate-900' },
  building: { label: 'Building',  text: 'text-slate-700',   fill: 'bg-slate-700' },
  thin:     { label: 'Thin',      text: 'text-orange-700',  fill: 'bg-slate-400' },
};
window.DIM_STATE = DIM_STATE;

// ── primitives ─────────────────────────────────────────────────────────────
function Chip({ state = 'verified', children, sm, className = '' }) {
  const m = WSTATE[state] || WSTATE.verified;
  return (
    <span className={wcn('inline-flex items-center gap-1.5 font-medium uppercase tracking-[0.06em] rounded-full ring-1 ring-inset whitespace-nowrap',
      m.chip, sm ? 'text-[10px] px-1.5 py-0.5' : 'text-[11px] px-2 py-0.5', className)}>
      {state === 'pending'
        ? <span className={wcn('h-1.5 w-1.5 rounded-full pulse-soft', m.dot)} />
        : <m.Icon size={11} strokeWidth={2.4} />}
      <span>{children ?? m.label}</span>
    </span>
  );
}

function Btn({ variant = 'primary', sm, children, className = '', iconLeft, iconRight, ...rest }) {
  const variants = {
    primary: 'bg-slate-900 text-white hover:bg-black',
    outline: 'bg-white text-slate-900 border border-slate-300 hover:bg-slate-50 hover:border-slate-400',
    ghost:   'bg-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100',
  };
  return (
    <button className={wcn('inline-flex items-center justify-center gap-2 font-medium tracking-[-0.01em] rounded-md transition-colors',
      sm ? 'text-[12px] h-8 px-3' : 'text-[13px] h-9 px-3.5', variants[variant], className)} {...rest}>
      {iconLeft}<span>{children}</span>{iconRight}
    </button>
  );
}

function Card({ children, className = '', ...rest }) {
  return <div className={wcn('bg-white border border-slate-200 rounded-lg', className)} {...rest}>{children}</div>;
}

function Eyebrow({ children, className = '' }) {
  return <div className={wcn('mono text-[10px] uppercase tracking-[0.16em] text-slate-500', className)}>{children}</div>;
}

function TierBadge({ tier, sm }) {
  if (!tier) return null;
  const tones = { T1: 'text-slate-600 border-slate-300', T2: 'text-sky-700 border-sky-300', T3: 'text-indigo-700 border-indigo-300', T4: 'text-emerald-700 border-emerald-300' };
  return (
    <span className={wcn('mono inline-flex items-center rounded border bg-white font-semibold tracking-[0.05em]',
      tones[tier], sm ? 'text-[9px] px-1 py-px' : 'text-[10px] px-1.5 py-0.5')} title={(W.TRUST_TIERS[tier]||{}).desc}>
      {tier}
    </span>
  );
}

// thin track meter
function Meter({ pct, mark, fill = 'bg-slate-900', h = 'h-2' }) {
  return (
    <div className={wcn('relative w-full rounded-sm bg-slate-100 overflow-hidden', h)}>
      <div className={wcn('absolute inset-y-0 left-0 rounded-sm', fill)} style={{ width: pct + '%' }} />
      {mark != null && <span className="absolute -top-0.5 -bottom-0.5 w-px bg-slate-400" style={{ left: mark + '%' }} title="field median" />}
    </div>
  );
}

window.Chip = Chip; window.Btn = Btn; window.Card = Card; window.Eyebrow = Eyebrow;
window.TierBadge = TierBadge; window.Meter = Meter; window.wcn = wcn;

// ── navigation ──────────────────────────────────────────────────────────────
const NAV = [
  { id: 'home',     route: '/wallet',          label: 'Wallet Home', icon: 'Wallet',         desc: 'Your career at a glance' },
  { id: 'evidence', route: '/wallet/evidence', label: 'My Evidence', icon: 'ShieldCheck',    desc: 'What you can prove' },
  { id: 'timeline', route: '/wallet/timeline', label: 'My Timeline', icon: 'Activity',       desc: 'Your career of record' },
  { id: 'trust',    route: '/wallet/trust',    label: 'My Trust',    icon: 'Gauge',          desc: 'How trusted you are' },
  { id: 'share',    route: '/wallet/share',    label: 'Share',       icon: 'Share2',         desc: 'Packets & links' },
];
window.NAV = NAV;

function Sidebar({ active, onNav }) {
  const c = W.CLINICIAN;
  return (
    <aside className="hidden lg:flex flex-col w-[248px] flex-none border-r border-slate-200 bg-white sticky top-0 h-screen">
      {/* brand */}
      <div className="px-5 h-[60px] flex items-center gap-2.5 border-b border-slate-200">
        <span className="relative h-6 w-6">
          <span className="absolute inset-0 bg-slate-900 rounded-[5px]" />
          <svg viewBox="0 0 20 20" className="absolute inset-0 h-6 w-6 text-white"><path d="M3 10h3l2-5 4 10 2-5h3" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </span>
        <div className="leading-none">
          <div className="text-[14.5px] font-semibold tracking-[-0.01em] text-slate-900">VitalCV<span className="text-slate-400 font-normal">/</span><span className="text-slate-500 font-normal">wallet</span></div>
        </div>
      </div>

      {/* identity */}
      <div className="px-5 py-4 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-md bg-slate-900 text-white flex items-center justify-center font-semibold text-[14px] tracking-tight">{c.initials}</div>
          <div className="min-w-0">
            <div className="text-[13.5px] font-semibold text-slate-900 leading-tight truncate">{c.fullName}, {c.credential}</div>
            <div className="mono text-[10.5px] text-slate-500 mt-0.5">NPI {c.npi}</div>
          </div>
        </div>
      </div>

      {/* nav */}
      <nav className="flex-1 px-3 py-3 space-y-0.5">
        {NAV.map(n => {
          const I = Ic[n.icon];
          const on = active === n.id;
          return (
            <button key={n.id} onClick={() => onNav(n.id)}
              className={wcn('group w-full text-left px-3 py-2 rounded-md flex items-center gap-3 transition-colors',
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

      {/* footer */}
      <div className="px-5 py-4 border-t border-slate-200">
        <div className="mono text-[10px] uppercase tracking-[0.12em] text-slate-400">Wallet ID</div>
        <div className="mono text-[10.5px] text-slate-600 mt-1 break-all">{c.walletId}</div>
        <div className="mt-3 flex items-center gap-2 text-[11px] text-slate-500">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          <span>Owned by you · since {c.walletOpened}</span>
        </div>
      </div>
    </aside>
  );
}

// Mobile tab bar (lg:hidden)
function MobileNav({ active, onNav }) {
  return (
    <div className="lg:hidden sticky top-8 z-20 bg-white border-b border-slate-200 flex overflow-x-auto">
      {NAV.map(n => {
        const I = Ic[n.icon]; const on = active === n.id;
        return (
          <button key={n.id} onClick={() => onNav(n.id)}
            className={wcn('flex-none px-4 py-3 flex items-center gap-2 text-[12.5px] font-medium border-b-2 transition-colors',
              on ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-500')}>
            <I size={15} /> {n.label}
          </button>
        );
      })}
    </div>
  );
}

// Page chrome — title bar above each view
function PageHead({ icon, route, title, sub, actions }) {
  const I = Ic[icon];
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 mb-7">
      <div className="flex items-start gap-3.5">
        <div className="h-10 w-10 rounded-lg bg-slate-900 text-white flex items-center justify-center flex-none mt-0.5"><I size={18} /></div>
        <div>
          <div className="mono text-[10.5px] text-slate-400 tracking-[0.04em]">{route}</div>
          <h1 className="text-[24px] font-semibold tracking-[-0.02em] text-slate-900 leading-tight mt-0.5">{title}</h1>
          {sub && <p className="text-[13px] text-slate-500 mt-1 max-w-[60ch] leading-snug">{sub}</p>}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

window.Sidebar = Sidebar; window.MobileNav = MobileNav; window.PageHead = PageHead;
