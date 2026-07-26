// WAVE 17 · Cryptographic Proof Dossier components

/* ---------- Custody Ledger Table ---------- */
function CustodyLedger({ rows, onInspect }) {
  return (
    <div className="border border-slate-200 rounded-[3px] bg-white overflow-hidden">
      <div className="px-5 py-2.5 border-b border-slate-200 bg-slate-50/60 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon.GitBranch size={13} className="text-slate-700" />
          <span className="text-[13px] font-semibold text-slate-900">Chain of Custody · forensic ledger</span>
        </div>
        <div className="mono text-[10.5px] uppercase tracking-[0.14em] text-slate-500">
          {rows.length} receipts · hash-linked · Ed25519
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[11.5px] mono">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/30 text-[10px] uppercase tracking-[0.14em] text-slate-500">
              <th className="text-left px-3 py-2 font-medium w-[28px]">#</th>
              <th className="text-left px-3 py-2 font-medium">Timestamp · UTC</th>
              <th className="text-left px-3 py-2 font-medium">Actor</th>
              <th className="text-left px-3 py-2 font-medium">Check</th>
              <th className="text-left px-3 py-2 font-medium">Source / Endpoint</th>
              <th className="text-left px-3 py-2 font-medium">M</th>
              <th className="text-right px-3 py-2 font-medium">Status</th>
              <th className="text-right px-3 py-2 font-medium">ms</th>
              <th className="text-left px-3 py-2 font-medium">Hash (sha256)</th>
              <th className="text-right px-3 py-2 font-medium">Verb</th>
              <th className="px-3 py-2 w-[40px]"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r, i) => {
              const v = VERB_META[r.verb];
              return (
                <tr key={r.id} className="lane-row hover:bg-slate-50/80 cursor-pointer" onClick={() => onInspect && onInspect(r.id)}>
                  <td className="px-3 py-2 text-slate-500 tabular-nums">{String(i + 1).padStart(3, '0')}</td>
                  <td className="px-3 py-2 text-slate-900 tabular-nums whitespace-nowrap">{r.ts}</td>
                  <td className="px-3 py-2 text-slate-700 truncate max-w-[180px]">{r.actor}</td>
                  <td className="px-3 py-2 text-slate-900 whitespace-nowrap">{r.kind}</td>
                  <td className="px-3 py-2 text-slate-600 truncate max-w-[280px]" title={r.source}>{r.source}</td>
                  <td className="px-3 py-2 text-slate-700">{r.method}</td>
                  <td className="px-3 py-2 text-right text-slate-700 tabular-nums">{r.status}</td>
                  <td className="px-3 py-2 text-right text-slate-500 tabular-nums">{r.latencyMs}</td>
                  <td className="px-3 py-2 text-slate-900 truncate max-w-[180px]">{r.hash.slice(0, 14)}…{r.hash.slice(-6)}</td>
                  <td className="px-3 py-2 text-right">
                    <span className={cn('px-1.5 py-0.5 rounded-[2px] ring-1 ring-inset text-[10px] uppercase tracking-[0.06em] font-medium', v.cls)}>
                      {v.label}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-slate-400 hover:text-slate-900">
                    <Icon.ChevronRight size={12} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ---------- Receipt Inspector (modal-style panel) ---------- */
function ReceiptInspector({ detail, onClose }) {
  if (!detail) return null;
  return (
    <div className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-6">
      <div className="bg-white border border-slate-300 rounded-[3px] w-full max-w-[920px] max-h-[88vh] overflow-hidden flex flex-col">
        <div className="px-5 py-3 border-b border-slate-200 bg-slate-50/60 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon.Stamp size={13} className="text-slate-700" />
            <span className="text-[13px] font-semibold text-slate-900">Receipt Inspector</span>
            <span className="mono text-[10.5px] text-slate-500">· {detail.id}</span>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-900">
            <Icon.X size={14} />
          </button>
        </div>

        <div className="grid grid-cols-12 flex-1 min-h-0">
          {/* Left: structured envelope */}
          <div className="col-span-7 border-r border-slate-200 p-5 overflow-auto">
            <div className="mono text-[10.5px] uppercase tracking-[0.14em] text-slate-500 mb-2">VC 2.0 Envelope</div>
            <pre className="mono text-[11px] leading-[1.65] bg-slate-50 border border-slate-200 rounded-[2px] p-4 overflow-auto text-slate-900">
{JSON.stringify(detail.envelope, null, 2)}
            </pre>

            <div className="mono text-[10.5px] uppercase tracking-[0.14em] text-slate-500 mb-2 mt-5">Signature</div>
            <div className="border border-slate-200 rounded-[2px] divide-y divide-slate-100">
              <div className="px-3 py-2 grid grid-cols-3 gap-3">
                <span className="mono text-[10.5px] text-slate-500 uppercase tracking-[0.1em]">alg</span>
                <span className="col-span-2 mono text-[11.5px] text-slate-900">{detail.signature.alg}</span>
              </div>
              <div className="px-3 py-2 grid grid-cols-3 gap-3">
                <span className="mono text-[10.5px] text-slate-500 uppercase tracking-[0.1em]">kid</span>
                <span className="col-span-2 mono text-[11.5px] text-slate-900 break-all">{detail.signature.kid}</span>
              </div>
              <div className="px-3 py-2 grid grid-cols-3 gap-3">
                <span className="mono text-[10.5px] text-slate-500 uppercase tracking-[0.1em]">sig</span>
                <span className="col-span-2 mono text-[11px] text-slate-700 break-all">{detail.signature.sig}</span>
              </div>
            </div>
          </div>

          {/* Right: verification status */}
          <div className="col-span-5 p-5 overflow-auto">
            <div className="mono text-[10.5px] uppercase tracking-[0.14em] text-slate-500 mb-2">Verification</div>
            <div className="space-y-2">
              {[
                { k: 'Signature', v: 'Valid · matches issuer key', ok: true },
                { k: 'Hash chain', v: 'Linked to prev · integrity OK', ok: true },
                { k: 'Issuer DID', v: 'Resolved · vitalcv.health', ok: true },
                { k: 'Anchor', v: 'Found in checkpoint vc-merkle-31', ok: true },
                { k: 'Time skew', v: '±0.4s vs RFC3161 timestamp', ok: true },
                { k: 'Replay risk', v: 'Nonce unique · not seen', ok: true },
              ].map((r, i) => (
                <div key={i} className="border border-slate-200 rounded-[2px] px-3 py-2 flex items-center justify-between">
                  <div>
                    <div className="text-[12px] text-slate-900">{r.k}</div>
                    <div className="mono text-[10.5px] text-slate-500">{r.v}</div>
                  </div>
                  <Icon.Check size={12} className="text-emerald-600" strokeWidth={2.5} />
                </div>
              ))}
            </div>

            <div className="mono text-[10.5px] uppercase tracking-[0.14em] text-slate-500 mt-5 mb-2">Source artifact</div>
            <div className="border border-slate-200 rounded-[2px] p-3">
              <div className="mono text-[10.5px] text-slate-500">SHA-256 of fetched payload</div>
              <div className="mono text-[11.5px] text-slate-900 mt-1 break-all">{detail.envelope.evidence_sha256}</div>
              <a href="#" className="mono text-[10.5px] uppercase tracking-[0.08em] text-indigo-700 hover:underline mt-2 inline-flex items-center gap-1">
                Fetch original <Icon.ExternalLink size={10} />
              </a>
            </div>
          </div>
        </div>

        <div className="px-5 py-3 border-t border-slate-200 bg-slate-50/40 flex items-center justify-between">
          <div className="mono text-[10.5px] text-slate-500">Receipt verified locally · no network call required for proof.</div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" iconLeft={<Icon.Copy size={11} />}>Copy JSON</Button>
            <Button size="sm" variant="outline" iconLeft={<Icon.Download size={11} />}>Download .vc2</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- Regulatory Mapping ---------- */
function RegulatoryMapping({ rows }) {
  return (
    <div className="border border-slate-200 rounded-[3px] bg-white overflow-hidden">
      <div className="px-5 py-2.5 border-b border-slate-200 bg-slate-50/60 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon.Layers size={13} className="text-slate-700" />
          <span className="text-[13px] font-semibold text-slate-900">Regulatory Mapping · evidence → standard</span>
        </div>
        <div className="mono text-[10.5px] uppercase tracking-[0.14em] text-slate-500">
          {rows.length} mappings · {rows.filter(r => r.satisfied).length} satisfied
        </div>
      </div>
      <table className="w-full text-[12px]">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50/30">
            <th className="text-left mono text-[10px] uppercase tracking-[0.14em] text-slate-500 font-medium px-5 py-2.5">Receipt</th>
            <th className="text-left mono text-[10px] uppercase tracking-[0.14em] text-slate-500 font-medium py-2.5">Authority · Standard</th>
            <th className="text-left mono text-[10px] uppercase tracking-[0.14em] text-slate-500 font-medium py-2.5">Topic</th>
            <th className="text-left mono text-[10px] uppercase tracking-[0.14em] text-slate-500 font-medium py-2.5">Detail</th>
            <th className="text-right mono text-[10px] uppercase tracking-[0.14em] text-slate-500 font-medium px-5 py-2.5">Outcome</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((r, i) => (
            <tr key={i} className="lane-row">
              <td className="px-5 py-2.5 mono text-[11px] text-slate-700">{r.receiptId}</td>
              <td className="py-2.5">
                <span className="mono text-[11.5px] text-slate-900">{r.authority}</span>
                <span className="mono text-[11px] text-slate-500"> · {r.std}</span>
              </td>
              <td className="py-2.5 text-[12px] text-slate-900">{r.topic}</td>
              <td className="py-2.5 text-[11.5px] text-slate-600 leading-[1.5] max-w-[460px]">{r.detail}</td>
              <td className="px-5 py-2.5 text-right">
                <span className={cn('inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[2px] ring-1 ring-inset text-[10px] uppercase tracking-[0.06em] font-medium',
                  r.satisfied ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/20' : 'bg-rose-50 text-rose-700 ring-rose-600/20')}>
                  {r.satisfied ? <Icon.Check size={10} strokeWidth={2.5} /> : <Icon.X size={10} strokeWidth={2.5} />}
                  {r.satisfied ? 'Satisfied' : 'Gap'}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ---------- Auditor Export ---------- */
function AuditorExport() {
  const [picked, setPicked] = React.useState('json');
  const opts = [
    { id: 'json',   label: 'JSON · full ledger',    sub: 'All receipts + envelopes + signatures · machine-readable',     bytes: '1.4 MB' },
    { id: 'pdf',    label: 'Signed PDF binder',     sub: 'Tabulated · signed by VitalCV CVO · auditor-friendly print',   bytes: '12.8 MB' },
    { id: 'link',   label: 'Time-bound auditor link', sub: 'Read-only URL · 14-day TTL · IP allow-list optional',          bytes: 'no download' },
  ];
  return (
    <div className="border border-slate-200 rounded-[3px] bg-white overflow-hidden">
      <div className="px-5 py-2.5 border-b border-slate-200 bg-slate-50/60 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon.Download size={13} className="text-slate-700" />
          <span className="text-[13px] font-semibold text-slate-900">Auditor Export</span>
        </div>
        <div className="mono text-[10.5px] uppercase tracking-[0.14em] text-slate-500">{DOSSIER_META.fileId}</div>
      </div>
      <div className="p-5 grid grid-cols-3 gap-4">
        {opts.map(o => (
          <button key={o.id} onClick={() => setPicked(o.id)} className={cn(
            'text-left border rounded-[3px] p-4 transition-colors',
            picked === o.id ? 'border-slate-900 bg-slate-50' : 'border-slate-200 hover:border-slate-400'
          )}>
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-semibold text-slate-900">{o.label}</span>
              <span className={cn('h-3 w-3 rounded-full ring-2', picked === o.id ? 'bg-slate-900 ring-slate-900' : 'bg-white ring-slate-300')} />
            </div>
            <div className="text-[11.5px] text-slate-600 mt-1 leading-[1.5]">{o.sub}</div>
            <div className="mono text-[10.5px] text-slate-500 mt-2">{o.bytes}</div>
          </button>
        ))}
      </div>
      <div className="px-5 py-3 border-t border-slate-200 bg-slate-50/40 flex items-center justify-between">
        <div className="mono text-[10.5px] text-slate-500">
          Sealed by <span className="text-slate-900">{DOSSIER_META.signingKey}</span> · root <span className="text-slate-900">{DOSSIER_META.rootHash.slice(0, 18)}…</span>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline">Add scope filter</Button>
          <Button size="sm" iconRight={<Icon.ArrowRight size={11} />}>Generate export</Button>
        </div>
      </div>
    </div>
  );
}

window.CustodyLedger = CustodyLedger;
window.ReceiptInspector = ReceiptInspector;
window.RegulatoryMapping = RegulatoryMapping;
window.AuditorExport = AuditorExport;
