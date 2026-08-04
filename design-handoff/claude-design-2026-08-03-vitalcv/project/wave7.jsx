// Wave 7 — Authority System
// Components: TrustTierBadge, DelegationBadge, T4Seal, AcceptanceBanner,
// SystemOfRecordCard, TrustLevelLegend, LegalNotice.

/* ---------- Trust Tier Badge ----------
 * A published, auditable ladder.
 */
const TIER_STYLE = {
  slate:   { text: 'text-slate-700',   bar: 'bg-slate-400',   ring: 'ring-slate-300',   bg: 'bg-white',         filled: 'bg-slate-700 text-white' },
  sky:     { text: 'text-sky-700',     bar: 'bg-sky-500',     ring: 'ring-sky-400/40',  bg: 'bg-sky-50',        filled: 'bg-sky-700 text-white'   },
  indigo:  { text: 'text-indigo-700',  bar: 'bg-indigo-500',  ring: 'ring-indigo-400/40', bg: 'bg-indigo-50',   filled: 'bg-indigo-700 text-white' },
  emerald: { text: 'text-emerald-700', bar: 'bg-emerald-600', ring: 'ring-emerald-500/40', bg: 'bg-emerald-50', filled: 'bg-emerald-700 text-white' },
};

function TrustTierBadge({ tier = 'T1', size = 'sm', showBar = true, title }) {
  const t = TRUST_TIERS[tier];
  if (!t) return null;
  const s = TIER_STYLE[t.tone];
  const sizeCls = size === 'lg'
    ? { pad: 'px-2.5 py-1.5', label: 'text-[11.5px]', code: 'text-[10px]' }
    : { pad: 'px-1.5 py-0.5', label: 'text-[10px]',   code: 'text-[9px]'  };

  const active = Math.max(1, parseInt(t.code.slice(1), 10));

  return (
    <span
      title={title || `Trust tier ${t.code} · ${t.label} — ${t.description}`}
      className={cn(
        'mono inline-flex items-center gap-1.5 rounded-[3px] ring-1 ring-inset whitespace-nowrap',
        s.bg, s.ring, sizeCls.pad
      )}
    >
      <span className={cn(sizeCls.code, 'uppercase tracking-[0.14em] font-semibold', s.text)}>
        [ {t.code} ]
      </span>
      <span className={cn(sizeCls.label, 'uppercase tracking-[0.1em]', s.text)}>
        {t.label}
      </span>
      {showBar && (
        <span className="flex items-end gap-[1px] ml-0.5">
          {[1,2,3,4].map(i => (
            <span
              key={i}
              className={cn('w-[3px] rounded-[1px]',
                i <= active ? s.bar : 'bg-slate-200',
                i === 1 && 'h-[4px]',
                i === 2 && 'h-[6px]',
                i === 3 && 'h-[9px]',
                i === 4 && 'h-[12px]',
              )}
            />
          ))}
        </span>
      )}
    </span>
  );
}
window.TrustTierBadge = TrustTierBadge;

/* ---------- Delegation Badge (chain-of-custody) ---------- */
function DelegationBadge({ laneId, compact = false }) {
  const auth = LANE_AUTHORITY[laneId];
  if (!auth) return null;
  const d = auth.delegate;
  const roleTone = {
    Issuer:    'text-emerald-700 border-emerald-600/30',
    Registry:  'text-indigo-700 border-indigo-600/30',
    Federated: 'text-sky-700 border-sky-600/30',
  }[d.role] || 'text-slate-700 border-slate-300';

  if (compact) {
    return (
      <span className="mono inline-flex items-center gap-1 text-[10px] text-slate-500 uppercase tracking-[0.1em]"
        title={`${d.role}: ${d.org} · ${d.sig}`}>
        <Icon.Shield size={10} className="text-slate-400" />
        <span className="truncate max-w-[150px]">{d.org}</span>
      </span>
    );
  }

  return (
    <div className="flex items-start gap-2.5">
      <div className="h-7 w-7 rounded-sm bg-slate-100 ring-1 ring-inset ring-slate-200 flex items-center justify-center flex-shrink-0">
        <Icon.Shield size={13} className="text-slate-600" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className={cn('mono text-[9.5px] uppercase tracking-[0.14em] px-1.5 py-[1px] rounded border bg-white whitespace-nowrap', roleTone)}>
            [ {d.role} ]
          </span>
          <span className="text-[12.5px] font-medium text-slate-900 truncate">{d.org}</span>
        </div>
        <div className="mono text-[10.5px] text-slate-500 mt-0.5 truncate">sig · {d.sig}</div>
      </div>
    </div>
  );
}
window.DelegationBadge = DelegationBadge;

/* ---------- T4 Primary-Sealed Seal ----------
 * The "no further verification required" mark.
 * A circular notarial seal rendered in pure SVG.
 */
function T4Seal({ size = 92, label = 'PRIMARY · SEALED' }) {
  const cx = size / 2, cy = size / 2;
  const rOuter = size / 2 - 1;
  const rInner = size / 2 - 6;
  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} className="select-none">
      <defs>
        <path id={`t4arc-${size}-top`}    d={`M ${size*0.12} ${cy} A ${rInner-2} ${rInner-2} 0 0 1 ${size*0.88} ${cy}`} />
        <path id={`t4arc-${size}-bot`}    d={`M ${size*0.12} ${cy} A ${rInner-2} ${rInner-2} 0 0 0 ${size*0.88} ${cy}`} />
      </defs>
      {/* Outer ring */}
      <circle cx={cx} cy={cy} r={rOuter}   fill="#fff" stroke="#0f172a" strokeWidth="1.4" />
      <circle cx={cx} cy={cy} r={rOuter-3} fill="none" stroke="#0f172a" strokeWidth="0.6" />
      {/* Inner disc */}
      <circle cx={cx} cy={cy} r={rInner}   fill="#0f172a" />
      <circle cx={cx} cy={cy} r={rInner-4} fill="none" stroke="rgba(255,255,255,.25)" strokeWidth="0.4" strokeDasharray="1 2" />

      {/* Arc text (top) */}
      <text fontFamily="Geist Mono, monospace" fontSize={size*0.075} fill="#0f172a" letterSpacing="2">
        <textPath href={`#t4arc-${size}-top`} startOffset="50%" textAnchor="middle">
          VITALCV · TRUST REGISTRY
        </textPath>
      </text>
      <text fontFamily="Geist Mono, monospace" fontSize={size*0.065} fill="#0f172a" letterSpacing="1.5">
        <textPath href={`#t4arc-${size}-bot`} startOffset="50%" textAnchor="middle">
          ISSUED · SIGNED · REPLAYABLE
        </textPath>
      </text>

      {/* Center glyph — checkmark in crosshair */}
      <g transform={`translate(${cx} ${cy})`}>
        <circle r={size*0.18} fill="none" stroke="#fff" strokeWidth="1" />
        <circle r={size*0.005} fill="#fff" />
        <path d={`M ${-size*0.08} 0 L ${-size*0.02} ${size*0.06} L ${size*0.09} ${-size*0.08}`}
              fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </g>

      {/* Tier band */}
      <rect x={cx - size*0.16} y={cy + rInner*0.45} width={size*0.32} height={size*0.14} fill="#fff" stroke="#0f172a" strokeWidth="0.8" />
      <text x={cx} y={cy + rInner*0.55} textAnchor="middle" fontFamily="Geist Mono, monospace" fontSize={size*0.08} fontWeight="700" fill="#0f172a" letterSpacing="1.5" dominantBaseline="middle">
        T4
      </text>
    </svg>
  );
}
window.T4Seal = T4Seal;

/* ---------- Trust Level Legend (published ladder) ---------- */
function TrustLevelLegend() {
  const tiers = Object.values(TRUST_TIERS);
  return (
    <div className="border border-slate-200 rounded-md bg-white overflow-hidden">
      <div className="px-4 py-2.5 border-b border-slate-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon.Stamp size={14} className="text-slate-700" />
          <span className="text-[13px] font-semibold text-slate-900">Trust Tier Ladder</span>
        </div>
        <span className="mono text-[9.5px] text-slate-400 uppercase tracking-[0.14em]">VitalCV Trust Framework · §2.1</span>
      </div>
      <ul>
        {tiers.map((t, i) => {
          const s = TIER_STYLE[t.tone];
          return (
            <li key={t.code} className={cn('flex items-start gap-3 px-4 py-2.5', i < tiers.length - 1 && 'border-b border-slate-100')}>
              <TrustTierBadge tier={t.code} size="lg" />
              <div className="flex-1 min-w-0">
                <div className="text-[12.5px] font-medium text-slate-900">{t.label}</div>
                <div className="text-[11.5px] text-slate-500 mt-0.5 leading-snug">{t.description}</div>
              </div>
              {t.code === 'T4' && (
                <span className="mono text-[9.5px] uppercase tracking-[0.14em] text-emerald-700 border border-emerald-600/30 bg-emerald-50 rounded px-1.5 py-[1px] whitespace-nowrap">
                  No further verification
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
window.TrustLevelLegend = TrustLevelLegend;

/* ---------- Acceptance Banner ----------
 * Employer console hero when the packet is Accepted.
 * The "system of record" moment.
 */
function AcceptanceBanner({ receipt }) {
  return (
    <div className="relative border border-slate-900 bg-white rounded-md overflow-hidden mb-8">
      {/* Thin engraved band */}
      <div className="h-1 bg-gradient-to-r from-slate-900 via-emerald-700 to-slate-900" />

      <div className="p-6 md:p-7">
        <div className="grid grid-cols-12 gap-6 items-center">
          {/* Seal */}
          <div className="col-span-12 md:col-span-2 flex md:justify-start justify-center">
            <T4Seal size={96} />
          </div>

          {/* Main declaration */}
          <div className="col-span-12 md:col-span-7">
            <div className="mono text-[10px] uppercase tracking-[0.2em] text-slate-500">
              Status · Accepted &amp; Notarized
            </div>
            <h2 className="text-[26px] md:text-[30px] font-semibold tracking-[-0.02em] text-slate-900 mt-1 leading-[1.05]">
              Verified Identity &amp; Readiness accepted as the system of record
            </h2>
            <p className="text-[12.5px] text-slate-600 mt-2 max-w-[620px] leading-[1.55]">
              Per NCQA-delegated credentialing standards, no further primary-source verification is
              required for the sources listed in this packet. This record is canonical and
              cryptographically replayable by any downstream auditor.
            </p>

            <div className="mt-4 flex items-center flex-wrap gap-2">
              <span className="mono text-[10px] uppercase tracking-[0.14em] border border-emerald-700 bg-emerald-700 text-white px-2 py-1 rounded-[3px]">
                [ NO FURTHER VERIFICATION REQUIRED ]
              </span>
              <TrustTierBadge tier="T4" size="lg" />
              <span className="mono text-[10px] uppercase tracking-[0.14em] text-slate-600 border border-slate-300 bg-white px-2 py-1 rounded-[3px]">
                [ NCQA DELEGATION · §4.2 ]
              </span>
            </div>
          </div>

          {/* Registry metadata */}
          <div className="col-span-12 md:col-span-3 bg-slate-50 border border-slate-200 rounded-md p-3.5">
            <div className="mono text-[9.5px] uppercase tracking-[0.14em] text-slate-500">Registry ID</div>
            <div className="mono text-[13px] font-semibold text-slate-900 mt-0.5 tabular-nums">{receipt.registryId}</div>
            <div className="h-px bg-slate-200 my-2.5" />
            <dl className="space-y-1.5">
              <div className="flex justify-between gap-2">
                <dt className="mono text-[9.5px] uppercase tracking-[0.12em] text-slate-500">Issued</dt>
                <dd className="mono text-[10.5px] text-slate-700 tabular-nums">{receipt.signedAt}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="mono text-[9.5px] uppercase tracking-[0.12em] text-slate-500">Standard</dt>
                <dd className="mono text-[10.5px] text-slate-700 text-right leading-tight">NCQA CR §3, §4.2</dd>
              </div>
              <div>
                <dt className="mono text-[9.5px] uppercase tracking-[0.12em] text-slate-500 mb-0.5">Merkle root</dt>
                <dd className="mono text-[10.5px] text-slate-700 break-all tabular-nums">{receipt.merkleRoot}</dd>
              </div>
            </dl>
          </div>
        </div>
      </div>

      {/* Signature strip */}
      <div className="border-t border-slate-900 bg-slate-950 text-slate-100 px-6 py-3 grid grid-cols-12 gap-6">
        <div className="col-span-12 md:col-span-6">
          <div className="mono text-[9.5px] uppercase tracking-[0.14em] text-slate-500">Signed by · Issuer</div>
          <div className="mono text-[12px] text-emerald-300 mt-0.5 break-all tabular-nums">{receipt.seal}</div>
          <div className="text-[11px] text-slate-300 mt-0.5">{receipt.signer} · {receipt.issuer}</div>
          <div className="text-[10.5px] text-slate-500 mt-0.5">{receipt.signerTitle}</div>
        </div>
        <div className="col-span-12 md:col-span-6">
          <div className="mono text-[9.5px] uppercase tracking-[0.14em] text-slate-500">Counter-signed by · Registry</div>
          <div className="mono text-[12px] text-sky-300 mt-0.5 break-all tabular-nums">{receipt.counterSeal}</div>
          <div className="text-[11px] text-slate-300 mt-0.5">VitalCV Trust Registry · Production Node 202</div>
          <div className="text-[10.5px] text-slate-500 mt-0.5">Replayable · ed25519 · append-only</div>
        </div>
      </div>
    </div>
  );
}
window.AcceptanceBanner = AcceptanceBanner;

/* ---------- Clinician-side "Accepted by employer" state card ---------- */
function AcceptedByEmployerCard({ receipt, employerName }) {
  return (
    <div className="border-[1.5px] border-slate-900 rounded-md bg-white overflow-hidden">
      <div className="h-1 bg-gradient-to-r from-slate-900 via-emerald-700 to-slate-900" />
      <div className="p-5 flex items-start gap-4">
        <T4Seal size={76} />
        <div className="flex-1 min-w-0">
          <div className="mono text-[9.5px] uppercase tracking-[0.18em] text-slate-500">Application · Accepted</div>
          <div className="text-[15px] font-semibold tracking-tightish text-slate-900 mt-0.5 leading-tight">
            {employerName} accepted your Passport as the system of record
          </div>
          <div className="text-[12px] text-slate-600 leading-[1.55] mt-1.5">
            No further primary-source verification is required for sources in this packet. A signed receipt is on file.
          </div>

          <div className="mt-3 bg-slate-50 border border-slate-200 rounded p-2.5">
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="mono text-[9.5px] uppercase tracking-[0.14em] text-slate-500">Registry ID</span>
              <span className="mono text-[10.5px] text-slate-900 tabular-nums">{receipt.registryId}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="mono text-[9.5px] uppercase tracking-[0.14em] text-slate-500">Issued</span>
              <span className="mono text-[10.5px] text-slate-700 tabular-nums">{receipt.signedAt}</span>
            </div>
          </div>

          <div className="mt-3 flex items-center gap-2 flex-wrap">
            <span className="mono text-[10px] uppercase tracking-[0.14em] text-emerald-700 border border-emerald-600/30 bg-emerald-50 rounded px-1.5 py-1">
              [ NO FURTHER VERIFICATION REQUIRED ]
            </span>
            <TrustTierBadge tier="T4" />
          </div>
        </div>
      </div>
    </div>
  );
}
window.AcceptedByEmployerCard = AcceptedByEmployerCard;

/* ---------- Legal authority microtype ---------- */
function LegalAuthorityNotice() {
  return (
    <div className="mono text-[10px] text-slate-500 leading-[1.55] tracking-[0.01em]">
      VitalCV is a delegated credential verification organization. This record is generated per
      NCQA CR §3 Credentialing and §4.2 Delegation, and conforms to W3C VC 2.0 / OpenID4VCI. All
      observations are cryptographically signed by the issuing authority and timestamped by the
      VitalCV Trust Registry (append-only, ed25519, node 202). Replay and counter-verification
      available to any downstream auditor via the included registry ID.
    </div>
  );
}
window.LegalAuthorityNotice = LegalAuthorityNotice;
