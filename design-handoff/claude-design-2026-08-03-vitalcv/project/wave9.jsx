// Wave 9 — Credentialing File
// Renders VitalCV as a foliated credentialing file: cover, TOC, attestation, missing fields,
// audit log, signatures/seals. Compliance-grade chrome — tabular mono, stamp-ink, numbered pages.

/* ---------- File chrome wrappers ---------- */

function FilePage({ n, total, sectionRef, sectionLabel, children, kind = 'body' }) {
  return (
    <section
      id={sectionRef}
      className={cn(
        'bg-white border border-slate-300 shadow-[0_1px_0_0_rgba(15,23,42,0.04)]',
        'mx-auto max-w-[920px] my-4 relative'
      )}
    >
      {/* Page header strip */}
      <div className="flex items-center justify-between px-8 pt-5 pb-3 border-b border-slate-200">
        <div className="mono text-[10px] uppercase tracking-[0.18em] text-slate-500">
          VCV Credentialing File · {FILE_META.id}
        </div>
        <div className="mono text-[10px] uppercase tracking-[0.14em] text-slate-500">
          {sectionLabel}
        </div>
      </div>
      <div className="px-8 py-6">
        {children}
      </div>
      {/* Page footer strip */}
      <div className="flex items-center justify-between px-8 py-2.5 border-t border-slate-200 bg-slate-50">
        <div className="mono text-[9.5px] uppercase tracking-[0.14em] text-slate-500">
          {FILE_META.classification}
        </div>
        <div className="mono text-[10px] text-slate-500 tabular-nums">
          Page {String(n).padStart(2, '0')} of {String(total).padStart(2, '0')}
        </div>
      </div>
    </section>
  );
}
window.FilePage = FilePage;

/* ---------- Section header inside a page ---------- */
function FileSectionHeader({ n, title, sub }) {
  return (
    <header className="mb-5">
      <div className="mono text-[11px] uppercase tracking-[0.18em] text-slate-500">Section {n}</div>
      <h2 className="mt-1 text-[22px] font-semibold tracking-[-0.02em] text-slate-900 leading-tight">{title}</h2>
      {sub && <p className="text-[12.5px] text-slate-600 mt-1.5 leading-[1.55]">{sub}</p>}
      <div className="mt-4 h-px bg-slate-900" />
    </header>
  );
}
window.FileSectionHeader = FileSectionHeader;

/* ---------- Cover sheet ----------
 * Front matter. Every real cred file has one.
 */
function FileCoverSheet() {
  return (
    <FilePage n={1} total={17} sectionRef="sec-cover" sectionLabel="§1 Cover Sheet">
      <div className="pt-4 pb-3 text-center">
        <div className="mono text-[11px] uppercase tracking-[0.24em] text-slate-500">VitalCV Trust Registry</div>
        <div className="mono text-[11px] uppercase tracking-[0.2em] text-slate-400 mt-1">Node 202 · Delegated CVO · NCQA CR §3 / §4.2</div>

        <div className="mt-10">
          <div className="mono text-[11px] uppercase tracking-[0.2em] text-slate-500">Credentialing File</div>
          <h1 className="mt-4 text-[34px] md:text-[44px] font-semibold tracking-[-0.03em] text-slate-900 leading-[1.05]">
            Miller, Macie
            <span className="block text-slate-400 text-[22px] md:text-[26px] tracking-[-0.01em] font-normal mt-1">Physician Assistant · PA-C</span>
          </h1>
        </div>

        <div className="mt-8 flex items-center justify-center gap-6 flex-wrap">
          <T4Seal size={96} />
          <div className="h-24 w-px bg-slate-200 hidden md:block" />
          <GateStamp state="closed" size={80} />
        </div>
      </div>

      {/* Fact table — the numbered front matter */}
      <div className="mt-10 border-t border-b border-slate-900">
        <dl className="divide-y divide-slate-200 mono">
          <CoverRow k="File ID"              v={FILE_META.id} highlight />
          <CoverRow k="Revision"             v={`v${FILE_META.version} · last revised ${FILE_META.lastRevised}`} />
          <CoverRow k="Opened"               v={FILE_META.opened} />
          <CoverRow k="Applicant · Legal Name" v={`${PROVIDER.fullName}, ${PROVIDER.credential}`} />
          <CoverRow k="NPI"                  v={PROVIDER.npi} />
          <CoverRow k="Taxonomy"             v={PROVIDER.taxonomy} />
          <CoverRow k="Record Type"          v={FILE_META.recordType} />
          <CoverRow k="Review Cycle"         v={FILE_META.reviewCycle} />
          <CoverRow k="Custodian · Registry" v={FILE_META.custodian} />
          <CoverRow k="Custodian · Reviewing Org" v={FILE_META.custodianOrg} />
          <CoverRow k="Classification"       v={FILE_META.classification} danger />
        </dl>
      </div>

      {/* Table of contents */}
      <div className="mt-10">
        <div className="mono text-[11px] uppercase tracking-[0.18em] text-slate-500 mb-3">Contents</div>
        <ol className="border border-slate-200 rounded">
          {FILE_TOC.map((t, i) => (
            <li key={t.id}
              className={cn('flex items-baseline gap-4 px-4 py-2.5', i < FILE_TOC.length - 1 && 'border-b border-slate-100')}>
              <span className="mono text-[10.5px] text-slate-400 tabular-nums w-8">{t.n}</span>
              <a href={`#sec-${t.id}`}
                className="flex-1 text-[13px] text-slate-900 hover:text-slate-950 border-b border-dotted border-slate-200">
                {t.label}
              </a>
              <span className="mono text-[10.5px] text-slate-400 tabular-nums">pp. {t.pages}</span>
            </li>
          ))}
        </ol>
      </div>

      {/* Privilege notice */}
      <div className="mt-10 border border-slate-900 bg-slate-50 px-5 py-4">
        <div className="mono text-[9.5px] uppercase tracking-[0.18em] text-slate-900 font-semibold">
          ☐ Confidential · Peer-Review Privileged Material
        </div>
        <p className="mono text-[10.5px] text-slate-700 mt-2 leading-[1.6]">
          This record contains primary-source-verified credentialing material protected under
          applicable state peer-review statutes and HIPAA §164.512. Unauthorized disclosure,
          reproduction, or redistribution is prohibited. All access is logged and cryptographically
          signed in Section 7 · Chain of Custody.
        </p>
      </div>
    </FilePage>
  );
}
window.FileCoverSheet = FileCoverSheet;

function CoverRow({ k, v, highlight, danger }) {
  return (
    <div className="grid grid-cols-[220px_1fr] items-baseline">
      <dt className="px-2 py-2.5 text-[10px] uppercase tracking-[0.14em] text-slate-500">{k}</dt>
      <dd className={cn('px-2 py-2.5 text-[12.5px] break-words text-slate-900',
        highlight && 'font-semibold text-[13px]',
        danger && 'font-semibold'
      )}>
        {v}
      </dd>
    </div>
  );
}
window.CoverRow = CoverRow;

/* ---------- Attestation section ----------
 * Signed clinician attestation. The heart of any cred file.
 */
function AttestationSection({ pageN = 12 }) {
  return (
    <FilePage n={pageN} total={17} sectionRef="sec-attestation" sectionLabel="§5 Attestation & Authorization">
      <FileSectionHeader
        n="§5"
        title="Attestation &amp; Release"
        sub="The applicant answers under penalty of perjury. Material YES to Q3–Q6 requires written explanation and triggers committee review per NCQA CR 3 §B.6."
      />

      {/* Attestation table */}
      <div className="border border-slate-900">
        {/* Column head */}
        <div className="grid grid-cols-[60px_1fr_90px_90px] bg-slate-950 text-slate-100 mono text-[9.5px] uppercase tracking-[0.14em]">
          <div className="px-3 py-2">#</div>
          <div className="px-3 py-2">Declaration</div>
          <div className="px-3 py-2 text-center">Answer</div>
          <div className="px-3 py-2 text-center">Material</div>
        </div>

        <ul className="divide-y divide-slate-200">
          {ATTESTATION_QUESTIONS.map((q) => (
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

      {/* Signature block */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
        <SignatureBlock
          who="Applicant"
          name={PROVIDER.fullName + ', PA-C'}
          role="Physician Assistant"
          date="2026-04-18"
          meta={[
            { k: 'IP address',    v: '98.37.12.44' },
            { k: 'User agent',    v: 'macOS 15.2 · Safari 18.3' },
            { k: 'Signature',     v: 'ed25519:applicant/0x6a12…d74c', mono: true },
          ]}
          script="Macie Miller"
        />
        <SignatureBlock
          who="Witnessed by"
          name="VitalCV Trust Registry · Node 202"
          role="Signing Authority"
          date="2026-04-18"
          meta={[
            { k: 'Notary',        v: 'Registry Auto-Notary v1.4' },
            { k: 'Counter-sig',   v: 'ed25519:vitalcv/sor/prod/202 · 0x01b4…fe29', mono: true },
            { k: 'Timestamp',     v: 'RFC 3161 · 2026-04-18T14:22:09Z', mono: true },
          ]}
          seal
        />
      </div>
    </FilePage>
  );
}
window.AttestationSection = AttestationSection;

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

function SignatureBlock({ who, name, role, date, meta = [], script, seal }) {
  return (
    <div className="border border-slate-900 p-5 bg-white">
      <div className="mono text-[9.5px] uppercase tracking-[0.18em] text-slate-500 mb-1">{who}</div>
      <div className="text-[13.5px] font-semibold text-slate-900">{name}</div>
      <div className="text-[11.5px] text-slate-500">{role} · {date}</div>

      {/* Signature line — generous vertical room for handwriting / seal */}
      <div className="mt-6 relative pt-10 pr-16">
        {script && (
          <span className="absolute left-2 top-0 text-[26px] text-slate-800 select-none pointer-events-none leading-none" style={{ fontFamily: "'Caveat', 'Snell Roundhand', cursive", fontWeight: 600 }}>
            {script}
          </span>
        )}
        {seal && (
          <div className="absolute right-0 -top-1 opacity-90 pointer-events-none">
            <T4Seal size={52} />
          </div>
        )}
        <div className="h-px bg-slate-900" />
        <div className="mono text-[9.5px] uppercase tracking-[0.14em] text-slate-500 mt-1.5 flex justify-between">
          <span>Signature</span>
          <span>Date</span>
        </div>
      </div>

      {/* Meta — stacked rows so long hashes don't collide with labels */}
      <dl className="mt-4 border-t border-slate-200 pt-3 space-y-2">
        {meta.map((m, i) => (
          <div key={i}>
            <dt className="mono text-[9.5px] uppercase tracking-[0.12em] text-slate-500">{m.k}</dt>
            <dd className={cn('text-[11px] text-slate-800 break-all leading-snug mt-0.5', m.mono && 'mono tabular-nums')}>{m.v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
window.SignatureBlock = SignatureBlock;

/* ---------- Missing fields / outstanding items ----------
 * Line-item ledger. Printed, not a modal.
 */
function MissingFieldsPanel({ pageN = 14 }) {
  const required = MISSING_FIELDS.filter(f => f.priority === 'required');
  const optional = MISSING_FIELDS.filter(f => f.priority === 'optional');

  return (
    <FilePage n={pageN} total={17} sectionRef="sec-missing" sectionLabel="§6 Outstanding Items">
      <FileSectionHeader
        n="§6"
        title="Outstanding Items"
        sub={`${required.length} required, ${optional.length} optional. Required items must be cleared before the Medical Staff Office may recommend appointment.`}
      />

      <MissingFieldsTable items={required} heading="Required · blocks acceptance" required />

      {optional.length > 0 && (
        <div className="mt-8">
          <MissingFieldsTable items={optional} heading="Supplementary · does not block acceptance" />
        </div>
      )}

      {/* Legend */}
      <div className="mt-6 flex items-center gap-5 flex-wrap text-[11.5px] text-slate-500">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 border border-slate-900 bg-white" />
          <span>Open</span>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 border border-slate-900 bg-slate-900 rounded-[1px] flex items-center justify-center">
            <svg viewBox="0 0 10 10" width="8" height="8" className="text-white"><path d="M1 5 L4 8 L9 2" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </span>
          <span>Cleared</span>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="mono uppercase tracking-[0.14em] text-[9.5px] border border-slate-900 rounded-[3px] px-1.5 py-[1px]">EMP</span>
          <span>Employer action</span>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="mono uppercase tracking-[0.14em] text-[9.5px] border border-slate-500 rounded-[3px] px-1.5 py-[1px]">CLN</span>
          <span>Clinician action</span>
        </span>
      </div>
    </FilePage>
  );
}
window.MissingFieldsPanel = MissingFieldsPanel;

function MissingFieldsTable({ items, heading, required }) {
  return (
    <div>
      <div className="mono text-[11px] uppercase tracking-[0.14em] text-slate-500 mb-2">{heading}</div>
      <div className={cn('border', required ? 'border-slate-900' : 'border-slate-300')}>
        <div className={cn('grid grid-cols-[34px_34px_120px_1fr_110px_110px] mono text-[9.5px] uppercase tracking-[0.12em]',
          required ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-500')}>
          <div className="px-3 py-2">#</div>
          <div className="px-2 py-2 text-center">✓</div>
          <div className="px-3 py-2">Section</div>
          <div className="px-3 py-2">Missing item</div>
          <div className="px-3 py-2">Owner</div>
          <div className="px-3 py-2">Due</div>
        </div>
        <ul className="divide-y divide-slate-200">
          {items.map((m, i) => (
            <li key={m.id} className="grid grid-cols-[34px_34px_120px_1fr_110px_110px] items-start">
              <div className="px-3 py-3 mono text-[10.5px] text-slate-400 tabular-nums">{String(i + 1).padStart(2, '0')}</div>
              <div className="px-2 py-3 flex items-start justify-center">
                <span className="inline-block h-3.5 w-3.5 border border-slate-900 bg-white mt-0.5" />
              </div>
              <div className="px-3 py-3 mono text-[10.5px] uppercase tracking-[0.1em] text-slate-600">{m.section}</div>
              <div className="px-3 py-3">
                <div className="text-[12.5px] text-slate-900 font-medium leading-tight">{m.field}</div>
                <div className="text-[11.5px] text-slate-500 leading-snug mt-1">{m.note}</div>
              </div>
              <div className="px-3 py-3">
                <OwnerPill owner={m.owner} />
              </div>
              <div className="px-3 py-3 mono text-[11px] text-slate-700 tabular-nums">{m.due}</div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function OwnerPill({ owner }) {
  const map = {
    Clinician: { short: 'CLN', cls: 'border-slate-500  text-slate-700' },
    Employer:  { short: 'EMP', cls: 'border-slate-900  text-slate-900' },
    Auto:      { short: 'SYS', cls: 'border-slate-300  text-slate-500' },
  };
  const m = map[owner] || map.Auto;
  return (
    <span className={cn('mono text-[10px] uppercase tracking-[0.12em] border rounded-[3px] px-1.5 py-[2px] whitespace-nowrap bg-white', m.cls)}>
      [ {m.short} ] {owner}
    </span>
  );
}
window.OwnerPill = OwnerPill;

/* ---------- Chain of Custody / Audit Log ---------- */
function ChainOfCustody({ pageN = 15 }) {
  return (
    <FilePage n={pageN} total={17} sectionRef="sec-chain" sectionLabel="§7 Chain of Custody">
      <FileSectionHeader
        n="§7"
        title="Chain of Custody &amp; Audit Log"
        sub="Every event that touched this file, in order. Entries are append-only, ed25519-signed, and externally replayable."
      />

      <div className="border border-slate-900">
        <div className="grid grid-cols-[170px_170px_110px_1fr] bg-slate-950 text-slate-100 mono text-[9.5px] uppercase tracking-[0.14em]">
          <div className="px-3 py-2">Timestamp</div>
          <div className="px-3 py-2">Actor</div>
          <div className="px-3 py-2">Role</div>
          <div className="px-3 py-2">Event</div>
        </div>
        <ul className="divide-y divide-slate-100">
          {AUDIT_LOG.map((e, i) => (
            <li key={i} className="grid grid-cols-[170px_170px_110px_1fr] items-start">
              <div className="px-3 py-2.5 mono text-[11px] text-slate-700 tabular-nums">{e.t}</div>
              <div className="px-3 py-2.5 text-[12px] text-slate-900">{e.actor}</div>
              <div className="px-3 py-2.5 mono text-[10px] uppercase tracking-[0.12em] text-slate-500">{e.role}</div>
              <div className="px-3 py-2.5 text-[12px] text-slate-700">{e.event}</div>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-5 mono text-[10.5px] text-slate-500 leading-[1.6]">
        Entries are anchored to a Merkle log published hourly at{' '}
        <span className="text-slate-900">trust.vitalcv.io/log/202</span>. Log root as of
        this print: <span className="text-slate-900 tabular-nums">{ACCEPTANCE_RECEIPT.merkleRoot}</span>.
      </div>
    </FilePage>
  );
}
window.ChainOfCustody = ChainOfCustody;

/* ---------- Seals page ---------- */
function SealsPage({ pageN = 17 }) {
  return (
    <FilePage n={pageN} total={17} sectionRef="sec-seal" sectionLabel="§8 Signatures & Seals">
      <FileSectionHeader n="§8" title="Signatures & Seals" sub="Primary-sealed by the issuing authorities. No further verification required for T4 lanes." />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="border border-slate-900 p-5 flex items-center gap-5">
          <T4Seal size={96} />
          <div>
            <div className="mono text-[9.5px] uppercase tracking-[0.18em] text-slate-500">Primary-Sealed</div>
            <div className="text-[14px] font-semibold text-slate-900 mt-1 leading-tight">VitalCV Trust Registry</div>
            <div className="mono text-[10.5px] text-slate-600 mt-0.5 break-all">{ACCEPTANCE_RECEIPT.counterSeal}</div>
          </div>
        </div>
        <div className="border border-slate-900 p-5 flex items-center gap-5">
          <GateStamp state="closed" size={80} />
          <div>
            <div className="mono text-[9.5px] uppercase tracking-[0.18em] text-slate-500">Acceptance Gate · Current</div>
            <div className="text-[14px] font-semibold text-slate-900 mt-1 leading-tight">Not ready for acceptance</div>
            <div className="text-[11.5px] text-slate-600 mt-1 leading-snug">Outstanding items in §6 must be cleared before final sign-off.</div>
          </div>
        </div>
      </div>

      <div className="mt-8 border-t border-slate-900 pt-4 mono text-[10px] text-slate-500 leading-[1.6]">
        END OF FILE · {FILE_META.id} · v{FILE_META.version} · {FILE_META.lastRevised}<br />
        Replay: <span className="text-slate-900">trust.vitalcv.io/file/{FILE_META.id}</span> ·
        Fingerprint: <span className="text-slate-900 tabular-nums">{ACCEPTANCE_RECEIPT.seal}</span>
      </div>
    </FilePage>
  );
}
window.SealsPage = SealsPage;
