// WAVE 13 · AI Knowledge Inbox
//
// A trusted intake layer that organizes a clinician's documents and
// extracted data WITHOUT falsely calling anything verified.
//
// Vocabulary lives in data-inbox.jsx (INBOX_PROVENANCE_META).
// Verified  = primary-source check happened during ingest
// Inferred  = AI extracted from doc; NOT verified (visually demands action)
// User-Entered = clinician typed; owned but not verified
// Unknown   = field empty
// Contradicted = two extractions disagree

// =============================================================
// Provenance Badge — strict
// =============================================================
function InboxProvenanceBadge({ tier = 'inferred', size = 'sm', showLabel = true, className = '' }) {
  const m = INBOX_PROVENANCE_META[tier];
  const sz = size === 'xs'
    ? 'text-[9.5px] px-1.5 py-[1px] gap-1'
    : 'text-[10.5px] px-1.5 py-[2px] gap-1.5';
  return (
    <span
      title={m.description}
      className={cn(
        'inline-flex items-center font-medium uppercase tracking-[0.1em] rounded-[2px] ring-1 ring-inset whitespace-nowrap',
        m.cls, sz, className
      )}
    >
      <span className="mono leading-none text-[1.05em]">{m.glyph}</span>
      {showLabel && <span>{m.label}</span>}
    </span>
  );
}
window.InboxProvenanceBadge = InboxProvenanceBadge;

// =============================================================
// Intake Dropzone
// =============================================================
function IntakeDropzone({ onUpload, classifying }) {
  const [hover, setHover] = React.useState(false);
  const [pendingName, setPendingName] = React.useState(null);
  const onDragOver = (e) => { e.preventDefault(); setHover(true); };
  const onDragLeave = () => setHover(false);
  const onDrop = (e) => {
    e.preventDefault(); setHover(false);
    const f = e.dataTransfer.files[0];
    if (f) { setPendingName(f.name); onUpload && onUpload(f); }
  };
  const onPick = (e) => {
    const f = e.target.files[0];
    if (f) { setPendingName(f.name); onUpload && onUpload(f); }
  };
  return (
    <div
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={cn(
        'border-2 border-dashed rounded-[3px] bg-white transition-colors',
        hover ? 'border-slate-900 bg-slate-50/60' : 'border-slate-300'
      )}
    >
      <div className="px-6 py-6 grid grid-cols-12 gap-6 items-center">
        <div className="col-span-12 md:col-span-7 flex items-start gap-4">
          <div className="h-11 w-11 border border-slate-300 rounded-[2px] grid place-items-center bg-slate-50">
            <Icon.Download size={18} className="text-slate-700 -rotate-180" />
          </div>
          <div>
            <div className="mono text-[10.5px] uppercase tracking-[0.18em] text-slate-500 mb-1">
              Intake · drop or browse
            </div>
            <div className="text-[15px] font-semibold text-slate-900 tracking-tightish">
              Drop CVs, state licenses, board certs, or COIs.
            </div>
            <div className="text-[12.5px] text-slate-600 mt-1 leading-[1.5] max-w-[56ch]">
              Dropped files are <span className="text-slate-900 font-medium">classified, parsed, and indexed</span>.
              No claim is made about validity until a primary-source check runs.
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 mono text-[10.5px] uppercase tracking-[0.12em] text-slate-500">
              <span>· PDF</span><span>· JPG · PNG · HEIC</span><span>· DOCX</span>
              <span className="text-slate-300">|</span>
              <span>up to 50 MB / file</span>
              <span className="text-slate-300">|</span>
              <span>encrypted at rest · clinician-owned</span>
            </div>
          </div>
        </div>

        <div className="col-span-12 md:col-span-5 flex md:justify-end gap-2 flex-wrap">
          <label className="inline-flex items-center gap-2 mono text-[11px] uppercase tracking-[0.14em] bg-slate-900 text-white hover:bg-black px-4 h-9 rounded-[3px] cursor-pointer">
            <Icon.FileText size={13} />
            <span>Browse files</span>
            <input type="file" className="hidden" onChange={onPick} accept=".pdf,.jpg,.jpeg,.png,.heic,.docx" />
          </label>
          <button className="mono text-[11px] uppercase tracking-[0.14em] border border-slate-300 text-slate-900 bg-white hover:border-slate-900 px-4 h-9 rounded-[3px] inline-flex items-center gap-2">
            <Icon.Link size={13} />
            <span>Paste link</span>
          </button>
        </div>
      </div>

      {/* Classifying tray */}
      {(classifying || pendingName) && (
        <div className="border-t border-slate-200 px-6 py-3 bg-slate-50/60 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <span className="h-2 w-2 rounded-full bg-slate-900 pulse-soft" />
            <span className="mono text-[11px] uppercase tracking-[0.14em] text-slate-700">
              Classifying
            </span>
            <span className="text-slate-300">·</span>
            <span className="mono text-[11.5px] text-slate-900 truncate">{pendingName || 'IMG_4831.HEIC'}</span>
          </div>
          <ClassificationPhases />
        </div>
      )}

      {/* Honest caveat strip */}
      <div className="border-t border-slate-200 px-6 py-2.5 bg-white flex items-center justify-between">
        <div className="mono text-[10px] uppercase tracking-[0.16em] text-slate-500 inline-flex items-center gap-2">
          <Icon.Info size={11} />
          <span>Uploads do <span className="text-slate-900">not</span> become verified evidence on upload.</span>
        </div>
        <div className="mono text-[10px] uppercase tracking-[0.14em] text-slate-500">
          parser <span className="text-slate-700">vc-extract/2.1.4</span>
        </div>
      </div>
    </div>
  );
}
window.IntakeDropzone = IntakeDropzone;

function ClassificationPhases() {
  const phases = ['OCR', 'Layout', 'Issuer detect', 'Field extract'];
  const [step, setStep] = React.useState(0);
  React.useEffect(() => {
    const t = setInterval(() => setStep(s => (s + 1) % phases.length), 900);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="flex items-center gap-2 mono text-[10px] uppercase tracking-[0.14em]">
      {phases.map((p, i) => (
        <span key={p} className={cn(
          'px-1.5 h-5 inline-flex items-center rounded-[2px] border',
          i < step ? 'border-emerald-300 text-emerald-700 bg-emerald-50/60' :
          i === step ? 'border-slate-900 text-slate-900 bg-white' :
          'border-slate-200 text-slate-400'
        )}>
          {i < step && <span className="text-emerald-700 mr-1">✓</span>}
          {p}
        </span>
      ))}
    </div>
  );
}

// =============================================================
// Document tile (used in document list / left rail picker)
// =============================================================
function DocumentTile({ doc, active, onClick }) {
  const cls = DOC_CLASS_META[doc.classification || 'unknown'];
  const stateLabel = {
    processed: 'Indexed',
    classifying: 'Classifying',
    unclassified: 'Unclassified',
    queued: 'Queued',
  }[doc.state] || doc.state;
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left grid grid-cols-[44px_1fr_auto] gap-3 items-start px-4 py-3 border-l-2 transition-colors',
        active ? 'border-slate-900 bg-slate-50' : 'border-transparent hover:bg-slate-50/60'
      )}
    >
      <DocThumb doc={doc} />
      <div className="min-w-0">
        <div className="text-[12.5px] font-semibold text-slate-900 truncate">{doc.name}</div>
        <div className="mt-0.5 mono text-[10px] uppercase tracking-[0.12em] text-slate-500 flex items-center gap-2 flex-wrap">
          <span>{cls.label}</span>
          <span className="text-slate-300">·</span>
          <span>{formatBytes(doc.bytes)}</span>
          <span className="text-slate-300">·</span>
          <span>{doc.pages}p</span>
        </div>
        <div className="mt-1 text-[10.5px] text-slate-500 truncate">{doc.receivedRel}</div>
      </div>
      <div className="flex flex-col items-end gap-1">
        {doc.state === 'classifying'
          ? <span className="mono text-[9.5px] uppercase tracking-[0.14em] text-slate-700 inline-flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-slate-900 pulse-soft" />
              {stateLabel}
            </span>
          : doc.state === 'unclassified'
          ? <span className="mono text-[9.5px] uppercase tracking-[0.14em] text-amber-700 inline-flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
              Unclassified
            </span>
          : <span className="mono text-[9.5px] uppercase tracking-[0.14em] text-slate-500">
              Indexed
            </span>}
        {doc.state === 'processed' && (
          <span className="mono text-[10px] text-slate-700 tabular-nums">{doc.extractedCount} fields</span>
        )}
      </div>
    </button>
  );
}
window.DocumentTile = DocumentTile;

function DocThumb({ doc }) {
  const tone = (doc.pageThumb || {}).tone || 'unknown';
  const lines = {
    cv:       [70, 90, 50, 88, 64, 80, 40],
    license:  [40, 86, 55, 70, 30],
    cert:     [60, 92, 70, 88, 40],
    photo:    [],
    unknown:  [42, 80, 56],
  }[tone] || [];
  const headerCls = tone === 'photo' ? 'bg-slate-300' : 'bg-slate-700';
  return (
    <div className="h-12 w-9 border border-slate-300 bg-white shadow-[0_0_0_1px_rgba(15,23,42,0.02)] relative overflow-hidden">
      {tone === 'photo' ? (
        <div className="absolute inset-0 grid-dots opacity-60" />
      ) : (
        <>
          <div className={cn('h-1 w-full', headerCls)} />
          <div className="px-1 py-1 space-y-[2px]">
            {lines.map((w, i) => (
              <div key={i} className="h-[2px] bg-slate-300" style={{ width: `${w}%` }} />
            ))}
          </div>
        </>
      )}
      {/* Classification glyph corner */}
      <div className="absolute bottom-0 right-0 mono text-[7px] font-semibold text-slate-700 bg-white/90 px-[2px] leading-[1.2] uppercase tracking-[0.06em]">
        {DOC_CLASS_META[doc.classification || 'unknown'].glyph}
      </div>
    </div>
  );
}

// =============================================================
// Document Detail Header — classification verdict + reason
// =============================================================
function DocumentVerdictHeader({ doc }) {
  const cls = DOC_CLASS_META[doc.classification || 'unknown'];
  const isUnclassified = doc.state === 'unclassified';
  const conf = doc.classificationConfidence;
  return (
    <div className={cn(
      'border rounded-[3px] overflow-hidden',
      isUnclassified ? 'border-amber-400/60' : 'border-slate-300'
    )}>
      <div className={cn(
        'px-5 py-3 border-b flex items-center justify-between',
        isUnclassified ? 'bg-amber-50/70 border-amber-300/60' : 'bg-slate-50 border-slate-200'
      )}>
        <div className="flex items-center gap-3 min-w-0">
          <DocThumb doc={doc} />
          <div className="min-w-0">
            <div className="mono text-[10px] uppercase tracking-[0.18em] text-slate-500">Document</div>
            <div className="text-[14px] font-semibold text-slate-900 truncate">{doc.name}</div>
          </div>
        </div>
        <div className="flex items-center gap-2 mono text-[10px] uppercase tracking-[0.14em] text-slate-500">
          <span>Received {doc.receivedAt}</span>
        </div>
      </div>
      <div className="px-5 py-4 grid grid-cols-12 gap-4 items-start">
        <div className="col-span-12 md:col-span-7">
          <div className="mono text-[10px] uppercase tracking-[0.18em] text-slate-500 mb-1">Classification</div>
          <div className="flex items-baseline gap-3 flex-wrap">
            <div className="text-[20px] font-semibold text-slate-900 tracking-tightish leading-none"
                 style={{ fontFamily: isUnclassified ? 'inherit' : 'inherit' }}>
              {cls.label}
            </div>
            {!isUnclassified && conf != null && (
              <span className="mono text-[11px] text-slate-700 tabular-nums">
                · classifier confidence <span className="text-slate-900">{(conf * 100).toFixed(0)}%</span>
              </span>
            )}
            {isUnclassified && (
              <span className="mono text-[10.5px] uppercase tracking-[0.14em] text-amber-700">
                · awaiting human label
              </span>
            )}
          </div>
          {doc.classificationReason && (
            <p className="mt-2 text-[12.5px] text-slate-600 leading-[1.55] max-w-[60ch]">
              <span className="mono text-[10px] uppercase tracking-[0.14em] text-slate-500 mr-2">Reason</span>
              {doc.classificationReason}
            </p>
          )}
        </div>
        <div className="col-span-12 md:col-span-5">
          <div className="border border-slate-200 rounded-[3px] p-3.5 bg-white">
            <div className="mono text-[10px] uppercase tracking-[0.14em] text-slate-500 flex items-center gap-2">
              <Icon.Info size={11} />
              Classification ≠ Verification
            </div>
            <p className="text-[12px] text-slate-600 leading-[1.55] mt-1.5">
              Classification labels what kind of document this is. <span className="text-slate-900 font-medium">It does not validate the contents.</span> Validation requires a primary-source check.
            </p>
            {isUnclassified && (
              <div className="mt-3 flex gap-2">
                <button className="mono text-[10.5px] uppercase tracking-[0.14em] bg-slate-900 text-white hover:bg-black px-3 h-7 rounded-[3px]">
                  Label manually
                </button>
                <button className="mono text-[10.5px] uppercase tracking-[0.14em] border border-slate-300 text-slate-900 hover:border-slate-900 px-3 h-7 rounded-[3px]">
                  Discard
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
window.DocumentVerdictHeader = DocumentVerdictHeader;

// =============================================================
// Extraction Table — strict per-field provenance
// =============================================================
function ExtractionTable({ doc, extraction }) {
  if (!extraction) return null;
  const counts = extraction.fields.reduce((acc, f) => {
    acc[f.provenance] = (acc[f.provenance] || 0) + 1;
    return acc;
  }, {});
  return (
    <div className="border border-slate-200 rounded-[3px] overflow-hidden bg-white">
      <div className="px-5 py-3 border-b border-slate-200 bg-slate-50/60 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Icon.Layers size={13} className="text-slate-700" />
          <div className="text-[13px] font-semibold text-slate-900">Extracted fields</div>
          <span className="mono text-[10px] text-slate-500 ml-1">{extraction.fields.length} fields</span>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {['verified','inferred','user_entered','contradicted','unknown'].map(t => (
            counts[t] ? <CountBadge key={t} tier={t} n={counts[t]} /> : null
          ))}
        </div>
      </div>
      <div className="grid grid-cols-[140px_1fr_180px_180px] mono text-[9.5px] uppercase tracking-[0.14em] text-slate-500 border-b border-slate-100">
        <div className="px-4 py-2.5">Field</div>
        <div className="px-4 py-2.5 border-l border-slate-100">Extracted value</div>
        <div className="px-4 py-2.5 border-l border-slate-100">Provenance</div>
        <div className="px-4 py-2.5 border-l border-slate-100">Promotion path</div>
      </div>
      <ul className="divide-y divide-slate-100">
        {extraction.fields.map(f => (
          <ExtractionRow key={f.id} f={f} />
        ))}
      </ul>
      <div className="px-5 py-3 border-t border-slate-200 bg-slate-50/60 flex items-center justify-between">
        <div className="mono text-[10px] uppercase tracking-[0.14em] text-slate-500 inline-flex items-center gap-2">
          <Icon.Info size={11} />
          Inferred fields demand a source check before they can be cited.
        </div>
        <div className="flex items-center gap-2">
          <button className="mono text-[10.5px] uppercase tracking-[0.14em] border border-slate-300 text-slate-900 hover:border-slate-900 bg-white px-3 h-7 rounded-[3px]">
            View source page
          </button>
          <button className="mono text-[10.5px] uppercase tracking-[0.14em] bg-slate-900 text-white hover:bg-black px-3 h-7 rounded-[3px]">
            Queue source checks
          </button>
        </div>
      </div>
    </div>
  );
}
window.ExtractionTable = ExtractionTable;

function CountBadge({ tier, n }) {
  const m = INBOX_PROVENANCE_META[tier];
  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 mono text-[9.5px] uppercase tracking-[0.14em] px-1.5 h-5 rounded-[2px] ring-1 ring-inset',
      m.cls
    )}>
      <span className="leading-none">{m.glyph}</span>
      <span className="font-semibold tabular-nums">{n}</span>
      <span>{m.label}</span>
    </span>
  );
}

function ExtractionRow({ f }) {
  const m = INBOX_PROVENANCE_META[f.provenance];
  const isInferred = f.provenance === 'inferred';
  const isContradicted = f.provenance === 'contradicted';
  const isVerified = f.provenance === 'verified';
  return (
    <li className={cn(
      'grid grid-cols-[140px_1fr_180px_180px] items-stretch border-l-[3px]',
      m.accentBorder,
      isContradicted && 'bg-purple-50/30',
      isVerified && 'bg-emerald-50/20'
    )}>
      <div className="px-4 py-3 mono text-[10.5px] uppercase tracking-[0.12em] text-slate-700 bg-slate-50/40">
        {f.label}
      </div>
      <div className="px-4 py-3 border-l border-slate-100 min-w-0">
        <div className={cn(
          'text-[13px] tracking-tightish',
          f.provenance === 'unknown' ? 'text-slate-500 italic' : 'text-slate-900 font-medium'
        )}>
          {f.value}
        </div>
        {f.originalText && f.originalText !== f.value && (
          <div className="mt-1 mono text-[10.5px] text-slate-500 truncate" title={f.originalText}>
            <span className="text-slate-400 mr-1.5">raw</span>“{f.originalText}”
          </div>
        )}
        {f.bbox && (
          <div className="mt-1 mono text-[9.5px] uppercase tracking-[0.14em] text-slate-400">
            location · {f.bbox}
          </div>
        )}
        {f.note && (
          <div className={cn(
            'mt-1.5 text-[11.5px] leading-[1.5]',
            isContradicted ? 'text-purple-700' : 'text-slate-500'
          )}>
            {f.note}
          </div>
        )}
      </div>
      <div className="px-4 py-3 border-l border-slate-100">
        <InboxProvenanceBadge tier={f.provenance} />
        {isVerified && f.psvSource && (
          <div className="mt-2 mono text-[10px] text-emerald-700 leading-[1.4]">{f.psvSource}</div>
        )}
        {isVerified && f.receipt && (
          <div className="mt-1 mono text-[10.5px] text-emerald-800 break-all">{f.receipt}</div>
        )}
        {!isVerified && (
          <div className="mt-2 mono text-[10px] text-slate-500">no source check yet</div>
        )}
      </div>
      <div className="px-4 py-3 border-l border-slate-100">
        {isInferred && f.psvSource && (
          <button className="w-full text-left mono text-[10.5px] uppercase tracking-[0.14em] border border-amber-500/60 bg-amber-50/40 hover:bg-amber-50 text-amber-800 px-2.5 py-1.5 rounded-[2px] inline-flex items-center justify-between gap-2">
            <span className="truncate">→ {f.psvSource}</span>
            <Icon.ArrowRight size={11} />
          </button>
        )}
        {isInferred && !f.psvSource && (
          <div className="mono text-[10.5px] text-slate-500 leading-[1.45]">
            no primary source · stays inferred
          </div>
        )}
        {isContradicted && (
          <button className="w-full text-left mono text-[10.5px] uppercase tracking-[0.14em] border border-purple-500/50 bg-purple-50/60 hover:bg-purple-50 text-purple-800 px-2.5 py-1.5 rounded-[2px] inline-flex items-center justify-between gap-2">
            <span className="truncate">Reconcile</span>
            <Icon.GitBranch size={11} />
          </button>
        )}
        {isVerified && (
          <div className="mono text-[10px] uppercase tracking-[0.14em] text-emerald-700 leading-[1.5]">
            ✓ promoted at ingest
          </div>
        )}
        {f.provenance === 'unknown' && (
          <div className="mono text-[10.5px] text-slate-500 leading-[1.45]">
            field empty · not requested
          </div>
        )}
        {f.provenance === 'user_entered' && (
          <button className="mono text-[10.5px] uppercase tracking-[0.14em] border border-slate-300 hover:border-slate-900 text-slate-900 bg-white px-2.5 py-1.5 rounded-[2px]">
            Confirm via OTP
          </button>
        )}
      </div>
    </li>
  );
}

// =============================================================
// Profile Update Suggestion Card
// =============================================================
function SuggestionCard({ s, onAccept, onReject, status }) {
  const m = INBOX_PROVENANCE_META[s.provenance];
  const isVerified = s.provenance === 'verified';
  const isContradicted = s.provenance === 'contradicted';
  return (
    <div className={cn(
      'border rounded-[3px] overflow-hidden bg-white border-l-[3px]',
      isVerified ? 'border-slate-200 border-l-emerald-500' :
      isContradicted ? 'border-purple-200 border-l-purple-500' :
      'border-slate-200 border-l-amber-500'
    )}>
      <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between flex-wrap gap-2 bg-slate-50/40">
        <div className="flex items-center gap-2 min-w-0">
          <Icon.Sparkles size={13} className="text-slate-700" />
          <div className="mono text-[10px] uppercase tracking-[0.18em] text-slate-500">Suggestion</div>
          <span className="text-slate-300">·</span>
          <div className="text-[13px] font-semibold text-slate-900 truncate">{s.target}</div>
        </div>
        <div className="flex items-center gap-2">
          <InboxProvenanceBadge tier={s.provenance} />
          <span className="mono text-[10px] uppercase tracking-[0.14em] text-slate-500 truncate max-w-[260px]" title={s.docName}>
            from {s.docName}
          </span>
        </div>
      </div>

      <div className="px-5 py-4">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_24px_1fr] gap-3 items-start">
          {/* Current */}
          <div className="border border-slate-200 rounded-[3px] p-3 bg-white">
            <div className="mono text-[9.5px] uppercase tracking-[0.16em] text-slate-500 mb-2">On profile now</div>
            <ul className="space-y-1.5">
              {s.fields.map((f, i) => (
                <li key={i} className="flex items-baseline justify-between gap-3 text-[12px]">
                  <span className="mono text-[10.5px] uppercase tracking-[0.1em] text-slate-500 whitespace-nowrap">{f.label}</span>
                  <span className={cn(
                    'text-right truncate',
                    /not on file/.test(f.current) ? 'text-slate-400 italic' : 'text-slate-700'
                  )}>{f.current}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Arrow */}
          <div className="hidden md:flex justify-center pt-6">
            <Icon.ArrowRight size={14} className="text-slate-400" />
          </div>

          {/* Proposed */}
          <div className={cn(
            'border rounded-[3px] p-3',
            isVerified ? 'border-emerald-300 bg-emerald-50/40' :
            isContradicted ? 'border-purple-300 bg-purple-50/40' :
            'border-amber-300 bg-amber-50/30'
          )}>
            <div className="mono text-[9.5px] uppercase tracking-[0.16em] text-slate-500 mb-2 flex items-center gap-2">
              <span>Proposed</span>
              {!isVerified && <span className="text-amber-700">· enters as {m.label.toLowerCase()}</span>}
            </div>
            <ul className="space-y-1.5">
              {s.fields.map((f, i) => (
                <li key={i} className="flex items-baseline justify-between gap-3 text-[12px]">
                  <span className="mono text-[10.5px] uppercase tracking-[0.1em] text-slate-500 whitespace-nowrap">{f.label}</span>
                  <span className={cn(
                    'text-right truncate font-medium',
                    f.kind === 'unchanged' ? 'text-slate-500' : 'text-slate-900'
                  )}>
                    {f.proposed}
                    {f.kind === 'add' && <span className="ml-1.5 mono text-[10px] uppercase tracking-[0.12em] text-emerald-700">+ add</span>}
                    {f.kind === 'replace' && <span className="ml-1.5 mono text-[10px] uppercase tracking-[0.12em] text-amber-700">replace</span>}
                  </span>
                </li>
              ))}
            </ul>
            {s.conflict && (
              <div className="mt-3 pt-2 border-t border-purple-200 text-[11px] text-purple-700">
                <span className="mono text-[10px] uppercase tracking-[0.14em] text-purple-600 mr-1.5">conflict</span>
                {s.conflict.with}
              </div>
            )}
          </div>
        </div>

        {s.note && (
          <div className="mt-3 text-[11.5px] text-slate-600 leading-[1.55] max-w-[80ch]">
            {s.note}
          </div>
        )}
      </div>

      <div className="px-5 py-3 border-t border-slate-200 bg-slate-50/60 flex items-center justify-between gap-3 flex-wrap">
        <div className="mono text-[10px] uppercase tracking-[0.14em] text-slate-500">
          {s.psvNeeded
            ? <>To upgrade to verified · <span className="text-slate-900">{s.psvNeeded}</span></>
            : isVerified ? 'Source check already on file · safe to apply'
            : 'No primary source for this field'}
        </div>
        {status === 'accepted' ? (
          <span className="mono text-[10.5px] uppercase tracking-[0.14em] text-emerald-700 inline-flex items-center gap-1.5">
            <Icon.Check size={12} /> Accepted to profile context
          </span>
        ) : status === 'rejected' ? (
          <span className="mono text-[10.5px] uppercase tracking-[0.14em] text-slate-500 inline-flex items-center gap-1.5">
            <Icon.X size={12} /> Rejected
          </span>
        ) : (
          <div className="flex items-center gap-2">
            <button
              onClick={onReject}
              className="mono text-[10.5px] uppercase tracking-[0.14em] border border-slate-300 hover:border-slate-900 text-slate-900 bg-white px-3 h-8 rounded-[3px]">
              Reject
            </button>
            <button
              onClick={onAccept}
              className={cn(
                'mono text-[10.5px] uppercase tracking-[0.14em] px-3 h-8 rounded-[3px] inline-flex items-center gap-1.5',
                isContradicted
                  ? 'border border-purple-500 bg-white text-purple-800 hover:bg-purple-50'
                  : 'bg-slate-900 text-white hover:bg-black'
              )}>
              {s.primaryAction || 'Accept to profile context'}
              <Icon.ArrowRight size={11} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
window.SuggestionCard = SuggestionCard;

// =============================================================
// Empty state — explainer
// =============================================================
function InboxEmptyState({ onUpload }) {
  return (
    <div className="border border-slate-200 rounded-[3px] bg-white p-10 text-center">
      <div className="mx-auto h-14 w-14 border border-slate-300 rounded-[3px] grid place-items-center bg-slate-50 mb-5">
        <Icon.Layers size={22} className="text-slate-700" />
      </div>
      <div className="mono text-[10.5px] uppercase tracking-[0.2em] text-slate-500">Knowledge Inbox</div>
      <h3 className="text-[24px] font-semibold text-slate-900 tracking-[-0.015em] mt-2 max-w-[640px] mx-auto">
        Classification organizes information.<br />
        Source checks decide what becomes verified.
      </h3>
      <p className="mt-4 text-[13.5px] text-slate-600 leading-[1.6] max-w-[600px] mx-auto">
        Drop your CV, state license, board cert, or DEA letter here. We will read them, label what's inside, and propose updates to your profile.
        Nothing is treated as <span className="text-slate-900 font-medium">verified</span> until a primary-source authority says so.
      </p>
      <div className="mt-7 grid grid-cols-1 md:grid-cols-3 gap-3 max-w-[820px] mx-auto text-left">
        <ExplainerStep n="01" title="Upload" body="CVs, licenses, certificates, COIs. Files are encrypted and clinician-owned." />
        <ExplainerStep n="02" title="Classify & extract" body="We label the document type and pull structured fields. Each field is tagged with its provenance." />
        <ExplainerStep n="03" title="Source-check" body="To upgrade an inferred field to verified, VitalCV queries the authority directly and stores a receipt." />
      </div>
      <div className="mt-8">
        <button onClick={onUpload} className="mono text-[11px] uppercase tracking-[0.14em] bg-slate-900 text-white hover:bg-black px-4 h-9 rounded-[3px] inline-flex items-center gap-2">
          <Icon.FileText size={13} /> Browse files to upload
        </button>
      </div>
    </div>
  );
}
window.InboxEmptyState = InboxEmptyState;

function ExplainerStep({ n, title, body }) {
  return (
    <div className="border border-slate-200 rounded-[3px] p-4 bg-white">
      <div className="mono text-[10px] uppercase tracking-[0.18em] text-slate-500">{n}</div>
      <div className="text-[13px] font-semibold text-slate-900 mt-1">{title}</div>
      <p className="text-[11.5px] text-slate-600 leading-[1.55] mt-1.5">{body}</p>
    </div>
  );
}

// =============================================================
// Inbox principle rail — small panel restating the doctrine
// =============================================================
function InboxPrincipleRail({ stats }) {
  return (
    <div className="space-y-4">
      <div className="border border-slate-200 rounded-[3px] bg-white">
        <div className="px-4 py-2.5 border-b border-slate-200 bg-slate-50/60 mono text-[10px] uppercase tracking-[0.18em] text-slate-500">
          Doctrine
        </div>
        <div className="px-4 py-3.5">
          <div className="text-[13px] font-semibold text-slate-900 leading-tight">
            Classification organizes information.
          </div>
          <div className="text-[13px] text-slate-700 leading-tight">
            Source checks decide what becomes verified.
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 space-y-2">
            <PrincipleRow tier="verified" body="Promoted only by an actual primary-source query during ingest." />
            <PrincipleRow tier="inferred" body="AI-extracted. Honest about being a guess. Demands a source check." />
            <PrincipleRow tier="user_entered" body="The clinician's own claim. Owned, not yet checked." />
            <PrincipleRow tier="contradicted" body="Two extractions disagree. Held back from auto-apply." />
            <PrincipleRow tier="unknown" body="Not present. Empty is neutral, not a red flag." />
          </div>
        </div>
      </div>

      <div className="border border-slate-200 rounded-[3px] bg-white">
        <div className="px-4 py-2.5 border-b border-slate-200 bg-slate-50/60 mono text-[10px] uppercase tracking-[0.18em] text-slate-500">
          Inbox at a glance
        </div>
        <div className="px-4 py-3 space-y-1.5">
          <RailKV k="Documents" v={stats.docs} />
          <RailKV k="Indexed" v={stats.processed} />
          <RailKV k="Unclassified" v={stats.unclassified} tone={stats.unclassified > 0 ? 'amber' : null} />
          <RailKV k="Extracted fields" v={stats.fields} />
          <RailKV k="Verified at ingest" v={stats.verified} tone="emerald" />
          <RailKV k="Awaiting source check" v={stats.inferred} tone={stats.inferred > 0 ? 'amber' : null} />
          <RailKV k="Contradictions" v={stats.contradicted} tone={stats.contradicted > 0 ? 'purple' : null} />
        </div>
      </div>
    </div>
  );
}
window.InboxPrincipleRail = InboxPrincipleRail;

function PrincipleRow({ tier, body }) {
  const m = INBOX_PROVENANCE_META[tier];
  return (
    <div className="flex items-start gap-2.5">
      <span className={cn('mono text-[10px] mt-[1px] h-4 w-4 inline-flex items-center justify-center rounded-[2px] ring-1 ring-inset shrink-0', m.cls)}>
        {m.glyph}
      </span>
      <div>
        <div className="mono text-[10px] uppercase tracking-[0.14em] text-slate-700 font-semibold">{m.label}</div>
        <div className="text-[11.5px] text-slate-600 leading-[1.45]">{body}</div>
      </div>
    </div>
  );
}

function RailKV({ k, v, tone }) {
  const toneCls = {
    emerald: 'text-emerald-700',
    amber:   'text-amber-700',
    purple:  'text-purple-700',
  }[tone] || 'text-slate-900';
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="mono text-[10.5px] uppercase tracking-[0.1em] text-slate-500">{k}</span>
      <span className={cn('mono text-[12px] font-semibold tabular-nums', toneCls)}>{v}</span>
    </div>
  );
}
