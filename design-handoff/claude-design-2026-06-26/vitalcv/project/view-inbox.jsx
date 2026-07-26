// VIEW — AI Knowledge Inbox

function ViewInbox() {
  const [docs, setDocs] = React.useState(INBOX_DOCUMENTS);
  const [activeId, setActiveId] = React.useState(
    INBOX_DOCUMENTS.find(d => d.state === 'processed')?.id || null
  );
  const [classifying, setClassifying] = React.useState(false);
  const [suggestionStatus, setSuggestionStatus] = React.useState({}); // id -> 'accepted' | 'rejected'

  const handleUpload = (file) => {
    setClassifying(true);
    // Cosmetic — drop a "classifying" tile at the top.
    const tempId = 'doc-temp-' + Date.now();
    const ext = (file && file.name && file.name.split('.').pop()) || 'pdf';
    const tone = /jpe?g|png|heic/i.test(ext) ? 'photo' : 'unknown';
    setDocs(d => [
      {
        id: tempId,
        name: file ? file.name : 'unnamed-upload',
        bytes: file ? file.size : 100000,
        pages: 1,
        receivedAt: 'just now',
        receivedRel: 'just now',
        state: 'classifying',
        classification: null,
        classificationConfidence: null,
        extractedCount: 0,
        pageThumb: { tone },
      },
      ...d,
    ]);
    setTimeout(() => {
      setClassifying(false);
      setDocs(d => d.map(x => x.id === tempId ? {
        ...x,
        state: 'unclassified',
        classification: 'unknown',
        classificationConfidence: 0.27,
        classificationReason: 'No recognized issuer letterhead. Awaiting human label.',
      } : x));
    }, 4200);
  };

  const active = docs.find(d => d.id === activeId);
  const extraction = active && INBOX_EXTRACTIONS[active.id];

  // Stats for the rail
  const stats = React.useMemo(() => {
    const s = { docs: docs.length, processed: 0, unclassified: 0, fields: 0, verified: 0, inferred: 0, contradicted: 0 };
    docs.forEach(d => {
      if (d.state === 'processed') s.processed++;
      if (d.state === 'unclassified') s.unclassified++;
      const ex = INBOX_EXTRACTIONS[d.id];
      if (ex) {
        s.fields += ex.fields.length;
        ex.fields.forEach(f => {
          if (f.provenance === 'verified') s.verified++;
          if (f.provenance === 'inferred') s.inferred++;
          if (f.provenance === 'contradicted') s.contradicted++;
        });
      }
    });
    return s;
  }, [docs]);

  const acceptSuggestion = (id) => setSuggestionStatus(s => ({ ...s, [id]: 'accepted' }));
  const rejectSuggestion = (id) => setSuggestionStatus(s => ({ ...s, [id]: 'rejected' }));

  return (
    <div className="max-w-[1400px] mx-auto px-6 py-10">
      {/* Eyebrow */}
      <div className="flex items-end justify-between gap-4 mb-6 flex-wrap">
        <div>
          <div className="mono text-[10.5px] uppercase tracking-[0.2em] text-slate-500 mb-2">
            Knowledge Inbox · Trust Mode
          </div>
          <h1 className="text-[34px] font-semibold tracking-[-0.02em] text-slate-900 leading-none">
            Drop docs. We classify them. Sources verify them.
          </h1>
          <p className="mt-3 text-[13.5px] text-slate-600 leading-[1.55] max-w-[68ch]">
            A trusted intake layer for your career artifacts. Files are classified, parsed, and indexed —
            but <span className="text-slate-900 font-medium">never marked verified</span> until a primary-source check runs.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="mono text-[10.5px] uppercase tracking-[0.14em] text-slate-500 inline-flex items-center gap-1.5">
            <Icon.ShieldCheck size={12} className="text-emerald-600" />
            Encrypted at rest · clinician-owned
          </span>
        </div>
      </div>

      {/* Dropzone */}
      <IntakeDropzone onUpload={handleUpload} classifying={classifying} />

      {/* Two-column body: documents + rail */}
      <div className="grid grid-cols-12 gap-6 mt-8">
        {/* Documents */}
        <div className="col-span-12 lg:col-span-8 space-y-6">
          {/* Document list */}
          <div className="border border-slate-200 rounded-[3px] bg-white overflow-hidden">
            <div className="px-5 py-2.5 border-b border-slate-200 bg-slate-50/60 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Icon.FileText size={13} className="text-slate-700" />
                <span className="text-[13px] font-semibold text-slate-900">Documents</span>
                <span className="mono text-[10px] text-slate-500">· {docs.length}</span>
              </div>
              <div className="mono text-[10px] uppercase tracking-[0.14em] text-slate-500 inline-flex items-center gap-3">
                <span><span className="h-1.5 w-1.5 rounded-full bg-emerald-500 inline-block mr-1.5 align-middle" />indexed</span>
                <span><span className="h-1.5 w-1.5 rounded-full bg-slate-900 inline-block mr-1.5 align-middle pulse-soft" />classifying</span>
                <span><span className="h-1.5 w-1.5 rounded-full bg-amber-500 inline-block mr-1.5 align-middle" />unclassified</span>
              </div>
            </div>
            <ul className="divide-y divide-slate-100">
              {docs.length === 0 && (
                <li className="px-5 py-8">
                  <InboxEmptyState onUpload={() => {}} />
                </li>
              )}
              {docs.map(doc => (
                <li key={doc.id}>
                  <DocumentTile doc={doc} active={activeId === doc.id} onClick={() => setActiveId(doc.id)} />
                </li>
              ))}
            </ul>
          </div>

          {/* Selected document detail */}
          {active && (
            <div className="space-y-4">
              <DocumentVerdictHeader doc={active} />
              {active.state === 'processed' && extraction && (
                <ExtractionTable doc={active} extraction={extraction} />
              )}
              {active.state === 'classifying' && (
                <div className="border border-slate-200 rounded-[3px] bg-white px-6 py-8 text-center">
                  <div className="mono text-[10.5px] uppercase tracking-[0.18em] text-slate-500 mb-2 inline-flex items-center gap-2 justify-center">
                    <span className="h-1.5 w-1.5 rounded-full bg-slate-900 pulse-soft" />
                    Classifying
                  </div>
                  <div className="text-[14px] text-slate-700">Reading layout, detecting issuer, extracting fields.</div>
                  <div className="mono text-[10.5px] text-slate-500 mt-2">Receipt will be issued only if a source check succeeds.</div>
                </div>
              )}
              {active.state === 'unclassified' && (
                <div className="border border-amber-300 bg-amber-50/40 rounded-[3px] px-5 py-4 flex items-start gap-3">
                  <Icon.AlertTri size={14} className="text-amber-700 mt-0.5" />
                  <div className="flex-1">
                    <div className="text-[13px] font-semibold text-slate-900">No automatic classification.</div>
                    <p className="text-[12px] text-slate-700 mt-1 leading-[1.55] max-w-[68ch]">
                      Confidence too low to label this document. We will not extract fields from it. Pick the right type below or discard it.
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {Object.entries(DOC_CLASS_META)
                        .filter(([k]) => k !== 'unknown')
                        .map(([k, v]) => (
                        <button key={k} className="mono text-[10.5px] uppercase tracking-[0.14em] border border-slate-300 hover:border-slate-900 text-slate-900 bg-white px-2.5 h-7 rounded-[2px]">
                          {v.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Suggestions */}
          <div>
            <SectionHeader
              eyebrow="Profile updates · proposed"
              title="Apply extracted data to your profile?"
              right={
                <span className="mono text-[10.5px] uppercase tracking-[0.14em] text-slate-500">
                  {INBOX_SUGGESTIONS.length} suggestion{INBOX_SUGGESTIONS.length !== 1 && 's'}
                </span>
              }
            />
            <div className="space-y-3">
              {INBOX_SUGGESTIONS.map(s => (
                <SuggestionCard
                  key={s.id}
                  s={s}
                  status={suggestionStatus[s.id]}
                  onAccept={() => acceptSuggestion(s.id)}
                  onReject={() => rejectSuggestion(s.id)}
                />
              ))}
            </div>
            <div className="mt-3 mono text-[10.5px] uppercase tracking-[0.14em] text-slate-500 inline-flex items-center gap-2">
              <Icon.Info size={11} />
              Accepting writes to your <span className="text-slate-900">profile context</span>. Promotion to a verified record still requires a primary-source check.
            </div>
          </div>
        </div>

        {/* Rail */}
        <aside className="col-span-12 lg:col-span-4">
          <InboxPrincipleRail stats={stats} />
        </aside>
      </div>
    </div>
  );
}
window.ViewInbox = ViewInbox;
