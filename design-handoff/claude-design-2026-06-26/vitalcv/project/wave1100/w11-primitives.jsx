// WAVE 1100 — primitives & chrome (Professional Knowledge Graph)

const cn = (...xs) => xs.filter(Boolean).join(' ');

/* ---------- Trust-state tokens (shared canon) ---------- */
const TRUST_META = {
  verified:   { label: 'Source-backed', chip: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20', dot: 'bg-emerald-600', Icon: Icon.ShieldCheck },
  pending:    { label: 'Reading',       chip: 'bg-amber-50 text-amber-800 ring-amber-600/20',       dot: 'bg-amber-500',  Icon: Icon.Clock },
  access:     { label: 'Gated source',  chip: 'bg-indigo-50 text-indigo-700 ring-indigo-600/20',    dot: 'bg-indigo-600', Icon: Icon.Lock },
  historical: { label: 'Historical',    chip: 'bg-slate-100 text-slate-600 ring-slate-300',         dot: 'bg-slate-400',  Icon: Icon.Clock },
  adverse:    { label: 'Adverse · verified', chip: 'bg-rose-50 text-rose-700 ring-rose-600/20',     dot: 'bg-rose-600',   Icon: Icon.AlertTri },
  conferred:  { label: 'Conferred',     chip: 'bg-violet-50 text-violet-700 ring-violet-600/20',    dot: 'bg-violet-600', Icon: Icon.Award },
  unknown:    { label: 'Projected',     chip: 'bg-slate-100 text-slate-500 ring-slate-300',         dot: 'bg-slate-300',  Icon: Icon.Minus },
};
window.TRUST_META = TRUST_META;

function Chip({ state = 'unknown', children, size = 'md', withIcon = true, className = '' }) {
  const m = TRUST_META[state] || TRUST_META.unknown;
  const sz = size === 'sm' ? 'text-[10px] px-1.5 py-0.5 gap-1' : 'text-[11px] px-2 py-0.5 gap-1.5';
  return (
    <span className={cn('inline-flex items-center font-medium uppercase tracking-[0.06em] rounded-full ring-1 ring-inset whitespace-nowrap', m.chip, sz, className)}>
      {withIcon && state === 'pending' && <span className={cn('h-1.5 w-1.5 rounded-full pulse-soft', m.dot)} />}
      {withIcon && state !== 'pending' && m.Icon && <m.Icon size={size === 'sm' ? 10 : 12} strokeWidth={2.25} />}
      <span>{children ?? m.label}</span>
    </span>
  );
}

function Button({ variant = 'primary', size = 'md', children, className = '', iconRight, iconLeft, onClick, disabled, title, type = 'button' }) {
  const base = 'inline-flex items-center justify-center font-medium tracking-tightish rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap';
  const sizes = { sm: 'text-[12px] h-8 px-3 gap-1.5', md: 'text-[13px] h-9 px-3.5 gap-2', lg: 'text-[14px] h-11 px-5 gap-2' };
  const variants = {
    primary: 'bg-slate-900 text-white hover:bg-black',
    outline: 'bg-white text-slate-900 border border-slate-300 hover:bg-slate-50 hover:border-slate-400',
    ghost:   'bg-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100',
  };
  return (
    <button type={type} onClick={onClick} disabled={disabled} title={title} className={cn(base, sizes[size], variants[variant], className)}>
      {iconLeft}<span>{children}</span>{iconRight}
    </button>
  );
}

function Card({ children, className = '', as: As = 'div', ...rest }) {
  return <As className={cn('bg-white border border-slate-200 rounded-lg', className)} {...rest}>{children}</As>;
}

function CardHead({ icon: I, title, right, className = '' }) {
  return (
    <div className={cn('px-5 py-3 border-b border-slate-200 flex items-center justify-between gap-3', className)}>
      <div className="flex items-center gap-2 min-w-0">
        {I && <I size={14} className="text-slate-700 flex-shrink-0" />}
        <span className="text-[13px] font-semibold text-slate-900 truncate">{title}</span>
      </div>
      {right != null && <div className="flex-shrink-0">{right}</div>}
    </div>
  );
}

function Eyebrow({ children, className = '' }) {
  return <div className={cn('mono text-[10px] uppercase tracking-[0.16em] text-slate-500', className)}>{children}</div>;
}

function SectionHeader({ n, title, sub, right, id }) {
  return (
    <div id={id} className="flex items-end justify-between gap-4 mb-4 pb-2.5 border-b border-slate-900/90 scroll-mt-24">
      <div className="flex items-baseline gap-3 min-w-0">
        {n && <span className="mono text-[11px] uppercase tracking-[0.16em] text-slate-300 font-semibold">{n}</span>}
        <div>
          <h2 className="text-[18px] font-semibold text-slate-900 tracking-tightish leading-tight">{title}</h2>
          {sub && <p className="text-[12.5px] text-slate-500 mt-0.5">{sub}</p>}
        </div>
      </div>
      {right && <div className="mono text-[10px] uppercase tracking-[0.14em] text-slate-500 flex-shrink-0">{right}</div>}
    </div>
  );
}

function KV({ k, v, mono, className = '' }) {
  return (
    <div className={cn('flex items-baseline justify-between gap-6 py-2 border-b border-slate-100 last:border-b-0', className)}>
      <span className="text-[11px] uppercase tracking-[0.08em] text-slate-500">{k}</span>
      <span className={cn('text-[12.5px] text-slate-900 text-right', mono && 'mono text-[12px]')}>{v}</span>
    </div>
  );
}

function SurfaceIntro({ eyebrow, title, sub, right }) {
  return (
    <div className="flex items-end justify-between gap-6 flex-wrap">
      <div className="min-w-0">
        <Eyebrow className="mb-2">{eyebrow}</Eyebrow>
        <h1 className="text-[30px] font-semibold tracking-[-0.02em] text-slate-900 leading-[1.05]">{title}</h1>
        {sub && <p className="mt-2.5 text-[13.5px] text-slate-600 leading-[1.6] max-w-[76ch] text-pretty">{sub}</p>}
      </div>
      {right && <div className="flex-shrink-0">{right}</div>}
    </div>
  );
}

function IconFor({ name, ...rest }) { const I = Icon[name] || Icon.Dot; return <I {...rest} />; }

/* ---------- Family legend dot + node glyph ---------- */
function FamilyDot({ family, size = 9 }) {
  const f = FAMILIES[family] || FAMILIES.aspiration;
  return <span className="inline-block rounded-full flex-shrink-0" style={{ width: size, height: size, background: f.dashed ? '#fff' : f.accent, boxShadow: f.dashed ? `inset 0 0 0 1.5px ${f.accent}` : 'none' }} />;
}

// A small inline node reference — used in inspectors and explorer rows. Clickable.
function NodeRef({ node, onClick, rel, dir, className = '' }) {
  const f = FAMILIES[node.family] || FAMILIES.aspiration;
  return (
    <button onClick={onClick} className={cn('group w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md hover:bg-slate-50 transition-colors text-left', className)}>
      <span className="h-7 w-7 rounded-md flex items-center justify-center flex-shrink-0" style={{ background: f.soft, color: f.accent }}>
        <IconFor name={node.icon} size={14} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[12.5px] font-semibold text-slate-900 leading-tight truncate">{node.label}</span>
        <span className="block text-[10.5px] text-slate-500 truncate">
          {rel ? <span className="mono uppercase tracking-[0.08em] text-slate-400">{dir === 'in' ? '← ' : '→ '}{REL[rel]?.label || rel}</span> : node.sub}
        </span>
      </span>
      <Icon.ChevronRight size={13} className="text-slate-300 group-hover:text-slate-500 flex-shrink-0" />
    </button>
  );
}

/* ---------- Brandmark ---------- */
function Brandmark() {
  return (
    <a href="#/graph" className="flex items-center gap-2.5 group">
      <span className="relative h-5 w-5">
        <span className="absolute inset-0 bg-slate-900 rounded-[4px]" />
        <svg viewBox="0 0 20 20" className="absolute inset-0 text-white h-5 w-5">
          <path d="M3 10h3l2-5 4 10 2-5h3" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <span className="font-semibold tracking-tightish text-slate-900 text-[14px]">
        VitalCV<span className="text-slate-400 font-normal">/</span><span className="text-slate-500 font-normal">graph</span>
      </span>
      <span className="hidden sm:inline mono text-[9px] uppercase tracking-[0.14em] text-slate-400 border border-slate-200 rounded px-1.5 py-0.5">Wave 1100</span>
    </a>
  );
}

/* ---------- Hash router ---------- */
function parseHash() {
  const h = (window.location.hash || '').replace(/^#\/?/, '');
  const parts = h.split('/').filter(Boolean);
  return { surface: parts[0] || 'graph', node: parts[1] || null };
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
function navTo(surface, node) { window.location.hash = node ? `#/${surface}/${node}` : `#/${surface}`; }
window.useRoute = useRoute;
window.navTo = navTo;

/* ---------- Top chrome ---------- */
const SURFACES = [
  { id: 'graph',    label: 'Career Graph', sub: 'everything connected', Icon: Icon.Share2 },
  { id: 'explorer', label: 'Explorer',     sub: 'ask the graph',        Icon: Icon.Search },
  { id: 'dna',      label: 'Career DNA',   sub: 'the topology',         Icon: Icon.Fingerprint },
  { id: 'model',    label: 'Entity Model', sub: 'the schema',           Icon: Icon.Boxes },
];
window.SURFACES = SURFACES;

function TopChrome({ surface }) {
  return (
    <div className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-200">
      <div className="bg-slate-950 text-slate-300 text-[11px]">
        <div className="max-w-[1440px] mx-auto px-6 h-8 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <span className="mono uppercase tracking-[0.16em] text-slate-500 font-medium">Knowledge Graph</span>
            <span className="text-slate-700">/</span>
            <span className="truncate">Subject <span className="mono text-white">MACIE MILLER</span> · {NODES.length} entities · {LINKS.length} relationships</span>
          </div>
          <div className="hidden md:flex items-center gap-3 text-slate-500">
            <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500 blink" />graph live</span>
            <span className="h-3 w-px bg-slate-700" />
            <span className="mono">vc.2026.06.27 · w1100</span>
          </div>
        </div>
      </div>
      <div className="max-w-[1440px] mx-auto px-6 h-14 flex items-center justify-between gap-6">
        <div className="flex items-center gap-7 min-w-0">
          <Brandmark />
          <nav className="hidden lg:flex items-center gap-1" role="tablist" aria-label="Graph surfaces">
            {SURFACES.map(s => {
              const active = surface === s.id;
              return (
                <button key={s.id} role="tab" aria-selected={active}
                  onClick={() => navTo(s.id)}
                  className={cn('group relative px-3 h-9 rounded-md text-[12.5px] font-medium transition-colors flex items-center gap-2',
                    active ? 'text-slate-900 bg-slate-100' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50')}>
                  <s.Icon size={14} className={active ? 'text-slate-700' : 'text-slate-400 group-hover:text-slate-500'} />
                  <span>{s.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden lg:inline-flex items-center gap-1.5 text-[12px] text-slate-500">
            <Icon.ShieldCheck size={14} className="text-emerald-600" />
            <span>One owned ledger · projected as a graph</span>
          </span>
          <Button size="sm" variant="outline" iconLeft={<Icon.Download size={13} />}>Export graph</Button>
        </div>
      </div>
      <nav className="lg:hidden flex items-center gap-1 px-4 pb-2 overflow-x-auto scroll-thin" role="tablist">
        {SURFACES.map(s => {
          const active = surface === s.id;
          return (
            <button key={s.id} onClick={() => navTo(s.id)}
              className={cn('px-3 h-8 rounded-md text-[12px] font-medium whitespace-nowrap flex items-center gap-1.5',
                active ? 'text-slate-900 bg-slate-100' : 'text-slate-500')}>
              <s.Icon size={13} /><span>{s.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}

/* ---------- Family legend (shared) ---------- */
function FamilyLegend({ className = '', active, onPick }) {
  return (
    <div className={cn('flex flex-wrap items-center gap-x-3.5 gap-y-1.5', className)}>
      {Object.entries(FAMILIES).map(([key, f]) => (
        <button key={key} onClick={() => onPick && onPick(key)}
          className={cn('inline-flex items-center gap-1.5 text-[11px] transition-opacity', onPick && 'hover:opacity-70', active && active !== key && 'opacity-35')}>
          <FamilyDot family={key} />
          <span className={cn('text-slate-600', active === key && 'font-semibold text-slate-900')}>{f.label}</span>
        </button>
      ))}
    </div>
  );
}

window.cn = cn;
window.Chip = Chip;
window.Button = Button;
window.Card = Card;
window.CardHead = CardHead;
window.Eyebrow = Eyebrow;
window.SectionHeader = SectionHeader;
window.KV = KV;
window.SurfaceIntro = SurfaceIntro;
window.IconFor = IconFor;
window.FamilyDot = FamilyDot;
window.NodeRef = NodeRef;
window.Brandmark = Brandmark;
window.TopChrome = TopChrome;
window.FamilyLegend = FamilyLegend;
