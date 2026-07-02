// SURFACE — /profile/:id — CAREER PROFILE (Wave 1000)
// A world-class living professional record. Not a résumé, not LinkedIn.
// Every section is longitudinal and source-bound.

const PROFILE_SECTIONS = [
  { id: 'identity',      label: 'Identity',      Icon: Icon.User },
  { id: 'education',     label: 'Education',     Icon: Icon.GraduationCap },
  { id: 'training',      label: 'Training',      Icon: Icon.Award },
  { id: 'licensure',     label: 'Licensure',     Icon: Icon.Stamp },
  { id: 'certifications',label: 'Certifications',Icon: Icon.Badge },
  { id: 'experience',    label: 'Experience',    Icon: Icon.Briefcase },
  { id: 'leadership',    label: 'Leadership',    Icon: Icon.Flag },
  { id: 'research',      label: 'Research',      Icon: Icon.Microscope },
  { id: 'teaching',      label: 'Teaching',      Icon: Icon.Book },
  { id: 'awards',        label: 'Awards',        Icon: Icon.Trophy },
  { id: 'organizations', label: 'Organizations', Icon: Icon.Building },
  { id: 'relationships', label: 'Relationships', Icon: Icon.Handshake },
  { id: 'trust',         label: 'Trust',         Icon: Icon.ShieldCheck },
];

/* ---------- Sticky section index ---------- */
function ProfileNav({ active }) {
  return (
    <nav className="sticky top-28 space-y-0.5">
      <Eyebrow className="px-3 mb-2">The record</Eyebrow>
      {PROFILE_SECTIONS.map(s => (
        <a key={s.id} href={`#sec-${s.id}`}
          className={cn('flex items-center gap-2.5 px-3 h-8 rounded-md text-[12.5px] font-medium transition-colors',
            active === s.id ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50')}>
          <s.Icon size={14} className={active === s.id ? 'text-slate-700' : 'text-slate-400'} />
          <span>{s.label}</span>
        </a>
      ))}
    </nav>
  );
}

/* ---------- Section frame ---------- */
function ProfileSection({ id, n, title, sub, count, children }) {
  return (
    <section id={`sec-${id}`} className="scroll-mt-28">
      <div className="flex items-end justify-between gap-4 mb-4 pb-2.5 border-b border-slate-900/90">
        <div className="flex items-baseline gap-3">
          <span className="mono text-[11px] uppercase tracking-[0.16em] text-slate-300 font-semibold">{n}</span>
          <div>
            <h2 className="text-[18px] font-semibold text-slate-900 tracking-tightish leading-tight">{title}</h2>
            {sub && <p className="text-[12.5px] text-slate-500 mt-0.5">{sub}</p>}
          </div>
        </div>
        {count != null && <span className="mono text-[10px] uppercase tracking-[0.12em] text-slate-400 flex-shrink-0">{count}</span>}
      </div>
      {children}
    </section>
  );
}

/* ---------- Record row (a verified line item) ---------- */
function RecordRow({ date, range, title, org, detail, state = 'verified', tags, right }) {
  return (
    <div className="border border-slate-200 rounded-lg bg-white px-5 py-4 hover:border-slate-300 transition-colors">
      <div className="flex items-start gap-4">
        <div className="mono text-[11px] text-slate-400 tabular-nums w-[88px] flex-shrink-0 pt-0.5">{range || date}</div>
        <div className="min-w-0 flex-1">
          <div className="text-[14px] font-semibold text-slate-900 leading-tight">{title}</div>
          {org && <div className="text-[12.5px] text-slate-500 mt-0.5">{org}</div>}
          {detail && <p className="text-[12px] text-slate-600 leading-[1.55] mt-2">{detail}</p>}
          {tags && tags.length > 0 && (
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {tags.map((t, i) => <span key={i} className="mono text-[10px] uppercase tracking-[0.06em] bg-slate-100 text-slate-600 rounded px-2 py-0.5">{t}</span>)}
            </div>
          )}
        </div>
        <div className="flex flex-col items-end gap-2 flex-shrink-0">
          <Chip state={state} size="sm" />
          {right}
        </div>
      </div>
    </div>
  );
}

function ViewProfile({ entity }) {
  const [active, setActive] = React.useState('identity');
  React.useEffect(() => {
    const obs = new IntersectionObserver(
      es => es.forEach(e => { if (e.isIntersecting) setActive(e.target.id.replace('sec-', '')); }),
      { rootMargin: '-30% 0px -60% 0px' }
    );
    PROFILE_SECTIONS.forEach(s => { const el = document.getElementById(`sec-${s.id}`); if (el) obs.observe(el); });
    return () => obs.disconnect();
  }, []);

  const byKind = k => EVENTS.filter(e => e.kind === k);
  const education = byKind('Education');
  const licensure = byKind('Licensure');
  const certs = byKind('Certification');
  const leadership = EVENTS.filter(e => e.dims.includes('leadership'));

  return (
    <div className="max-w-[1340px] mx-auto px-6 py-9">
      <div className="rise mb-8">
        <SurfaceIntro eyebrow="Career Profile · the living record"
          title={<>A professional record that <span className="text-slate-400">grows, never resets.</span></>}
          sub="Not a résumé you rewrite for each role. Not a profile you perform. A longitudinal record of a clinical career — every line dated, sourced, and owned. It compounds for forty years."
          right={<Button variant="outline" size="sm" iconLeft={<Icon.Download size={13} />}>Export verified record</Button>} />
      </div>

      <div className="grid grid-cols-12 gap-8">
        {/* Left index */}
        <aside className="hidden lg:block col-span-3 xl:col-span-2"><ProfileNav active={active} /></aside>

        {/* Record body */}
        <div className="col-span-12 lg:col-span-9 xl:col-span-10 space-y-12">
          {/* IDENTITY */}
          <ProfileSection id="identity" n="01" title="Identity" sub="Who the record belongs to — anchored, not asserted.">
            <div className="border border-slate-200 rounded-lg bg-white overflow-hidden">
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-slate-200">
                <div className="p-5">
                  <Eyebrow className="mb-2.5">Person</Eyebrow>
                  <KV k="Name" v={entity.fullName} />
                  <KV k="Credential" v={entity.credential} />
                  <KV k="Specialty" v="Cardiology" />
                </div>
                <div className="p-5">
                  <Eyebrow className="mb-2.5">Anchored identity</Eyebrow>
                  <KV k="NPI" v={<span className="mono text-[11px]">{entity.npi}</span>} />
                  <KV k="Enumerated" v={entity.enumerated} mono />
                  <KV k="Location" v={entity.city} />
                </div>
                <div className="p-5">
                  <Eyebrow className="mb-2.5">Owned ledger</Eyebrow>
                  <KV k="Ledger" v={<span className="mono text-[11px]">{entity.ledgerId.slice(0, 22)}…</span>} />
                  <KV k="Owned since" v={entity.ownerSince} mono />
                  <div className="mt-3 flex items-center gap-2 text-[11px] text-emerald-700"><Icon.ShieldCheck size={13} />Identity anchored at NPPES</div>
                </div>
              </div>
            </div>
          </ProfileSection>

          {/* EDUCATION */}
          <ProfileSection id="education" n="02" title="Education" sub="Degrees conferred — the foundation evidence." count={`${education.length} degrees`}>
            <div className="space-y-3">
              {education.map(e => <RecordRow key={e.id} range={e.year} title={e.title} org={e.org} detail={e.detail} tags={[e.source, e.tier]} />)}
            </div>
          </ProfileSection>

          {/* TRAINING */}
          <ProfileSection id="training" n="03" title="Training" sub="Postgraduate training that built clinical depth." count="1 fellowship">
            <div className="space-y-3">
              {byKind('Fellowship').map(e => <RecordRow key={e.id} range={e.year} title={e.title} org={e.org} detail={e.detail} tags={['Selective', e.source]} />)}
            </div>
          </ProfileSection>

          {/* LICENSURE */}
          <ProfileSection id="licensure" n="04" title="Licensure" sub="Authority to practice — issued by the state, unbroken." count={`${licensure.length} active`}>
            <div className="space-y-3">
              {licensure.map(e => <RecordRow key={e.id} range={e.year} title={e.title} org={e.org} detail={e.detail} tags={['In good standing', 'No disciplinary actions']}
                right={<span className="mono text-[10px] text-slate-400">renews 2027</span>} />)}
            </div>
          </ProfileSection>

          {/* CERTIFICATIONS */}
          <ProfileSection id="certifications" n="05" title="Certifications" sub="Board and federal credentials — primary-source sealed." count={`${certs.length} active`}>
            <div className="space-y-3">
              {certs.map(e => <RecordRow key={e.id} range={e.year} title={e.title} org={e.org} detail={e.detail} tags={[e.tier === 'T4' ? 'Primary-sealed · T4' : e.tier, e.source]} />)}
            </div>
          </ProfileSection>

          {/* EXPERIENCE */}
          <ProfileSection id="experience" n="06" title="Experience" sub="Positions held — duration is itself evidence." count={`${EXPERIENCE.length} positions`}>
            <div className="space-y-3">
              {EXPERIENCE.map(x => (
                <div key={x.id} className="border border-slate-200 rounded-lg bg-white px-5 py-4">
                  <div className="flex items-start gap-4">
                    <div className="mono text-[11px] text-slate-400 tabular-nums w-[88px] flex-shrink-0 pt-0.5">{x.start}–{x.end}</div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[14px] font-semibold text-slate-900 leading-tight">{x.title}</span>
                        {x.current && <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />}
                      </div>
                      <div className="text-[12.5px] text-slate-500 mt-0.5">{x.org}</div>
                      <p className="text-[12px] text-slate-600 leading-[1.55] mt-2">{x.summary}</p>
                      <ul className="mt-2.5 space-y-1">
                        {x.facts.map((f, i) => (
                          <li key={i} className="flex items-start gap-2 text-[12px] text-slate-700"><Icon.Check size={13} className="text-emerald-600 mt-0.5 flex-shrink-0" />{f}</li>
                        ))}
                      </ul>
                    </div>
                    <Chip state={x.state} size="sm" />
                  </div>
                </div>
              ))}
            </div>
          </ProfileSection>

          {/* LEADERSHIP */}
          <ProfileSection id="leadership" n="07" title="Leadership" sub="Responsibility entrusted — services led, scope expanded." count={`${leadership.length} on record`}>
            <div className="space-y-3">
              {leadership.map(e => <RecordRow key={e.id} range={e.year} title={e.title} org={e.org} detail={e.detail} state={e.state} tags={e.dims.map(d => DIM[d].label)} />)}
            </div>
          </ProfileSection>

          {/* RESEARCH / PUBLICATIONS */}
          <ProfileSection id="research" n="08" title="Research & Publications" sub="Contribution to the field — peer-reviewed, DOI-registered." count={`${PUBLICATIONS.length} works`}>
            <div className="space-y-3">
              {PUBLICATIONS.map(p => (
                <div key={p.id} className="border border-slate-200 rounded-lg bg-white px-5 py-4">
                  <div className="flex items-start gap-4">
                    <div className="mono text-[11px] text-slate-400 tabular-nums w-[88px] flex-shrink-0 pt-0.5">{p.year}</div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[13.5px] font-semibold text-slate-900 leading-snug">{p.title}</div>
                      <div className="text-[12px] text-slate-500 mt-1 italic">{p.venue}</div>
                      <div className="mt-2 flex items-center gap-2 flex-wrap">
                        <span className="mono text-[10px] uppercase tracking-[0.06em] bg-slate-100 text-slate-600 rounded px-2 py-0.5">{p.role}</span>
                        <span className="mono text-[10.5px] text-slate-400">DOI {p.doi}</span>
                        {p.cites > 0 && <span className="mono text-[10.5px] text-slate-500">· {p.cites} citations</span>}
                      </div>
                    </div>
                    <Chip state={p.state} size="sm" />
                  </div>
                </div>
              ))}
            </div>
          </ProfileSection>

          {/* TEACHING */}
          <ProfileSection id="teaching" n="09" title="Teaching" sub="Training the next generation — propagating practice beyond self.">
            <div className="grid sm:grid-cols-3 gap-4">
              {TEACHING.map(t => (
                <div key={t.id} className="border border-slate-200 rounded-lg bg-white p-5">
                  <div className="h-9 w-9 rounded-md bg-slate-900 text-white flex items-center justify-center mb-3"><IconFor name={t.icon} size={16} /></div>
                  <div className="text-[26px] font-semibold text-slate-900 tabular-nums leading-none">{t.value}</div>
                  <div className="text-[13px] font-medium text-slate-700 mt-1.5">{t.label}</div>
                  <div className="text-[11.5px] text-slate-500 mt-0.5">{t.sub}</div>
                </div>
              ))}
            </div>
          </ProfileSection>

          {/* AWARDS */}
          <ProfileSection id="awards" n="10" title="Awards & Recognition" sub="Esteem conferred by others — scarce, undecaying, cannot self-claim." count={`${RECOGNITION.length} conferred`}>
            <div className="space-y-3">
              {RECOGNITION.map(r => (
                <div key={r.id} className="border border-violet-200 bg-violet-50/40 rounded-lg px-5 py-4">
                  <div className="flex items-start gap-4">
                    <div className="mono text-[11px] text-slate-400 tabular-nums w-[88px] flex-shrink-0 pt-0.5">{r.year}</div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[14px] font-semibold text-slate-900 leading-tight">{r.title}</div>
                      <div className="text-[12.5px] text-slate-500 mt-0.5">{r.conferrer}</div>
                      <p className="text-[12px] text-slate-600 leading-[1.55] mt-2">{r.blurb}</p>
                    </div>
                    <div className="flex flex-col items-end gap-2 flex-shrink-0">
                      <Chip state="conferred" size="sm" />
                      <span className="mono text-[10px] uppercase tracking-[0.08em] text-violet-700">{r.selectivity}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ProfileSection>

          {/* ORGANIZATIONS */}
          <ProfileSection id="organizations" n="11" title="Organizations" sub="Every affiliation, active and past — the institutions served." count={`${ORGANIZATIONS.length} affiliations`}>
            <div className="grid sm:grid-cols-2 gap-3">
              {ORGANIZATIONS.map(o => (
                <div key={o.id} className="border border-slate-200 rounded-lg bg-white p-4 flex items-start gap-3">
                  <div className="h-10 w-10 rounded-md bg-slate-100 flex items-center justify-center flex-shrink-0"><IconFor name={o.icon} size={17} className="text-slate-700" /></div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-semibold text-slate-900 leading-tight">{o.name}</span>
                      {o.status === 'active' && <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 flex-shrink-0" />}
                    </div>
                    <div className="text-[11.5px] text-slate-500 mt-0.5">{o.role}</div>
                    <div className="mt-2 flex items-center gap-2 mono text-[10px] uppercase tracking-[0.1em] text-slate-400">
                      <span>{o.kind}</span><span>·</span><span>since {o.since}</span><span>·</span><span>{o.location}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ProfileSection>

          {/* RELATIONSHIPS */}
          <ProfileSection id="relationships" n="12" title="Professional Relationships" sub="The people who can attest — mentors, peers, supervisors." count={`${RELATIONSHIPS.length} ties`}>
            <div className="border border-slate-200 rounded-lg bg-white overflow-hidden divide-y divide-slate-100">
              {RELATIONSHIPS.map(r => (
                <div key={r.id} className="px-5 py-3.5 flex items-center gap-3.5">
                  <div className="h-10 w-10 rounded-full bg-slate-900 text-white flex items-center justify-center mono text-[12px] font-semibold flex-shrink-0">{r.initials}</div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-semibold text-slate-900 leading-tight">{r.name}</div>
                    <div className="text-[11.5px] text-slate-500">{r.role} · {r.org}</div>
                  </div>
                  <div className="hidden sm:block text-right flex-shrink-0">
                    <div className="mono text-[9px] uppercase tracking-[0.1em] text-slate-400">attests</div>
                    <div className="text-[11px] text-slate-600 mt-0.5">{r.attests}</div>
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0 w-[88px]">
                    <span className="mono text-[10px] uppercase tracking-[0.1em] text-slate-500">{r.tie}</span>
                    {r.willRef && <span className="inline-flex items-center gap-1 text-[10.5px] text-emerald-700"><Icon.Check size={11} />will reference</span>}
                  </div>
                </div>
              ))}
            </div>
          </ProfileSection>

          {/* TRUST */}
          <ProfileSection id="trust" n="13" title="Trust" sub="How believable the whole record is — computed, fresh, owned.">
            <div className="grid lg:grid-cols-12 gap-5">
              <div className="lg:col-span-5 border border-slate-200 rounded-lg bg-slate-950 text-white p-6 flex flex-col justify-between">
                <div>
                  <Eyebrow className="text-slate-400 mb-2">Composite trust index</Eyebrow>
                  <div className="text-[52px] font-semibold tracking-tight leading-none tabular-nums">{CAREER_STATE.trustScore}</div>
                  <p className="text-[12.5px] text-slate-400 mt-3 leading-snug">{CAREER_STATE.trustNote}. Every fact is re-read on a schedule — trust decays and refreshes, it is never assumed.</p>
                </div>
                <div className="mt-6 flex items-center gap-2 text-[11px] text-emerald-400"><Icon.ShieldCheck size={13} />All authority evidence fresh</div>
              </div>
              <div className="lg:col-span-7 border border-slate-200 rounded-lg bg-white p-5">
                <Eyebrow className="mb-3">Seven dimensions vs. field median</Eyebrow>
                <div className="space-y-2.5">
                  {DIMENSIONS.map(d => (
                    <div key={d.key} className="flex items-center gap-2.5">
                      <span className="text-[11.5px] text-slate-600 w-[84px] flex-shrink-0">{d.label}</span>
                      <Bar value={d.value} median={d.median} />
                      <span className="mono text-[10px] text-slate-400 tabular-nums w-5 text-right flex-shrink-0">{d.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </ProfileSection>

          <div className="border-t border-slate-200 pt-6 text-center">
            <p className="text-[12px] text-slate-500 max-w-[64ch] mx-auto leading-[1.6]">
              This record is <span className="text-slate-900 font-medium">projected, not stored</span> — recomputed from the owned ledger on every read. It travels with the clinician across every employer, state, and specialty, for the length of a career.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

window.ViewProfile = ViewProfile;
