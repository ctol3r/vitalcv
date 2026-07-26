// Wave 10 — The Application
// CAQH-style long-form intake packet. Numbered sections, labeled fields, per-field status,
// per-section attestation strip, final consolidated release + signature.

/* ---------- Section header (shared across packet pages) ---------- */
function ApplicationSectionHeader({ section, stats, mode }) {
  const pct = stats.pct;
  return (
    <header className="mb-5">
      <div className="flex items-baseline justify-between gap-4 flex-wrap">
        <div>
          <div className="mono text-[11px] uppercase tracking-[0.18em] text-slate-500">
            Section {section.n}
          </div>
          <h2 className="mt-1 text-[22px] font-semibold tracking-[-0.02em] text-slate-900 leading-tight">
            {section.label}
          </h2>
        </div>
        {/* Section completion */}
        <div className="flex items-center gap-2 whitespace-nowrap">
          <span className={cn(
            'mono text-[10px] uppercase tracking-[0.14em] border rounded-[3px] px-1.5 py-[2px] font-semibold',
            pct === 100
              ? 'border-emerald-700 text-emerald-800 bg-emerald-50'
              : pct >= 50
              ? 'border-amber-700 text-amber-900 bg-amber-50'
              : 'border-slate-400 text-slate-600 bg-white'
          )}>
            [ {pct === 100 ? 'COMPLETE' : 'PARTIAL'} · {pct}% ]
          </span>
          <span className="mono text-[11px] text-slate-500 tabular-nums">
            {stats.complete}/{stats.total}
          </span>
        </div>
      </div>
      {section.subtitle && (
        <p className="text-[12.5px] text-slate-600 mt-1.5 leading-[1.55] max-w-[62ch]">
          {section.subtitle}
        </p>
      )}
      <div className="mt-4 h-px bg-slate-900" />
    </header>
  );
}
window.ApplicationSectionHeader = ApplicationSectionHeader;

/* ---------- Field group (label + labeled field rows) ---------- */
function FieldGroup({ group, mode }) {
  return (
    <div className="mb-5 last:mb-0">
      <div className="mono text-[10px] uppercase tracking-[0.14em] text-slate-500 mb-2 flex items-start gap-2">
        <span className="tabular-nums text-slate-400 flex-shrink-0">{group.id}</span>
        <span className="leading-[1.4]">{group.label}</span>
      </div>
      <div className="border border-slate-300">
        <ul className="divide-y divide-slate-200">
          {group.fields.map(f => <FieldRow key={f.id} field={f} mode={mode} />)}
        </ul>
      </div>
    </div>
  );
}
window.FieldGroup = FieldGroup;

/* ---------- Single field row ---------- */
function FieldRow({ field, mode }) {
  const empty = !field.value;
  const pending = field.status === 'pending';
  return (
    <li className="grid grid-cols-[240px_1fr_110px] items-start">
      <div className="px-3 py-2.5 border-r border-slate-200 bg-slate-50/60 flex flex-col gap-1.5">
        <div className="flex items-baseline gap-1.5">
          <span className="mono text-[10px] tabular-nums text-slate-400 flex-shrink-0">{field.id}</span>
          <span className="text-[11.5px] text-slate-700 leading-snug">{field.label}</span>
        </div>
        {field.required && (
          <span className="mono text-[9px] uppercase tracking-[0.14em] text-slate-500 self-start">
            [ required ]
          </span>
        )}
      </div>
      <div className="px-3 py-2.5">
        {mode === 'clinician' && !field.value
          ? <ClinicianInput field={field} />
          : <div className={cn(
              'text-[13px] leading-snug break-words',
              empty ? 'text-slate-400 italic' : 'text-slate-900',
              field.id.endsWith('SSN') && 'mono tabular-nums'
            )}>
              {field.value || '— not provided —'}
            </div>}
        {field.note && (
          <div className="mono text-[10.5px] text-slate-500 mt-1.5 leading-snug">
            {field.note}
          </div>
        )}
        {field.redline && (
          <div className="mt-2 border-l-2 border-red-700 bg-red-50 pl-3 pr-3 py-2">
            <div className="mono text-[9.5px] uppercase tracking-[0.14em] text-red-800 font-semibold">Redline · reviewer</div>
            <div className="text-[11.5px] text-red-900 mt-1 leading-[1.55]">{field.redline}</div>
          </div>
        )}
      </div>
      <div className="px-3 py-2.5 border-l border-slate-200 flex items-start justify-center">
        <FieldStatusPill status={field.status} pending={pending} empty={empty} />
      </div>
    </li>
  );
}

function FieldStatusPill({ status, pending, empty }) {
  if (empty) return <span className="mono text-[9.5px] uppercase tracking-[0.14em] border border-slate-300 text-slate-400 rounded-[3px] px-1.5 py-[2px] whitespace-nowrap">[ empty ]</span>;
  if (pending) return <span className="mono text-[9.5px] uppercase tracking-[0.14em] border border-amber-700 text-amber-900 bg-amber-50 rounded-[3px] px-1.5 py-[2px] font-semibold whitespace-nowrap">[ pending ]</span>;
  return <span className="mono text-[9.5px] uppercase tracking-[0.14em] border border-slate-900 text-slate-900 rounded-[3px] px-1.5 py-[2px] font-semibold whitespace-nowrap">[ attested ]</span>;
}

function ClinicianInput({ field }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-8 border border-dashed border-slate-400 bg-slate-50 rounded px-2 flex items-center">
        <span className="text-[11.5px] text-slate-400">Enter {field.label.toLowerCase()}…</span>
      </div>
    </div>
  );
}

/* ---------- Per-section attestation strip ----------
 * Every real application has one of these after each section: the applicant
 * initials and certifies the section is complete and accurate.
 */
function SectionAttestationStrip({ section, attested = true }) {
  return (
    <div className={cn(
      'mt-6 border flex items-center gap-4 px-4 py-3',
      attested ? 'border-slate-900 bg-slate-50/80' : 'border-dashed border-slate-400 bg-white'
    )}>
      <div className="flex-shrink-0">
        <div className="mono text-[9px] uppercase tracking-[0.16em] text-slate-500">Section attest</div>
        <div className="text-[12px] text-slate-900 font-semibold leading-tight">{section.n} · {section.label}</div>
      </div>
      <div className="flex-1 relative pt-4 pb-1">
        {attested ? (
          <>
            <span className="absolute left-2 top-0 text-[18px] text-slate-800 select-none pointer-events-none leading-none"
                  style={{ fontFamily: "'Caveat', 'Snell Roundhand', cursive", fontWeight: 600 }}>
              M.M.
            </span>
            <div className="h-px bg-slate-900 mt-3" />
            <div className="mono text-[9px] uppercase tracking-[0.14em] text-slate-500 mt-1 flex justify-between">
              <span>Initial</span>
              <span>2026-04-18 · 14:18 UTC</span>
            </div>
          </>
        ) : (
          <>
            <div className="h-px bg-slate-400 mt-5" />
            <div className="mono text-[9px] uppercase tracking-[0.14em] text-slate-400 mt-1">
              Not yet initialed
            </div>
          </>
        )}
      </div>
      <div className="flex-shrink-0">
        {attested
          ? <span className="mono text-[9.5px] uppercase tracking-[0.14em] border border-emerald-700 text-emerald-800 bg-emerald-50 rounded-[3px] px-1.5 py-[2px] font-semibold whitespace-nowrap">[ CERTIFIED ]</span>
          : <button className="mono text-[9.5px] uppercase tracking-[0.14em] border border-slate-900 text-slate-900 bg-white hover:bg-slate-50 rounded-[3px] px-2 py-[3px] font-semibold">Initial to certify</button>}
      </div>
    </div>
  );
}
window.SectionAttestationStrip = SectionAttestationStrip;

/* ---------- Disclosure section (§H) ----------
 * Re-uses ATTESTATION_QUESTIONS. Render with Yes/No pills, material flags, and the
 * explanation callout where present.
 */
function DisclosureQuestions() {
  return (
    <div className="border border-slate-900">
      <div className="grid grid-cols-[60px_1fr_90px_90px] bg-slate-950 text-slate-100 mono text-[9.5px] uppercase tracking-[0.14em]">
        <div className="px-3 py-2">#</div>
        <div className="px-3 py-2">Declaration</div>
        <div className="px-3 py-2 text-center">Answer</div>
        <div className="px-3 py-2 text-center">Material</div>
      </div>
      <ul className="divide-y divide-slate-200">
        {ATTESTATION_QUESTIONS.map(q => (
          <li key={q.id} className="grid grid-cols-[60px_1fr_90px_90px] items-start">
            <div className="px-3 py-3 mono text-[11px] text-slate-500 tabular-nums">{q.id}</div>
            <div className="px-3 py-3 text-[12.5px] text-slate-900 leading-[1.5]">
              {q.q}
              {q.explanation && (
                <div className="mt-2 border-l-2 border-amber-600 bg-amber-50 pl-3 pr-3 py-2">
                  <div className="mono text-[9.5px] uppercase tracking-[0.14em] text-amber-800 font-semibold">Explanation attached</div>
                  <div className="text-[11.5px] text-amber-900 mt-1 leading-[1.55]">{q.explanation}</div>
                </div>
              )}
            </div>
            <div className="px-3 py-3 flex items-center justify-center">
              <AttestationAnswer answer={q.answer} />
            </div>
            <div className="px-3 py-3 flex items-center justify-center">
              {q.material
                ? <span className="mono text-[10px] uppercase tracking-[0.12em] text-slate-900 border border-slate-900 rounded-[3px] px-1.5 py-[2px]">MATERIAL</span>
                : <span className="mono text-[10px] uppercase tracking-[0.12em] text-slate-400">—</span>}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
window.DisclosureQuestions = DisclosureQuestions;

// AttestationAnswer was defined in wave9; expose locally via window-fallback
function AttestationAnswer({ answer }) {
  const map = {
    yes:        { label: 'YES',        tone: 'emerald' },
    no:         { label: 'NO',         tone: 'amber'   },
    authorized: { label: 'AUTHORIZED', tone: 'slate'   },
    certified:  { label: 'CERTIFIED',  tone: 'slate'   },
  };
  const m = map[answer] || { label: '—', tone: 'slate' };
  const tone = {
    emerald: 'border-emerald-700 text-emerald-800 bg-emerald-50',
    amber:   'border-amber-700  text-amber-900  bg-amber-50',
    slate:   'border-slate-900  text-slate-900  bg-white',
  }[m.tone];
  return (
    <span className={cn('mono text-[10px] uppercase tracking-[0.16em] font-semibold border rounded-[3px] px-1.5 py-[3px] whitespace-nowrap', tone)}>
      [ {m.label} ]
    </span>
  );
}

/* ---------- Release & Signature (§J) ---------- */
function ReleaseAndSignature() {
  return (
    <div className="space-y-6">
      {/* Release text */}
      <div className="border border-slate-900 p-5 bg-slate-50/60">
        <div className="mono text-[9.5px] uppercase tracking-[0.18em] text-slate-500 mb-2">Authorization &amp; Release</div>
        <p className="text-[12.5px] text-slate-900 leading-[1.65]">
          I, <span className="font-semibold">Macie Elizabeth Miller, PA-C</span>, authorize
          Cedar Health System and its designated credentialing verification organization
          (VitalCV, Inc., acting as delegated CVO under NCQA CR §4.2) to obtain, from any
          source it deems appropriate, any information bearing on my professional
          qualifications, competence, character, or ability to carry out the privileges
          for which I have applied. I release all individuals and organizations providing
          information from any liability arising from the release or use of such
          information, and I waive any right to inspect recommendations and references
          submitted under this authorization.
        </p>
        <p className="text-[12.5px] text-slate-900 leading-[1.65] mt-3">
          I certify that the information contained in this application is complete,
          accurate, and current as of the date of signature. I understand that
          misstatement of, or omission from, any application information constitutes
          cause for denial of appointment or termination of existing privileges. I agree
          to notify the Medical Staff Office in writing within 30 days of any material
          change to the information provided.
        </p>
      </div>

      {/* Signature blocks */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <SignatureBlock
          who="Applicant"
          name="Miller, Macie · PA-C"
          role="Physician Assistant"
          date={APPLICATION_META.submittedAt.split(' ')[0]}
          script="Macie Miller"
          meta={[
            { k: 'IP address',   v: '98.37.12.44' },
            { k: 'User agent',   v: 'macOS 15.2 · Safari 18.3' },
            { k: 'Signature',    v: 'ed25519:applicant/0x6a12…d74c', mono: true },
            { k: 'Timestamp',    v: 'RFC 3161 · 2026-04-18T14:22:09Z', mono: true },
          ]}
        />
        <SignatureBlock
          who="Received by"
          name="Cedar Health System · MSO"
          role="Medical Staff Office"
          date="2026-04-18"
          seal
          meta={[
            { k: 'Received by',  v: 'Okafor, Jordan · Credentialing Specialist' },
            { k: 'Packet ID',    v: APPLICATION_META.id, mono: true },
            { k: 'Lock at',      v: APPLICATION_META.lockAt, mono: true },
            { k: 'Counter-sig',  v: 'ed25519:cedar/mso/2026 · 0xb9c4…fa17', mono: true },
          ]}
        />
      </div>
    </div>
  );
}
window.ReleaseAndSignature = ReleaseAndSignature;

/* ---------- Section dispatch ---------- */
function ApplicationSectionBody({ section, mode }) {
  if (section.disclosureSection) return <DisclosureQuestions />;
  if (section.releaseSection)    return <ReleaseAndSignature />;
  return (
    <>
      {(section.groups || []).map(g => <FieldGroup key={g.id} group={g} mode={mode} />)}
    </>
  );
}
window.ApplicationSectionBody = ApplicationSectionBody;
