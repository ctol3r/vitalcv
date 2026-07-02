// VIEW · Cryptographic Proof Dossier

function ViewDossier() {
  const [inspecting, setInspecting] = React.useState(null);
  const meta = DOSSIER_META;

  const handleInspect = (id) => setInspecting(id);
  const detail = inspecting ? RECEIPT_DETAIL : null;

  return (
    <div className="max-w-[1400px] mx-auto px-6 py-10">
      {/* Header */}
      <div className="border border-slate-300 bg-slate-900 text-slate-100 rounded-[3px] p-6 mb-6">
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <div className="mono text-[10.5px] uppercase tracking-[0.2em] text-slate-400 mb-2">
              Cryptographic Proof Dossier · forensic
            </div>
            <h1 className="text-[28px] font-semibold tracking-[-0.02em] text-white leading-tight">
              Tamper-evident audit trail · {meta.fileId}
            </h1>
            <p className="mt-2 text-[13px] text-slate-300 leading-[1.55] max-w-[64ch]">
              Every primary-source check below is hash-linked, signed by the VitalCV CVO key, and anchored to an external timestamp checkpoint. An auditor can verify this dossier without contacting VitalCV.
            </p>
          </div>
          <div className="text-right">
            <div className="mono text-[10.5px] uppercase tracking-[0.14em] text-slate-400">Subject</div>
            <div className="text-[13px] text-white">{meta.subject}</div>
            <div className="mono text-[11px] text-slate-300">NPI {meta.npi}</div>
            <div className="mono text-[10.5px] uppercase tracking-[0.14em] text-slate-400 mt-3">Generated</div>
            <div className="mono text-[11px] text-slate-200">{meta.generatedAt}</div>
            <div className="mono text-[10.5px] text-slate-400">by {meta.generatedBy}</div>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-4 border-t border-slate-700 pt-4 gap-6">
          <div>
            <div className="mono text-[10px] uppercase tracking-[0.14em] text-slate-400">Receipts</div>
            <div className="mono text-[18px] text-white tabular-nums mt-0.5">{meta.receiptCount}</div>
          </div>
          <div>
            <div className="mono text-[10px] uppercase tracking-[0.14em] text-slate-400">Anchored checkpoints</div>
            <div className="mono text-[18px] text-white tabular-nums mt-0.5">{meta.checkpointCount}</div>
          </div>
          <div>
            <div className="mono text-[10px] uppercase tracking-[0.14em] text-slate-400">Algorithm</div>
            <div className="mono text-[14px] text-white mt-1">{meta.algorithm}</div>
          </div>
          <div>
            <div className="mono text-[10px] uppercase tracking-[0.14em] text-slate-400">Root hash</div>
            <div className="mono text-[12px] text-white mt-1 break-all">{meta.rootHash}</div>
          </div>
        </div>
      </div>

      {/* Custody Ledger */}
      <div className="mb-6">
        <CustodyLedger rows={CUSTODY_LEDGER} onInspect={handleInspect} />
      </div>

      {/* Regulatory Mapping */}
      <div className="mb-6">
        <RegulatoryMapping rows={REG_MAPPING} />
      </div>

      {/* Auditor Export */}
      <div className="mb-6">
        <AuditorExport />
      </div>

      {/* Footer */}
      <div className="mt-10 border-t border-slate-200 pt-6 grid grid-cols-12 gap-6">
        <div className="col-span-12 md:col-span-4">
          <div className="mono text-[10.5px] uppercase tracking-[0.18em] text-slate-500 mb-2">Forensic 01</div>
          <div className="text-[13px] font-semibold text-slate-900 mb-1">Hash-linked, not stored</div>
          <p className="text-[12px] text-slate-600 leading-[1.55]">Each receipt commits the previous receipt's hash. Tampering with row N invalidates rows N…end. The chain itself is the proof.</p>
        </div>
        <div className="col-span-12 md:col-span-4">
          <div className="mono text-[10.5px] uppercase tracking-[0.18em] text-slate-500 mb-2">Forensic 02</div>
          <div className="text-[13px] font-semibold text-slate-900 mb-1">External anchor</div>
          <p className="text-[12px] text-slate-600 leading-[1.55]">Quarterly Merkle roots are timestamped via RFC3161 and published. An auditor can prove this dossier existed before any disputed event.</p>
        </div>
        <div className="col-span-12 md:col-span-4">
          <div className="mono text-[10.5px] uppercase tracking-[0.18em] text-slate-500 mb-2">Forensic 03</div>
          <div className="text-[13px] font-semibold text-slate-900 mb-1">Verifiable offline</div>
          <p className="text-[12px] text-slate-600 leading-[1.55]">JSON exports are self-contained. Verification requires only the issuer's public DID document — no live API call to VitalCV.</p>
        </div>
      </div>

      {detail && <ReceiptInspector detail={detail} onClose={() => setInspecting(null)} />}
    </div>
  );
}
window.ViewDossier = ViewDossier;
