// WAVE 1200 — primitives & chrome (Professional Reasoning Engine · dark)

const cn = (...xs) => xs.filter(Boolean).join(' ');

/* ---------- Trust / state tokens (dark) ---------- */
const STATE_META = {
  verified:   { label: 'Source-backed', chip: 'bg-emerald-500/12 text-emerald-300 ring-emerald-400/25', dot: 'bg-emerald-400', Icon: Icon.ShieldCheck },
  pending:    { label: 'Reading',       chip: 'bg-amber-500/12 text-amber-300 ring-amber-400/25',       dot: 'bg-amber-400',  Icon: Icon.Clock },
  conferred:  { label: 'Conferred',     chip: 'bg-fuchsia-500/12 text-fuchsia-300 ring-fuchsia-400/25', dot: 'bg-fuchsia-400', Icon: Icon.Award },
  historical: { label: 'Historical',    chip: 'bg-slate-500/15 text-slate-300 ring-slate-400/20',       dot: 'bg-slate-400',  Icon: Icon.Clock },
  unknown:    { label: 'Projected',     chip: 'bg-violet-500/12 text-violet-300 ring-violet-400/25',    dot: 'bg-violet-400', Icon: Icon.Target },
};
window.STATE_META = STATE_META;

function Chip({ state = 'unknown', children, size = 'md', withIcon = true, className = '' }) {
  const m = STATE_META[state] || STATE_META.unknown;
  const sz = size === 'sm' ? 'text-[10px] px-1.5 py-0.5 gap-1' : 'text-[11px] px-2 py-0.5 gap-1.5';
  return (
    <span className={cn('inline-flex items-center font-medium uppercase tracking-[0.06em] rounded-full ring-1 ring-inset whitespace-nowrap', m.chip, sz, className)}>
      {withIcon && state === 'pending' && <span className={cn('h-1.5 w-1.5 rounded-full pulse-soft', m.dot)} />}
      {withIcon && state !== 'pending' && m.Icon && <m.Icon size={size === 'sm' ? 10 : 12} strokeWidth={2.25} />}
      <span>{children ?? m.label}</span>
    </span>
  );
}

function Tag({ children, color = '#34d8e8', className = '' }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-[10px] mono uppercase tracking-[0.1em] rounded px-1.5 py-0.5', className)}
      style={{ color, background: hexA(color, 0.12), boxShadow: `inset 0 0 0 1px ${hexA(color, 0.22)}` }}>
      {children}
    </span>
  );
}

function Button({ variant = 'primary', size = 'md', children, className = '', iconRight, iconLeft, onClick, disabled, title, type = 'button' }) {
  const base = 'inline-flex items-center justify-center font-medium tracking-tightish rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap';
  const sizes = { sm: 'text-[12px] h-8 px-3 gap-1.5', md: 'text-[13px] h-9 px-3.5 gap-2', lg: 'text-[14px] h-11 px-5 gap-2' };
  const variants = {
    primary: 'bg-cyan-400 text-slate-950 hover:bg-cyan-300',
    outline: 'bg-white/0 text-slate-200 border border-white/15 hover:bg-white/5 hover:border-white/30',
    ghost:   'bg-transparent text-slate-400 hover:text-white hover:bg-white/5',
    dark:    'bg-slate-800 text-slate-200 hover:bg-slate-700 border border-white/5',
  };
  return (
    <button type={type} onClick={onClick} disabled={disabled} title={title} className={cn(base, sizes[size], variants[variant], className)}>
      {iconLeft}<span>{children}</span>{iconRight}
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
        {I && <I size={15} className="text-cyan-300 flex-shrink-0" />}
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
  return <div className={cn('mono text-[10px] uppercase tracking-[0.18em] text-cyan-400/80', className)}>{children}</div>;
}

function SurfaceIntro({ eyebrow, title, sub, right }) {
  return (
    <div className="flex items-end justify-between gap-6 flex-wrap">
      <div className="min-w-0">
        <Eyebrow className="mb-2.5">{eyebrow}</Eyebrow>
        <h1 className="text-[30px] font-semibold tracking-[-0.02em] text-slate-50 leading-[1.05]">{title}</h1>
        {sub && <p className="mt-3 text-[13.5px] text-slate-400 leading-[1.6] max-w-[78ch] text-pretty">{sub}</p>}
      </div>
      {right && <div className="flex-shrink-0">{right}</div>}
    </div>
  );
}

function Stat({ label, value, unit, delta, color = '#34d8e8' }) {
  return (
    <div>
      <div className="mono text-[9.5px] uppercase tracking-[0.14em] text-slate-500">{label}</div>
      <div className="flex items-baseline gap-1.5 mt-1">
        <span className="text-[26px] font-semibold tabular-nums leading-none" style={{ color }}>{value}</span>
        {unit && <span className="text-[12px] text-slate-500">{unit}</span>}
        {delta != null && delta !== 0 && (
          <span className={cn('mono text-[11px] ml-0.5', delta > 0 ? 'text-emerald-400' : 'text-rose-400')}>
            {delta > 0 ? '+' : ''}{delta}
          </span>
        )}
      </div>
    </div>
  );
}

function Bar({ value, max = 100, color = '#34d8e8', track = 'rgba(255,255,255,0.06)', h = 5, ghost = null }) {
  return (
    <span className="relative block rounded-full overflow-hidden w-full" style={{ height: h, background: track }}>
      {ghost != null && <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${Math.min(100, ghost / max * 100)}%`, background: hexA(color, 0.3) }} />}
      <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${Math.min(100, value / max * 100)}%`, background: color, transition: 'width .5s cubic-bezier(.2,.7,.2,1)' }} />
    </span>
  );
}

function FamilyDot({ family, size = 9 }) {
  const c = FAM_COLOR[family] || '#7cc6e8';
  return <span className="inline-block rounded-full flex-shrink-0" style={{ width: size, height: size, background: c }} />;
}

function IconFor({ name, ...rest }) { const I = Icon[name] || Icon.Dot; return <I {...rest} />; }

// inline node reference (dark)
function NodeRef({ node, onClick, detail, className = '' }) {
  if (!node) return null;
  const c = FAM_COLOR[node.family] || '#7cc6e8';
  return (
    <button onClick={onClick} className={cn('group w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-white/[0.04] transition-colors text-left', className)}>
      <span className="h-7 w-7 rounded-md flex items-center justify-center flex-shrink-0" style={{ background: hexA(c, 0.14), color: c }}>
        <IconFor name={node.icon} size={14} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[12.5px] font-semibold text-slate-100 leading-tight truncate">{node.label}</span>
        <span className="block text-[10.5px] text-slate-500 truncate">{detail || node.sub}</span>
      </span>
      {onClick && <Icon.ChevronRight size={13} className="text-slate-600 group-hover:text-slate-400 flex-shrink-0" />}
    </button>
  );
}

/* ---------- Brandmark ---------- */
function Brandmark() {
  return (
    <a href="#/graph" className="flex items-center gap-2.5 group">
      <span className="relative h-5 w-5">
        <span className="absolute inset-0 bg-cyan-400 rounded-[5px]" />
        <svg viewBox="0 0 20 20" className="absolute inset-0 text-slate-950 h-5 w-5">
          <circle cx="6" cy="6" r="1.7" fill="currentColor" /><circle cx="14" cy="5" r="1.4" fill="currentColor" /><circle cx="14.5" cy="14" r="1.7" fill="currentColor" /><circle cx="5" cy="14" r="1.4" fill="currentColor" />
          <path d="M6 6 14 5 14.5 14 5 14 6 6 14.5 14M14 5 5 14" stroke="currentColor" strokeWidth="1" fill="none" opacity="0.55" />
        </svg>
      </span>
      <span className="font-semibold tracking-tightish text-slate-100 text-[14px]">
        VitalCV<span className="text-slate-600 font-normal">/</span><span className="text-cyan-300 font-normal">reason</span>
      </span>
      <span className="hidden sm:inline whitespace-nowrap mono text-[9px] uppercase tracking-[0.14em] text-slate-500 border border-white/10 rounded px-1.5 py-0.5">Wave 1200</span>
    </a>
  );
}

/* ---------- Hash router ---------- */
function parseHash() {
  const h = (window.location.hash || '').replace(/^#\/?/, '');
  const parts = h.split('/').filter(Boolean);
  return { surface: parts[0] || 'graph', arg: parts[1] || null };
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
window.useRoute = useRoute;
window.navTo = navTo;

/* ---------- Surfaces ---------- */
const SURFACES = [
  { id: 'graph',     label: 'Career Graph', sub: 'the universe',        Icon: Icon.Share2 },
  { id: 'search',    label: 'Search',       sub: 'find anything',       Icon: Icon.Search },
  { id: 'explore',   label: 'Explore',      sub: 'ask in language',     Icon: Icon.Sparkles },
  { id: 'path',      label: 'Path',         sub: 'why, explained',      Icon: Icon.GitBranch },
  { id: 'scenarios', label: 'Scenarios',    sub: 'what if…',            Icon: Icon.Compass },
  { id: 'studio',    label: 'Studio',       sub: 'recommendations',     Icon: Icon.Sparkles },
];
window.SURFACES = SURFACES;

/* ---------- Top chrome ---------- */
function TopChrome({ surface }) {
  return (
    <div className="sticky top-0 z-30 bg-[#0b0e13]/92 backdrop-blur border-b border-white/[0.07]">
      <div className="bg-black/40 text-slate-400 text-[11px] border-b border-white/[0.05]">
        <div className="max-w-[1480px] mx-auto px-6 h-8 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <span className="mono uppercase tracking-[0.16em] text-slate-500 font-medium">Reasoning Engine</span>
            <span className="text-slate-700">/</span>
            <span className="truncate">Knowledge graph · <span className="mono text-cyan-300">{UNIVERSE.nodes.length}</span> entities · <span className="mono text-cyan-300">{UNIVERSE.edges.length}</span> relationships · <span className="mono text-slate-300">{CLINICIANS.length}</span> clinicians</span>
          </div>
          <div className="hidden md:flex items-center gap-3 text-slate-500">
            <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-cyan-400 blink" />graph live</span>
            <span className="h-3 w-px bg-slate-700" />
            <span className="mono">vc.2026.06.27 · w1200</span>
          </div>
        </div>
      </div>
      <div className="max-w-[1480px] mx-auto px-6 h-14 flex items-center justify-between gap-6">
        <div className="flex items-center gap-7 min-w-0">
          <Brandmark />
          <nav className="hidden lg:flex items-center gap-0.5" role="tablist" aria-label="Reasoning surfaces">
            {SURFACES.map(s => {
              const active = surface === s.id;
              return (
                <button key={s.id} role="tab" aria-selected={active} onClick={() => navTo(s.id)}
                  className={cn('group relative px-3 h-9 rounded-md text-[12.5px] font-medium transition-colors flex items-center gap-2',
                    active ? 'text-slate-50 bg-white/[0.07]' : 'text-slate-400 hover:text-slate-100 hover:bg-white/[0.04]')}>
                  <s.Icon size={14} className={active ? 'text-cyan-300' : 'text-slate-500 group-hover:text-slate-300'} />
                  <span>{s.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden xl:inline-flex items-center gap-1.5 text-[12px] text-slate-500">
            <Icon.ShieldCheck size={14} className="text-emerald-400" />
            <span>One owned ledger · reasoned as a graph</span>
          </span>
          <Button size="sm" variant="outline" iconLeft={<Icon.Download size={13} />}>Export</Button>
        </div>
      </div>
      <nav className="lg:hidden flex items-center gap-1 px-4 pb-2 overflow-x-auto scroll-thin" role="tablist">
        {SURFACES.map(s => {
          const active = surface === s.id;
          return (
            <button key={s.id} onClick={() => navTo(s.id)}
              className={cn('px-3 h-8 rounded-md text-[12px] font-medium whitespace-nowrap flex items-center gap-1.5',
                active ? 'text-slate-50 bg-white/[0.08]' : 'text-slate-400')}>
              <s.Icon size={13} /><span>{s.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}

/* ---------- Legend ---------- */
const LEGEND = [
  { family: 'person', label: 'People' },
  { family: 'institution', label: 'Institutions' },
  { family: 'credential', label: 'Credentials' },
  { family: 'work', label: 'Evidence' },
  { family: 'honor', label: 'Recognition' },
  { family: 'aspiration', label: 'Opportunities' },
];
function Legend({ className = '', filters, setFilters }) {
  return (
    <div className={cn('flex flex-wrap items-center gap-x-3.5 gap-y-1.5', className)}>
      {LEGEND.map(({ family, label }) => {
        const on = !filters || filters[family];
        return (
          <button key={family} onClick={() => setFilters && setFilters(f => ({ ...f, [family]: !f[family] }))}
            disabled={!setFilters}
            className={cn('inline-flex items-center gap-1.5 text-[11px] transition-opacity', setFilters && 'hover:opacity-80', !on && 'opacity-35')}>
            <FamilyDot family={family} />
            <span className="text-slate-400">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
window.LEGEND = LEGEND;

window.cn = cn;
window.Chip = Chip;
window.Tag = Tag;
window.Button = Button;
window.Panel = Panel;
window.PanelHead = PanelHead;
window.Eyebrow = Eyebrow;
window.SurfaceIntro = SurfaceIntro;
window.Stat = Stat;
window.Bar = Bar;
window.FamilyDot = FamilyDot;
window.IconFor = IconFor;
window.NodeRef = NodeRef;
window.Brandmark = Brandmark;
window.TopChrome = TopChrome;
window.Legend = Legend;
