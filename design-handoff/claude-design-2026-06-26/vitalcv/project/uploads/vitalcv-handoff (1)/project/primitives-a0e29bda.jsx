// Shared primitives for VitalCV

const cn = (...xs) => xs.filter(Boolean).join(' ');

/* ---------- Status chip ---------- */
// State tokens. STRICT: green=verified, amber=pending, indigo=access, red=blocked, slate=unknown.
const STATE_META = {
  verified: {
    label: 'Checked',
    glyph: '✔',
    chip: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
    dot:  'bg-emerald-600',
    bar:  'bg-emerald-600',
    text: 'text-emerald-700',
    Icon: Icon.Check,
  },
  pending: {
    label: 'Pending',
    glyph: '⏳',
    chip: 'bg-amber-50 text-amber-800 ring-amber-600/20',
    dot:  'bg-amber-500',
    bar:  'bg-amber-500',
    text: 'text-amber-800',
    Icon: Icon.Clock,
  },
  access: {
    label: 'Access Required',
    glyph: '🔒',
    chip: 'bg-indigo-50 text-indigo-700 ring-indigo-600/20',
    dot:  'bg-indigo-600',
    bar:  'bg-indigo-600',
    text: 'text-indigo-700',
    Icon: Icon.Lock,
  },
  blocked: {
    label: 'Blocked',
    glyph: '✕',
    chip: 'bg-red-50 text-red-700 ring-red-600/20',
    dot:  'bg-red-600',
    bar:  'bg-red-600',
    text: 'text-red-700',
    Icon: Icon.X,
  },
  contradicted: {
    label: 'Contradicted',
    glyph: '⑂',
    chip: 'bg-purple-50 text-purple-700 ring-purple-600/20',
    dot:  'bg-purple-600',
    bar:  'bg-purple-600',
    text: 'text-purple-700',
    Icon: Icon.GitBranch,
  },
  unknown: {
    label: 'Not checked',
    glyph: '·',
    chip: 'bg-slate-100 text-slate-600 ring-slate-300',
    dot:  'bg-slate-400',
    bar:  'bg-slate-300',
    text: 'text-slate-600',
    Icon: Icon.Minus,
  },
  info: {
    label: 'Info',
    chip: 'bg-slate-100 text-slate-700 ring-slate-300',
    dot:  'bg-slate-400',
    text: 'text-slate-600',
    Icon: Icon.Info,
  },
};

function Chip({ state = 'unknown', children, size = 'md', withIcon = true, className = '' }) {
  const m = STATE_META[state];
  const sz = size === 'sm'
    ? 'text-[10.5px] px-1.5 py-0.5 gap-1'
    : 'text-[11px] px-2 py-0.5 gap-1.5';
  return (
    <span className={cn(
      'inline-flex items-center font-medium uppercase tracking-[0.06em] rounded-full ring-1 ring-inset whitespace-nowrap',
      m.chip, sz, className
    )}>
      {withIcon && state === 'pending' && (
        <span className={cn('h-1.5 w-1.5 rounded-full pulse-soft', m.dot)} />
      )}
      {withIcon && state !== 'pending' && m.Icon && <m.Icon size={12} strokeWidth={2.25} />}
      <span>{children ?? m.label}</span>
    </span>
  );
}

/* ---------- Buttons ---------- */
function Button({ variant = 'primary', size = 'md', children, className = '', iconRight, iconLeft, ...rest }) {
  const base = 'inline-flex items-center justify-center font-medium tracking-tightish rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed';
  const sizes = {
    sm: 'text-[12px] h-8 px-3 gap-1.5',
    md: 'text-[13px] h-9 px-3.5 gap-2',
    lg: 'text-[14px] h-11 px-5 gap-2',
  };
  const variants = {
    primary: 'bg-slate-900 text-white hover:bg-black',
    outline: 'bg-white text-slate-900 border border-slate-300 hover:bg-slate-50 hover:border-slate-400',
    ghost:   'bg-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100',
    danger:  'bg-white text-red-700 border border-red-300 hover:bg-red-50',
  };
  return (
    <button className={cn(base, sizes[size], variants[variant], className)} {...rest}>
      {iconLeft}
      <span>{children}</span>
      {iconRight}
    </button>
  );
}

/* ---------- Card ---------- */
function Card({ children, className = '', as: As = 'div' }) {
  return <As className={cn('bg-white border border-slate-200 rounded-md', className)}>{children}</As>;
}

/* ---------- Top chrome: view switcher + scenario banner ---------- */
function TopChrome({ view, setView, dark, onToggleDark, onPrint, mode }) {
  // Tabs are mode-aware. Trust Mode shows the fast-path; Credentialing Mode shows the full binder.
  const trustTabs = [
    { id: 'home',        label: '01 · Public Entry',     sub: 'vitalcv.health' },
    { id: 'inbox',       label: '02 · Knowledge Inbox',  sub: 'inbox.vitalcv.health' },
    { id: 'passport',    label: '03 · Clinician Passport', sub: 'clinician.vitalcv.health' },
    { id: 'autopilot',   label: '04 · Career Autopilot', sub: 'autopilot.vitalcv.health' },
    { id: 'trust_badge', label: '05 · Trust Badge',      sub: 'verify.vitalcv.health' },
    { id: 'verify',      label: '06 · Public Verifier',  sub: 'verify.vitalcv.health' },
  ];
  const credTabs = [
    { id: 'home',        label: '01 · Public Entry',       sub: 'vitalcv.health' },
    { id: 'inbox',       label: '02 · Knowledge Inbox',    sub: 'inbox.vitalcv.health' },
    { id: 'passport',    label: '03 · Clinician Passport', sub: 'clinician.vitalcv.health' },
    { id: 'employer',    label: '04 · Employer Console',   sub: 'console.vitalcv.health' },
    { id: 'file',        label: '05 · Credentialing File', sub: 'VCV-CF-2026-000841' },
    { id: 'application', label: '06 · Application Packet', sub: 'VCV-APP-2026-000841' },
    { id: 'activation',  label: '07 · Start Activation',   sub: 'VCV-START-2026-000841' },
    { id: 'roi',         label: '08 · Executive ROI',      sub: 'exec.vitalcv.health' },
    { id: 'dossier',     label: '09 · Proof Dossier',      sub: 'forensic · VCV-CF-2026-000841' },
  ];
  const tabs = mode === 'trust' ? trustTabs : mode === 'cred' ? credTabs : credTabs;
  return (
    <div className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-200">
      {/* Scenario bar */}
      <div className="bg-slate-900 text-slate-200 text-[11px]">
        <div className="max-w-[1400px] mx-auto px-6 h-7 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="uppercase tracking-[0.14em] text-slate-400 font-medium">Prototype</span>
            <span className="text-slate-500">—</span>
            <span>Walking scenario: <span className="mono text-white">MACIE MILLER, PA-C</span> · NPI <span className="mono text-white">1346053246</span></span>
          </div>
          <div className="flex items-center gap-3 text-slate-400">
            <span>Env: <span className="mono text-slate-200">sandbox</span></span>
            <span className="h-3 w-px bg-slate-700" />
            <span>Build <span className="mono text-slate-200">vc.2026.04.18-a</span></span>
          </div>
        </div>
      </div>

      {/* Brand + nav */}
      <div className="max-w-[1400px] mx-auto px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Brandmark />
          <nav className="flex items-center gap-1" role="tablist" aria-label="Prototype views">
            {tabs.map(t => {
              const active = view === t.id;
              return (
                <button
                  key={t.id}
                  role="tab"
                  aria-selected={active}
                  onClick={() => setView(t.id)}
                  className={cn(
                    'group relative px-3 h-9 rounded-md text-[12.5px] font-medium transition-colors flex items-center gap-2',
                    active ? 'text-slate-900 bg-slate-100' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                  )}
                >
                  <span className="mono text-[10.5px] text-slate-400 group-hover:text-slate-500">
                    {t.label.split(' · ')[0]}
                  </span>
                  <span>{t.label.split(' · ')[1]}</span>
                </button>
              );
            })}
          </nav>
        </div>
        <div className="flex items-center gap-3 text-[12px] text-slate-500">
          <span className="hidden md:inline-flex items-center gap-1.5" title="Architected to SOC 2 and HITRUST control families. Formal attestation in progress.">
            <Icon.ShieldCheck size={14} className="text-emerald-600" />
            <span>Audit-ready architecture</span>
          </span>
          <span className="hidden md:inline-flex items-center gap-1.5">
            <Icon.Globe size={14} />
            <span className="mono text-[11px]">VC 2.0 · OpenID4VCI</span>
          </span>
          <button
            onClick={onPrint}
            title="Export audit artifact"
            className="h-8 w-8 inline-flex items-center justify-center rounded-md border border-slate-200 hover:border-slate-400 text-slate-600 hover:text-slate-900">
            <Icon.Printer size={14} />
          </button>
          <button
            onClick={onToggleDark}
            title={dark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            className="h-8 w-8 inline-flex items-center justify-center rounded-md border border-slate-200 hover:border-slate-400 text-slate-600 hover:text-slate-900">
            {dark ? <Icon.Sun size={14} /> : <Icon.Moon size={14} />}
          </button>
          <Button size="sm" variant="outline">Sign in</Button>
        </div>
      </div>
    </div>
  );
}

function Brandmark({ size = 'md' }) {
  const dim = size === 'lg' ? 'h-6 w-6' : 'h-5 w-5';
  const text = size === 'lg' ? 'text-[16px]' : 'text-[14px]';
  return (
    <a href="#" className="flex items-center gap-2.5 group">
      <span className={cn('relative', dim)}>
        <span className="absolute inset-0 bg-slate-900 rounded-[4px]" />
        <span className="absolute inset-[3px] border border-white/0" />
        <svg viewBox="0 0 20 20" className={cn('absolute inset-0 text-white', dim)}>
          <path d="M3 10h3l2-5 4 10 2-5h3" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <span className={cn('font-semibold tracking-tightish text-slate-900', text)}>
        VitalCV<span className="text-slate-400 font-normal">/</span><span className="text-slate-500 font-normal">trust</span>
      </span>
    </a>
  );
}

/* ---------- Key/Value row ---------- */
function KV({ k, v, mono, className = '' }) {
  return (
    <div className={cn('flex items-baseline justify-between gap-6 py-2 border-b border-slate-100 last:border-b-0', className)}>
      <span className="text-[11.5px] uppercase tracking-[0.08em] text-slate-500">{k}</span>
      <span className={cn('text-[13px] text-slate-900 text-right', mono && 'mono text-[12px]')}>{v}</span>
    </div>
  );
}

/* ---------- Section header ---------- */
function SectionHeader({ eyebrow, title, right }) {
  return (
    <div className="flex items-end justify-between mb-3">
      <div>
        {eyebrow && <div className="mono text-[10.5px] uppercase tracking-[0.14em] text-slate-500 mb-1">{eyebrow}</div>}
        <h2 className="text-[15px] font-semibold text-slate-900 tracking-tightish">{title}</h2>
      </div>
      {right}
    </div>
  );
}

window.cn = cn;
window.STATE_META = STATE_META;
window.Chip = Chip;
window.Button = Button;
window.Card = Card;
window.KV = KV;
window.TopChrome = TopChrome;
window.Brandmark = Brandmark;
window.SectionHeader = SectionHeader;
