// VIEW 4 — Credentialing File (compliance-grade print-style view)

function ViewFile({ lanes }) {
  const gate = React.useMemo(() => evaluateAcceptance(lanes), [lanes]);
  const [activeSection, setActiveSection] = React.useState('cover');

  // Observe section visibility for TOC highlight
  React.useEffect(() => {
    const ids = FILE_TOC.map(t => 'sec-' + t.id);
    const els = ids.map(id => document.getElementById(id)).filter(Boolean);
    if (!els.length) return;
    const obs = new IntersectionObserver((entries) => {
      const visible = entries
        .filter(e => e.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
      if (visible[0]) {
        const raw = visible[0].target.id.replace(/^sec-/, '');
        setActiveSection(raw);
      }
    }, { rootMargin: '-20% 0px -60% 0px', threshold: [0, 0.25, 0.5, 0.75, 1] });
    els.forEach(el => obs.observe(el));
    return () => obs.disconnect();
  }, []);

  const jumpTo = (id) => {
    const el = document.getElementById('sec-' + id);
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.pageYOffset - 80;
    window.scrollTo({ top, behavior: 'smooth' });
  };

  return (
    <div className="bg-slate-100/70 min-h-screen pb-16">
      {/* File toolbar */}
      <FileToolbar />

      <div className="max-w-[1400px] mx-auto px-6 pt-6">
        <div className="grid grid-cols-12 gap-6">
          {/* TOC sidebar */}
          <aside className="col-span-12 lg:col-span-3 lg:sticky lg:top-[72px] lg:self-start">
            <FileTOC activeId={activeSection} onJump={jumpTo} gate={gate} />
          </aside>

          {/* File pages */}
          <div className="col-span-12 lg:col-span-9 space-y-4">
            {/* §1 Cover */}
            <FileCoverSheet />

            {/* §2–3 Applicant + Readiness */}
            <ApplicantIdentificationPage />
            <ReadinessSummaryPage gate={gate} />

            {/* §4 PSV Checklist */}
            <PSVChecklistPage gate={gate} />

            {/* §5 Attestation */}
            <AttestationSection />

            {/* §6 Missing */}
            <MissingFieldsPanel />

            {/* §7 Chain of custody */}
            <ChainOfCustody />

            {/* §8 Seals */}
            <SealsPage />
          </div>
        </div>
      </div>
    </div>
  );
}
window.ViewFile = ViewFile;

/* ---------- File toolbar ---------- */
function FileToolbar() {
  return (
    <div className="sticky top-[49px] z-10 bg-white/97 backdrop-blur border-b border-slate-200">
      <div className="max-w-[1400px] mx-auto px-6 py-2 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="mono text-[10px] uppercase tracking-[0.18em] text-slate-500">
            Credentialing File
          </div>
          <span className="text-slate-300">·</span>
          <span className="mono text-[11px] text-slate-900 tabular-nums truncate">{FILE_META.id}</span>
          <span className="mono text-[10.5px] text-slate-400">v{FILE_META.version}</span>
          <span className="hidden md:inline-flex mono text-[9.5px] uppercase tracking-[0.14em] text-slate-600 border border-slate-300 rounded-[3px] px-1.5 py-[2px] whitespace-nowrap bg-white ml-2">
            CONFIDENTIAL · PEER-REVIEW PRIVILEGED
          </span>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button className="mono text-[11px] uppercase tracking-[0.1em] border border-slate-300 rounded-[3px] px-2.5 py-1.5 hover:bg-slate-50 inline-flex items-center gap-1.5">
            <Icon.Download size={12} /> Bundle
          </button>
          <button onClick={() => window.print()} className="mono text-[11px] uppercase tracking-[0.1em] border border-slate-900 bg-slate-900 text-white rounded-[3px] px-2.5 py-1.5 hover:bg-black inline-flex items-center gap-1.5">
            <Icon.FileText size={12} /> Print file
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- TOC sidebar ---------- */
function FileTOC({ activeId, onJump, gate }) {
  return (
    <div className="border border-slate-300 bg-white rounded-[3px] overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
        <div className="mono text-[9.5px] uppercase tracking-[0.18em] text-slate-500">Table of Contents</div>
        <div className="mono text-[11px] text-slate-900 tabular-nums mt-0.5">{FILE_META.id}</div>
      </div>
      <ol>
        {FILE_TOC.map((t, i) => (
          <li key={t.id}>
            <button
              type="button"
              onClick={() => onJump(t.id)}
              className={cn('w-full text-left flex items-baseline gap-2 px-4 py-2 border-l-2 transition-colors',
                i < FILE_TOC.length - 1 && 'border-b border-slate-100',
                activeId === t.id ? 'bg-slate-50 border-l-slate-900' : 'border-l-transparent hover:bg-slate-50/70'
              )}>
              <span className="mono text-[10px] text-slate-400 tabular-nums w-7 flex-shrink-0">{t.n}</span>
              <span className={cn('text-[12px] flex-1 leading-snug',
                activeId === t.id ? 'text-slate-900 font-medium' : 'text-slate-700')}>
                {t.label}
              </span>
              <span className="mono text-[9.5px] text-slate-400 tabular-nums flex-shrink-0">{t.pages}</span>
            </button>
          </li>
        ))}
      </ol>
      {/* Mini gate status */}
      <div className="border-t border-slate-200 bg-slate-50 px-4 py-3">
        <div className="mono text-[9.5px] uppercase tracking-[0.14em] text-slate-500 mb-1.5">Current gate</div>
        <div className="flex items-center gap-2">
          <span className={cn('mono text-[10.5px] uppercase tracking-[0.14em] border rounded-[3px] px-1.5 py-[2px] font-semibold',
            gate.ready ? 'border-emerald-700 text-emerald-800 bg-emerald-50' : 'border-amber-700 text-amber-900 bg-amber-50')}>
            [ {gate.ready ? 'READY' : 'NOT READY'} ]
          </span>
          <span className="mono text-[10.5px] text-slate-700 tabular-nums">{gate.counts.met}/{gate.counts.required}</span>
        </div>
      </div>
    </div>
  );
}

/* ---------- §2 Applicant Identification ---------- */
function ApplicantIdentificationPage() {
  return (
    <FilePage n={2} total={17} sectionRef="sec-applicant" sectionLabel="§2 Applicant Identification">
      <FileSectionHeader
        n="§2"
        title="Applicant Identification"
        sub="Identity resolved to NPI via CMS NPPES. Primary-sealed T4. Demographic fields are drawn from the federal enumeration record of truth."
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-0 border border-slate-900">
        <div className="md:col-span-1 p-5 border-r border-slate-200 bg-slate-50">
          <div className="h-24 w-24 rounded bg-slate-900 text-white flex items-center justify-center text-[32px] font-semibold mx-auto">
            {PROVIDER.initials}
          </div>
          <div className="mt-4 text-center">
            <div className="text-[15px] font-semibold text-slate-900">{PROVIDER.fullName}, {PROVIDER.credential}</div>
            <div className="text-[11.5px] text-slate-500 mt-0.5">{PROVIDER.role}</div>
          </div>
          <div className="mt-4 flex justify-center">
            <TrustTierBadge tier="T4" size="lg" />
          </div>
        </div>
        <div className="md:col-span-2 p-0">
          <dl className="divide-y divide-slate-200 mono">
            <CoverRow k="Legal name"            v={PROVIDER.fullName} highlight />
            <CoverRow k="Preferred name"        v="Macie Miller" />
            <CoverRow k="NPI · Type 1"          v={PROVIDER.npi} />
            <CoverRow k="Taxonomy"              v={PROVIDER.taxonomy} />
            <CoverRow k="Gender"                v={PROVIDER.gender} />
            <CoverRow k="Enumerated"            v={PROVIDER.enumeratedDateLong} />
            <CoverRow k="Primary practice city" v={PROVIDER.city} />
            <CoverRow k="DOB"                   v="—— · ——— · ——    (on file, redacted)" />
            <CoverRow k="Government ID"         v="US Passport · on file · back image outstanding" />
          </dl>
        </div>
      </div>

      {/* Delegation chain for identity */}
      <div className="mt-6 border border-slate-200 p-4 bg-slate-50/60 rounded">
        <div className="mono text-[9.5px] uppercase tracking-[0.14em] text-slate-500 mb-2">Delegation chain of custody · Identity</div>
        <DelegationBadge laneId="identity" />
      </div>
    </FilePage>
  );
}

/* ---------- §3 Readiness & Trust ---------- */
function ReadinessSummaryPage({ gate }) {
  return (
    <FilePage n={4} total={17} sectionRef="sec-readiness" sectionLabel="§3 Readiness &amp; Trust Summary">
      <FileSectionHeader
        n="§3"
        title="Readiness &amp; Trust Summary"
        sub="A consolidated snapshot of what the registry currently knows. This page reflects live status at the time of print."
      />

      {/* Top-line stats */}
      <div className="grid grid-cols-4 gap-px bg-slate-200 border border-slate-900">
        <ReadinessStat label="Required verifications" value={`${gate.counts.met}/${gate.counts.required}`} sub="Met / total" />
        <ReadinessStat label="In flight"              value={gate.counts.pending}  sub="Auto-updating" />
        <ReadinessStat label="Unmet"                  value={gate.counts.unmet}    sub={gate.counts.unmet === 0 ? 'All clear' : 'Requires action'} warn={gate.counts.unmet > 0} />
        <ReadinessStat label="Blocking"               value={gate.counts.blocking} sub="Adverse findings" danger={gate.counts.blocking > 0} />
      </div>

      {/* Readiness bar */}
      <div className="mt-6 border border-slate-900 p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="mono text-[10px] uppercase tracking-[0.14em] text-slate-500">Completion · required verifications</div>
          <div className="mono text-[11px] text-slate-900 tabular-nums">{gate.progressPct}%</div>
        </div>
        <div className="h-3 bg-slate-100 border border-slate-200 overflow-hidden flex">
          {gate.checks.filter(c => c.rule.required).map((c, i) => (
            <div key={i}
              className={cn('h-full border-r border-white last:border-r-0',
                c.status === 'met' && 'bg-emerald-600',
                c.status === 'pending' && 'bg-amber-500',
                c.status === 'unmet' && 'bg-slate-200',
                c.status === 'blocking' && 'bg-red-600',
              )}
              style={{ width: `${100 / gate.counts.required}%` }}
              title={`${c.rule.label} — ${c.status}`}
            />
          ))}
        </div>
      </div>

      {/* Trust tier distribution */}
      <div className="mt-6">
        <div className="mono text-[10px] uppercase tracking-[0.14em] text-slate-500 mb-2">Trust tier distribution · by lane</div>
        <div className="border border-slate-900">
          <div className="grid grid-cols-[1fr_210px_200px] bg-slate-950 text-slate-100 mono text-[9.5px] uppercase tracking-[0.14em]">
            <div className="px-3 py-2">Lane</div>
            <div className="px-3 py-2">Tier</div>
            <div className="px-3 py-2">Delegated Authority</div>
          </div>
          <ul className="divide-y divide-slate-100">
            {Object.entries(LANE_AUTHORITY).map(([laneId, auth]) => (
              <li key={laneId} className="grid grid-cols-[1fr_210px_200px] items-center">
                <div className="px-3 py-2.5 text-[12px] text-slate-900 capitalize">{laneId}</div>
                <div className="px-3 py-2.5"><TrustTierBadge tier={auth.tier} /></div>
                <div className="px-3 py-2.5 mono text-[11px] text-slate-700 truncate">{auth.delegate.org}</div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </FilePage>
  );
}

function ReadinessStat({ label, value, sub, warn, danger }) {
  return (
    <div className={cn('bg-white p-4',
      warn && 'bg-amber-50',
      danger && 'bg-red-50'
    )}>
      <div className="mono text-[9.5px] uppercase tracking-[0.14em] text-slate-500">{label}</div>
      <div className={cn('text-[28px] font-semibold tracking-[-0.02em] text-slate-900 mt-1 tabular-nums',
        warn && 'text-amber-900',
        danger && 'text-red-800'
      )}>
        {value}
      </div>
      <div className={cn('mono text-[10px] text-slate-500 mt-0.5', warn && 'text-amber-700', danger && 'text-red-700')}>{sub}</div>
    </div>
  );
}

/* ---------- §4 PSV Checklist page ---------- */
function PSVChecklistPage({ gate }) {
  return (
    <FilePage n={6} total={17} sectionRef="sec-psv" sectionLabel="§4 Primary-Source Verifications">
      <FileSectionHeader
        n="§4"
        title="Primary-Source Verifications"
        sub="Each requirement is mapped to a primary authoritative source, a minimum trust tier, and the governing standard. NCQA CR §3 / TJC MS.06.01.03."
      />
      <PSVChecklist gate={gate} />

      {/* Sub: lane-by-lane evidence summary */}
      <div className="mt-8">
        <div className="mono text-[10px] uppercase tracking-[0.14em] text-slate-500 mb-2">Evidence summary · per lane</div>
        <div className="border border-slate-900">
          <div className="grid grid-cols-[1fr_100px_110px_130px] bg-slate-950 text-slate-100 mono text-[9.5px] uppercase tracking-[0.14em]">
            <div className="px-3 py-2">Lane</div>
            <div className="px-3 py-2">State</div>
            <div className="px-3 py-2">Last checked</div>
            <div className="px-3 py-2">Signature</div>
          </div>
          <ul className="divide-y divide-slate-100">
            {gate.checks.map(c => {
              const auth = LANE_AUTHORITY[c.rule.laneId];
              return (
                <li key={c.rule.id} className="grid grid-cols-[1fr_100px_110px_130px] items-center">
                  <div className="px-3 py-2.5">
                    <div className="text-[12px] text-slate-900 font-medium">{c.rule.label}</div>
                    <div className="mono text-[10px] text-slate-500">{(auth && auth.delegate.org) || '—'}</div>
                  </div>
                  <div className="px-3 py-2.5"><PSVStatusPill status={c.status} /></div>
                  <div className="px-3 py-2.5 mono text-[10.5px] text-slate-700 tabular-nums">
                    {c.lane && c.lane.checkedAt ? c.lane.checkedAt : '—'}
                  </div>
                  <div className="px-3 py-2.5 mono text-[10px] text-slate-600 break-all">
                    {(auth && auth.delegate.sig) || '—'}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </FilePage>
  );
}
