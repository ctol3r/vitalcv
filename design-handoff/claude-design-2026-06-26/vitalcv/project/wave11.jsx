// Wave 11 — Committee Review
// The ceremonial artifact. Board memorandum with numbered resolutions, exhibits index,
// recommendation stamp, committee roster. Serif body, seal-ink tone, official feel.

/* Cedar Health seal — simple but deliberate; not a logo, an institutional mark */
function CommitteeSeal({ size = 72 }) {
  const s = size;
  return (
    <svg viewBox="0 0 100 100" width={s} height={s} className="select-none" aria-hidden>
      <defs>
        <path id="csRing" d="M50,50 m-42,0 a42,42 0 1,1 84,0 a42,42 0 1,1 -84,0" />
      </defs>
      <circle cx="50" cy="50" r="47" fill="none" stroke="#0f172a" strokeWidth="0.8" />
      <circle cx="50" cy="50" r="44" fill="none" stroke="#0f172a" strokeWidth="1.6" />
      <circle cx="50" cy="50" r="34" fill="none" stroke="#0f172a" strokeWidth="0.6" strokeDasharray="1.5 2" />
      {/* Central mark: star + caduceus-ish cross */}
      <g transform="translate(50 50)" stroke="#0f172a" strokeWidth="1.3" fill="none" strokeLinecap="round">
        <line x1="0" y1="-16" x2="0" y2="16" />
        <line x1="-16" y1="0" x2="16" y2="0" />
        <circle r="6" fill="#0f172a" />
      </g>
      {/* Circular text */}
      <text fontSize="6" fill="#0f172a" letterSpacing="2" fontFamily="ui-monospace,SFMono-Regular,Menlo,monospace">
        <textPath href="#csRing" startOffset="0%">CREDENTIALS COMMITTEE · MEDICAL STAFF · CEDAR HEALTH SYSTEM · EST 1953 · </textPath>
      </text>
    </svg>
  );
}
window.CommitteeSeal = CommitteeSeal;

/* ---------- Banner: Ready for Committee Review ----------
 * Sits atop the Employer console when gate is satisfied.
 */
function ReadyForCommitteeBanner({ gate, onOpenDossier }) {
  const readiness = committeeReadiness(gate);
  const ready = readiness.status === 'ready' || readiness.status === 'ready_conditional';
  if (!ready) return null;

  return (
    <div className="relative mb-6 border border-slate-900 bg-white overflow-hidden">
      {/* Seal-ink border accent */}
      <div className="absolute inset-x-0 top-0 h-1 bg-slate-900" />
      <div className="grid grid-cols-1 md:grid-cols-[auto_1fr_auto] items-stretch">
        {/* Seal column */}
        <div className="flex items-center justify-center px-6 py-5 border-b md:border-b-0 md:border-r border-slate-200 bg-slate-50">
          <CommitteeSeal size={84} />
        </div>
        {/* Copy column */}
        <div className="px-6 py-5">
          <div className="mono text-[10px] uppercase tracking-[0.24em] text-slate-500">Status</div>
          <h3 className="mt-1 font-serif text-[22px] tracking-[-0.01em] text-slate-900 leading-tight">
            {readiness.status === 'ready' ? 'Ready for Committee Review' : 'Ready — with conditions'}
          </h3>
          <p className="text-[12.5px] text-slate-700 mt-1.5 leading-[1.55] max-w-[62ch]">
            Packet assembled, sealed, and placed on the docket of the{' '}
            <span className="font-medium text-slate-900">{COMMITTEE_MEETING.body}</span>.
            Committee convenes <span className="mono text-slate-900">{COMMITTEE_MEETING.meetingDate} · {COMMITTEE_MEETING.meetingTime}</span>.
          </p>
          <dl className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-1 mono text-[10.5px]">
            <div>
              <dt className="uppercase tracking-[0.14em] text-slate-500">Docket</dt>
              <dd className="text-slate-900 tabular-nums">{COMMITTEE_MEETING.docket}</dd>
            </div>
            <div>
              <dt className="uppercase tracking-[0.14em] text-slate-500">Item</dt>
              <dd className="text-slate-900 tabular-nums">{COMMITTEE_MEETING.itemNo} of {COMMITTEE_MEETING.itemTotal}</dd>
            </div>
            <div>
              <dt className="uppercase tracking-[0.14em] text-slate-500">Chair</dt>
              <dd className="text-slate-900">Trang, H. MD</dd>
            </div>
            <div>
              <dt className="uppercase tracking-[0.14em] text-slate-500">Quorum</dt>
              <dd className="text-slate-900 tabular-nums">{COMMITTEE_MEETING.quorumRequired} · majority</dd>
            </div>
          </dl>
        </div>
        {/* CTA column */}
        <div className="flex flex-col items-stretch justify-center gap-2 px-6 py-5 border-t md:border-t-0 md:border-l border-slate-200 bg-slate-50">
          <button
            onClick={onOpenDossier}
            className="mono text-[11px] uppercase tracking-[0.14em] bg-slate-900 text-white hover:bg-black px-3 py-2 rounded-[3px] whitespace-nowrap inline-flex items-center gap-1.5 justify-center">
            <Icon.FileText size={12} /> Open Board Memorandum
          </button>
          <button className="mono text-[11px] uppercase tracking-[0.14em] border border-slate-900 text-slate-900 bg-white hover:bg-slate-100 px-3 py-2 rounded-[3px] whitespace-nowrap inline-flex items-center gap-1.5 justify-center">
            <Icon.Download size={12} /> Download exhibits bundle
          </button>
        </div>
      </div>
    </div>
  );
}
window.ReadyForCommitteeBanner = ReadyForCommitteeBanner;

/* ---------- Recommendation stamp ---------- */
function RecommendationStamp() {
  const r = CVO_RECOMMENDATION;
  const map = {
    approve:                 { label: 'RECOMMEND · APPROVE',            accent: 'border-emerald-700 text-emerald-800 bg-emerald-50' },
    approve_with_conditions: { label: 'RECOMMEND · APPROVE · CONDITIONS', accent: 'border-amber-700 text-amber-900 bg-amber-50' },
    defer:                   { label: 'RECOMMEND · DEFER',              accent: 'border-slate-700 text-slate-900 bg-slate-100' },
    deny:                    { label: 'RECOMMEND · DENY',               accent: 'border-red-700  text-red-800    bg-red-50'     },
  };
  const m = map[r.status] || map.defer;
  return (
    <div className={cn('border-2 px-4 py-3 rounded-[3px] inline-flex flex-col', m.accent)}>
      <div className="mono text-[9.5px] uppercase tracking-[0.2em] font-semibold leading-tight">
        Delegated CVO · VitalCV
      </div>
      <div className="mono text-[14px] uppercase tracking-[0.16em] font-semibold leading-tight mt-1">
        [ {m.label} ]
      </div>
      <div className="mono text-[9px] uppercase tracking-[0.16em] mt-1 opacity-80">
        Basis · NCQA CR §3 · §4.2 · TJC MS.06.01.03
      </div>
    </div>
  );
}
window.RecommendationStamp = RecommendationStamp;

/* ---------- Exhibits index ---------- */
function ExhibitsIndex() {
  return (
    <div className="border border-slate-900">
      <div className="grid grid-cols-[60px_1fr_160px_60px_160px] bg-slate-950 text-slate-100 mono text-[9.5px] uppercase tracking-[0.14em]">
        <div className="px-3 py-2">Ex.</div>
        <div className="px-3 py-2">Description</div>
        <div className="px-3 py-2">Reference</div>
        <div className="px-3 py-2 text-right">Pp.</div>
        <div className="px-3 py-2">Fingerprint</div>
      </div>
      <ul className="divide-y divide-slate-100">
        {COMMITTEE_EXHIBITS.map(e => (
          <li key={e.id} className="grid grid-cols-[60px_1fr_160px_60px_160px] items-center">
            <div className="px-3 py-2.5 mono text-[11px] font-semibold text-slate-900 tabular-nums">{e.id}</div>
            <div className="px-3 py-2.5 text-[12.5px] text-slate-900">{e.label}</div>
            <div className="px-3 py-2.5 mono text-[10.5px] text-slate-600 truncate">{e.ref}</div>
            <div className="px-3 py-2.5 mono text-[11px] text-slate-700 tabular-nums text-right">{e.pages}</div>
            <div className="px-3 py-2.5 mono text-[10px] text-slate-500 truncate">{e.fingerprint}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}
window.ExhibitsIndex = ExhibitsIndex;

/* ---------- Committee Roster · Quorum table ---------- */
function CommitteeRoster() {
  const voting    = COMMITTEE_ROSTER.filter(m => m.voting);
  const present   = voting.filter(m => m.present && !m.recused).length;
  const recused   = voting.filter(m => m.recused).length;
  const quorumMet = present >= COMMITTEE_MEETING.quorumRequired;
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <div className="mono text-[10px] uppercase tracking-[0.14em] text-slate-500">Voting members present</div>
        <div className="mono text-[10.5px] text-slate-700 tabular-nums">
          {present} of {voting.length} ·
          <span className={cn('ml-1.5 uppercase tracking-[0.14em] font-semibold',
            quorumMet ? 'text-emerald-800' : 'text-amber-900')}>
            [ {quorumMet ? 'QUORUM MET' : 'NO QUORUM'} ]
          </span>
        </div>
      </div>
      <div className="border border-slate-900">
        <div className="grid grid-cols-[1fr_1fr_90px_90px] bg-slate-950 text-slate-100 mono text-[9.5px] uppercase tracking-[0.14em]">
          <div className="px-3 py-2">Member</div>
          <div className="px-3 py-2">Role</div>
          <div className="px-3 py-2 text-center">Voting</div>
          <div className="px-3 py-2 text-center">Status</div>
        </div>
        <ul className="divide-y divide-slate-100">
          {COMMITTEE_ROSTER.map((m, i) => (
            <li key={i} className={cn('grid grid-cols-[1fr_1fr_90px_90px] items-center',
              m.recused && 'bg-amber-50/60',
              !m.present && m.voting && !m.recused && 'bg-slate-50'
            )}>
              <div className="px-3 py-2.5 text-[12px] text-slate-900">{m.name}</div>
              <div className="px-3 py-2.5 text-[11.5px] text-slate-600">{m.role}</div>
              <div className="px-3 py-2.5 flex items-center justify-center">
                {m.voting
                  ? <span className="mono text-[9.5px] uppercase tracking-[0.14em] text-slate-900">Yes</span>
                  : <span className="mono text-[9.5px] uppercase tracking-[0.14em] text-slate-400">—</span>}
              </div>
              <div className="px-3 py-2.5 flex items-center justify-center">
                {m.recused
                  ? <span className="mono text-[9.5px] uppercase tracking-[0.14em] border border-amber-700 text-amber-900 bg-amber-50 rounded-[3px] px-1.5 py-[2px] font-semibold whitespace-nowrap">[ RECUSED ]</span>
                  : m.present
                    ? <span className="mono text-[9.5px] uppercase tracking-[0.14em] border border-emerald-700 text-emerald-800 bg-emerald-50 rounded-[3px] px-1.5 py-[2px] font-semibold whitespace-nowrap">[ PRESENT ]</span>
                    : <span className="mono text-[9.5px] uppercase tracking-[0.14em] border border-slate-400 text-slate-500 rounded-[3px] px-1.5 py-[2px] whitespace-nowrap">[ ABSENT ]</span>}
              </div>
            </li>
          ))}
        </ul>
      </div>
      {recused > 0 && (
        <div className="mono text-[10.5px] text-slate-500 mt-2 leading-snug">
          Recusal note · Chen, D. MD supervises the applicant in current practice. Recuses under Bylaws Art. VI §3(c).
        </div>
      )}
    </div>
  );
}
window.CommitteeRoster = CommitteeRoster;

/* ---------- Board Memorandum ----------
 * The document. Printable one-pager (well, two). Serif body.
 */
function BoardMemorandum({ inFile = false }) {
  const r = CVO_RECOMMENDATION;
  const m = COMMITTEE_MEETING;
  return (
    <article className={cn('bg-white', !inFile && 'border border-slate-300 shadow-[0_1px_0_0_rgba(15,23,42,0.04)] mx-auto max-w-[920px] my-4')}>
      {/* Official header */}
      <header className="border-b-2 border-slate-900 px-10 pt-10 pb-6 relative">
        <div className="absolute top-6 right-10 opacity-90">
          <CommitteeSeal size={86} />
        </div>
        <div className="mono text-[10px] uppercase tracking-[0.24em] text-slate-500">Board Memorandum</div>
        <h1 className="mt-2 font-serif text-[26px] md:text-[30px] tracking-[-0.01em] text-slate-900 leading-tight max-w-[70%]">
          Credentials Committee of the Medical Staff
        </h1>
        <div className="font-serif text-[14px] text-slate-700 italic mt-1">{m.organization}</div>

        <dl className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-2 mono text-[10.5px]">
          <div>
            <dt className="uppercase tracking-[0.14em] text-slate-500">Docket</dt>
            <dd className="text-slate-900 tabular-nums">{m.docket}</dd>
          </div>
          <div>
            <dt className="uppercase tracking-[0.14em] text-slate-500">Item</dt>
            <dd className="text-slate-900 tabular-nums">No. {m.itemNo}</dd>
          </div>
          <div>
            <dt className="uppercase tracking-[0.14em] text-slate-500">Date</dt>
            <dd className="text-slate-900 tabular-nums">{m.meetingDate}</dd>
          </div>
          <div>
            <dt className="uppercase tracking-[0.14em] text-slate-500">Time</dt>
            <dd className="text-slate-900 tabular-nums">{m.meetingTime}</dd>
          </div>
        </dl>
      </header>

      <div className="px-10 py-8 space-y-8">
        {/* TO / FROM / RE block */}
        <div className="mono text-[11.5px] grid grid-cols-[80px_1fr] gap-y-1.5 gap-x-4">
          <span className="uppercase tracking-[0.14em] text-slate-500">TO:</span>
          <span className="text-slate-900">Credentials Committee, Cedar Health Medical Staff — attn. Helene Trang, MD, Chair</span>
          <span className="uppercase tracking-[0.14em] text-slate-500">FROM:</span>
          <span className="text-slate-900">Jordan Okafor, Credentialing Specialist · Secretary to the Committee</span>
          <span className="uppercase tracking-[0.14em] text-slate-500">DATE:</span>
          <span className="text-slate-900 tabular-nums">2026-04-23</span>
          <span className="uppercase tracking-[0.14em] text-slate-500">RE:</span>
          <span className="text-slate-900">
            Initial Appointment · <span className="font-semibold">Macie E. Miller, PA-C</span> · NPI 1346053246 · Cardiology · Allied Health Professional
          </span>
        </div>

        {/* Recommendation stamp */}
        <section>
          <div className="mono text-[10px] uppercase tracking-[0.18em] text-slate-500 mb-2">§1 · Recommendation</div>
          <div className="flex items-start gap-5 flex-wrap">
            <RecommendationStamp />
            <p className="font-serif text-[14.5px] text-slate-900 leading-[1.6] max-w-[54ch] flex-1 min-w-[280px]">
              The delegated CVO respectfully recommends that the Committee{' '}
              <span className="italic">approve the application of Macie E. Miller, PA-C, for initial appointment to the Allied Health Professional Staff, with privileges as requested on the PA Cardiology track, subject to the conditions enumerated in §2 below.</span>
            </p>
          </div>
        </section>

        {/* Conditions */}
        {r.conditions && r.conditions.length > 0 && (
          <section>
            <div className="mono text-[10px] uppercase tracking-[0.18em] text-slate-500 mb-2">§2 · Conditions of Approval</div>
            <ol className="border-l-2 border-slate-900 pl-5 space-y-3">
              {r.conditions.map(c => (
                <li key={c.id} className="relative">
                  <span className="absolute -left-5 top-0 mono text-[10.5px] font-semibold text-slate-900 bg-white pr-1">{c.id}</span>
                  <p className="font-serif text-[13.5px] text-slate-900 leading-[1.55]">{c.text}</p>
                </li>
              ))}
            </ol>
          </section>
        )}

        {/* Finding of fact */}
        <section>
          <div className="mono text-[10px] uppercase tracking-[0.18em] text-slate-500 mb-2">§3 · Findings of Fact</div>
          <ol className="list-[lower-roman] list-outside ml-6 space-y-2">
            {r.findingOfFact.map((f, i) => (
              <li key={i} className="font-serif text-[13.5px] text-slate-900 leading-[1.55] pl-1">{f}</li>
            ))}
          </ol>
        </section>

        {/* Resolution language */}
        <section>
          <div className="mono text-[10px] uppercase tracking-[0.18em] text-slate-500 mb-2">§4 · Proposed Resolution</div>
          <div className="border border-slate-900 bg-slate-50/60 px-5 py-4">
            <p className="font-serif text-[13.5px] text-slate-900 leading-[1.7]">
              <span className="mono uppercase tracking-[0.16em] text-[10.5px] text-slate-500 mr-2">WHEREAS,</span>
              the Credentialing Verification Organization has completed primary-source verification of the applicant's professional qualifications in accordance with NCQA CR §3 and Cedar Health Medical Staff Bylaws Article VI; and
            </p>
            <p className="font-serif text-[13.5px] text-slate-900 leading-[1.7] mt-3">
              <span className="mono uppercase tracking-[0.16em] text-[10.5px] text-slate-500 mr-2">WHEREAS,</span>
              no adverse findings under NPDB, OIG/LEIE, or state licensing authority are reported;
            </p>
            <p className="font-serif text-[13.5px] text-slate-900 leading-[1.7] mt-3">
              <span className="mono uppercase tracking-[0.16em] text-[10.5px] text-slate-500 mr-2">NOW, THEREFORE, BE IT RESOLVED,</span>
              that the Credentials Committee recommends to the Medical Executive Committee the appointment of{' '}
              <span className="font-semibold italic">Macie E. Miller, PA-C</span>, to the Allied Health Professional Staff, with privileges as requested, subject to the conditions in §2, effective upon ratification by the Board of Directors.
            </p>
          </div>
        </section>

        {/* Committee roster */}
        <section>
          <div className="mono text-[10px] uppercase tracking-[0.18em] text-slate-500 mb-2">§5 · Committee &amp; Quorum</div>
          <CommitteeRoster />
        </section>

        {/* Exhibits */}
        <section>
          <div className="mono text-[10px] uppercase tracking-[0.18em] text-slate-500 mb-2">§6 · Exhibits</div>
          <ExhibitsIndex />
        </section>

        {/* Vote block */}
        <section>
          <div className="mono text-[10px] uppercase tracking-[0.18em] text-slate-500 mb-2">§7 · Committee Vote</div>
          <div className="grid grid-cols-3 gap-4">
            <VoteBox label="In favor"  tally="__ / 5" />
            <VoteBox label="Opposed"   tally="__ / 5" />
            <VoteBox label="Abstain"   tally="__ / 5" />
          </div>
          <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-6">
            <SignatureBlock
              who="Chair of the Committee"
              name="Helene Trang, MD"
              role="Chief of Medical Staff"
              date="__________"
              meta={[
                { k: 'Meeting',   v: m.meetingDate },
                { k: 'Ayes',      v: '__' },
                { k: 'Nays',      v: '__' },
                { k: 'Abstain',   v: '__' },
              ]}
            />
            <SignatureBlock
              who="Secretary of the Committee"
              name="Jordan Okafor"
              role="Credentialing Specialist"
              date="__________"
              seal
              meta={[
                { k: 'Minutes',   v: 'Recorded per Robert\'s Rules of Order, 12th ed.' },
                { k: 'Bylaws',    v: 'Cedar Health MS Bylaws Art. VI §3' },
                { k: 'Filed',     v: 'Pending' },
              ]}
            />
          </div>
        </section>

        {/* Closing */}
        <footer className="border-t border-slate-300 pt-4">
          <p className="font-serif italic text-[12px] text-slate-600 leading-[1.55]">
            Prepared under peer-review privilege. This memorandum and all incorporated exhibits are
            protected from discovery under applicable state peer-review statutes and shall not be
            reproduced, disclosed, or distributed beyond the voting membership of the Committee and
            its authorized recording secretary.
          </p>
          <div className="mono text-[9.5px] uppercase tracking-[0.18em] text-slate-500 mt-3">
            CONFIDENTIAL · PEER-REVIEW PRIVILEGED · Cedar Health Medical Staff Office
          </div>
        </footer>
      </div>
    </article>
  );
}
window.BoardMemorandum = BoardMemorandum;

function VoteBox({ label, tally }) {
  return (
    <div className="border-2 border-slate-900 p-4 text-center">
      <div className="mono text-[9.5px] uppercase tracking-[0.2em] text-slate-500 mb-2">{label}</div>
      <div className="font-serif text-[26px] font-semibold tracking-[-0.02em] text-slate-900 tabular-nums">{tally}</div>
      <div className="mono text-[9px] uppercase tracking-[0.14em] text-slate-400 mt-2">Entered at vote</div>
    </div>
  );
}
window.VoteBox = VoteBox;
