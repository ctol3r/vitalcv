// VIEW 5 — The Application Packet

function ViewApplication() {
  const [mode, setMode] = React.useState('cvo'); // 'cvo' (read-only, as-submitted) | 'clinician' (editable)
  const [activeId, setActiveId] = React.useState('A');

  const sectionStats = React.useMemo(() =>
    Object.fromEntries(APPLICATION_SECTIONS.map(s => [s.id, computeSectionCompletion(s)])),
  []);

  const overall = React.useMemo(() => {
    const totals = Object.values(sectionStats).reduce((acc, s) => ({ total: acc.total + s.total, complete: acc.complete + s.complete }), { total: 0, complete: 0 });
    return { ...totals, pct: Math.round((totals.complete / totals.total) * 100) };
  }, [sectionStats]);

  // Section visibility → rail active highlight
  React.useEffect(() => {
    const els = APPLICATION_SECTIONS.map(s => document.getElementById('app-sec-' + s.id)).filter(Boolean);
    if (!els.length) return;
    const obs = new IntersectionObserver((entries) => {
      const visible = entries.filter(e => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio);
      if (visible[0]) setActiveId(visible[0].target.id.replace(/^app-sec-/, ''));
    }, { rootMargin: '-20% 0px -60% 0px', threshold: [0, 0.25, 0.5, 0.75, 1] });
    els.forEach(el => obs.observe(el));
    return () => obs.disconnect();
  }, []);

  const jumpTo = (id) => {
    const el = document.getElementById('app-sec-' + id);
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.pageYOffset - 90;
    window.scrollTo({ top, behavior: 'smooth' });
  };

  return (
    <div className="bg-slate-100/70 min-h-screen pb-16">
      <ApplicationToolbar mode={mode} setMode={setMode} overall={overall} />

      <div className="max-w-[1400px] mx-auto px-6 pt-6">
        <div className="grid grid-cols-12 gap-6">
          {/* Left rail */}
          <aside className="col-span-12 lg:col-span-3 lg:sticky lg:top-[90px] lg:self-start">
            <ApplicationRail activeId={activeId} onJump={jumpTo} stats={sectionStats} overall={overall} />
          </aside>

          {/* Packet pages */}
          <div className="col-span-12 lg:col-span-9 space-y-4">
            <ApplicationCoverPage overall={overall} />

            {APPLICATION_SECTIONS.map((s, i) => (
              <ApplicationPage
                key={s.id}
                section={s}
                stats={sectionStats[s.id]}
                mode={mode}
                pageN={i + 2}
                totalPages={APPLICATION_SECTIONS.length + 2}
              />
            ))}

            {/* Submission receipt */}
            <SubmissionReceiptPage pageN={APPLICATION_SECTIONS.length + 2} totalPages={APPLICATION_SECTIONS.length + 2} />
          </div>
        </div>
      </div>
    </div>
  );
}
window.ViewApplication = ViewApplication;

/* ---------- Toolbar ---------- */
function ApplicationToolbar({ mode, setMode, overall }) {
  const submitted = APPLICATION_META.status === 'submitted';
  return (
    <div className="sticky top-[49px] z-10 bg-white/97 backdrop-blur border-b border-slate-200">
      <div className="max-w-[1400px] mx-auto px-6 py-2 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <div className="mono text-[10px] uppercase tracking-[0.18em] text-slate-500">Application Packet</div>
          <span className="text-slate-300">·</span>
          <span className="mono text-[11px] text-slate-900 tabular-nums truncate">{APPLICATION_META.id}</span>
          <span className="hidden md:inline-flex mono text-[9.5px] uppercase tracking-[0.14em] text-slate-600 border border-slate-300 rounded-[3px] px-1.5 py-[2px] whitespace-nowrap bg-white ml-2">
            {APPLICATION_META.packetVersion}
          </span>
          {submitted && (
            <span className="mono text-[9.5px] uppercase tracking-[0.14em] border border-emerald-700 text-emerald-800 bg-emerald-50 rounded-[3px] px-1.5 py-[2px] font-semibold whitespace-nowrap">
              [ SUBMITTED · LOCKED ]
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Mode toggle */}
          <div className="inline-flex items-center border border-slate-300 rounded-[3px] overflow-hidden">
            <button onClick={() => setMode('cvo')}
              className={cn('mono text-[10.5px] uppercase tracking-[0.12em] px-2.5 py-1.5',
                mode === 'cvo' ? 'bg-slate-900 text-white' : 'bg-white text-slate-700 hover:bg-slate-50')}>
              CVO view
            </button>
            <button onClick={() => setMode('clinician')}
              className={cn('mono text-[10.5px] uppercase tracking-[0.12em] px-2.5 py-1.5 border-l border-slate-300',
                mode === 'clinician' ? 'bg-slate-900 text-white' : 'bg-white text-slate-700 hover:bg-slate-50')}>
              Clinician view
            </button>
          </div>
          <button onClick={() => window.print()} className="mono text-[11px] uppercase tracking-[0.1em] border border-slate-900 bg-slate-900 text-white rounded-[3px] px-2.5 py-1.5 hover:bg-black inline-flex items-center gap-1.5">
            <Icon.FileText size={12} /> Print packet
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- Rail ---------- */
function ApplicationRail({ activeId, onJump, stats, overall }) {
  return (
    <div className="border border-slate-300 bg-white rounded-[3px] overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
        <div className="mono text-[9.5px] uppercase tracking-[0.18em] text-slate-500">Packet Outline</div>
        <div className="mono text-[11px] text-slate-900 tabular-nums mt-0.5">{APPLICATION_META.id}</div>
        <div className="mt-3">
          <div className="flex items-baseline justify-between">
            <span className="mono text-[9.5px] uppercase tracking-[0.14em] text-slate-500">Overall</span>
            <span className="mono text-[11px] text-slate-900 tabular-nums">{overall.pct}%</span>
          </div>
          <div className="h-1.5 bg-slate-200 rounded-full mt-1 overflow-hidden">
            <div className={cn('h-full', overall.pct === 100 ? 'bg-emerald-600' : 'bg-slate-900')}
              style={{ width: `${overall.pct}%` }} />
          </div>
          <div className="mono text-[10px] text-slate-500 mt-1 tabular-nums">
            {overall.complete} of {overall.total} required fields
          </div>
        </div>
      </div>
      <ol>
        {APPLICATION_SECTIONS.map((s, i) => {
          const st = stats[s.id];
          const done = st.pct === 100;
          const active = activeId === s.id;
          return (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => onJump(s.id)}
                className={cn('w-full text-left flex items-start gap-2 px-4 py-2.5 border-l-2 transition-colors',
                  i < APPLICATION_SECTIONS.length - 1 && 'border-b border-slate-100',
                  active ? 'bg-slate-50 border-l-slate-900' : 'border-l-transparent hover:bg-slate-50/70'
                )}>
                <span className={cn(
                  'mt-0.5 h-3.5 w-3.5 flex-shrink-0 border flex items-center justify-center',
                  done ? 'bg-slate-900 border-slate-900' : 'bg-white border-slate-400'
                )}>
                  {done && <svg viewBox="0 0 10 10" width="8" height="8" className="text-white"><path d="M1 5 L4 8 L9 2" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                </span>
                <span className="mono text-[10px] text-slate-400 tabular-nums flex-shrink-0 w-6">{s.n}</span>
                <span className="flex-1 min-w-0">
                  <span className={cn('block text-[12px] leading-tight',
                    active ? 'text-slate-900 font-medium' : 'text-slate-800')}>
                    {s.label}
                  </span>
                  <span className="mono text-[9.5px] text-slate-500 tabular-nums">{st.complete}/{st.total} · {st.pct}%</span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/* ---------- Cover page ---------- */
function ApplicationCoverPage({ overall }) {
  return (
    <section className="bg-white border border-slate-300 mx-auto max-w-[920px] my-4 shadow-[0_1px_0_0_rgba(15,23,42,0.04)]">
      <div className="flex items-center justify-between px-8 pt-5 pb-3 border-b border-slate-200">
        <div className="mono text-[10px] uppercase tracking-[0.18em] text-slate-500">
          VCV Application Packet · {APPLICATION_META.id}
        </div>
        <div className="mono text-[10px] uppercase tracking-[0.14em] text-slate-500">Cover</div>
      </div>

      <div className="px-8 py-8 text-center">
        <div className="mono text-[11px] uppercase tracking-[0.24em] text-slate-500">VitalCV · Delegated CVO</div>
        <div className="mono text-[11px] uppercase tracking-[0.2em] text-slate-400 mt-1">Application for Appointment to the Medical Staff</div>

        <h1 className="mt-8 text-[34px] md:text-[42px] font-semibold tracking-[-0.03em] text-slate-900 leading-[1.05]">
          Application Packet
          <span className="block text-slate-500 text-[18px] md:text-[22px] tracking-[-0.01em] font-normal mt-1">
            {APPLICATION_META.applicationType}
          </span>
        </h1>

        <div className="mt-6 inline-flex flex-col gap-2 items-center">
          <span className="mono text-[11px] uppercase tracking-[0.14em] border border-emerald-700 text-emerald-800 bg-emerald-50 rounded-[3px] px-2 py-[3px] font-semibold">
            [ SUBMITTED · {APPLICATION_META.submittedAt} ]
          </span>
          <span className="mono text-[10.5px] text-slate-500">
            Submitted by {APPLICATION_META.submittedBy} to {APPLICATION_META.organization}
          </span>
        </div>
      </div>

      <div className="px-8 pb-8">
        <div className="border-t border-b border-slate-900">
          <dl className="divide-y divide-slate-200 mono">
            <CoverRow k="Packet ID"        v={APPLICATION_META.id} highlight />
            <CoverRow k="Applicant"         v="Miller, Macie E. · PA-C · NPI 1346053246" />
            <CoverRow k="Application type"  v={APPLICATION_META.applicationType} />
            <CoverRow k="Packet schema"     v={APPLICATION_META.packetVersion} />
            <CoverRow k="Opened"            v={APPLICATION_META.opened} />
            <CoverRow k="Last saved"        v={APPLICATION_META.lastSaved} />
            <CoverRow k="Submitted"         v={APPLICATION_META.submittedAt} />
            <CoverRow k="Destination"       v={APPLICATION_META.organization} />
            <CoverRow k="Completion"        v={`${overall.complete} of ${overall.total} required fields · ${overall.pct}%`} highlight />
          </dl>
        </div>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-px bg-slate-200 border border-slate-900">
          <CoverStat label="Sections"       value={String(APPLICATION_SECTIONS.length)}  sub="A · B · C · D · E · F · G · H · I · J" />
          <CoverStat label="Required fields"value={String(overall.total)}                sub="All marked with [ required ]" />
          <CoverStat label="Outstanding"    value={String(Math.max(0, overall.total - overall.complete))}  sub="See §6 of Credentialing File" warn />
        </div>

        <div className="mt-6 border border-slate-900 bg-slate-50 px-5 py-4">
          <div className="mono text-[9.5px] uppercase tracking-[0.18em] text-slate-900 font-semibold">
            ☐ Certified · Penalty-of-perjury disclosures
          </div>
          <p className="mono text-[10.5px] text-slate-700 mt-2 leading-[1.6]">
            All declarations in §H are made under penalty of perjury. Material YES answers
            to Q3–Q6 trigger MSO committee review per NCQA CR 3 §B.6.
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between px-8 py-2.5 border-t border-slate-200 bg-slate-50">
        <div className="mono text-[9.5px] uppercase tracking-[0.14em] text-slate-500">CONFIDENTIAL · SUBMITTED UNDER PENALTY OF PERJURY</div>
        <div className="mono text-[10px] text-slate-500 tabular-nums">Page 01 of {APPLICATION_SECTIONS.length + 2}</div>
      </div>
    </section>
  );
}

function CoverStat({ label, value, sub, warn }) {
  return (
    <div className={cn('bg-white p-4', warn && 'bg-amber-50')}>
      <div className="mono text-[9.5px] uppercase tracking-[0.14em] text-slate-500">{label}</div>
      <div className={cn('text-[28px] font-semibold tracking-[-0.02em] text-slate-900 mt-1 tabular-nums',
        warn && 'text-amber-900')}>{value}</div>
      <div className={cn('mono text-[10px] text-slate-500 mt-0.5', warn && 'text-amber-700')}>{sub}</div>
    </div>
  );
}

/* ---------- Application page wrapper ---------- */
function ApplicationPage({ section, stats, mode, pageN, totalPages }) {
  return (
    <section id={'app-sec-' + section.id}
      className="bg-white border border-slate-300 mx-auto max-w-[920px] my-4 shadow-[0_1px_0_0_rgba(15,23,42,0.04)]">
      <div className="flex items-center justify-between px-8 pt-5 pb-3 border-b border-slate-200">
        <div className="mono text-[10px] uppercase tracking-[0.18em] text-slate-500">
          VCV Application Packet · {APPLICATION_META.id}
        </div>
        <div className="mono text-[10px] uppercase tracking-[0.14em] text-slate-500">
          {section.n} {section.label}
        </div>
      </div>
      <div className="px-8 py-6">
        <ApplicationSectionHeader section={section} stats={stats} mode={mode} />
        <ApplicationSectionBody section={section} mode={mode} />
        {!section.releaseSection && <SectionAttestationStrip section={section} />}
      </div>
      <div className="flex items-center justify-between px-8 py-2.5 border-t border-slate-200 bg-slate-50">
        <div className="mono text-[9.5px] uppercase tracking-[0.14em] text-slate-500">CONFIDENTIAL · SUBMITTED UNDER PENALTY OF PERJURY</div>
        <div className="mono text-[10px] text-slate-500 tabular-nums">Page {String(pageN).padStart(2,'0')} of {String(totalPages).padStart(2,'0')}</div>
      </div>
    </section>
  );
}

/* ---------- Submission receipt (final page) ---------- */
function SubmissionReceiptPage({ pageN, totalPages }) {
  return (
    <section className="bg-white border border-slate-300 mx-auto max-w-[920px] my-4 shadow-[0_1px_0_0_rgba(15,23,42,0.04)]">
      <div className="flex items-center justify-between px-8 pt-5 pb-3 border-b border-slate-200">
        <div className="mono text-[10px] uppercase tracking-[0.18em] text-slate-500">
          VCV Application Packet · {APPLICATION_META.id}
        </div>
        <div className="mono text-[10px] uppercase tracking-[0.14em] text-slate-500">Submission receipt</div>
      </div>

      <div className="px-8 py-8">
        <div className="text-center mb-6">
          <div className="mono text-[11px] uppercase tracking-[0.2em] text-slate-500">Submission Receipt</div>
          <h2 className="mt-2 text-[24px] font-semibold tracking-[-0.02em] text-slate-900">Packet sealed &amp; forwarded</h2>
          <p className="text-[12.5px] text-slate-600 mt-1.5 max-w-[60ch] mx-auto">
            This packet has been cryptographically sealed and delivered to the destination organization.
            No further edits are possible without opening a new revision.
          </p>
        </div>

        <div className="border border-slate-900">
          <dl className="divide-y divide-slate-200 mono">
            <CoverRow k="Packet ID"        v={APPLICATION_META.id} highlight />
            <CoverRow k="Sealed at"        v={APPLICATION_META.lockAt} />
            <CoverRow k="Submitted to"     v={APPLICATION_META.organization} />
            <CoverRow k="Applicant signature"      v="ed25519:applicant/0x6a12…d74c" />
            <CoverRow k="Registry counter-sig"    v="ed25519:vitalcv/sor/prod/202 · 0x01b4…fe29" />
            <CoverRow k="Destination counter-sig" v="ed25519:cedar/mso/2026 · 0xb9c4…fa17" />
            <CoverRow k="RFC 3161 timestamp" v="2026-04-18T14:22:09Z" />
          </dl>
        </div>

        <div className="mt-6 mono text-[10.5px] text-slate-500 leading-[1.6]">
          END OF PACKET · {APPLICATION_META.id} · sealed {APPLICATION_META.lockAt}<br />
          Replay: <span className="text-slate-900">trust.vitalcv.io/packet/{APPLICATION_META.id}</span>
        </div>
      </div>

      <div className="flex items-center justify-between px-8 py-2.5 border-t border-slate-200 bg-slate-50">
        <div className="mono text-[9.5px] uppercase tracking-[0.14em] text-slate-500">CONFIDENTIAL · SUBMITTED UNDER PENALTY OF PERJURY</div>
        <div className="mono text-[10px] text-slate-500 tabular-nums">Page {String(pageN).padStart(2,'0')} of {String(totalPages).padStart(2,'0')}</div>
      </div>
    </section>
  );
}
