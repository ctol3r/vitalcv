// ════════════════════════════════════════════════════════════════════════
// OPPORTUNITY NETWORK — shell, navigation & shared primitives
// ════════════════════════════════════════════════════════════════════════

const ocn = (...xs) => xs.filter(Boolean).join(' ');

// Extra icons beyond the shared set
Object.assign(window.Icon, {
  Briefcase: (p) => (<svg {...{width:p.size||16,height:p.size||16}} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={p.strokeWidth||1.75} strokeLinecap="round" strokeLinejoin="round" className={p.className} aria-hidden="true"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>),
  Target:    (p) => (<svg {...{width:p.size||16,height:p.size||16}} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={p.strokeWidth||1.75} strokeLinecap="round" strokeLinejoin="round" className={p.className} aria-hidden="true"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/></svg>),
  Compass:   (p) => (<svg {...{width:p.size||16,height:p.size||16}} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={p.strokeWidth||1.75} strokeLinecap="round" strokeLinejoin="round" className={p.className} aria-hidden="true"><circle cx="12" cy="12" r="9"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>),
  Unlock:    (p) => (<svg {...{width:p.size||16,height:p.size||16}} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={p.strokeWidth||1.75} strokeLinecap="round" strokeLinejoin="round" className={p.className} aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>),
  Users:     (p) => (<svg {...{width:p.size||16,height:p.size||16}} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={p.strokeWidth||1.75} strokeLinecap="round" strokeLinejoin="round" className={p.className} aria-hidden="true"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>),
  TrendUp:   (p) => (<svg {...{width:p.size||16,height:p.size||16}} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={p.strokeWidth||1.75} strokeLinecap="round" strokeLinejoin="round" className={p.className} aria-hidden="true"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>),
  Zap:       (p) => (<svg {...{width:p.size||16,height:p.size||16}} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={p.strokeWidth||1.75} strokeLinecap="round" strokeLinejoin="round" className={p.className} aria-hidden="true"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>),
  ArrowLeft: (p) => (<svg {...{width:p.size||16,height:p.size||16}} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={p.strokeWidth||1.75} strokeLinecap="round" strokeLinejoin="round" className={p.className} aria-hidden="true"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>),
  Award:     (p) => (<svg {...{width:p.size||16,height:p.size||16}} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={p.strokeWidth||1.75} strokeLinecap="round" strokeLinejoin="round" className={p.className} aria-hidden="true"><circle cx="12" cy="8" r="6"/><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"/></svg>),
  Eye:       (p) => (<svg {...{width:p.size||16,height:p.size||16}} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={p.strokeWidth||1.75} strokeLinecap="round" strokeLinejoin="round" className={p.className} aria-hidden="true"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/><circle cx="12" cy="12" r="3"/></svg>),
  Share2:    (p) => (<svg {...{width:p.size||16,height:p.size||16}} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={p.strokeWidth||1.75} strokeLinecap="round" strokeLinejoin="round" className={p.className} aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>),
});
const Ic = window.Icon;

// ── primitives (parity with the wallet) ────────────────────────────────────
function Card({ children, className = '', ...rest }) {
  return <div className={ocn('bg-white border border-slate-200 rounded-lg', className)} {...rest}>{children}</div>;
}
function Eyebrow({ children, className = '' }) {
  return <div className={ocn('mono text-[10px] uppercase tracking-[0.16em] text-slate-500', className)}>{children}</div>;
}
function Btn({ variant = 'primary', sm, children, className = '', iconLeft, iconRight, ...rest }) {
  const variants = {
    primary: 'bg-slate-900 text-white hover:bg-black',
    outline: 'bg-white text-slate-900 border border-slate-300 hover:bg-slate-50 hover:border-slate-400',
    ghost:   'bg-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100',
  };
  return (
    <button className={ocn('inline-flex items-center justify-center gap-2 font-medium tracking-[-0.01em] rounded-md transition-colors',
      sm ? 'text-[12px] h-8 px-3' : 'text-[13px] h-9 px-3.5', variants[variant], className)} {...rest}>
      {iconLeft}<span>{children}</span>{iconRight}
    </button>
  );
}
function TierBadge({ tier, sm }) {
  if (!tier) return null;
  const tones = { T1: 'text-slate-600 border-slate-300', T2: 'text-sky-700 border-sky-300', T3: 'text-indigo-700 border-indigo-300', T4: 'text-emerald-700 border-emerald-300' };
  return (
    <span className={ocn('mono inline-flex items-center rounded border bg-white font-semibold tracking-[0.05em]',
      tones[tier], sm ? 'text-[9px] px-1 py-px' : 'text-[10px] px-1.5 py-0.5')} title={(W.TRUST_TIERS[tier]||{}).desc}>
      {tier}
    </span>
  );
}
function Meter({ pct, mark, fill = 'bg-slate-900', h = 'h-2' }) {
  return (
    <div className={ocn('relative w-full rounded-sm bg-slate-100 overflow-hidden', h)}>
      <div className={ocn('absolute inset-y-0 left-0 rounded-sm transition-all duration-700', fill)} style={{ width: pct + '%' }} />
      {mark != null && <span className="absolute -top-0.5 -bottom-0.5 w-px bg-slate-400" style={{ left: mark + '%' }} title="field median" />}
    </div>
  );
}

// ── readiness primitives (the heart of this module) ────────────────────────
function ReadinessChip({ level, sm, className = '' }) {
  const m = O.LEVEL[level] || O.LEVEL.building;
  return (
    <span className={ocn('inline-flex items-center gap-1.5 font-medium uppercase tracking-[0.06em] rounded-full ring-1 ring-inset whitespace-nowrap',
      m.chip, sm ? 'text-[10px] px-1.5 py-0.5' : 'text-[11px] px-2 py-0.5', className)}>
      <span className={ocn('h-1.5 w-1.5 rounded-full', m.dot, level === 'conditional' && 'pulse-soft')} />
      {m.label}
    </span>
  );
}

// Circular readiness gauge — colored by level.
function ReadinessRing({ pct, level, size = 60, stroke = 6, label = true }) {
  const m = O.LEVEL[level] || O.LEVEL.building;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative flex-none" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#e2e8f0" strokeWidth={stroke} />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={m.ring} strokeWidth={stroke}
          strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct/100)}
          style={{ transition: 'stroke-dashoffset 1s cubic-bezier(.2,.7,.2,1)' }} />
      </svg>
      {label && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="font-semibold text-slate-900 tracking-[-0.02em] tabular-nums leading-none" style={{ fontSize: size * 0.27 }}>{pct}</div>
          <div className="mono text-slate-400 uppercase tracking-[0.1em]" style={{ fontSize: size * 0.11 }}>ready</div>
        </div>
      )}
    </div>
  );
}

// One requirement line — used in detail + cards.
const REQ_ICON = { evidence: 'ShieldCheck', trust: 'Gauge', experience: 'Briefcase' };
function ReqRow({ r, onEvidence }) {
  let stateIcon, tone;
  if (r.met && r.atRisk) { stateIcon = <Ic.AlertTri size={14} />; tone = 'text-orange-600'; }
  else if (r.met && r.soft) { stateIcon = <span className="h-2 w-2 rounded-full bg-amber-500 pulse-soft inline-block" />; tone = 'text-amber-700'; }
  else if (r.met) { stateIcon = <Ic.CheckCircle size={14} />; tone = 'text-emerald-600'; }
  else { stateIcon = <Ic.X size={14} />; tone = 'text-slate-400'; }

  const right = r.type === 'trust'
    ? <span className={ocn('mono text-[11px] tabular-nums', r.met ? 'text-slate-600' : 'text-orange-600')}>{r.score} / {r.min}</span>
    : r.type === 'experience'
      ? <span className={ocn('mono text-[11px]', r.met ? 'text-slate-600' : 'text-orange-600')}>{r.have} · need {r.need}</span>
      : r.atRisk ? <span className="mono text-[11px] text-orange-600">{r.daysLeft}d left</span>
        : r.soft ? <span className="mono text-[11px] text-amber-700">in flight</span>
          : r.met ? (r.tier ? <TierBadge tier={r.tier} sm /> : <span className="mono text-[11px] text-emerald-600">verified</span>)
            : <span className="mono text-[11px] text-slate-400">not on file</span>;

  return (
    <div className="flex items-center gap-3 py-2">
      <span className={ocn('flex-none', tone)}>{stateIcon}</span>
      <div className="min-w-0 flex-1">
        <div className="text-[12.5px] text-slate-800 leading-tight">{r.label}</div>
        {r.detail && <div className="text-[11px] text-slate-400 leading-tight truncate">{r.detail}</div>}
      </div>
      <div className="flex-none">{right}</div>
    </div>
  );
}

window.Card = Card; window.Eyebrow = Eyebrow; window.Btn = Btn;
window.TierBadge = TierBadge; window.Meter = Meter; window.ocn = ocn;
window.ReadinessChip = ReadinessChip; window.ReadinessRing = ReadinessRing; window.ReqRow = ReqRow;

// section header (parity with wallet SecHead)
function SecHead({ icon, title, right, fallbackIcon }) {
  const I = window.Icon[icon] || window.Icon[fallbackIcon] || window.Icon.Activity;
  return (
    <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <I size={15} className="text-slate-700" />
        <h2 className="text-[14px] font-semibold text-slate-900 tracking-[-0.01em]">{title}</h2>
      </div>
      {right}
    </div>
  );
}
window.SecHead = SecHead;

// ── navigation ──────────────────────────────────────────────────────────────
const NAV = [
  { id: 'home',      route: '/opportunities',         label: 'Opportunities', icon: 'Briefcase', desc: 'What you’re ready for' },
  { id: 'recommend', route: '/opportunities/next',    label: 'Next Steps',    icon: 'Compass',   desc: 'How to unlock more' },
  { id: 'growth',    route: '/opportunities/growth',  label: 'Career Growth', icon: 'TrendUp',   desc: 'Your network effect' },
];
window.NAV = NAV;

function Sidebar({ active, onNav }) {
  const c = W.CLINICIAN;
  const s = O.summary();
  return (
    <aside className="hidden lg:flex flex-col w-[248px] flex-none border-r border-slate-200 bg-white sticky top-0 h-screen">
      <div className="px-5 h-[60px] flex items-center gap-2.5 border-b border-slate-200">
        <span className="relative h-6 w-6">
          <span className="absolute inset-0 bg-slate-900 rounded-[5px]" />
          <svg viewBox="0 0 20 20" className="absolute inset-0 h-6 w-6 text-white"><path d="M3 10h3l2-5 4 10 2-5h3" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </span>
        <div className="leading-none">
          <div className="text-[14.5px] font-semibold tracking-[-0.01em] text-slate-900">VitalCV<span className="text-slate-400 font-normal">/</span><span className="text-slate-500 font-normal">network</span></div>
        </div>
      </div>

      <div className="px-5 py-4 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-md bg-slate-900 text-white flex items-center justify-center font-semibold text-[14px] tracking-tight">{c.initials}</div>
          <div className="min-w-0">
            <div className="text-[13.5px] font-semibold text-slate-900 leading-tight truncate">{c.fullName}, {c.credential}</div>
            <div className="mono text-[10.5px] text-slate-500 mt-0.5">{c.specialty}</div>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-3 space-y-0.5">
        {NAV.map(n => {
          const I = Ic[n.icon];
          const on = active === n.id || (active === 'detail' && n.id === 'home');
          return (
            <button key={n.id} onClick={() => onNav(n.id)}
              className={ocn('group w-full text-left px-3 py-2 rounded-md flex items-center gap-3 transition-colors',
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

      {/* readiness summary */}
      <div className="px-5 py-4 border-t border-slate-200">
        <div className="mono text-[10px] uppercase tracking-[0.12em] text-slate-400 mb-2.5">Right now you are</div>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-[12px]">
            <span className="flex items-center gap-2 text-slate-700"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Ready for</span>
            <span className="mono font-semibold text-slate-900 tabular-nums">{s.ready}</span>
          </div>
          <div className="flex items-center justify-between text-[12px]">
            <span className="flex items-center gap-2 text-slate-700"><span className="h-1.5 w-1.5 rounded-full bg-sky-500" /> Nearly ready</span>
            <span className="mono font-semibold text-slate-900 tabular-nums">{s.nearly}</span>
          </div>
          <div className="flex items-center justify-between text-[12px]">
            <span className="flex items-center gap-2 text-slate-700"><span className="h-1.5 w-1.5 rounded-full bg-orange-500" /> Building toward</span>
            <span className="mono font-semibold text-slate-900 tabular-nums">{s.building}</span>
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
        const I = Ic[n.icon]; const on = active === n.id || (active === 'detail' && n.id === 'home');
        return (
          <button key={n.id} onClick={() => onNav(n.id)}
            className={ocn('flex-none px-4 py-3 flex items-center gap-2 text-[12.5px] font-medium border-b-2 transition-colors',
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
          {sub && <p className="text-[13px] text-slate-500 mt-1 max-w-[64ch] leading-snug">{sub}</p>}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

window.Sidebar = Sidebar; window.MobileNav = MobileNav; window.PageHead = PageHead;
