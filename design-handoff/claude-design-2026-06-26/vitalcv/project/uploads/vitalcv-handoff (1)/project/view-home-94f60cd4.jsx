// VIEW 1 — Public homepage wedge
function ViewHome({ onSubmit }) {
  const [npi, setNpi] = React.useState('');
  const [error, setError] = React.useState('');
  const [focused, setFocused] = React.useState(false);
  const clean = npi.replace(/\D/g, '').slice(0, 10);
  const full  = clean.length === 10;

  // Format as 3-3-4 for readability without actually mutating state model
  const display = clean.length === 0 ? '' :
    clean.length <= 3 ? clean :
    clean.length <= 6 ? `${clean.slice(0,3)} ${clean.slice(3)}` :
    `${clean.slice(0,3)} ${clean.slice(3,6)} ${clean.slice(6)}`;

  const handle = () => {
    if (!full) { setError('NPI must be 10 digits.'); return; }
    setError('');
    onSubmit(clean);
  };

  const fill = () => setNpi(PROVIDER.npi);

  return (
    <div className="max-w-[1400px] mx-auto px-6">
      {/* Hero */}
      <section className="pt-24 pb-20 grid grid-cols-12 gap-6 items-start">
        <div className="col-span-12 lg:col-span-7">
          <div className="mono text-[11px] uppercase tracking-[0.18em] text-slate-500 mb-6 flex items-center gap-2">
            <span className="h-px w-6 bg-slate-300 inline-block" />
            <span>Credential readiness infrastructure</span>
          </div>
          <h1 className="text-[68px] leading-[0.98] font-semibold tracking-[-0.025em] text-slate-900">
            Stop starting<br/>over. Start ready.
          </h1>
          <p className="mt-7 text-[17px] leading-[1.55] text-slate-600 max-w-[640px]">
            Enter your NPI to see a source-backed credential readiness snapshot from federal sources&nbsp;
            <span className="mono text-[14.5px] text-slate-800">(NPPES, OIG/LEIE, PECOS)</span>.
            Know what's ready, and what's missing — before the paperwork starts.
          </p>

          {/* NPI input */}
          <div className="mt-10 max-w-[640px]">
            <div className="flex items-center justify-between mb-2">
              <label htmlFor="npi" className="mono text-[11px] uppercase tracking-[0.14em] text-slate-500">
                Your NPI · 10-digit National Provider Identifier
              </label>
              <button
                type="button"
                onClick={fill}
                className="mono text-[11px] uppercase tracking-[0.14em] text-slate-400 hover:text-slate-700 underline-offset-2 hover:underline"
                title="Use the demo NPI for Macie Miller, PA-C"
              >
                Use demo NPI ↑
              </button>
            </div>

            <div className={cn(
              'ring-focus flex items-stretch border border-slate-300 rounded-md bg-white transition-colors',
              focused && 'border-slate-900'
            )}>
              <div className="flex items-center px-4 border-r border-slate-200 text-slate-400">
                <Icon.Fingerprint size={18} />
              </div>
              <input
                id="npi"
                inputMode="numeric"
                autoComplete="off"
                placeholder="— — —  — — —  — — — —"
                value={display}
                onChange={e => { setNpi(e.target.value); setError(''); }}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                onKeyDown={e => e.key === 'Enter' && handle()}
                className="mono flex-1 bg-transparent h-16 px-4 text-[22px] tracking-[0.14em] text-slate-900 placeholder:text-slate-300 outline-none"
              />
              <button
                onClick={handle}
                disabled={!full}
                className={cn(
                  'flex items-center gap-2 px-6 text-[13px] font-medium transition-colors',
                  full ? 'bg-slate-900 text-white hover:bg-black' : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                )}
              >
                <span>Check Credential Readiness</span>
                <Icon.ArrowRight size={16} />
              </button>
            </div>

            <div className="mt-2 h-5 flex items-center justify-between text-[11.5px]">
              <span className={cn('mono uppercase tracking-[0.12em]', error ? 'text-red-600' : 'text-slate-400')}>
                {error || (full ? '10 / 10 digits' : `${clean.length} / 10 digits`)}
              </span>
              <span className="text-slate-400">
                No account required · Nothing stored without your consent
              </span>
            </div>
          </div>

          {/* Trust strip */}
          <div className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-2 text-[12px] text-slate-500">
            <span className="inline-flex items-center gap-1.5">
              <Icon.ShieldCheck size={14} className="text-emerald-600" />
              <span>VC 2.0 compatible</span>
            </span>
            <span className="h-3 w-px bg-slate-200" />
            <span className="inline-flex items-center gap-1.5">
              <Icon.Layers size={14} className="text-slate-400" />
              <span>OpenID4VCI aligned</span>
            </span>
            <span className="h-3 w-px bg-slate-200" />
            <span className="inline-flex items-center gap-1.5">
              <Icon.Stamp size={14} className="text-slate-400" />
              <span>Audit-ready receipts</span>
            </span>
          </div>
        </div>

        {/* Right: data provenance panel */}
        <div className="col-span-12 lg:col-span-5 lg:pl-10 mt-4 lg:mt-0">
          <Card className="p-0 overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Icon.Activity size={14} className="text-slate-500" />
                <span className="text-[12.5px] font-medium text-slate-900">Authoritative sources, never scraped</span>
              </div>
              <span className="mono text-[10.5px] uppercase tracking-[0.12em] text-slate-400">Live</span>
            </div>
            <div className="divide-y divide-slate-100">
              {SOURCES_STRIP.map((s, i) => (
                <div key={i} className="px-5 py-3.5 flex items-center justify-between hover:bg-slate-50/60">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="mono text-[11px] text-slate-500 uppercase tracking-[0.1em]">{s.code}</span>
                      <span className="text-[13px] font-medium text-slate-900 truncate">{s.name}</span>
                    </div>
                    <div className="text-[11.5px] text-slate-500 mt-0.5">{s.authority}</div>
                  </div>
                  <div className="text-right">
                    <Chip state={s.state} size="sm">{s.chip}</Chip>
                    <div className="mono text-[10.5px] text-slate-400 mt-1">{s.freshness}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-[11.5px] text-slate-500">
              <span>4 federal + state sources wired in</span>
              <a href="#" className="inline-flex items-center gap-1 text-slate-700 hover:text-slate-900">
                <span>Full source registry</span> <Icon.ArrowRight size={12} />
              </a>
            </div>
          </Card>

          {/* Quiet quote */}
          <div className="mt-5 text-[12.5px] text-slate-500 leading-[1.5] border-l-2 border-slate-200 pl-4">
            "Credentialing eats <span className="text-slate-900 font-medium">90–180 days</span> per hire.
            Most of that is re-collecting evidence that's already public."
            <div className="mono text-[10.5px] uppercase tracking-[0.12em] text-slate-400 mt-2">Why VitalCV exists</div>
          </div>
        </div>
      </section>

      {/* How it works strip */}
      <section className="border-t border-slate-200 pt-10 pb-16">
        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-12 lg:col-span-3">
            <div className="mono text-[10.5px] uppercase tracking-[0.14em] text-slate-500 mb-2">Protocol</div>
            <h3 className="text-[22px] font-semibold tracking-tightish text-slate-900 leading-[1.15]">
              One NPI in.<br/>A defensible packet out.
            </h3>
          </div>
          <div className="col-span-12 lg:col-span-9 grid grid-cols-1 md:grid-cols-3 gap-px bg-slate-200 border border-slate-200 rounded-md overflow-hidden">
            {STEPS.map((s, i) => (
              <div key={i} className="bg-white p-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="mono text-[11px] text-slate-400 uppercase tracking-[0.14em]">Step {String(i+1).padStart(2,'0')}</span>
                  <s.Icon size={16} className="text-slate-400" />
                </div>
                <div className="text-[14px] font-semibold text-slate-900 mb-1.5">{s.title}</div>
                <div className="text-[12.5px] text-slate-500 leading-[1.5]">{s.body}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust Tier Ladder — the published authority ladder */}
      <section className="border-t border-slate-200 pt-12 pb-16">
        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-12 lg:col-span-4">
            <div className="mono text-[11px] uppercase tracking-[0.18em] text-slate-500 mb-3">§2 · Authority framework</div>
            <h3 className="text-[22px] font-semibold tracking-[-0.02em] text-slate-900 leading-[1.2]">
              A published ladder of trust.<br />
              <span className="text-slate-500">Every observation is tiered.</span>
            </h3>
            <p className="mt-4 text-[13px] leading-[1.6] text-slate-600 max-w-[420px]">
              Not all sources are equal, and we refuse to pretend otherwise. Every fact on the
              passport is tagged with a tier from T1 to T4 so downstream auditors know exactly how
              much confidence to extend. T4 records are signed by the issuing authority itself — no
              further verification required.
            </p>
            <div className="mt-5 flex items-center gap-2 text-[11.5px] text-slate-500">
              <Icon.Shield size={13} className="text-slate-400" />
              <span>Conforms to <span className="mono text-slate-700">NCQA CR §3</span>, <span className="mono text-slate-700">W3C VC 2.0</span>, <span className="mono text-slate-700">OpenID4VCI</span></span>
            </div>
          </div>
          <div className="col-span-12 lg:col-span-8">
            <TrustLevelLegend />
            <div className="mt-3">
              <LegalAuthorityNotice />
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 py-8 flex items-center justify-between text-[11.5px] text-slate-500">
        <div className="flex items-center gap-3">
          <Brandmark />
          <span className="text-slate-300">|</span>
          <span>Delegated credential verification infrastructure · NCQA CR §3 · §4.2</span>
        </div>
        <div className="mono">© 2026 VitalCV, Inc. · Trust Registry Node 202 · ed25519</div>
      </footer>
    </div>
  );
}

const SOURCES_STRIP = [
  { code: 'NPPES',    name: 'Identity registry',           authority: 'CMS · Federal',               state: 'verified', chip: 'Live', freshness: 'Updated hourly' },
  { code: 'OIG/LEIE', name: 'Exclusion list',              authority: 'HHS OIG · Federal',           state: 'verified', chip: 'Live', freshness: 'Refreshed monthly' },
  { code: 'PECOS',    name: 'Medicare enrollment',         authority: 'CMS · Federal',               state: 'verified', chip: 'Live', freshness: 'Updated daily' },
  { code: 'CA-PA',    name: 'Physician Assistant Board',   authority: 'State of California',         state: 'access',   chip: 'Gated', freshness: 'Employer-gated PSV' },
];

const STEPS = [
  { Icon: Icon.Fingerprint, title: 'Enter your NPI',           body: 'We resolve your identity against public federal enumeration. No PII required, no account.' },
  { Icon: Icon.Layers,      title: 'Fan out to sources',       body: 'We query authoritative registries in parallel and stamp each result with a verifiable receipt.' },
  { Icon: Icon.Stamp,       title: 'Carry your packet forward', body: 'Share a cryptographically-signed snapshot with any employer, CVO, or locum tenens partner.' },
];

window.ViewHome = ViewHome;
