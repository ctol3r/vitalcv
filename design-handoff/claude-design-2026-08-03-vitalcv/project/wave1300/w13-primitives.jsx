// WAVE 1300 — primitives, accent theming, chrome + workspace switcher

const cn = (...xs) => xs.filter(Boolean).join(' ');
function hexA(hex, a) {
  const h = hex.replace('#', ''); const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}
window.cn = cn; window.hexA = hexA;

/* ---------- Buttons ---------- */
function Button({ variant = 'primary', size = 'md', children, className = '', iconRight, iconLeft, onClick, disabled, title, type = 'button' }) {
  const base = 'inline-flex items-center justify-center font-medium rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap';
  const sizes = { xs: 'text-[11px] h-7 px-2.5 gap-1.5', sm: 'text-[12px] h-8 px-3 gap-1.5', md: 'text-[13px] h-9 px-3.5 gap-2', lg: 'text-[14px] h-11 px-5 gap-2' };
  const variants = {
    primary: 'text-slate-950 accent-bg',
    outline: 'bg-white/0 text-slate-200 border border-white/15 hover:bg-white/5 hover:border-white/30',
    ghost:   'bg-transparent text-slate-400 hover:text-white hover:bg-white/5',
    dark:    'bg-slate-800 text-slate-200 hover:bg-slate-700 border border-white/5',
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
        <h1 className="text-[30px] font-semibold tracking-[-0.02em] text-slate-50 leading-[1.05]">{title}</h1>
        {sub && <p className="mt-3 text-[13.5px] text-slate-400 leading-[1.6] max-w-[80ch] text-pretty">{sub}</p>}
      </div>
      {right && <div className="flex-shrink-0">{right}</div>}
    </div>
  );
}

function Stat({ label, value, unit, color }) {
  return (
    <div>
      <div className="mono text-[9.5px] uppercase tracking-[0.14em] text-slate-500">{label}</div>
      <div className="flex items-baseline gap-1.5 mt-1">
        <span className="text-[26px] font-semibold tabular-nums leading-none" style={{ color: color || 'var(--accent)' }}>{value}</span>
        {unit && <span className="text-[12px] text-slate-500">{unit}</span>}
      </div>
    </div>
  );
}

function Bar({ value, max = 100, color, track = 'rgba(255,255,255,0.06)', h = 5 }) {
  return (
    <span className="relative block rounded-full overflow-hidden w-full" style={{ height: h, background: track }}>
      <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${Math.min(100, value / max * 100)}%`, background: color || 'var(--accent)', transition: 'width .5s cubic-bezier(.2,.7,.2,1)' }} />
    </span>
  );
}

/* ---------- Toggle ---------- */
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

/* ---------- Pill / chip ---------- */
function Pill({ children, tone = 'slate', className = '' }) {
  const tones = {
    slate: 'bg-white/[0.05] text-slate-300 ring-white/10',
    accent: 'accent-soft-bg accent-text accent-ring',
    emerald: 'bg-emerald-500/12 text-emerald-300 ring-emerald-400/25',
    amber: 'bg-amber-500/12 text-amber-300 ring-amber-400/25',
    rose: 'bg-rose-500/12 text-rose-300 ring-rose-400/25',
  };
  return <span className={cn('inline-flex items-center gap-1.5 text-[10.5px] font-medium uppercase tracking-[0.07em] rounded-full px-2 py-0.5 ring-1 ring-inset whitespace-nowrap', tones[tone], className)}>{children}</span>;
}

/* ---------- Role badge ---------- */
function RoleBadge({ roleId, size = 14 }) {
  const r = ROLES[roleId]; if (!r) return null;
  const I = Icon[r.icon] || Icon.User;
  return (
    <span className="inline-flex items-center gap-1.5 text-[11.5px] text-slate-300">
      <span className="h-5 w-5 rounded-md flex items-center justify-center accent-soft-bg accent-text flex-shrink-0"><I size={11} /></span>
      <span className="truncate">{r.label}</span>
    </span>
  );
}
function WidgetKindDot({ kind }) {
  const c = { graph: '#6aa8f5', metric: '#5ed6a4', alert: '#ec7a9b', activity: '#f0a93a', card: '#c08bf0', widget: '#34d8e8' }[kind] || '#7c8aa0';
  return <span className="h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ background: c }} />;
}
window.WidgetKindDot = WidgetKindDot;

/* ---------- Hash router ---------- */
function parseHash() {
  const h = (window.location.hash || '').replace(/^#\/?/, '');
  const parts = h.split('/').filter(Boolean);
  return { surface: parts[0] || 'workspace', arg: parts[1] || null };
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

/* ---------- Surfaces ---------- */
const SURFACES = [
  { id: 'workspace',  label: 'Workspace',  sub: 'the engine',       Icon: 'Boxes' },
  { id: 'workflows',  label: 'Workflows',  sub: 'pipeline builder', Icon: 'Workflow' },
  { id: 'roles',      label: 'Roles',      sub: 'who sees what',    Icon: 'Users' },
  { id: 'dashboards', label: 'Dashboards', sub: 'composer',         Icon: 'Grid' },
  { id: 'automation', label: 'Automation', sub: 'when → then',      Icon: 'Zap' },
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
        <div className="absolute left-0 top-12 z-50 w-[330px] bg-[#11161e] border border-white/12 rounded-xl shadow-2xl shadow-black/60 overflow-hidden">
          <div className="px-3.5 py-2.5 border-b border-white/[0.07] flex items-center justify-between">
            <span className="mono text-[9.5px] uppercase tracking-[0.16em] text-slate-500">Switch workspace</span>
            <span className="mono text-[9.5px] text-slate-600">{WORKSPACES.length} organizations</span>
          </div>
          <div className="p-1.5 max-h-[60vh] overflow-y-auto scroll-thin">
            {WORKSPACES.map(w => {
              const WI = Icon[w.icon] || Icon.Building; const active = w.id === s.activeWs;
              return (
                <button key={w.id} onClick={() => { Store.set({ activeWs: w.id }); setOpen(false); navTo('workspace'); }}
                  className={cn('w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-colors text-left', active ? 'bg-white/[0.06]' : 'hover:bg-white/[0.04]')}>
                  <span className="h-7 w-7 rounded-md flex items-center justify-center flex-shrink-0" style={{ background: hexA(w.accent, 0.16), color: w.accent }}><WI size={15} /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[12.5px] font-semibold text-slate-100 leading-tight truncate">{w.name}</span>
                    <span className="block text-[10.5px] text-slate-500 truncate">{w.type} · {w.stats.providers.toLocaleString()} {w.terms.providerPl.toLowerCase()}</span>
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
  const { def, terms } = useWorkspace();
  return (
    <div className="sticky top-0 z-40 bg-[#0b0e13]/92 backdrop-blur border-b border-white/[0.07]">
      <div className="bg-black/40 text-slate-400 text-[11px] border-b border-white/[0.05]">
        <div className="max-w-[1520px] mx-auto px-6 h-8 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <span className="mono uppercase tracking-[0.16em] text-slate-500 font-medium">Workforce OS</span>
            <span className="text-slate-700">/</span>
            <span className="truncate">{def.type} · <span className="mono accent-text">{def.stats.providers.toLocaleString()}</span> {terms.providerPl.toLowerCase()} · <span className="mono accent-text">{def.stats.groups}</span> {terms.groupPl.toLowerCase()}</span>
          </div>
          <div className="hidden md:flex items-center gap-3 text-slate-500">
            <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full accent-bg blink" />config live</span>
            <span className="h-3 w-px bg-slate-700" />
            <span className="mono">vc.2026.06.27 · w1300</span>
          </div>
        </div>
      </div>
      <div className="max-w-[1520px] mx-auto px-6 h-14 flex items-center justify-between gap-5">
        <div className="flex items-center gap-5 min-w-0">
          <Brandmark />
          <span className="hidden md:block h-6 w-px bg-white/10" />
          <WorkspaceSwitcher />
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden xl:inline-flex items-center gap-1.5 text-[12px] text-slate-500">
            <Icon.Sliders size={14} className="accent-text" />
            <span>Configurable infrastructure — not fixed software</span>
          </span>
          <Button size="sm" variant="outline" iconLeft={<Icon.Save size={13} />} onClick={() => Store.reset()} title="Reset all organizations to default configuration">Reset config</Button>
        </div>
      </div>
      <div className="border-t border-white/[0.05]">
        <nav className="max-w-[1520px] mx-auto px-4 flex items-center gap-0.5 overflow-x-auto scroll-thin" role="tablist" aria-label="OS surfaces">
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
    <a href="#/workspace" className="flex items-center gap-2.5 group flex-shrink-0">
      <span className="relative h-5 w-5">
        <span className="absolute inset-0 accent-bg rounded-[5px]" />
        <svg viewBox="0 0 20 20" className="absolute inset-0 text-slate-950 h-5 w-5">
          <rect x="4" y="4" width="5" height="5" rx="1" fill="currentColor" /><rect x="11" y="4" width="5" height="5" rx="1" fill="currentColor" opacity="0.6" />
          <rect x="11" y="11" width="5" height="5" rx="1" fill="currentColor" /><rect x="4" y="11" width="5" height="5" rx="1" fill="currentColor" opacity="0.6" />
        </svg>
      </span>
      <span className="hidden sm:inline font-semibold tracking-[-0.01em] text-slate-100 text-[14px]">
        VitalCV<span className="text-slate-600 font-normal">/</span><span className="accent-text font-normal">os</span>
      </span>
      <span className="hidden xl:inline whitespace-nowrap mono text-[9px] uppercase tracking-[0.14em] text-slate-500 border border-white/10 rounded px-1.5 py-0.5">Wave 1300</span>
    </a>
  );
}

/* ---------- Empty / section helpers ---------- */
function SectionLabel({ children, right }) {
  return (
    <div className="flex items-center justify-between gap-3 mb-2.5">
      <span className="mono text-[10px] uppercase tracking-[0.16em] text-slate-500">{children}</span>
      {right}
    </div>
  );
}

window.Button = Button;
window.Panel = Panel;
window.PanelHead = PanelHead;
window.Eyebrow = Eyebrow;
window.SurfaceIntro = SurfaceIntro;
window.Stat = Stat;
window.Bar = Bar;
window.Toggle = Toggle;
window.Pill = Pill;
window.RoleBadge = RoleBadge;
window.TopChrome = TopChrome;
window.Brandmark = Brandmark;
window.SectionLabel = SectionLabel;
