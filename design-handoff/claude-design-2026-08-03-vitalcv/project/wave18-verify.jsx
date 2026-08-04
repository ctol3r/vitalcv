// Wave 18 — Trust Badge Public Verifier
// ------------------------------------------------------------
// Audience: a hospital scheduler, locum agency, payer ops, or in-house counsel
// who has been handed a Trust Badge token (or scanned a QR) and needs to
// confirm — right now, in front of the candidate — that it's real and current.
//
// Design contract:
//   • This page is PUBLIC. No clinician PII beyond what the badge itself
//     already exposes (name, NPI, scope, status). No license numbers, no DOB,
//     no addresses, no employment history.
//   • Verification is presented as performed BY the verifier's browser against
//     the issuing key, NOT as VitalCV "proving" something. Truth-aligned copy.
//   • Three states the page must render:
//       (1) idle  — empty paste/scan UI
//       (2) verifying — per-step progress, cancellable
//       (3) resolved — clear / warn / revoked / expired
//   • A scheduler must be able to walk away with: a result, a permalink to
//     re-verify, an embed snippet for their site, and a one-page artifact.
//
// What this page does NOT do (and does not claim):
//   • Does not "approve" the clinician for any role.
//   • Does not constitute primary-source verification for a credentialing file.
//   • Does not replace background checks, peer references, or NPDB queries.
//   • Does not transfer risk or provide indemnification.

const VERIFY_DEMO_TOKEN = 'vcv.tb.01JGA7R2QW0D4C8NXM5P9HE3B6';

// Stages the page walks through during a live verification.
// Wording is deliberate: "fetched", "validated", "checked" — not "guaranteed",
// "certified", "approved".
const VERIFY_STAGES = [
  { id: 'parse',     label: 'Token parsed',                   detail: 'Decoded VC 2.0 envelope · ULID format · header intact' },
  { id: 'sig',       label: 'Issuer signature validated',     detail: 'Verified locally against did:web:vitalcv.health · ed25519' },
  { id: 'revoke',    label: 'Revocation status fetched',      detail: 'Status List 2021 entry index 8841 · bit 0' },
  { id: 'expiry',    label: 'Expiry window checked',          detail: '30-day badge · 12 days remaining at fetch time' },
  { id: 'sources',   label: 'Source attestations re-confirmed', detail: 'Each lane re-fetched from its registry within last 60s' },
  { id: 'render',    label: 'Result composed',                detail: 'Decision rendered from authoritative state, not cache' },
];

// What the verifier sees once a token resolves. This mirrors TRUST_BADGE in
// wave12 but trimmed to "what is safe to show on a public page".
const VERIFY_RESULT_DEMO = {
  token:   VERIFY_DEMO_TOKEN,
  badgeId: 'TB-2026-04-18-000841-A',
  issued:  '2026-04-18 14:32:51 UTC',
  expires: '2026-05-18 14:32:51 UTC',
  expiresInDays: 12,
  fetchedAt: '2026-04-30 09:14:02 UTC',
  subject: { name: 'Macie E. Miller, PA-C', npi: '1346053246' },
  scope:   'Identity · Licensure · Sanctions · Medicare enrollment',
  status:  'clear',          // clear | warn | revoked | expired
  issuerDid: 'did:web:vitalcv.health',
  publicKey: 'ed25519:0x71a4…f2c8',
  receiptHash: '0x8a41f0b9e2f67d4c1a3e9b0a2c7d2e5f3910ab77c06de91f',
  // What was checked, source by source. Each item is "what the registry SAID",
  // not "what VitalCV concluded".
  checks: [
    { source: 'NPPES',        statement: 'Identity record matches NPI 1346053246', verb: 'Match',     ok: true,  asOf: '2026-04-30 09:13 UTC' },
    { source: 'OIG · LEIE',   statement: 'No active exclusion record on file',     verb: 'No hit',    ok: true,  asOf: '2026-04-30 09:13 UTC' },
    { source: 'PECOS',        statement: 'Medicare enrollment is active',          verb: 'Active',    ok: true,  asOf: '2026-04-30 09:13 UTC' },
    { source: 'CA PA Board',  statement: 'License PA-052987 is active, no discipline shown', verb: 'Active', ok: true, asOf: '2026-04-30 09:13 UTC' },
    { source: 'NCCPA',        statement: 'Certification is current; CAQ Cardiovascular on file', verb: 'Current', ok: true, asOf: '2026-04-30 09:13 UTC' },
    { source: 'DEA',          statement: 'Registration is active, Schedules II–V', verb: 'Active',    ok: true,  asOf: '2026-04-30 09:13 UTC' },
  ],
};
window.VERIFY_RESULT_DEMO = VERIFY_RESULT_DEMO;

// ============================================================
// View
// ============================================================
function ViewVerify() {
  const [phase, setPhase]   = React.useState('idle');     // idle | verifying | resolved
  const [token, setToken]   = React.useState('');
  const [stageIx, setStage] = React.useState(0);
  const [result, setResult] = React.useState(null);
  const [showInspector, setShowInspector] = React.useState(false);
  const [showEmbed, setShowEmbed] = React.useState(false);

  // simulated verification — runs through the stage list and resolves
  React.useEffect(() => {
    if (phase !== 'verifying') return;
    if (stageIx >= VERIFY_STAGES.length) {
      const t = setTimeout(() => {
        setResult(VERIFY_RESULT_DEMO);
        window.__lastVerifyResult = VERIFY_RESULT_DEMO;
        setPhase('resolved');
      }, 220);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setStage(i => i + 1), 380);
    return () => clearTimeout(t);
  }, [phase, stageIx]);

  const startVerify = (tok) => {
    setToken(tok);
    setStage(0);
    setResult(null);
    setPhase('verifying');
  };
  const reset = () => {
    setPhase('idle');
    setToken('');
    setStage(0);
    setResult(null);
  };

  return (
    <div className="max-w-[1400px] mx-auto px-6 py-10">
      <VerifyEyebrow />

      {phase === 'idle' && (
        <VerifyIdle
          onSubmit={startVerify}
          onUseDemo={() => startVerify(VERIFY_DEMO_TOKEN)}
        />
      )}

      {phase === 'verifying' && (
        <VerifyRunning token={token} stageIx={stageIx} onCancel={reset} />
      )}

      {phase === 'resolved' && result && (
        <VerifyResolved
          result={result}
          onInspect={() => setShowInspector(true)}
          onEmbed={() => setShowEmbed(true)}
          onReverify={reset}
        />
      )}

      {/* Always visible: explainers below the fold so the public page is self-describing */}
      {phase !== 'verifying' && <VerifyExplainerStrip />}

      {showInspector && result && (
        <ReceiptInspectorModal result={result} onClose={() => setShowInspector(false)} />
      )}
      {showEmbed && result && (
        <EmbedSnippetModal result={result} onClose={() => setShowEmbed(false)} />
      )}
    </div>
  );
}
window.ViewVerify = ViewVerify;

// ============================================================
// Eyebrow / page header — sets expectations on what this page IS
// ============================================================
function VerifyEyebrow() {
  return (
    <div className="mb-8 flex items-end justify-between gap-6 border-b border-slate-200 pb-6">
      <div>
        <div className="mono text-[10.5px] uppercase tracking-[0.22em] text-emerald-700 inline-flex items-center gap-2">
          <span className="h-px w-6 bg-emerald-300" />
          <span>verify.vitalcv.health · public verifier</span>
        </div>
        <h1 className="mt-3 text-[28px] md:text-[34px] font-semibold tracking-[-0.015em] text-slate-900 leading-[1.1]"
            style={{ fontFamily: 'ui-serif, Georgia, serif' }}>
          Verify a Trust Badge.
        </h1>
        <p className="mt-2 text-[14px] text-slate-600 max-w-[640px] leading-[1.55]">
          Paste a token or scan a QR. Your browser checks the issuer signature,
          fetches revocation state, and re-confirms each underlying source.
          Nothing on this page constitutes a credentialing decision — it tells
          you what the registries say <em>right now</em>.
        </p>
      </div>
      <div className="hidden md:flex flex-col items-end gap-2">
        <span className="mono text-[9.5px] uppercase tracking-[0.2em] text-slate-500">Built on</span>
        <div className="mono text-[11px] text-slate-700 tabular-nums">VC 2.0 · OpenID4VCI · StatusList 2021</div>
        <div className="mono text-[10.5px] text-slate-500 inline-flex items-center gap-1.5">
          <Icon.ShieldCheck size={12} className="text-emerald-600" />
          Verification runs in your browser
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Phase 1 — idle
// ============================================================
function VerifyIdle({ onSubmit, onUseDemo }) {
  const [val, setVal] = React.useState('');
  return (
    <div className="grid grid-cols-12 gap-6">
      <div className="col-span-12 lg:col-span-8">
        <form
          onSubmit={(e) => { e.preventDefault(); if (val.trim()) onSubmit(val.trim()); }}
          className="border-2 border-slate-900 rounded-[3px] bg-white"
        >
          <div className="border-b border-slate-200 px-6 py-4 flex items-center justify-between">
            <div className="mono text-[10.5px] uppercase tracking-[0.18em] text-slate-600">Step 1 · Provide a Trust Badge token</div>
            <div className="mono text-[10px] uppercase tracking-[0.14em] text-slate-400">Paste · Scan · Drop a URL</div>
          </div>
          <div className="px-6 pt-5 pb-2">
            <label htmlFor="vcv-token" className="mono text-[10px] uppercase tracking-[0.14em] text-slate-500">Token</label>
            <input
              id="vcv-token"
              autoFocus
              spellCheck={false}
              autoComplete="off"
              value={val}
              onChange={(e) => setVal(e.target.value)}
              placeholder="vcv.tb.01JGA7R2QW0D4C8NXM5P9HE3B6  ·  or  vc2:nppes:0x…"
              className="mono w-full text-[14px] text-slate-900 placeholder:text-slate-400 bg-transparent border-b border-slate-300 focus:border-emerald-700 focus:outline-none py-2"
            />
            <div className="mono text-[10.5px] text-slate-500 mt-2">
              We don't store this token. Verification is local except for the registry calls below.
            </div>
          </div>
          <div className="border-t border-slate-200 px-6 py-4 flex items-center justify-between">
            <button
              type="button"
              onClick={onUseDemo}
              className="mono text-[11px] uppercase tracking-[0.14em] text-slate-700 hover:text-slate-900 underline-offset-4 hover:underline"
            >
              Use the walk-through token →
            </button>
            <button
              type="submit"
              disabled={!val.trim()}
              className="mono text-[11px] uppercase tracking-[0.14em] bg-emerald-700 text-white hover:bg-emerald-800 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed px-4 h-9 rounded-[3px] inline-flex items-center gap-2"
            >
              <Icon.ShieldCheck size={14} />
              Verify badge
            </button>
          </div>
        </form>

        <ScanRow />
      </div>

      <aside className="col-span-12 lg:col-span-4 space-y-4">
        <VerifyTrustModelCard />
        <VerifyLimitsCard />
      </aside>
    </div>
  );
}

function ScanRow() {
  return (
    <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
      <div className="border border-slate-200 rounded-[3px] bg-white p-4 flex items-center gap-4">
        <div className="h-12 w-12 border border-slate-300 rounded-[3px] bg-slate-50 inline-flex items-center justify-center text-slate-500">
          <Icon.Camera size={20} />
        </div>
        <div>
          <div className="text-[13px] font-medium text-slate-900">Scan a QR</div>
          <div className="mono text-[10.5px] text-slate-500 mt-0.5">Camera preview opens in this tab</div>
        </div>
      </div>
      <div className="border border-slate-200 rounded-[3px] bg-white p-4 flex items-center gap-4">
        <div className="h-12 w-12 border border-slate-300 rounded-[3px] bg-slate-50 inline-flex items-center justify-center text-slate-500">
          <Icon.Globe size={20} />
        </div>
        <div>
          <div className="text-[13px] font-medium text-slate-900">Drop a permalink</div>
          <div className="mono text-[10.5px] text-slate-500 mt-0.5">verify.vitalcv.health/v/TB-…</div>
        </div>
      </div>
    </div>
  );
}

function VerifyTrustModelCard() {
  return (
    <div className="border border-slate-200 rounded-[3px] bg-white p-5">
      <div className="mono text-[10.5px] uppercase tracking-[0.18em] text-slate-500 mb-2">How verification works</div>
      <ol className="space-y-2.5 text-[12.5px] text-slate-800 leading-[1.55]">
        <li className="flex gap-3"><span className="mono text-[10px] text-emerald-700 mt-0.5">01</span> Your browser fetches the issuer's public key from <span className="mono">did:web:vitalcv.health</span>.</li>
        <li className="flex gap-3"><span className="mono text-[10px] text-emerald-700 mt-0.5">02</span> The token's signature is checked locally — VitalCV's server is not in the trust path.</li>
        <li className="flex gap-3"><span className="mono text-[10px] text-emerald-700 mt-0.5">03</span> Each underlying registry (NPPES, OIG, PECOS, board) is re-queried for live state.</li>
        <li className="flex gap-3"><span className="mono text-[10px] text-emerald-700 mt-0.5">04</span> Revocation list is checked. If the issuer has revoked this badge, the page says so.</li>
      </ol>
    </div>
  );
}

function VerifyLimitsCard() {
  return (
    <div className="border border-amber-300 rounded-[3px] bg-amber-50/60 p-5">
      <div className="mono text-[10.5px] uppercase tracking-[0.18em] text-amber-800 mb-2 inline-flex items-center gap-2">
        <Icon.AlertTri size={12} /> Read this before you rely on a result
      </div>
      <ul className="space-y-1.5 text-[12px] text-amber-900 leading-[1.5] list-disc pl-5">
        <li>A clear result is not a credentialing decision and does not authorize hospital privileges or payer enrollment.</li>
        <li>Each registry reflects only what it knows at the time of fetch. Some sources are batch-updated.</li>
        <li>This page does not transfer liability to VitalCV, the issuer, or any source registry.</li>
        <li>For NCQA-aligned credentialing, open a Credentialing File — the Trust Badge is not a substitute.</li>
      </ul>
    </div>
  );
}

// ============================================================
// Phase 2 — verifying (live progress)
// ============================================================
function VerifyRunning({ token, stageIx, onCancel }) {
  return (
    <div className="grid grid-cols-12 gap-6">
      <div className="col-span-12 lg:col-span-8">
        <div className="border-2 border-emerald-700 rounded-[3px] bg-white">
          <div className="border-b border-emerald-200 bg-emerald-50/40 px-6 py-4 flex items-center justify-between">
            <div className="mono text-[10.5px] uppercase tracking-[0.2em] text-emerald-800 inline-flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500 pulse-soft" />
              Verifying — {Math.min(stageIx + 1, VERIFY_STAGES.length)} of {VERIFY_STAGES.length}
            </div>
            <button
              onClick={onCancel}
              className="mono text-[10.5px] uppercase tracking-[0.14em] text-slate-600 hover:text-slate-900 underline-offset-4 hover:underline"
            >
              Cancel
            </button>
          </div>
          <div className="px-6 pt-4 pb-1">
            <div className="mono text-[10px] uppercase tracking-[0.14em] text-slate-500">Token</div>
            <div className="mono text-[12.5px] text-slate-900 break-all">{token}</div>
          </div>
          <ul className="px-6 py-5 space-y-3">
            {VERIFY_STAGES.map((s, i) => {
              const state = i < stageIx ? 'done' : i === stageIx ? 'active' : 'pending';
              return (
                <li key={s.id} className="grid grid-cols-[24px_1fr] gap-3">
                  <span className={cn(
                    'mt-1 h-3 w-3 rounded-full ring-1',
                    state === 'done'    && 'bg-emerald-500 ring-emerald-600',
                    state === 'active'  && 'bg-emerald-500 ring-emerald-600 pulse-soft',
                    state === 'pending' && 'bg-white ring-slate-300',
                  )} />
                  <div>
                    <div className={cn(
                      'text-[13px] leading-tight',
                      state === 'pending' ? 'text-slate-400' : 'text-slate-900 font-medium',
                    )}>
                      {s.label}
                    </div>
                    <div className={cn(
                      'mono text-[10.5px] mt-0.5',
                      state === 'pending' ? 'text-slate-300' : 'text-slate-500',
                    )}>
                      {s.detail}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
      <aside className="col-span-12 lg:col-span-4 space-y-4">
        <VerifyTrustModelCard />
      </aside>
    </div>
  );
}

// ============================================================
// Phase 3 — resolved
// ============================================================
function VerifyResolved({ result, onInspect, onEmbed, onReverify }) {
  const r = result;
  return (
    <div className="grid grid-cols-12 gap-6">
      {/* Result panel */}
      <div className="col-span-12 lg:col-span-8 space-y-5">
        <ResultHeadline result={r} onInspect={onInspect} onEmbed={onEmbed} onReverify={onReverify} />
        <SourceByLane result={r} />
        <CarefulFootnote />
      </div>

      {/* Side: provenance + share */}
      <aside className="col-span-12 lg:col-span-4 space-y-4">
        <VerifyShareCard result={r} onEmbed={onEmbed} />
        <VerifyTrustModelCard />
      </aside>
    </div>
  );
}

function ResultHeadline({ result, onInspect, onEmbed, onReverify }) {
  const r = result;
  const tone = r.status === 'clear' ? 'clear' : r.status === 'warn' ? 'warn' : 'fail';
  const headline = {
    clear: 'No adverse finding from any checked source.',
    warn:  'One or more sources returned a caution. Review below.',
    revoked: 'This badge has been revoked by the issuer.',
    expired: 'This badge has expired.',
  }[r.status] || 'Result unavailable.';

  return (
    <div className={cn(
      'relative bg-white border-2 rounded-[3px] overflow-hidden',
      tone === 'clear' ? 'border-emerald-700' : tone === 'warn' ? 'border-amber-600' : 'border-rose-700'
    )}>
      <div className={cn(
        'h-2',
        tone === 'clear' ? 'bg-emerald-700' : tone === 'warn' ? 'bg-amber-600' : 'bg-rose-700',
      )} />
      <div className={cn(
        'px-7 pt-6 pb-5 border-b',
        tone === 'clear' ? 'bg-emerald-50/40 border-emerald-200' :
        tone === 'warn'  ? 'bg-amber-50/60 border-amber-200' :
                           'bg-rose-50/60 border-rose-200',
      )}>
        <div className="flex items-start justify-between gap-6">
          <div>
            <div className={cn(
              'mono text-[10.5px] uppercase tracking-[0.22em] font-semibold',
              tone === 'clear' ? 'text-emerald-700' : tone === 'warn' ? 'text-amber-800' : 'text-rose-800',
            )}>
              VitalCV · Trust Badge · public verification result
            </div>
            <h2 className={cn(
              'mt-2 text-[26px] leading-[1.15] font-semibold tracking-[-0.015em]',
              tone === 'clear' ? 'text-emerald-950' : tone === 'warn' ? 'text-amber-950' : 'text-rose-950',
            )} style={{ fontFamily: 'ui-serif, Georgia, serif' }}>
              {r.subject.name}
            </h2>
            <div className="mono text-[12px] mt-1 text-slate-700">
              NPI {r.subject.npi} · {r.scope}
            </div>
            <p className="text-[13px] text-slate-800 mt-3 max-w-[520px] leading-[1.5]">
              {headline}
            </p>
          </div>
          <div className={cn(
            'border-2 rounded-[3px] px-4 py-2 text-center bg-white shrink-0',
            tone === 'clear' ? 'border-emerald-700' : tone === 'warn' ? 'border-amber-600' : 'border-rose-700',
          )}>
            <div className={cn(
              'mono text-[9.5px] uppercase tracking-[0.2em]',
              tone === 'clear' ? 'text-emerald-700' : tone === 'warn' ? 'text-amber-800' : 'text-rose-800',
            )}>Status</div>
            <div className={cn(
              'mono text-[18px] font-semibold uppercase tracking-[0.14em] mt-0.5',
              tone === 'clear' ? 'text-emerald-800' : tone === 'warn' ? 'text-amber-900' : 'text-rose-900',
            )}>
              [ {r.status.toUpperCase()} ]
            </div>
            <div className={cn(
              'mono text-[9.5px] uppercase tracking-[0.14em] mt-0.5',
              tone === 'clear' ? 'text-emerald-700/70' : tone === 'warn' ? 'text-amber-800/70' : 'text-rose-800/70',
            )}>
              as of {r.fetchedAt.replace(' UTC', '')}
            </div>
          </div>
        </div>
      </div>

      {/* Provenance bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-slate-100 border-b border-slate-200 text-[12px]">
        <ProvCell k="Badge" v={r.badgeId} mono />
        <ProvCell k="Issued" v={r.issued} mono />
        <ProvCell k="Expires" v={`${r.expiresInDays}d`} mono detail={r.expires} />
        <ProvCell k="Issuer" v={r.issuerDid} mono />
      </div>

      {/* Footer actions */}
      <div className="px-7 py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3 bg-slate-50/40">
        <div className="mono text-[10.5px] uppercase tracking-[0.14em] text-slate-600 inline-flex items-center gap-2">
          <Icon.ShieldCheck size={12} className="text-emerald-700" />
          Signature checked locally · re-fetch any time at this URL
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={onInspect} className="mono text-[10.5px] uppercase tracking-[0.14em] border border-slate-900 text-slate-900 bg-white hover:bg-slate-50 px-3 h-8 rounded-[3px] inline-flex items-center gap-2">
            <Icon.Search size={12} /> Inspect cryptographically
          </button>
          <button onClick={onEmbed} className="mono text-[10.5px] uppercase tracking-[0.14em] border border-slate-900 text-slate-900 bg-white hover:bg-slate-50 px-3 h-8 rounded-[3px] inline-flex items-center gap-2">
            <Icon.Code size={12} /> Embed on your site
          </button>
          <button onClick={onReverify} className="mono text-[10.5px] uppercase tracking-[0.14em] bg-slate-900 text-white hover:bg-black px-3 h-8 rounded-[3px] inline-flex items-center gap-2">
            <Icon.Refresh size={12} /> Verify another
          </button>
        </div>
      </div>
    </div>
  );
}

function ProvCell({ k, v, mono, detail }) {
  return (
    <div className="px-5 py-3">
      <div className="mono text-[9.5px] uppercase tracking-[0.14em] text-slate-500">{k}</div>
      <div className={cn('text-[12.5px] text-slate-900 mt-0.5 break-all', mono && 'mono text-[11.5px]')}>{v}</div>
      {detail && <div className="mono text-[10px] text-slate-500 mt-0.5">{detail}</div>}
    </div>
  );
}

function SourceByLane({ result }) {
  return (
    <div>
      <SectionHeader
        eyebrow="§2 · Source-by-source result"
        title="What each registry said"
        right={
          <span className="mono text-[10.5px] uppercase tracking-[0.14em] text-slate-500">
            {result.checks.length} sources · re-fetched at {result.fetchedAt.replace(' UTC', '')}
          </span>
        }
      />
      <div className="border border-slate-200 rounded-[3px] overflow-hidden bg-white">
        <ul className="divide-y divide-slate-100">
          {result.checks.map((c, i) => (
            <li key={i} className="grid grid-cols-[24px_180px_1fr_120px_140px] items-center px-4 py-3 hover:bg-emerald-50/20">
              <span className={cn('h-2.5 w-2.5 rounded-full', c.ok ? 'bg-emerald-500' : 'bg-rose-500')} />
              <span className="mono text-[11.5px] text-slate-900 font-medium">{c.source}</span>
              <span className="text-[13px] text-slate-800">{c.statement}</span>
              <span className={cn(
                'mono text-[10.5px] uppercase tracking-[0.14em] text-right',
                c.ok ? 'text-emerald-700' : 'text-rose-700',
              )}>
                {c.verb}
              </span>
              <span className="mono text-[10px] text-slate-500 text-right tabular-nums">
                {c.asOf.replace(' UTC', '')}
              </span>
            </li>
          ))}
        </ul>
      </div>
      <div className="mono text-[10.5px] text-slate-500 mt-2">
        Each row reflects what the named registry returned. VitalCV does not modify or
        re-interpret these statements.
      </div>
    </div>
  );
}

function CarefulFootnote() {
  return (
    <div className="border border-slate-200 rounded-[3px] bg-slate-50/60 p-5">
      <div className="mono text-[10.5px] uppercase tracking-[0.18em] text-slate-600 mb-2">What "clear" means here</div>
      <p className="text-[12.5px] text-slate-700 leading-[1.55]">
        A clear Trust Badge means none of the listed registries returned an adverse signal at fetch time.
        It is not an attestation of clinical competence, an assertion that the clinician is appropriate
        for any specific role, or a substitute for primary-source verification under NCQA, TJC, or DNV
        standards. For roles requiring credentialing, open the full Credentialing File.
      </p>
    </div>
  );
}

function VerifyShareCard({ result, onEmbed }) {
  const url = `https://verify.vitalcv.health/v/${result.badgeId}`;
  return (
    <div className="border border-slate-200 rounded-[3px] bg-white p-5">
      <div className="mono text-[10.5px] uppercase tracking-[0.18em] text-slate-500 mb-2">Share this verification</div>
      <div className="mono text-[11.5px] text-slate-900 break-all border border-slate-200 rounded-[3px] px-3 py-2 bg-slate-50">
        {url}
      </div>
      <div className="grid grid-cols-2 gap-2 mt-3">
        <button className="mono text-[10.5px] uppercase tracking-[0.14em] border border-slate-300 text-slate-700 bg-white hover:bg-slate-50 px-3 h-8 rounded-[3px] inline-flex items-center justify-center gap-1.5">
          <Icon.Copy size={12} /> Copy link
        </button>
        <button onClick={onEmbed} className="mono text-[10.5px] uppercase tracking-[0.14em] border border-slate-300 text-slate-700 bg-white hover:bg-slate-50 px-3 h-8 rounded-[3px] inline-flex items-center justify-center gap-1.5">
          <Icon.Code size={12} /> Embed
        </button>
      </div>
      <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-100">
        <MiniQR />
        <div className="text-right">
          <div className="mono text-[10px] uppercase tracking-[0.14em] text-slate-500">Receipt hash</div>
          <div className="mono text-[10.5px] text-slate-900 break-all">{result.receiptHash.slice(0, 18)}…</div>
        </div>
      </div>
    </div>
  );
}

function MiniQR() {
  // Tiny decorative QR — same generator as wave12, smaller.
  const cells = [];
  const seed = [11,7,3,13,17,5,19,23,2,29,31,41,43,47,53,59];
  for (let y = 0; y < 17; y++) {
    for (let x = 0; x < 17; x++) {
      const v = (seed[(x*3 + y) % seed.length] + x*y) % 7;
      cells.push({ x, y, on: v < 3 });
    }
  }
  return (
    <div className="border border-slate-300 rounded-[2px] p-1.5 bg-white">
      <svg viewBox="0 0 17 17" width={64} height={64} className="block">
        <rect width="17" height="17" fill="#ffffff" />
        {cells.filter(c => c.on).map((c, i) =>
          <rect key={i} x={c.x} y={c.y} width="1" height="1" fill="#0f172a" />
        )}
        {[[0,0],[10,0],[0,10]].map(([ox,oy],i) => (
          <g key={i}>
            <rect x={ox}   y={oy}   width="7" height="7" fill="#0f172a" />
            <rect x={ox+1} y={oy+1} width="5" height="5" fill="#ffffff" />
            <rect x={ox+2} y={oy+2} width="3" height="3" fill="#0f172a" />
          </g>
        ))}
      </svg>
    </div>
  );
}

// ============================================================
// Cryptographic Inspector — modal
// ============================================================
function ReceiptInspectorModal({ result, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="bg-white border-2 border-slate-900 rounded-[3px] max-w-[760px] w-full max-h-[88vh] overflow-y-auto">
        <div className="sticky top-0 bg-slate-900 text-white px-6 py-3 flex items-center justify-between">
          <div className="mono text-[10.5px] uppercase tracking-[0.2em]">Cryptographic inspector</div>
          <button onClick={onClose} className="mono text-[10.5px] uppercase tracking-[0.14em] hover:text-emerald-300">Close ✕</button>
        </div>
        <div className="px-6 py-5 space-y-5">
          <InspectorRow k="Token (ULID)"    v={result.token} />
          <InspectorRow k="Badge ID"        v={result.badgeId} />
          <InspectorRow k="Issued"          v={result.issued} />
          <InspectorRow k="Expires"         v={result.expires} />
          <InspectorRow k="Issuer DID"      v={result.issuerDid} />
          <InspectorRow k="Public key"      v={result.publicKey} />
          <InspectorRow k="Receipt hash"    v={result.receiptHash} long />

          <div className="border-t border-slate-200 pt-4">
            <div className="mono text-[10.5px] uppercase tracking-[0.18em] text-slate-500 mb-2">VC 2.0 envelope (excerpt)</div>
            <pre className="mono text-[11px] text-slate-800 bg-slate-50 border border-slate-200 rounded-[3px] p-3 overflow-x-auto leading-[1.55]">{`{
  "@context": ["https://www.w3.org/ns/credentials/v2"],
  "type": ["VerifiableCredential", "TrustBadgeCredential"],
  "issuer": "${result.issuerDid}",
  "validFrom": "${result.issued}",
  "validUntil": "${result.expires}",
  "credentialSubject": {
    "id": "did:vcv:npi:${result.subject.npi}",
    "name": "${result.subject.name}",
    "scope": "${result.scope}"
  },
  "credentialStatus": {
    "type": "StatusList2021Entry",
    "statusListIndex": "8841"
  },
  "proof": {
    "type": "DataIntegrityProof",
    "cryptosuite": "eddsa-2022",
    "proofValue": "${result.receiptHash}"
  }
}`}</pre>
          </div>

          <div className="border-t border-slate-200 pt-4">
            <div className="mono text-[10.5px] uppercase tracking-[0.18em] text-slate-500 mb-2">Verification trace</div>
            <ul className="space-y-1.5">
              {VERIFY_STAGES.map(s => (
                <li key={s.id} className="grid grid-cols-[16px_1fr] gap-2 items-baseline">
                  <span className="mono text-[10px] text-emerald-700">✓</span>
                  <div>
                    <div className="text-[12px] text-slate-900">{s.label}</div>
                    <div className="mono text-[10px] text-slate-500">{s.detail}</div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

function InspectorRow({ k, v, long }) {
  return (
    <div className={cn('grid gap-2', long ? 'grid-cols-1' : 'grid-cols-[140px_1fr] items-baseline')}>
      <div className="mono text-[10px] uppercase tracking-[0.14em] text-slate-500">{k}</div>
      <div className="mono text-[11.5px] text-slate-900 break-all">{v}</div>
    </div>
  );
}

// ============================================================
// Embed snippet modal
// ============================================================
function EmbedSnippetModal({ result, onClose }) {
  const snippet = `<iframe
  src="https://verify.vitalcv.health/embed/${result.badgeId}"
  width="320" height="120"
  style="border:0"
  title="VitalCV Trust Badge — ${result.subject.name}">
</iframe>`;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="bg-white border-2 border-slate-900 rounded-[3px] max-w-[640px] w-full">
        <div className="bg-slate-900 text-white px-6 py-3 flex items-center justify-between">
          <div className="mono text-[10.5px] uppercase tracking-[0.2em]">Embed this verification</div>
          <button onClick={onClose} className="mono text-[10.5px] uppercase tracking-[0.14em] hover:text-emerald-300">Close ✕</button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <div className="mono text-[10.5px] uppercase tracking-[0.18em] text-slate-500 mb-2">Iframe snippet</div>
            <pre className="mono text-[11.5px] text-slate-900 bg-slate-50 border border-slate-200 rounded-[3px] p-3 overflow-x-auto leading-[1.55]">{snippet}</pre>
          </div>
          <p className="text-[12px] text-slate-600 leading-[1.55]">
            The embedded badge auto-refreshes its status from the issuer. If the badge is revoked or
            expires, your page reflects that within minutes — no code changes needed.
          </p>
          <div className="flex items-center justify-end gap-2">
            <button className="mono text-[10.5px] uppercase tracking-[0.14em] border border-slate-300 text-slate-700 bg-white hover:bg-slate-50 px-3 h-8 rounded-[3px]">Copy snippet</button>
            <button onClick={onClose} className="mono text-[10.5px] uppercase tracking-[0.14em] bg-slate-900 text-white hover:bg-black px-3 h-8 rounded-[3px]">Done</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Always-visible explainer below the fold
// ============================================================
function VerifyExplainerStrip() {
  const items = [
    { eyebrow: 'For schedulers', title: 'Use this before you put someone on the calendar.', body: 'A clear badge tells you nothing adverse showed up across six core registries within the last minute. It is fast enough to use during the call.' },
    { eyebrow: 'For agencies',   title: 'Drop the badge into your candidate profile.',     body: 'The embed snippet keeps a live verification status next to the candidate, so internal stakeholders see the same answer you do.' },
    { eyebrow: 'For payers',     title: 'Pre-screen before delegated credentialing review.', body: 'A Trust Badge cannot replace the Credentialing File. It can flag the obvious disqualifiers earlier — sanctions, exclusions, expirations.' },
  ];
  return (
    <div className="mt-12 pt-10 border-t border-slate-200">
      <div className="mono text-[10.5px] uppercase tracking-[0.18em] text-slate-500 mb-4">When to use this page</div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {items.map((it, i) => (
          <div key={i} className="border border-slate-200 rounded-[3px] bg-white p-5">
            <div className="mono text-[10px] uppercase tracking-[0.14em] text-emerald-700">{it.eyebrow}</div>
            <div className="text-[15px] font-semibold text-slate-900 mt-1.5 leading-snug" style={{ fontFamily: 'ui-serif, Georgia, serif' }}>{it.title}</div>
            <p className="text-[12.5px] text-slate-600 mt-2 leading-[1.55]">{it.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
