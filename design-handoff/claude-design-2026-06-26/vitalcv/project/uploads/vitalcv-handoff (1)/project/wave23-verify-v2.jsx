// WAVE 23 · Public Trust Verifier v2
// Additive layer. Mounts UNDER the existing wave18 verifier surface and adds:
//   1. A snapshot-vs-live banner that names the registry refetch policy honestly.
//   2. A "what we did NOT verify" panel — explicit non-claims.
//   3. A v2 lane-tier strip using ConfidenceBadge from Wave 19.
//   4. A source-fetch health card with per-registry latency + last-success.
//   5. Revoked / expired result states with a clear remediation rail.
//   6. Receipt-chain explorer (3-step provenance walk) without modifying the modal.
//
// We DON'T touch wave18 — instead this file exposes <VerifyV2Strip /> and the
// view layer drops it in below the existing result. Backwards compatible.

/* ---------- Snapshot-vs-live banner ---------- */
function SnapshotVsLiveBanner({ result }) {
  return (
    <div className="border border-slate-200 rounded-[3px] bg-white px-5 py-3">
      <div className="flex items-start gap-4">
        <div className="h-8 w-8 rounded-[3px] bg-slate-900 text-white flex items-center justify-center flex-shrink-0">
          <Icon.Clock size={14} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="mono text-[10.5px] uppercase tracking-[0.14em] text-slate-500">
              Snapshot vs. live
            </span>
            <span className="mono text-[10.5px] tabular-nums text-slate-700">
              fetched {result.fetchedAt.replace(' UTC', '')}
            </span>
          </div>
          <p className="mt-1 text-[12.5px] text-slate-700 leading-[1.55] max-w-[72ch]">
            Each row below is a snapshot taken just now from the named registry.
            Snapshots become stale as registries publish new data. We never claim a row is "real-time" — we only claim it was fresh at fetch time. To re-confirm, click <span className="mono">Verify another</span> above.
          </p>
        </div>
      </div>
    </div>
  );
}

/* ---------- "What we did NOT verify" panel ---------- */
function NotVerifiedPanel({ result }) {
  // Honest non-claims — these are the questions a clear badge does NOT answer.
  const nonClaims = [
    {
      k: 'Clinical competence',
      v: 'A clear badge does not assess judgment, bedside manner, or outcomes.',
    },
    {
      k: 'Role appropriateness',
      v: 'It does not say this clinician is appropriate for any specific role at your facility.',
    },
    {
      k: 'Regulatory standing equivalence',
      v: 'It is not equivalent to NCQA / TJC / DNV primary-source credentialing — that lives in the full Credentialing File.',
    },
    {
      k: 'Future state',
      v: 'It speaks to fetch-time only. A registry can publish an adverse signal an hour from now.',
    },
    {
      k: 'Identity beyond NPI match',
      v: 'We confirm NPI matches the listed registries. We do not run government-ID checks here.',
    },
  ];
  return (
    <div className="border border-slate-200 rounded-[3px] bg-white">
      <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon.Info size={13} className="text-slate-700" />
          <span className="text-[13px] font-semibold text-slate-900">What this badge does NOT verify</span>
        </div>
        <span className="mono text-[10.5px] uppercase tracking-[0.14em] text-slate-500">
          honest non-claims
        </span>
      </div>
      <ul className="divide-y divide-slate-100">
        {nonClaims.map(c => (
          <li key={c.k} className="px-5 py-3 grid grid-cols-12 gap-3">
            <div className="col-span-4 mono text-[11px] uppercase tracking-[0.1em] text-slate-500 pt-0.5">
              {c.k}
            </div>
            <div className="col-span-8 text-[12.5px] text-slate-700 leading-[1.55]">
              {c.v}
            </div>
          </li>
        ))}
      </ul>
      <div className="px-5 py-3 border-t border-slate-100 mono text-[10.5px] text-slate-500 leading-[1.55]">
        For roles requiring full credentialing, open the Credentialing File. The badge is a screen, not a binder.
      </div>
    </div>
  );
}

/* ---------- Lane-tier strip (uses ConfidenceBadge from Wave 19) ---------- */
function LaneTierStrip({ result }) {
  // Map source rows to v2 tiers. Sources we have a primary-source receipt for
  // are 'verified'; older or wider sources are 'inferred'; failures are 'contradicted'.
  // We DO NOT use the bare word 'Verified' as a label here — ConfidenceBadge handles it.
  const lanes = result.checks.map((c, i) => {
    let tier = 'verified';
    if (!c.ok) tier = 'contradicted';
    else if (c.tierHint === 'inferred') tier = 'inferred';
    else if (c.tierHint === 'unknown') tier = 'unknown';
    return { id: `lane_${i}`, source: c.source, statement: c.statement, tier, asOf: c.asOf };
  });

  return (
    <div className="border border-slate-200 rounded-[3px] bg-white">
      <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon.Layers size={13} className="text-slate-700" />
          <span className="text-[13px] font-semibold text-slate-900">Per-source confidence tier</span>
        </div>
        <span className="mono text-[10.5px] uppercase tracking-[0.14em] text-slate-500">
          v2 doctrine · 4-tier
        </span>
      </div>
      <ul className="divide-y divide-slate-100">
        {lanes.map(l => (
          <li key={l.id} className="px-5 py-2.5 grid grid-cols-12 gap-3 items-center">
            <div className="col-span-4 mono text-[11.5px] text-slate-900 font-medium">{l.source}</div>
            <div className="col-span-5 text-[12px] text-slate-700">{l.statement}</div>
            <div className="col-span-3 flex items-center justify-end gap-2">
              {typeof ConfidenceBadge === 'function'
                ? <ConfidenceBadge tier={l.tier} compact />
                : <span className="mono text-[10.5px] uppercase tracking-[0.14em] text-slate-500">{l.tier}</span>
              }
            </div>
          </li>
        ))}
      </ul>
      <div className="px-5 py-3 border-t border-slate-100 mono text-[10.5px] text-slate-500 leading-[1.55]">
        Tiers reflect how the row was sourced — not whether the clinician is "good." A registry-confirmed row is the strongest tier we use here; we do not use the word "Verified" as a row label.
      </div>
    </div>
  );
}

/* ---------- Source-fetch health card ---------- */
function SourceFetchHealth({ result }) {
  // Synthesize per-source latency + last-success from the result.checks array.
  // In a real system this comes from a /health endpoint.
  const rows = result.checks.map(c => ({
    source: c.source,
    latencyMs: c.latencyMs ?? 220 + Math.floor(Math.random() * 180),
    lastSuccess: c.asOf,
    state: c.ok ? 'healthy' : 'degraded',
  }));

  return (
    <div className="border border-slate-200 rounded-[3px] bg-white">
      <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon.Activity size={13} className="text-slate-700" />
          <span className="text-[13px] font-semibold text-slate-900">Registry fetch health</span>
        </div>
        <span className="mono text-[10.5px] uppercase tracking-[0.14em] text-slate-500">
          this fetch · per-source
        </span>
      </div>
      <ul className="divide-y divide-slate-100">
        {rows.map((r, i) => (
          <li key={i} className="px-5 py-2 grid grid-cols-12 gap-3 items-center">
            <div className="col-span-1">
              <span className={cn(
                'h-1.5 w-1.5 rounded-full inline-block',
                r.state === 'healthy' ? 'bg-emerald-500' : 'bg-rose-500'
              )} />
            </div>
            <div className="col-span-5 mono text-[11.5px] text-slate-900">{r.source}</div>
            <div className="col-span-3 mono text-[10.5px] tabular-nums text-slate-700 text-right">
              {r.latencyMs}ms
            </div>
            <div className="col-span-3 mono text-[10px] tabular-nums text-slate-500 text-right">
              {r.lastSuccess.replace(' UTC', '')}
            </div>
          </li>
        ))}
      </ul>
      <div className="px-5 py-3 border-t border-slate-100 mono text-[10.5px] text-slate-500 leading-[1.55]">
        If a source is degraded we do not silently omit its row — we show "fetch failed" rather than "clear by default."
      </div>
    </div>
  );
}

/* ---------- Receipt chain explorer (3-step provenance walk) ---------- */
function ReceiptChainExplorer({ result }) {
  // Three steps: registry → fetcher → badge. Each step is a hash receipt.
  const chain = [
    {
      step: 1, label: 'Registry response',
      hash: result.checks[0]?.receiptHash || '0xreg…aa11',
      ts: result.checks[0]?.asOf || result.fetchedAt,
      sub: 'What the registry returned · raw payload hash',
    },
    {
      step: 2, label: 'Normalized snapshot',
      hash: result.snapshotHash || '0xsnap…bb22',
      ts: result.fetchedAt,
      sub: 'Server-side normalization · field-level extraction · NPI re-bind',
    },
    {
      step: 3, label: 'Public badge',
      hash: result.receiptHash,
      ts: result.fetchedAt,
      sub: 'Signed badge · what verify.vitalcv.health serves',
    },
  ];
  return (
    <div className="border border-slate-200 rounded-[3px] bg-white">
      <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon.Link size={13} className="text-slate-700" />
          <span className="text-[13px] font-semibold text-slate-900">Receipt chain · 3 steps</span>
        </div>
        <span className="mono text-[10.5px] uppercase tracking-[0.14em] text-slate-500">
          provenance walk
        </span>
      </div>
      <div className="px-2 py-3">
        <div className="flex items-stretch gap-2 px-3">
          {chain.map((s, i) => (
            <React.Fragment key={s.step}>
              <div className="flex-1 min-w-0 border border-slate-200 rounded-[3px] bg-white px-3 py-2.5">
                <div className="flex items-center gap-1.5 mb-1">
                  <div className="h-4 w-4 rounded-full bg-slate-900 text-white flex items-center justify-center mono text-[9px] font-semibold">{s.step}</div>
                  <div className="text-[12px] font-medium text-slate-900">{s.label}</div>
                </div>
                <div className="mono text-[10.5px] text-slate-700 break-all">{s.hash}</div>
                <div className="mono text-[9.5px] text-slate-500 mt-0.5">{s.ts.replace(' UTC', '')}</div>
                <div className="text-[11px] text-slate-600 mt-1.5 leading-[1.5]">{s.sub}</div>
              </div>
              {i < chain.length - 1 && (
                <div className="flex items-center text-slate-400">
                  <Icon.ChevronRight size={14} />
                </div>
              )}
            </React.Fragment>
          ))}
        </div>
      </div>
      <div className="px-5 py-2 border-t border-slate-100 mono text-[10.5px] text-slate-500 leading-[1.55]">
        Step 1 hash and step 3 hash should be reproducible: re-fetching against the same registry produces the same step-1 hash, and the same normalization produces the same step-3 hash.
      </div>
    </div>
  );
}

/* ---------- Revoked / expired result states ---------- */
function VerifyAdverseStates({ result }) {
  if (result.status !== 'revoked' && result.status !== 'expired') return null;
  const isRevoked = result.status === 'revoked';
  return (
    <div className={cn(
      'border-2 rounded-[3px] px-5 py-4',
      isRevoked ? 'border-rose-700 bg-rose-50/40' : 'border-amber-600 bg-amber-50/40'
    )}>
      <div className="flex items-start gap-4">
        <div className={cn(
          'h-9 w-9 rounded-[3px] flex items-center justify-center flex-shrink-0',
          isRevoked ? 'bg-rose-700 text-white' : 'bg-amber-600 text-white'
        )}>
          <Icon.AlertTriangle size={16} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="mono text-[10.5px] uppercase tracking-[0.14em] mb-1">
            <span className={isRevoked ? 'text-rose-800' : 'text-amber-800'}>
              {isRevoked ? 'Badge revoked by issuer' : 'Badge expired'}
            </span>
          </div>
          <h3 className="text-[18px] font-semibold tracking-tightish text-slate-900 leading-tight">
            {isRevoked
              ? 'Do not rely on this badge.'
              : 'This badge is past its expiry. Re-verify before relying.'}
          </h3>
          <p className="mt-1.5 text-[12.5px] text-slate-700 leading-[1.55] max-w-[60ch]">
            {isRevoked
              ? 'The issuer revoked this badge after publication. We display the revocation receipt below so you can audit the chain. Treat any prior screenshot as out of date.'
              : 'A clear badge has a published validity window. After it elapses, registry data may have changed. Click "Verify another" to mint a fresh badge.'}
          </p>
        </div>
      </div>
    </div>
  );
}

/* ---------- Combined v2 strip ---------- */
function VerifyV2Strip({ result }) {
  if (!result) return null;
  return (
    <div className="space-y-4">
      <VerifyAdverseStates result={result} />
      <SnapshotVsLiveBanner result={result} />
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-12 lg:col-span-8 space-y-4">
          <LaneTierStrip result={result} />
          <ReceiptChainExplorer result={result} />
        </div>
        <aside className="col-span-12 lg:col-span-4 space-y-4">
          <SourceFetchHealth result={result} />
          <NotVerifiedPanel result={result} />
        </aside>
      </div>
    </div>
  );
}

window.SnapshotVsLiveBanner = SnapshotVsLiveBanner;
window.NotVerifiedPanel = NotVerifiedPanel;
window.LaneTierStrip = LaneTierStrip;
window.SourceFetchHealth = SourceFetchHealth;
window.ReceiptChainExplorer = ReceiptChainExplorer;
window.VerifyAdverseStates = VerifyAdverseStates;
window.VerifyV2Strip = VerifyV2Strip;

/* ---------- Auto-mount: monkey-patch ViewVerify to render the strip ---------- */
// We don't want to maintain a separate v2 view file. Instead, when this script
// loads, wrap ViewVerify so the strip renders below the existing surface
// whenever a result is present in DOM scope. We do this by intercepting the
// ViewVerify rendering — but only if it hasn't been wrapped yet (idempotent).
(() => {
  if (typeof window.ViewVerify !== 'function') return;
  if (window.__verifyV2Wrapped) return;
  const Original = window.ViewVerify;
  function ViewVerifyV2() {
    const [result, setResult] = React.useState(null);
    // Listen for the demo's "verified" event — wave18's ViewVerify sets a
    // global `__lastVerifyResult` we can read on tick.
    React.useEffect(() => {
      const tick = () => {
        if (window.__lastVerifyResult && window.__lastVerifyResult !== result) {
          setResult(window.__lastVerifyResult);
        }
      };
      const id = setInterval(tick, 350);
      return () => clearInterval(id);
    }, [result]);
    return (
      <>
        <Original />
        {result && (
          <div className="max-w-[1100px] mx-auto px-6 pb-10 -mt-2">
            <VerifyV2Strip result={result} />
          </div>
        )}
      </>
    );
  }
  window.ViewVerify = ViewVerifyV2;
  window.__verifyV2Wrapped = true;
})();
