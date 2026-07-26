// WAVE 12 · Mode System
// Two products in one app — made unmistakable.
//
// Trust Mode  → Quick Check → outputs a TRUST BADGE (seconds, pass/fail, revocable)
// Cred Mode   → Full File   → outputs a CREDENTIALING FILE (weeks, committee, binder)
//
// The user always knows which mode they're in. The two modes look and feel different.

// ------------------------------------------------------------
// Mode definitions
// ------------------------------------------------------------
const MODES = {
  trust: {
    id: 'trust',
    name: 'Quick Check',
    longName: 'Trust Mode · Quick Check',
    tagline: 'A source-backed pass/fail in seconds.',
    sla: 'Seconds',
    slaLong: 'Under 60 seconds · real-time',
    artifact: 'Trust Badge',
    artifactPlural: 'Trust Badges',
    governance: 'Self-serve · machine-verifiable',
    standard: 'OIG/LEIE · NPPES · PECOS · State boards',
    audience: 'Staffing, scheduling, contract signing, marketplace listings',
    // Unmistakable polarity
    accent:       '#047857',       // emerald-700
    accentSoft:   '#ecfdf5',       // emerald-50
    accentRing:   '#10b981',       // emerald-500
    accentInk:    '#064e3b',       // emerald-900
    pattern:      'diode',         // small dot + halo motif
    typeface:     'mono-led',      // mono for data, tight tracking
    useWhen: [
      'Posting or accepting a locum shift',
      'Scheduling an interview or credentialing call',
      'Sending a contract or MSA to a clinician',
      'Running a quick sanctions/exclusion check',
      'Verifying "still in good standing" during an active engagement',
    ],
    dontUseFor: [
      'Hospital privileges or medical staff appointment',
      'Payer enrollment (delegated credentialing)',
      'Any decision requiring committee review',
      'Anything that lasts longer than 30 days without re-check',
    ],
    exampleOutputs: [
      'Clean · 14 sources verified',
      'Clean · 1 licence pending re-verification',
      'Do not proceed · OIG sanction detected',
    ],
  },
  cred: {
    id: 'cred',
    name: 'Full Credentialing File',
    longName: 'Credentialing Mode · Full File',
    tagline: 'The NCQA-grade binder your committee votes on.',
    sla: '10–14 days',
    slaLong: '10 – 14 business days · application to committee-ready',
    artifact: 'Credentialing File',
    artifactPlural: 'Credentialing Files',
    governance: 'Delegated CVO · Committee-reviewed',
    standard: 'NCQA CR §3 · CR §4.2 · TJC MS.06.01.03',
    audience: 'Health systems, medical groups, payers, DHOs',
    accent:       '#0f172a',       // slate-900 (seal ink)
    accentSoft:   '#f8fafc',       // slate-50
    accentRing:   '#334155',
    accentInk:    '#020617',
    pattern:      'seal',
    typeface:     'serif-formal',
    useWhen: [
      'Initial appointment to a medical staff',
      'Reappointment / recredentialing (2-year cycle)',
      'Payer delegated credentialing submissions',
      'Privilege granting or modification',
      'Anything requiring Credentials Committee vote',
    ],
    dontUseFor: [
      'Quick scheduling decisions (use Quick Check)',
      'Pre-interview screening (use Quick Check)',
      'Marketplace / gig listings (use Quick Check)',
      'Day-to-day "is this clinician still clean" (use Quick Check)',
    ],
    exampleOutputs: [
      'PSV complete · Ready for Committee Review',
      'Outstanding NPDB · Assembly 84%',
      'Ready with conditions · 2 items pending',
    ],
  },
};
window.MODES = MODES;

// ------------------------------------------------------------
// Mode context / hook
// ------------------------------------------------------------
const ModeContext = React.createContext(null);
window.ModeContext = ModeContext;

function ModeProvider({ children }) {
  const [mode, setModeState] = React.useState(() => {
    try { return localStorage.getItem('vitalcv.mode') || null; }
    catch (_) { return null; }
  });
  const setMode = React.useCallback((m) => {
    setModeState(m);
    try { localStorage.setItem('vitalcv.mode', m || ''); } catch (_) {}
  }, []);
  const clearMode = React.useCallback(() => {
    setModeState(null);
    try { localStorage.removeItem('vitalcv.mode'); } catch (_) {}
  }, []);

  const value = React.useMemo(() => ({
    mode, meta: mode ? MODES[mode] : null, setMode, clearMode, chosen: !!mode,
  }), [mode, setMode, clearMode]);

  return <ModeContext.Provider value={value}>{children}</ModeContext.Provider>;
}
window.ModeProvider = ModeProvider;

function useMode() {
  const ctx = React.useContext(ModeContext);
  if (!ctx) return { mode: null, meta: null, setMode: () => {}, clearMode: () => {}, chosen: false };
  return ctx;
}
window.useMode = useMode;

// ------------------------------------------------------------
// Mode pattern: tiny decorative motifs so the two modes FEEL different
// ------------------------------------------------------------
function ModeGlyph({ mode, size = 44 }) {
  if (mode === 'trust') {
    // LED-diode aesthetic: ring with bright node + satellites
    return (
      <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden>
        <circle cx="24" cy="24" r="22" fill="none" stroke="#065f46" strokeWidth="0.8" />
        <circle cx="24" cy="24" r="15" fill="none" stroke="#10b981" strokeWidth="0.8" strokeDasharray="1 2.5" />
        <circle cx="24" cy="24" r="6" fill="#047857" />
        <circle cx="24" cy="24" r="3" fill="#6ee7b7" />
        {[0,60,120,180,240,300].map((a,i) => {
          const rad = a * Math.PI / 180;
          const x = 24 + Math.cos(rad) * 20;
          const y = 24 + Math.sin(rad) * 20;
          return <circle key={i} cx={x} cy={y} r={i === 0 ? 1.8 : 1} fill="#047857" />;
        })}
      </svg>
    );
  }
  // Cred: seal-ink crest
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden>
      <circle cx="24" cy="24" r="22" fill="none" stroke="#0f172a" strokeWidth="0.6" />
      <circle cx="24" cy="24" r="19" fill="none" stroke="#0f172a" strokeWidth="1.4" />
      <circle cx="24" cy="24" r="14" fill="none" stroke="#0f172a" strokeWidth="0.5" strokeDasharray="1.4 2" />
      <g transform="translate(24 24)" stroke="#0f172a" strokeWidth="1.3" fill="none" strokeLinecap="round">
        <line x1="0" y1="-7" x2="0" y2="7" />
        <line x1="-7" y1="0" x2="7" y2="0" />
        <circle r="2.6" fill="#0f172a" />
      </g>
    </svg>
  );
}
window.ModeGlyph = ModeGlyph;

// ------------------------------------------------------------
// Mode ribbon — always visible, always clear
// Renders just below the top chrome.
// ------------------------------------------------------------
function ModeRibbon({ onSwitch }) {
  const { mode, meta } = useMode();
  if (!mode) return null;
  const isTrust = mode === 'trust';

  return (
    <div
      role="status"
      aria-label={`You are in ${meta.longName}`}
      className={cn(
        'sticky top-[84px] z-20 border-b',
        isTrust ? 'bg-emerald-50/80 border-emerald-200' : 'bg-slate-50 border-slate-200'
      )}
    >
      <div className="max-w-[1400px] mx-auto px-6 h-10 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <ModeGlyph mode={mode} size={22} />
          <div className="flex items-baseline gap-2 min-w-0">
            <span className={cn(
              'mono text-[10.5px] uppercase tracking-[0.2em] font-semibold',
              isTrust ? 'text-emerald-800' : 'text-slate-700'
            )}>
              {isTrust ? 'Trust Mode' : 'Credentialing Mode'}
            </span>
            <span className={cn('mono text-[10px] uppercase tracking-[0.14em]',
              isTrust ? 'text-emerald-700/70' : 'text-slate-500')}>·</span>
            <span className={cn('text-[12.5px] font-medium truncate',
              isTrust ? 'text-emerald-950' : 'text-slate-900')}>
              {meta.name}
            </span>
            <span className="hidden md:inline text-slate-400 mono text-[10px]">—</span>
            <span className="hidden md:inline text-[12px] text-slate-600 truncate">{meta.tagline}</span>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <span className={cn(
            'hidden md:inline-flex items-center gap-1.5 mono text-[10.5px] uppercase tracking-[0.14em] px-2 h-6 rounded-[3px] border',
            isTrust
              ? 'border-emerald-700 text-emerald-800 bg-white'
              : 'border-slate-900 text-slate-900 bg-white'
          )}>
            <span className={cn('h-1.5 w-1.5 rounded-full',
              isTrust ? 'bg-emerald-500' : 'bg-slate-900')} />
            Output: {meta.artifact}
          </span>
          <span className={cn(
            'hidden lg:inline-flex mono text-[10.5px] uppercase tracking-[0.14em] text-slate-600',
          )}>
            SLA · <span className="text-slate-900 ml-1">{meta.sla}</span>
          </span>
          <button
            onClick={onSwitch}
            className={cn(
              'mono text-[10.5px] uppercase tracking-[0.14em] px-2.5 h-7 rounded-[3px] border transition-colors',
              isTrust
                ? 'border-emerald-700 text-emerald-800 bg-white hover:bg-emerald-100'
                : 'border-slate-900 text-slate-900 bg-white hover:bg-slate-100'
            )}
          >
            Switch mode
          </button>
        </div>
      </div>
    </div>
  );
}
window.ModeRibbon = ModeRibbon;

// ------------------------------------------------------------
// Mode Chooser — the two-door decision page
// ------------------------------------------------------------
function ModeChooser({ onChoose, currentMode = null }) {
  return (
    <div className="max-w-[1400px] mx-auto px-6 pt-16 pb-24">
      {/* Eyebrow */}
      <div className="text-center mb-10">
        <div className="mono text-[11px] uppercase tracking-[0.2em] text-slate-500 mb-5 inline-flex items-center gap-2">
          <span className="h-px w-6 bg-slate-300" />
          <span>Choose the right tool for the job</span>
          <span className="h-px w-6 bg-slate-300" />
        </div>
        <h1 className="font-semibold tracking-[-0.025em] text-slate-900 text-[54px] leading-[1] max-w-[900px] mx-auto">
          Two different products.<br/>One set of sources.
        </h1>
        <p className="mt-6 text-[15.5px] text-slate-600 max-w-[640px] mx-auto leading-[1.6]">
          VitalCV does two different jobs, and they shouldn't be confused.
          Pick the one that matches what you're trying to decide today.
        </p>
      </div>

      {/* The two doors */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <ModeCard
          mode="trust"
          onChoose={() => onChoose('trust')}
          selected={currentMode === 'trust'}
        />
        <ModeCard
          mode="cred"
          onChoose={() => onChoose('cred')}
          selected={currentMode === 'cred'}
        />
      </div>

      {/* Bridge note */}
      <div className="mt-8 max-w-[780px] mx-auto text-center">
        <div className="mono text-[10.5px] uppercase tracking-[0.18em] text-slate-500 mb-2">You can change your mind</div>
        <p className="text-[13px] text-slate-600 leading-[1.55]">
          Start with a <span className="text-slate-900 font-medium">Quick Check</span> today, open the <span className="text-slate-900 font-medium">Full File</span> tomorrow.
          Evidence carries forward — no clinician re-attestation, no duplicated verification calls.
        </p>
      </div>

      {/* Quiet comparison table */}
      <details className="mt-12 max-w-[980px] mx-auto">
        <summary className="cursor-pointer mono text-[11px] uppercase tracking-[0.18em] text-slate-500 hover:text-slate-900 text-center list-none">
          Show side-by-side comparison ↓
        </summary>
        <div className="mt-6">
          <ModeComparisonTable />
        </div>
      </details>
    </div>
  );
}
window.ModeChooser = ModeChooser;

function ModeCard({ mode, onChoose, selected }) {
  const m = MODES[mode];
  const isTrust = mode === 'trust';
  return (
    <button
      type="button"
      onClick={onChoose}
      className={cn(
        'group relative block text-left transition-all border overflow-hidden',
        isTrust
          ? 'bg-white border-emerald-200 hover:border-emerald-700 hover:shadow-[0_1px_0_0_rgba(4,120,87,0.08),0_8px_24px_-12px_rgba(4,120,87,0.35)]'
          : 'bg-white border-slate-300 hover:border-slate-900 hover:shadow-[0_1px_0_0_rgba(15,23,42,0.06),0_8px_24px_-12px_rgba(15,23,42,0.35)]',
        selected && (isTrust ? 'border-emerald-700 ring-1 ring-emerald-700/20' : 'border-slate-900 ring-1 ring-slate-900/20'),
      )}
    >
      {/* Top accent */}
      <div className={cn('absolute inset-x-0 top-0 h-1', isTrust ? 'bg-emerald-600' : 'bg-slate-900')} />

      {/* Header */}
      <div className={cn('px-8 pt-10 pb-6', isTrust ? 'bg-emerald-50/50' : 'bg-slate-50/70')}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className={cn('mono text-[10.5px] uppercase tracking-[0.22em] font-semibold mb-2',
              isTrust ? 'text-emerald-700' : 'text-slate-600')}>
              {isTrust ? 'Trust Mode' : 'Credentialing Mode'}
            </div>
            <h2 className={cn(
              'tracking-[-0.02em] leading-[1.02]',
              isTrust
                ? 'text-emerald-950 text-[34px] font-semibold'
                : 'text-slate-900 text-[34px] font-semibold'
            )} style={isTrust ? {} : { fontFamily: 'ui-serif, Georgia, "Times New Roman", serif' }}>
              {m.name}
            </h2>
            <p className={cn('mt-3 text-[14px] leading-[1.5] max-w-[38ch]',
              isTrust ? 'text-emerald-900/80' : 'text-slate-700')}>
              {m.tagline}
            </p>
          </div>
          <ModeGlyph mode={mode} size={64} />
        </div>

        {/* Stat row */}
        <div className={cn('mt-7 grid grid-cols-3 gap-3')}>
          <StatCell label="Time"     value={m.sla} accent={isTrust} />
          <StatCell label="Output"   value={m.artifact} accent={isTrust} />
          <StatCell label="Standard" value={isTrust ? 'OIG · NPPES · PECOS' : 'NCQA CR §3'} accent={isTrust} mono small />
        </div>
      </div>

      {/* Body */}
      <div className="px-8 py-7 space-y-6">
        <div>
          <div className="mono text-[10.5px] uppercase tracking-[0.18em] text-slate-500 mb-3">Use this when</div>
          <ul className="space-y-2">
            {m.useWhen.map((u, i) => (
              <li key={i} className="flex items-start gap-2.5 text-[13.5px] text-slate-800 leading-[1.5]">
                <span className={cn('mt-[7px] h-[6px] w-[6px] rounded-full shrink-0',
                  isTrust ? 'bg-emerald-600' : 'bg-slate-900')} />
                <span>{u}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="border-t border-slate-100 pt-5">
          <div className="mono text-[10.5px] uppercase tracking-[0.18em] text-slate-400 mb-3">Don't use this for</div>
          <ul className="space-y-1.5">
            {m.dontUseFor.map((u, i) => (
              <li key={i} className="flex items-start gap-2.5 text-[12.5px] text-slate-500 leading-[1.5]">
                <span className="mono text-slate-300 text-[12px] mt-[1px]">—</span>
                <span>{u}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Sample outputs preview */}
        <div className="border-t border-slate-100 pt-5">
          <div className="mono text-[10.5px] uppercase tracking-[0.18em] text-slate-500 mb-3">Typical outcome</div>
          {isTrust ? <TrustOutcomePreview /> : <CredOutcomePreview />}
        </div>
      </div>

      {/* Footer / CTA */}
      <div className={cn(
        'px-8 py-5 border-t flex items-center justify-between',
        isTrust ? 'border-emerald-100 bg-emerald-50/40' : 'border-slate-200 bg-slate-50/60'
      )}>
        <div className="mono text-[10.5px] uppercase tracking-[0.14em] text-slate-500">
          Governance · <span className="text-slate-800">{m.governance}</span>
        </div>
        <span className={cn(
          'inline-flex items-center gap-2 mono text-[11.5px] uppercase tracking-[0.14em] font-semibold px-4 h-9 rounded-[3px] transition-colors',
          isTrust
            ? 'bg-emerald-700 text-white group-hover:bg-emerald-800'
            : 'bg-slate-900 text-white group-hover:bg-black'
        )}>
          Enter {m.name}
          <span className="text-white/70">→</span>
        </span>
      </div>
    </button>
  );
}

function StatCell({ label, value, accent, mono = false, small = false }) {
  return (
    <div className={cn(
      'border px-3 py-2.5 rounded-[3px]',
      accent ? 'border-emerald-200 bg-white' : 'border-slate-200 bg-white'
    )}>
      <div className="mono text-[9.5px] uppercase tracking-[0.14em] text-slate-500">{label}</div>
      <div className={cn('mt-0.5 text-slate-900 font-medium',
        small ? 'text-[10.5px]' : 'text-[13px]',
        mono && 'mono')}>
        {value}
      </div>
    </div>
  );
}

function TrustOutcomePreview() {
  return (
    <div className="border border-emerald-200 bg-emerald-50/50 rounded-[3px] px-4 py-3 flex items-center gap-4">
      <div className="relative h-9 w-9 shrink-0">
        <div className="absolute inset-0 rounded-full bg-emerald-100" />
        <div className="absolute inset-[4px] rounded-full bg-emerald-600 flex items-center justify-center">
          <Icon.Check size={16} className="text-white" />
        </div>
      </div>
      <div className="flex-1">
        <div className="mono text-[9.5px] uppercase tracking-[0.18em] text-emerald-700">Trust Badge</div>
        <div className="text-[13px] text-emerald-950 font-medium">Clean · 14 sources verified</div>
      </div>
      <div className="text-right">
        <div className="mono text-[9px] uppercase tracking-[0.14em] text-emerald-700/70">Valid</div>
        <div className="mono text-[10px] text-emerald-900 tabular-nums">30 days</div>
      </div>
    </div>
  );
}

function CredOutcomePreview() {
  return (
    <div className="border border-slate-300 bg-white rounded-[3px] px-4 py-3 flex items-center gap-3">
      <div className="h-10 w-7 border border-slate-900 bg-slate-50 shrink-0 flex items-center justify-center">
        <div className="h-5 w-[3px] bg-slate-900" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="mono text-[9.5px] uppercase tracking-[0.18em] text-slate-500">Credentialing File</div>
        <div className="text-[13px] text-slate-900 font-medium truncate" style={{ fontFamily: 'ui-serif, Georgia, serif' }}>
          Ready for Committee Review
        </div>
      </div>
      <div className="text-right">
        <div className="mono text-[9px] uppercase tracking-[0.14em] text-slate-500">Docket</div>
        <div className="mono text-[10px] text-slate-900 tabular-nums">05-014</div>
      </div>
    </div>
  );
}

// Side-by-side comparison
function ModeComparisonTable() {
  const rows = [
    ['Time',             'Seconds',              '10 – 14 business days'],
    ['Output artifact',  'Trust Badge',          'Credentialing File + Board Memorandum'],
    ['Governance',       'Self-serve',           'Delegated CVO · Committee vote'],
    ['Sources',          'OIG · NPPES · PECOS · State boards',  '14 primary sources · NPDB · peer references'],
    ['Validity',         '30 days · revocable',  '2 years · until recredentialing'],
    ['Fit for',          'Shifts, interviews, marketplace',       'Medical staff, privileges, payer enrollment'],
    ['Clinician work',   'Zero (passport already attested)',      'Application, gaps, disclosures, 3 references'],
    ['Standard cited',   'CMS sanction/exclusion, state board',   'NCQA CR §3 · §4.2 · TJC MS.06.01.03'],
    ['Price model',      'Per-check',             'Per-file · retainer'],
  ];
  return (
    <div className="border border-slate-200 rounded-[3px] overflow-hidden">
      <div className="grid grid-cols-[160px_1fr_1fr] bg-slate-100 mono text-[9.5px] uppercase tracking-[0.14em] text-slate-600">
        <div className="px-4 py-3">Dimension</div>
        <div className="px-4 py-3 border-l border-slate-200 flex items-center gap-2">
          <span className="h-2 w-2 bg-emerald-600 rounded-full" />
          Quick Check
        </div>
        <div className="px-4 py-3 border-l border-slate-200 flex items-center gap-2">
          <span className="h-2 w-2 bg-slate-900 rounded-full" />
          Full Credentialing File
        </div>
      </div>
      <ul className="divide-y divide-slate-100">
        {rows.map((r, i) => (
          <li key={i} className="grid grid-cols-[160px_1fr_1fr] items-start">
            <div className="px-4 py-3 mono text-[10.5px] uppercase tracking-[0.12em] text-slate-500 bg-slate-50/40">{r[0]}</div>
            <div className="px-4 py-3 text-[12.5px] text-slate-900 border-l border-slate-100">{r[1]}</div>
            <div className="px-4 py-3 text-[12.5px] text-slate-900 border-l border-slate-100">{r[2]}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}
window.ModeComparisonTable = ModeComparisonTable;

// ------------------------------------------------------------
// Mode switch dialog — confirms switch & exposes upgrade bridge
// ------------------------------------------------------------
function ModeSwitchDialog({ open, onClose, onSwitch, currentMode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-[2px] flex items-center justify-center px-6">
      <div className="bg-white border border-slate-900 max-w-[720px] w-full overflow-hidden shadow-2xl">
        <div className="border-b border-slate-200 px-6 py-4 flex items-center justify-between bg-slate-50">
          <div>
            <div className="mono text-[10px] uppercase tracking-[0.18em] text-slate-500">Switch mode</div>
            <h3 className="text-[16px] font-semibold text-slate-900 mt-0.5">Which job are you doing?</h3>
          </div>
          <button onClick={onClose} className="h-8 w-8 inline-flex items-center justify-center rounded border border-slate-200 hover:border-slate-400 text-slate-600">
            <Icon.X size={14} />
          </button>
        </div>

        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <ModeSwitchOption
            mode="trust"
            current={currentMode === 'trust'}
            onChoose={() => onSwitch('trust')}
          />
          <ModeSwitchOption
            mode="cred"
            current={currentMode === 'cred'}
            onChoose={() => onSwitch('cred')}
          />
        </div>

        <div className="border-t border-slate-200 px-6 py-3 bg-slate-50 flex items-center justify-between">
          <div className="mono text-[10.5px] uppercase tracking-[0.14em] text-slate-500">
            Switching is non-destructive · evidence carries forward
          </div>
          <button onClick={onClose} className="mono text-[10.5px] uppercase tracking-[0.14em] text-slate-600 hover:text-slate-900 px-2">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
window.ModeSwitchDialog = ModeSwitchDialog;

function ModeSwitchOption({ mode, current, onChoose }) {
  const m = MODES[mode];
  const isTrust = mode === 'trust';
  return (
    <button
      type="button"
      onClick={onChoose}
      className={cn(
        'text-left border p-4 rounded-[3px] transition-colors',
        current
          ? (isTrust ? 'border-emerald-700 bg-emerald-50' : 'border-slate-900 bg-slate-50')
          : (isTrust ? 'border-slate-200 hover:border-emerald-700 hover:bg-emerald-50/40' : 'border-slate-200 hover:border-slate-900 hover:bg-slate-50/40')
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className={cn('mono text-[10px] uppercase tracking-[0.18em] font-semibold',
            isTrust ? 'text-emerald-700' : 'text-slate-600')}>
            {isTrust ? 'Trust Mode' : 'Credentialing Mode'}
          </div>
          <div className="text-[16px] font-semibold text-slate-900 mt-0.5">{m.name}</div>
          <div className="text-[12px] text-slate-600 mt-0.5 leading-[1.4]">{m.tagline}</div>
        </div>
        <ModeGlyph mode={mode} size={32} />
      </div>
      <div className="mt-3 flex items-center gap-2 mono text-[10px] uppercase tracking-[0.14em] text-slate-500">
        <span>{m.sla}</span><span>·</span><span>{m.artifact}</span>
      </div>
      {current && (
        <div className="mt-2 mono text-[10px] uppercase tracking-[0.16em] text-slate-500">[ CURRENT MODE ]</div>
      )}
    </button>
  );
}

// ------------------------------------------------------------
// TRUST BADGE — the Trust Mode output artifact
// A single card. Verifiable. Expires.
// ------------------------------------------------------------
const TRUST_BADGE = {
  id: 'TB-2026-04-18-000841-A',
  issued:  '2026-04-18 14:32:51 UTC',
  expires: '2026-05-18 14:32:51 UTC',
  expiresRel: '30 days',
  token:   'vcv.tb.01JGA7R2QW0D4C8NXM5P9HE3B6',
  verifier:'vitalcv.health/v/TB-000841-A',
  subject: { name: 'Macie E. Miller, PA-C', npi: '1346053246' },
  scope:   'Identity · Licensure · Sanctions · Medicare enrollment',
  status:  'clear',  // clear | warn | fail
  bySource: [
    { source: 'NPPES',        result: 'Match · identity confirmed',     ok: true  },
    { source: 'OIG · LEIE',   result: 'No exclusion',                   ok: true  },
    { source: 'PECOS',        result: 'Active enrollment',              ok: true  },
    { source: 'CA PA Board',  result: 'Active · good standing',         ok: true  },
    { source: 'NCCPA',        result: 'Certified · CAQ Cardiovascular', ok: true  },
    { source: 'DEA',          result: 'Active · Schedule II-V',         ok: true  },
  ],
};
window.TRUST_BADGE = TRUST_BADGE;

function ViewTrustBadge({ onUpgrade }) {
  const b = TRUST_BADGE;
  return (
    <div className="max-w-[1400px] mx-auto px-6 py-12">
      {/* Eyebrow */}
      <div className="flex items-center justify-between mb-6">
        <div className="mono text-[10.5px] uppercase tracking-[0.2em] text-emerald-700 inline-flex items-center gap-2">
          <span className="h-px w-6 bg-emerald-300" />
          <span>Trust Mode · Quick Check Result</span>
        </div>
        <div className="mono text-[10.5px] uppercase tracking-[0.14em] text-slate-500 tabular-nums">
          Issued {b.issued}
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Badge card */}
        <div className="col-span-12 lg:col-span-8">
          <TrustBadgeCard badge={b} />
        </div>

        {/* Side: what this is / upgrade */}
        <aside className="col-span-12 lg:col-span-4 space-y-4">
          <WhatIsTrustBadge />
          <ModeUpgradeCallout onUpgrade={onUpgrade} />
        </aside>
      </div>

      {/* Source detail */}
      <div className="mt-10">
        <SectionHeader
          eyebrow="§2 · Source-by-source result"
          title="Primary-source verification"
          right={
            <span className="mono text-[10.5px] uppercase tracking-[0.14em] text-slate-500">
              {b.bySource.length} sources · all green
            </span>
          }
        />
        <div className="border border-slate-200 rounded-[3px] overflow-hidden">
          <ul className="divide-y divide-slate-100">
            {b.bySource.map((s, i) => (
              <li key={i} className="grid grid-cols-[24px_200px_1fr_120px] items-center px-4 py-3 hover:bg-emerald-50/20">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                <span className="mono text-[11.5px] text-slate-900 font-medium">{s.source}</span>
                <span className="text-[13px] text-slate-800">{s.result}</span>
                <span className="mono text-[10.5px] uppercase tracking-[0.14em] text-emerald-700 text-right">Verified</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
window.ViewTrustBadge = ViewTrustBadge;

function TrustBadgeCard({ badge }) {
  const b = badge;
  return (
    <div className="relative bg-white border-2 border-emerald-700 overflow-hidden">
      {/* Thick top bar */}
      <div className="h-2 bg-emerald-700" />
      {/* Header */}
      <div className="px-8 pt-7 pb-6 bg-emerald-50/40 border-b border-emerald-200">
        <div className="flex items-start justify-between gap-6">
          <div className="flex items-start gap-4">
            <ModeGlyph mode="trust" size={64} />
            <div>
              <div className="mono text-[10.5px] uppercase tracking-[0.22em] text-emerald-700 font-semibold">VitalCV · Trust Badge</div>
              <h2 className="font-semibold tracking-[-0.015em] text-emerald-950 mt-1 text-[32px] leading-tight">
                {b.subject.name}
              </h2>
              <div className="mono text-[12px] text-emerald-900/80 mt-1">NPI {b.subject.npi} · {b.scope}</div>
            </div>
          </div>
          {/* Status stamp */}
          <div className="border-2 border-emerald-700 rounded-[3px] px-4 py-2 text-center bg-white">
            <div className="mono text-[9.5px] uppercase tracking-[0.2em] text-emerald-700">Status</div>
            <div className="mono text-[18px] font-semibold uppercase tracking-[0.14em] text-emerald-800 mt-0.5">[ CLEAR ]</div>
            <div className="mono text-[9.5px] uppercase tracking-[0.14em] text-emerald-700/70 mt-0.5">no adverse finding</div>
          </div>
        </div>
      </div>
      {/* Body */}
      <div className="grid grid-cols-1 md:grid-cols-[1fr_180px] gap-6 px-8 py-6">
        {/* Meta */}
        <div className="grid grid-cols-2 gap-x-6 gap-y-3">
          <BadgeMetaRow k="Token"    v={b.token}    mono />
          <BadgeMetaRow k="Badge ID" v={b.id}       mono />
          <BadgeMetaRow k="Issued"   v={b.issued}   mono />
          <BadgeMetaRow k="Expires"  v={`${b.expires} · in ${b.expiresRel}`} mono />
          <BadgeMetaRow k="Scope"    v={b.scope} />
          <BadgeMetaRow k="Verify at" v={b.verifier} mono />
        </div>
        {/* QR placeholder */}
        <div className="flex flex-col items-center md:items-end justify-between">
          <QRPlaceholder />
          <div className="mt-3 mono text-[9.5px] uppercase tracking-[0.16em] text-emerald-700 text-center md:text-right">
            Scan to verify
          </div>
        </div>
      </div>
      {/* Footer */}
      <div className="border-t border-emerald-200 px-8 py-3 bg-emerald-50/60 flex items-center justify-between">
        <div className="mono text-[10.5px] uppercase tracking-[0.14em] text-emerald-800 inline-flex items-center gap-2">
          <Icon.ShieldCheck size={12} /> Revocable · real-time status at verifier URL
        </div>
        <div className="flex items-center gap-2">
          <button className="mono text-[10.5px] uppercase tracking-[0.14em] border border-emerald-700 text-emerald-800 bg-white hover:bg-emerald-100 px-3 h-7 rounded-[3px]">
            Copy token
          </button>
          <button className="mono text-[10.5px] uppercase tracking-[0.14em] bg-emerald-700 text-white hover:bg-emerald-800 px-3 h-7 rounded-[3px]">
            Download PDF
          </button>
        </div>
      </div>
    </div>
  );
}
window.TrustBadgeCard = TrustBadgeCard;

function BadgeMetaRow({ k, v, mono }) {
  return (
    <div>
      <div className="mono text-[9.5px] uppercase tracking-[0.14em] text-emerald-700/80">{k}</div>
      <div className={cn('text-[12.5px] text-emerald-950 mt-0.5 break-all', mono && 'mono text-[11.5px]')}>{v}</div>
    </div>
  );
}

function QRPlaceholder() {
  // Deterministic-looking QR dots — purely decorative.
  const cells = [];
  const seed = [11,7,3,13,17,5,19,23,2,29,31,41,43,47,53,59];
  for (let y = 0; y < 21; y++) {
    for (let x = 0; x < 21; x++) {
      const v = (seed[(x*3 + y) % seed.length] + x*y) % 7;
      cells.push({ x, y, on: v < 3 });
    }
  }
  return (
    <div className="bg-white border-2 border-emerald-700 p-2 rounded-[2px] shadow-[0_1px_0_0_rgba(4,120,87,0.1)]">
      <svg viewBox="0 0 21 21" width={120} height={120} className="block">
        <rect width="21" height="21" fill="#ffffff" />
        {cells.filter(c => c.on).map((c, i) =>
          <rect key={i} x={c.x} y={c.y} width="1" height="1" fill="#065f46" />
        )}
        {/* Finder corners */}
        {[[0,0],[14,0],[0,14]].map(([ox,oy],i) => (
          <g key={i}>
            <rect x={ox}   y={oy}   width="7" height="7" fill="#065f46" />
            <rect x={ox+1} y={oy+1} width="5" height="5" fill="#ffffff" />
            <rect x={ox+2} y={oy+2} width="3" height="3" fill="#065f46" />
          </g>
        ))}
      </svg>
    </div>
  );
}

function WhatIsTrustBadge() {
  return (
    <div className="border border-slate-200 rounded-[3px] p-5 bg-white">
      <div className="mono text-[10.5px] uppercase tracking-[0.18em] text-slate-500 mb-2">What this is</div>
      <p className="text-[13px] text-slate-800 leading-[1.55]">
        A Trust Badge is a <span className="text-slate-900 font-medium">machine-verifiable pass/fail</span> suitable for
        opening a door — scheduling an interview, posting a shift, signing a contract.
        It does <em>not</em> replace a Credentialing File.
      </p>
      <dl className="mt-4 space-y-2 text-[12px]">
        <div className="flex justify-between gap-3">
          <dt className="mono text-[10px] uppercase tracking-[0.12em] text-slate-500">Time to issue</dt>
          <dd className="text-slate-900">Under 60 seconds</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="mono text-[10px] uppercase tracking-[0.12em] text-slate-500">Validity</dt>
          <dd className="text-slate-900">30 days · revocable</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="mono text-[10px] uppercase tracking-[0.12em] text-slate-500">Sources</dt>
          <dd className="text-slate-900">6 federal + state</dd>
        </div>
      </dl>
    </div>
  );
}
window.WhatIsTrustBadge = WhatIsTrustBadge;

function ModeUpgradeCallout({ onUpgrade }) {
  return (
    <div className="border border-slate-900 bg-slate-50 rounded-[3px] p-5">
      <div className="flex items-start gap-3 mb-3">
        <ModeGlyph mode="cred" size={32} />
        <div>
          <div className="mono text-[10.5px] uppercase tracking-[0.18em] text-slate-600">Need something deeper?</div>
          <div className="text-[14px] font-semibold text-slate-900 mt-0.5" style={{ fontFamily: 'ui-serif, Georgia, serif' }}>
            Open the Full Credentialing File
          </div>
        </div>
      </div>
      <p className="text-[12.5px] text-slate-700 leading-[1.55] mb-3">
        If this is for a medical-staff appointment, payer enrollment, or committee vote,
        this Trust Badge is <span className="italic">not</span> sufficient. Open a Credentialing File
        to assemble the NCQA-grade binder.
      </p>
      <dl className="text-[11.5px] space-y-1.5 mb-4">
        <div className="flex justify-between">
          <dt className="mono text-[10px] uppercase tracking-[0.12em] text-slate-500">Time</dt>
          <dd className="text-slate-900 tabular-nums">10 – 14 days</dd>
        </div>
        <div className="flex justify-between">
          <dt className="mono text-[10px] uppercase tracking-[0.12em] text-slate-500">Outputs</dt>
          <dd className="text-slate-900">File · Memorandum · Exhibits</dd>
        </div>
      </dl>
      <button
        onClick={onUpgrade}
        className="w-full mono text-[11px] uppercase tracking-[0.14em] bg-slate-900 text-white hover:bg-black px-3 h-9 rounded-[3px] inline-flex items-center justify-center gap-2"
      >
        Open Credentialing File from this check →
      </button>
      <div className="mono text-[9.5px] uppercase tracking-[0.14em] text-slate-500 mt-2 text-center">
        Evidence carries forward · no re-attestation
      </div>
    </div>
  );
}
window.ModeUpgradeCallout = ModeUpgradeCallout;
