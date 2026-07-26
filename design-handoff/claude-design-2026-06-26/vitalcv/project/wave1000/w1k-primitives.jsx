// Career OS — primitives: tokens, Chip, Card, Button, shell chrome, router helpers

const cn = (...xs) => xs.filter(Boolean).join(' ');

/* ---------- Trust-state tokens (canon: evidence carries a state, never a bare word) ---------- */
// verified = corroborated & fresh · pending = read in flight · access = institution-gated
// historical = true past fact, aged out of "current" · adverse = verified negative
const TRUST_META = {
  verified:   { label: 'Source-backed', chip: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20', dot: 'bg-emerald-600', bar: 'bg-emerald-600', text: 'text-emerald-700', Icon: Icon.ShieldCheck },
  pending:    { label: 'Reading',       chip: 'bg-amber-50 text-amber-800 ring-amber-600/20',       dot: 'bg-amber-500',  bar: 'bg-amber-500',  text: 'text-amber-800',  Icon: Icon.Clock },
  access:     { label: 'Gated source',  chip: 'bg-indigo-50 text-indigo-700 ring-indigo-600/20',    dot: 'bg-indigo-600', bar: 'bg-indigo-600', text: 'text-indigo-700', Icon: Icon.Lock },
  historical: { label: 'Historical',    chip: 'bg-slate-100 text-slate-600 ring-slate-300',         dot: 'bg-slate-400',  bar: 'bg-slate-400',  text: 'text-slate-600',  Icon: Icon.Clock },
  adverse:    { label: 'Adverse · verified', chip: 'bg-rose-50 text-rose-700 ring-rose-600/20',     dot: 'bg-rose-600',   bar: 'bg-rose-600',   text: 'text-rose-700',   Icon: Icon.AlertTri },
  conferred:  { label: 'Conferred',     chip: 'bg-violet-50 text-violet-700 ring-violet-600/20',    dot: 'bg-violet-600', bar: 'bg-violet-600', text: 'text-violet-700', Icon: Icon.Award },
  unknown:    { label: 'Not asserted',  chip: 'bg-slate-100 text-slate-500 ring-slate-300',         dot: 'bg-slate-300',  bar: 'bg-slate-300',  text: 'text-slate-500',  Icon: Icon.Minus },
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

/* ---------- Card header: mono eyebrow + bold right tag (matches product grammar) ---------- */
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

/* ---------- Brandmark (the VitalCV pulse glyph) ---------- */
function Brandmark() {
  return (
    <a href="#/career/macie-miller" className="flex items-center gap-2.5 group">
      <span className="relative h-5 w-5">
        <span className="absolute inset-0 bg-slate-900 rounded-[4px]" />
        <svg viewBox="0 0 20 20" className="absolute inset-0 text-white h-5 w-5">
          <path d="M3 10h3l2-5 4 10 2-5h3" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <span className="font-semibold tracking-tightish text-slate-900 text-[14px]">
        VitalCV<span className="text-slate-400 font-normal">/</span><span className="text-slate-500 font-normal">career</span>
      </span>
      <span className="hidden sm:inline mono text-[9px] uppercase tracking-[0.14em] text-slate-400 border border-slate-200 rounded px-1.5 py-0.5">Platform</span>
    </a>
  );
}

/* ---------- Hash router ---------- */
// Routes: #/career/:id  #/memory/:id  #/reputation/:id  #/mobility/:id
function parseHash() {
  const h = (window.location.hash || '').replace(/^#\/?/, '');
  const parts = h.split('/').filter(Boolean);
  const surface = parts[0] || 'career';
  const entityId = parts[1] || 'macie-miller';
  return { surface, entityId };
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
function navTo(surface, entityId = 'macie-miller') { window.location.hash = `#/${surface}/${entityId}`; }
window.useRoute = useRoute;
window.navTo = navTo;
window.parseHash = parseHash;

/* ---------- Top chrome: scenario bar + surface tabs ---------- */
const SURFACES = [
  { id: 'career',        label: 'Home',          sub: 'where am I',   Icon: Icon.Compass },
  { id: 'profile',       label: 'Profile',       sub: 'living record',Icon: Icon.User },
  { id: 'command',       label: 'Command',       sub: 'workspace',    Icon: Icon.Layers },
  { id: 'opportunities', label: 'Opportunities', sub: 'what’s open',  Icon: Icon.Zap, badge: 5 },
  { id: 'memory',        label: 'Memory',        sub: 'timeline',     Icon: Icon.Book },
  { id: 'legacy',        label: 'Legacy',        sub: 'the story',    Icon: Icon.Mountain },
];
window.SURFACES = SURFACES;

function TopChrome({ surface, entityId, entity }) {
  return (
    <div className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-200">
      {/* Scenario bar */}
      <div className="bg-slate-950 text-slate-300 text-[11px]">
        <div className="max-w-[1340px] mx-auto px-6 h-8 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <span className="mono uppercase tracking-[0.16em] text-slate-500 font-medium">Career Platform</span>
            <span className="text-slate-700">/</span>
            <span className="truncate">Subject <span className="mono text-white">{entity.fullName}</span> · NPI <span className="mono text-white">{entity.npi}</span></span>
          </div>
          <div className="hidden md:flex items-center gap-3 text-slate-500">
            <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500 blink" />ledger live</span>
            <span className="h-3 w-px bg-slate-700" />
            <span className="mono">vc.2026.06.27 · w1000</span>
          </div>
        </div>
      </div>
      {/* Brand + surface tabs */}
      <div className="max-w-[1340px] mx-auto px-6 h-14 flex items-center justify-between gap-6">
        <div className="flex items-center gap-7 min-w-0">
          <Brandmark />
          <nav className="hidden lg:flex items-center gap-1" role="tablist" aria-label="Career OS surfaces">
            {SURFACES.map(s => {
              const active = surface === s.id;
              return (
                <button key={s.id} role="tab" aria-selected={active}
                  onClick={() => navTo(s.id, entityId)}
                  className={cn('group relative px-3 h-9 rounded-md text-[12.5px] font-medium transition-colors flex items-center gap-2',
                    active ? 'text-slate-900 bg-slate-100' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50')}>
                  <s.Icon size={14} className={active ? 'text-slate-700' : 'text-slate-400 group-hover:text-slate-500'} />
                  <span>{s.label}</span>
                  {s.badge && <span className="ml-0.5 mono text-[9px] font-semibold tabular-nums bg-slate-900 text-white rounded-full min-w-[16px] h-4 px-1 inline-flex items-center justify-center">{s.badge}</span>}
                </button>
              );
            })}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden lg:inline-flex items-center gap-1.5 text-[12px] text-slate-500">
            <Icon.ShieldCheck size={14} className="text-emerald-600" />
            <span>Owned ledger · portable</span>
          </span>
          <Button size="sm" variant="outline" iconLeft={<Icon.Download size={13} />}>Export receipt</Button>
        </div>
      </div>
      {/* Mobile surface tabs */}
      <nav className="lg:hidden flex items-center gap-1 px-4 pb-2 overflow-x-auto scroll-thin" role="tablist">
        {SURFACES.map(s => {
          const active = surface === s.id;
          return (
            <button key={s.id} onClick={() => navTo(s.id, entityId)}
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

/* ---------- Entity header — shared identity block across surfaces ---------- */
function EntityHeader({ entity, surfaceLabel, surfaceDesc }) {
  return (
    <div className="flex items-start gap-5 flex-wrap">
      <div className="h-16 w-16 rounded-xl bg-slate-900 text-white flex items-center justify-center font-semibold text-[20px] tracking-tight flex-shrink-0">
        {entity.initials}
      </div>
      <div className="min-w-0 flex-1">
        <Eyebrow>{surfaceLabel}</Eyebrow>
        <div className="flex items-baseline gap-3 flex-wrap mt-1">
          <h1 className="text-[30px] font-semibold tracking-[-0.02em] text-slate-900 leading-none">{entity.fullName}</h1>
          <span className="mono text-[13px] text-slate-500 uppercase tracking-[0.1em]">{entity.credential}</span>
        </div>
        <div className="mt-2.5 flex items-center flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-slate-600">
          <span className="inline-flex items-center gap-1.5"><Icon.Stethoscope size={13} className="text-slate-400" />{entity.specialty}</span>
          <span className="text-slate-300">·</span>
          <span className="inline-flex items-center gap-1.5"><Icon.Hash size={13} className="text-slate-400" />NPI <span className="mono text-slate-900">{entity.npi}</span></span>
          <span className="text-slate-300">·</span>
          <span className="inline-flex items-center gap-1.5"><Icon.MapPin size={13} className="text-slate-400" />{entity.city}</span>
          <span className="text-slate-300">·</span>
          <span className="inline-flex items-center gap-1.5"><Icon.Calendar size={13} className="text-slate-400" />{entity.yearsPracticing}y in practice</span>
        </div>
        {surfaceDesc && <p className="mt-3 text-[13px] text-slate-600 leading-[1.6] max-w-[78ch]">{surfaceDesc}</p>}
      </div>
    </div>
  );
}

window.Chip = Chip;
window.Button = Button;

/* ---------- Shared small helpers ---------- */
function IconFor({ name, ...rest }) { const I = Icon[name] || Icon.Dot; return <I {...rest} />; }

// A labeled progress bar with optional median tick.
function Bar({ value, median, tone = 'bg-slate-900', track = 'bg-slate-100', h = 'h-2' }) {
  return (
    <div className={cn('relative w-full rounded-sm overflow-visible', track, h)}>
      <div className={cn('absolute inset-y-0 left-0 rounded-sm', tone)} style={{ width: `${value}%` }} />
      {median != null && <span className="absolute -top-0.5 -bottom-0.5 w-px border-l border-dashed border-slate-400" style={{ left: `${median}%` }} />}
    </div>
  );
}

// Surface intro band shared by every surface — keeps headers consistent.
function SurfaceIntro({ eyebrow, title, sub, right }) {
  return (
    <div className="flex items-end justify-between gap-6 flex-wrap">
      <div className="min-w-0">
        <Eyebrow className="mb-2">{eyebrow}</Eyebrow>
        <h1 className="text-[30px] font-semibold tracking-[-0.02em] text-slate-900 leading-[1.05]">{title}</h1>
        {sub && <p className="mt-2.5 text-[13.5px] text-slate-600 leading-[1.6] max-w-[74ch] text-pretty">{sub}</p>}
      </div>
      {right && <div className="flex-shrink-0">{right}</div>}
    </div>
  );
}

window.IconFor = IconFor;
window.Bar = Bar;
window.SurfaceIntro = SurfaceIntro;
window.Card = Card;
window.CardHead = CardHead;
window.Eyebrow = Eyebrow;
window.SectionHeader = SectionHeader;
window.KV = KV;
window.Brandmark = Brandmark;
window.TopChrome = TopChrome;
window.EntityHeader = EntityHeader;
window.cn = cn;
