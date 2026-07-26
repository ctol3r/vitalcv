// WAVE 1400 — primitives, selectors, accent theming, chrome
const cn = (...xs) => xs.filter(Boolean).join(' ');
function hexA(hex, a) {
  const h = hex.replace('#', ''); const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}
window.cn = cn; window.hexA = hexA;

/* ---------- time ---------- */
function timeAgo(ts) {
  const s = Math.max(1, Math.round((Date.now() - ts) / 1000));
  if (s < 60) return s + 's ago';
  const m = Math.round(s / 60); if (m < 60) return m + 'm ago';
  const h = Math.round(m / 60); if (h < 24) return h + 'h ago';
  const d = Math.round(h / 24); return d + 'd ago';
}
function clockTime(ts) { return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }
window.timeAgo = timeAgo; window.clockTime = clockTime;

/* ---------- SELECTORS — pure derivations over the roster ---------- */
// Priority score: higher = more urgent. Drives queue ordering everywhere.
function priorityScore(p) {
  let s = 0;
  if (p.risk === 'high') s += 50; else if (p.risk === 'med') s += 24;
  s += p.blockers.length * 14;
  if (p.overdue) s += 22 + Math.min(20, (p.daysInStage - p.sla));
  if (p.flagged) s += 18;
  if (p.isActive && p.licenseDays != null && p.licenseDays <= 90) s += Math.max(8, 90 - p.licenseDays) / 2;
  s += Math.max(0, 70 - p.readiness) / 4;
  return Math.round(s);
}
function priorityBand(score) { return score >= 70 ? 'P1' : score >= 40 ? 'P2' : 'P3'; }
window.priorityScore = priorityScore; window.priorityBand = priorityBand;

// Build the seven work queues for a workspace from its roster.
function buildQueues(def, roster) {
  return QUEUE_DEFS.map(q => {
    const items = roster.filter(p => q.match(p, def)).map(p => ({ ...p, score: priorityScore(p) })).sort((a, b) => b.score - a.score);
    const p1 = items.filter(i => i.score >= 70).length;
    return { ...q, items, count: items.length, p1 };
  });
}
window.buildQueues = buildQueues;

// Operations-center aggregates.
function aggregates(def, roster) {
  const inMotion = roster.filter(p => !p.isActive);
  const active = roster.filter(p => p.isActive);
  const readinessAvg = inMotion.length ? Math.round(inMotion.reduce((a, p) => a + p.readiness, 0) / inMotion.length) : 100;
  const atRiskHigh = roster.filter(p => p.risk === 'high').length;
  const atRiskMed = roster.filter(p => p.risk === 'med').length;
  const blocked = roster.filter(p => p.blockers.length).length;
  const overdue = roster.filter(p => p.overdue).length;
  const expiring = active.filter(p => p.licenseDays != null && p.licenseDays <= 90).length;
  const nearlyReady = inMotion.filter(p => p.readiness >= 85).length;
  const escalations = roster.filter(p => p.flagged).length;
  // staffing gaps by group: where active headcount is thin vs in-motion demand
  const byGroup = {};
  def.groups.forEach(g => byGroup[g] = { group: g, motion: 0, active: 0, risk: 0 });
  roster.forEach(p => { const g = byGroup[p.group]; if (!g) return; if (p.isActive) g.active++; else g.motion++; if (p.risk === 'high') g.risk++; });
  const groups = Object.values(byGroup);
  return { inMotion: inMotion.length, active: active.length, readinessAvg, atRiskHigh, atRiskMed, blocked, overdue, expiring, nearlyReady, escalations, groups, total: roster.length };
}
window.aggregates = aggregates;

const RISK = { high: { c: '#ec7a9b', label: 'High' }, med: { c: '#f0a93a', label: 'Medium' }, low: { c: '#5ed6a4', label: 'Low' } };
window.RISK = RISK;

/* ---------- Buttons ---------- */
function Button({ variant = 'primary', size = 'md', children, className = '', iconRight, iconLeft, onClick, disabled, title, type = 'button' }) {
  const base = 'inline-flex items-center justify-center font-medium rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap';
  const sizes = { xs: 'text-[11px] h-7 px-2.5 gap-1.5', sm: 'text-[12px] h-8 px-3 gap-1.5', md: 'text-[13px] h-9 px-3.5 gap-2', lg: 'text-[14px] h-11 px-5 gap-2' };
  const variants = {
    primary: 'text-slate-950 accent-bg',
    outline: 'bg-white/0 text-slate-200 border border-white/15 hover:bg-white/5 hover:border-white/30',
    ghost:   'bg-transparent text-slate-400 hover:text-white hover:bg-white/5',
    dark:    'bg-white/[0.04] text-slate-200 hover:bg-white/[0.08] border border-white/8',
    emerald: 'bg-emerald-500/14 text-emerald-300 border border-emerald-400/25 hover:bg-emerald-500/22',
    danger:  'bg-rose-500/12 text-rose-300 border border-rose-400/25 hover:bg-rose-500/20',
  };
  return (
    <button type={type} onClick={onClick} disabled={disabled} title={title} className={cn(base, sizes[size], variants[variant], className)}>
      {iconLeft}{children && <span>{children}</span>}{iconRight}
    </button>
  );
}

function Panel({ children, className = '', as: As = 'div', ...rest }) {
  return <As className={cn('bg-[#141922] border border-white/[0.08] rounded-xl', className)} {...rest}>{children}</As>;
}
function PanelHead({ icon: I, title, sub, right, className = '' }) {
  return (
    <div className={cn('px-5 py-3.5 border-b border-white/[0.07] flex items-center justify-between gap-3', className)}>
      <div className="flex items-center gap-2.5 min-w-0">
        {I && <I size={15} className="accent-text flex-shrink-0" />}
        <div className="min-w-0">
          <div className="text-[13px] font-semibold text-slate-100 truncate">{title}</div>
          {sub && <div className="text-[11px] text-slate-500 truncate mt-0.5">{sub}</div>}
        </div>
      </div>
      {right != null && <div className="flex-shrink-0">{right}</div>}
    </div>
  );
}
function Eyebrow({ children, className = '' }) {
  return <div className={cn('mono text-[10px] uppercase tracking-[0.18em] accent-text', className)}>{children}</div>;
}
function SurfaceIntro({ eyebrow, title, sub, right }) {
  return (
    <div className="flex items-end justify-between gap-6 flex-wrap">
      <div className="min-w-0">
        <Eyebrow className="mb-2.5">{eyebrow}</Eyebrow>
        <h1 className="text-[28px] font-semibold tracking-[-0.02em] text-slate-50 leading-[1.05]">{title}</h1>
        {sub && <p className="mt-3 text-[13.5px] text-slate-400 leading-[1.6] max-w-[78ch] text-pretty">{sub}</p>}
      </div>
      {right && <div className="flex-shrink-0">{right}</div>}
    </div>
  );
}
function Stat({ label, value, unit, color, sub }) {
  return (
    <div>
      <div className="mono text-[9.5px] uppercase tracking-[0.14em] text-slate-500">{label}</div>
      <div className="flex items-baseline gap-1.5 mt-1">
        <span className="text-[26px] font-semibold tabular-nums leading-none" style={{ color: color || 'var(--accent)' }}>{value}</span>
        {unit && <span className="text-[12px] text-slate-500">{unit}</span>}
      </div>
      {sub && <div className="text-[10.5px] text-slate-500 mt-1">{sub}</div>}
    </div>
  );
}
function Bar({ value, max = 100, color, track = 'rgba(255,255,255,0.06)', h = 5 }) {
  return (
    <span className="relative block rounded-full overflow-hidden w-full" style={{ height: h, background: track }}>
      <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${Math.min(100, value / max * 100)}%`, background: color || 'var(--accent)', transition: 'width .6s cubic-bezier(.2,.7,.2,1)' }} />
    </span>
  );
}
function Pill({ children, tone = 'slate', className = '' }) {
  const tones = {
    slate: 'bg-white/[0.05] text-slate-300 ring-white/10',
    accent: 'accent-soft-bg accent-text accent-ring',
    emerald: 'bg-emerald-500/12 text-emerald-300 ring-emerald-400/25',
    amber: 'bg-amber-500/12 text-amber-300 ring-amber-400/25',
    rose: 'bg-rose-500/12 text-rose-300 ring-rose-400/25',
    blue: 'bg-sky-500/12 text-sky-300 ring-sky-400/25',
  };
  return <span className={cn('inline-flex items-center gap-1.5 text-[10.5px] font-medium uppercase tracking-[0.07em] rounded-full px-2 py-0.5 ring-1 ring-inset whitespace-nowrap', tones[tone], className)}>{children}</span>;
}
function Toggle({ on, onChange, size = 'md' }) {
  const dims = size === 'sm' ? { w: 28, h: 16, k: 12 } : { w: 34, h: 19, k: 15 };
  return (
    <button type="button" onClick={() => onChange(!on)} aria-pressed={on}
      className={cn('relative rounded-full transition-colors flex-shrink-0', on ? 'accent-bg' : 'bg-slate-700')}
      style={{ width: dims.w, height: dims.h }}>
      <span className="absolute top-1/2 -translate-y-1/2 rounded-full bg-white transition-all"
        style={{ height: dims.k, width: dims.k, left: on ? dims.w - dims.k - 2 : 2 }} />
    </button>
  );
}

/* ---------- Domain bits ---------- */
function RiskDot({ risk, size = 7 }) {
  const c = (RISK[risk] || RISK.low).c;
  return <span className="rounded-full flex-shrink-0 inline-block" style={{ width: size, height: size, background: c, boxShadow: `0 0 0 3px ${hexA(c, 0.16)}` }} />;
}
function PriorityTag({ score }) {
  const band = priorityBand(score);
  const tone = band === 'P1' ? 'rose' : band === 'P2' ? 'amber' : 'slate';
  return <Pill tone={tone}>{band}</Pill>;
}
function Avatar({ userId, size = 22 }) {
  const u = TEAM.find(t => t.id === userId);
  if (!u) return <span className="rounded-full bg-white/[0.06] flex items-center justify-center text-slate-500 flex-shrink-0" style={{ width: size, height: size }}><Icon.User size={size * 0.5} /></span>;
  const role = ROLES[u.role] || {};
  return (
    <span className="rounded-full flex items-center justify-center font-semibold text-slate-950 flex-shrink-0" title={u.name}
      style={{ width: size, height: size, background: role.accent || '#34d8e8', fontSize: size * 0.4 }}>{u.initials}</span>
  );
}
function RoleChip({ roleId }) {
  const r = ROLES[roleId]; if (!r) return null;
  const I = Icon[r.icon] || Icon.User;
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-400">
      <span className="h-4.5 w-4.5 rounded flex items-center justify-center flex-shrink-0" style={{ background: hexA(r.accent, 0.16), color: r.accent, width: 18, height: 18 }}><I size={11} /></span>
      <span className="truncate">{r.short}</span>
    </span>
  );
}
function StageChip({ def, idx }) {
  const stage = def.stages[idx]; if (!stage) return null;
  return <span className="mono text-[10px] text-slate-400">{String(idx + 1).padStart(2, '0')} · {stage.label}</span>;
}
function ProviderCell({ p, def, onClick }) {
  return (
    <button onClick={onClick} className="flex items-center gap-2.5 min-w-0 text-left group">
      <RiskDot risk={p.risk} />
      <span className="min-w-0">
        <span className="block text-[12.5px] font-medium text-slate-100 truncate group-hover:accent-text transition-colors">{p.name}</span>
        <span className="block text-[10.5px] text-slate-500 truncate">{p.specialty} · {p.group}</span>
      </span>
    </button>
  );
}
window.Button = Button; window.Panel = Panel; window.PanelHead = PanelHead; window.Eyebrow = Eyebrow;
window.SurfaceIntro = SurfaceIntro; window.Stat = Stat; window.Bar = Bar; window.Pill = Pill; window.Toggle = Toggle;
window.RiskDot = RiskDot; window.PriorityTag = PriorityTag; window.Avatar = Avatar; window.RoleChip = RoleChip;
window.StageChip = StageChip; window.ProviderCell = ProviderCell;

/* ---------- Router ---------- */
function parseHash() {
  const h = (window.location.hash || '').replace(/^#\/?/, '');
  const parts = h.split('/').filter(Boolean);
  return { surface: parts[0] || 'operations', arg: parts[1] || null };
}
function useRoute() {
  const [route, setRoute] = React.useState(parseHash);
  React.useEffect(() => {
    const on = () => { setRoute(parseHash()); window.scrollTo({ top: 0, behavior: 'instant' }); };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}
function navTo(surface, arg) { window.location.hash = arg ? `#/${surface}/${arg}` : `#/${surface}`; }
window.useRoute = useRoute; window.navTo = navTo;

const SURFACES = [
  { id: 'operations', label: 'Operations',  sub: 'mission control', Icon: 'Radar' },
  { id: 'queues',     label: 'Work Queues',  sub: 'what to do next', Icon: 'ListChecks' },
  { id: 'command',    label: 'Command',      sub: 'do the work',     Icon: 'Command' },
  { id: 'timeline',   label: 'Timeline',     sub: 'audit trail',     Icon: 'GitCommit' },
  { id: 'executive',  label: 'Executive',    sub: 'leadership view',  Icon: 'Award' },
];
window.SURFACES = SURFACES;

/* ---------- Workspace switcher ---------- */
function WorkspaceSwitcher() {
  const s = useStore();
  const [open, setOpen] = React.useState(false);
  const def = WORKSPACES.find(w => w.id === s.activeWs) || WORKSPACES[0];
  const ref = React.useRef(null);
  React.useEffect(() => {
    const on = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('pointerdown', on); return () => document.removeEventListener('pointerdown', on);
  }, []);
  const I = Icon[def.icon] || Icon.Building;
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2.5 h-10 pl-2 pr-2.5 rounded-lg border border-white/10 bg-white/[0.03] hover:border-white/20 transition-colors max-w-[280px]">
        <span className="h-6 w-6 rounded-md flex items-center justify-center flex-shrink-0" style={{ background: hexA(def.accent, 0.16), color: def.accent }}><I size={14} /></span>
        <span className="min-w-0 text-left">
          <span className="block text-[12.5px] font-semibold text-slate-100 leading-tight truncate">{def.short} · {def.type}</span>
          <span className="block mono text-[9px] uppercase tracking-[0.12em] text-slate-500 leading-tight truncate">{def.name}</span>
        </span>
        <Icon.ChevronDown size={14} className={cn('text-slate-500 transition-transform flex-shrink-0', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="absolute left-0 top-12 z-50 w-[340px] bg-[#11161e] border border-white/12 rounded-xl shadow-2xl shadow-black/60 overflow-hidden">
          <div className="px-3.5 py-2.5 border-b border-white/[0.07] flex items-center justify-between">
            <span className="mono text-[9.5px] uppercase tracking-[0.16em] text-slate-500">Switch organization</span>
            <span className="mono text-[9.5px] text-slate-600">{WORKSPACES.length} live</span>
          </div>
          <div className="p-1.5 max-h-[62vh] overflow-y-auto scroll-thin">
            {WORKSPACES.map(w => {
              const WI = Icon[w.icon] || Icon.Building; const active = w.id === s.activeWs;
              const slice = s.ws[w.id];
              const agg = aggregates(w, slice.roster);
              return (
                <button key={w.id} onClick={() => { Store.set({ activeWs: w.id }); setOpen(false); navTo('operations'); }}
                  className={cn('w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-colors text-left', active ? 'bg-white/[0.06]' : 'hover:bg-white/[0.04]')}>
                  <span className="h-7 w-7 rounded-md flex items-center justify-center flex-shrink-0" style={{ background: hexA(w.accent, 0.16), color: w.accent }}><WI size={15} /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[12.5px] font-semibold text-slate-100 leading-tight truncate">{w.name}</span>
                    <span className="block text-[10.5px] text-slate-500 truncate">{w.type} · {agg.inMotion} in motion · {agg.atRiskHigh} at risk</span>
                  </span>
                  {active && <Icon.Check size={15} style={{ color: w.accent }} className="flex-shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- Top chrome ---------- */
function TopChrome({ surface }) {
  const { def, roster, events, live } = useWorkspace();
  const agg = aggregates(def, roster);
  const last = events[0];
  return (
    <div className="sticky top-0 z-40 bg-[#0b0e13]/92 backdrop-blur border-b border-white/[0.07]">
      <div className="bg-black/40 text-slate-400 text-[11px] border-b border-white/[0.05]">
        <div className="max-w-[1560px] mx-auto px-6 h-8 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <span className="mono uppercase tracking-[0.16em] text-slate-500 font-medium">Operations Engine</span>
            <span className="text-slate-700">/</span>
            <span className="truncate"><span className="mono accent-text">{agg.inMotion}</span> in motion · <span className="mono text-rose-300">{agg.atRiskHigh}</span> at risk · <span className="mono text-amber-300">{agg.overdue}</span> overdue</span>
          </div>
          <div className="hidden md:flex items-center gap-3 text-slate-500">
            <button onClick={() => Store.set(s => ({ live: !s.live }))} className="inline-flex items-center gap-1.5 hover:text-slate-200 transition-colors" title={live ? 'Pause live feed' : 'Resume live feed'}>
              <span className={cn('h-1.5 w-1.5 rounded-full', live ? 'bg-emerald-400 blink' : 'bg-slate-600')} />
              {live ? 'live' : 'paused'}
            </button>
            <span className="h-3 w-px bg-slate-700" />
            <span className="mono truncate max-w-[210px]">{last ? `${EVENT_TYPES[last.type] ? EVENT_TYPES[last.type].label : last.type} · ${timeAgo(last.ts)}` : 'vc.2026.06.27 · w1400'}</span>
          </div>
        </div>
      </div>
      <div className="max-w-[1560px] mx-auto px-6 h-14 flex items-center justify-between gap-5">
        <div className="flex items-center gap-5 min-w-0">
          <Brandmark />
          <span className="hidden md:block h-6 w-px bg-white/10" />
          <WorkspaceSwitcher />
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden xl:inline-flex items-center gap-1.5 text-[12px] text-slate-500">
            <Icon.GitCommit size={14} className="accent-text" />
            <span>Every action writes an immutable event</span>
          </span>
          <Button size="sm" variant="outline" iconLeft={<Icon.RotateCw size={13} />} onClick={() => { if (confirm('Reset all operational data to seed state?')) Store.reset(); }} title="Reset operational data">Reset</Button>
        </div>
      </div>
      <div className="border-t border-white/[0.05]">
        <nav className="max-w-[1560px] mx-auto px-4 flex items-center gap-0.5 overflow-x-auto scroll-thin" role="tablist">
          {SURFACES.map(sf => {
            const SI = Icon[sf.Icon] || Icon.Dot; const active = surface === sf.id;
            return (
              <button key={sf.id} role="tab" aria-selected={active} onClick={() => navTo(sf.id)}
                className={cn('group relative px-3.5 h-11 text-[12.5px] font-medium transition-colors flex items-center gap-2 whitespace-nowrap',
                  active ? 'text-slate-50' : 'text-slate-400 hover:text-slate-100')}>
                <SI size={14} className={active ? 'accent-text' : 'text-slate-500 group-hover:text-slate-300'} />
                <span>{sf.label}</span>
                <span className="hidden lg:inline mono text-[9px] uppercase tracking-[0.12em] text-slate-600">{sf.sub}</span>
                {active && <span className="absolute left-2 right-2 bottom-0 h-[2px] rounded-full accent-bg" />}
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
function Brandmark() {
  return (
    <a href="#/operations" className="flex items-center gap-2.5 group flex-shrink-0">
      <span className="relative h-5 w-5">
        <span className="absolute inset-0 accent-bg rounded-[5px]" />
        <svg viewBox="0 0 20 20" className="absolute inset-0 text-slate-950 h-5 w-5">
          <rect x="4" y="4" width="5" height="5" rx="1" fill="currentColor" /><rect x="11" y="4" width="5" height="5" rx="1" fill="currentColor" opacity="0.6" />
          <rect x="11" y="11" width="5" height="5" rx="1" fill="currentColor" /><rect x="4" y="11" width="5" height="5" rx="1" fill="currentColor" opacity="0.6" />
        </svg>
      </span>
      <span className="hidden sm:inline font-semibold tracking-[-0.01em] text-slate-100 text-[14px]">
        VitalCV<span className="text-slate-600 font-normal">/</span><span className="accent-text font-normal">ops</span>
      </span>
      <span className="hidden xl:inline whitespace-nowrap mono text-[9px] uppercase tracking-[0.14em] text-slate-500 border border-white/10 rounded px-1.5 py-0.5">Wave 1400</span>
    </a>
  );
}
function SectionLabel({ children, right }) {
  return (
    <div className="flex items-center justify-between gap-3 mb-2.5">
      <span className="mono text-[10px] uppercase tracking-[0.16em] text-slate-500">{children}</span>
      {right}
    </div>
  );
}
window.TopChrome = TopChrome; window.Brandmark = Brandmark; window.SectionLabel = SectionLabel;
