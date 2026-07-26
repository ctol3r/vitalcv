/* =============================================================================
 * Confidence Doctrine — v2
 * -----------------------------------------------------------------------------
 * The doctrine is the law. Four tiers, locked. Lane-agnostic.
 *
 *   Decision tree:
 *     if value is from primary-source registry → verified
 *     else if value is AI-derived from clinician-supplied document → inferred
 *     else if data not on file → unknown
 *     else if two authoritative registries disagree → contradicted
 *
 *   Tier definitions:
 *     verified      — value is from a primary-source registry the system queried directly
 *     inferred      — value is AI-derived from a clinician-supplied document or third-party feed (not primary-source)
 *     unknown       — data not on file (NOT a negative signal — explicitly neutral)
 *     contradicted  — two authoritative sources disagree, requires human reconciliation
 *
 *   Rules of use:
 *     • There are exactly four tiers. A 5th tier is a recall-scope problem, not a doctrine change.
 *     • The label "Verified" inside ConfidenceBadge is the *tier name* — it is not a pipeline status.
 *       For pipeline status (lane state), the production primitives use "Checked", never bare "Verified".
 *     • Descriptions are bundled. Help components MUST NOT fetch them at runtime.
 *
 *   Public API surface (v1 preserved + v2 additions):
 *     CONFIDENCE_META                  // canonical tier metadata map
 *     ConfidenceBadge                  // inline badge w/ glyph + label, sizes xs|sm|md|lg
 *     ConfidenceLegend                 // page-footer legend (NEW v2)
 *     ConfidenceFieldHelp              // tooltip/popover help button (NEW v2)
 *     useConfidenceTier                // hook: derives tier from field metadata (NEW v2)
 *     confidenceDoctrineNarrative      // string export of the decision tree (NEW v2)
 *     IdentityField, IdentityFieldsCard, ConflictResolution   // v1 carryover
 *     NCQATag, NCQA_STATUS_META, FreshnessIndicator           // v1 carryover
 * =============================================================================
 */

const confidenceDoctrineNarrative =
`If the value is from a primary-source registry the system queried directly, it is verified.
Otherwise, if the value is AI-derived from a clinician-supplied document or third-party feed, it is inferred.
Otherwise, if data is not on file, it is unknown — this is a neutral signal, not a negative one.
Otherwise, if two authoritative sources disagree, it is contradicted and requires human reconciliation.`;

const CONFIDENCE_META = {
  verified: {
    label: 'Verified',
    glyph: '✔',
    cls: 'text-emerald-700 bg-emerald-50 ring-emerald-600/20',
    dot: 'bg-emerald-600',
    short: 'Primary-source registry.',
    description: 'Value is from a primary-source registry the system queried directly.',
  },
  inferred: {
    label: 'Inferred',
    glyph: '≈',
    cls: 'text-slate-600 bg-slate-100 ring-slate-300',
    dot: 'bg-slate-400',
    short: 'AI-derived from clinician-supplied document.',
    description: 'Value is AI-derived from a clinician-supplied document or third-party feed. Not primary-source.',
  },
  unknown: {
    label: 'Unknown',
    glyph: '⚠',
    cls: 'text-amber-800 bg-white ring-amber-500/40 border-amber-500/40',
    dot: 'bg-amber-500',
    short: 'Data not on file. Neutral signal.',
    description: 'Data is not on file. This is explicitly a neutral signal, not a negative one.',
  },
  contradicted: {
    label: 'Contradicted',
    glyph: '⑂',
    cls: 'text-purple-700 bg-purple-50 ring-purple-600/20',
    dot: 'bg-purple-600',
    short: 'Authoritative sources disagree.',
    description: 'Two authoritative sources disagree. Requires human reconciliation before downstream use.',
  },
};

/* ---------- Sizing scale for badges (xs | sm | md | lg) ---------- */
const CONFIDENCE_SIZE = {
  xs: { box: 'text-[9.5px] px-1.5 py-[1px] gap-1',     glyph: 'text-[10px]' },
  sm: { box: 'text-[10.5px] px-1.5 py-[2px] gap-1',    glyph: 'text-[11px]' },
  md: { box: 'text-[11.5px] px-2 py-[3px] gap-1.5',    glyph: 'text-[12.5px]' },
  lg: { box: 'text-[12.5px] px-2.5 py-[4px] gap-1.5',  glyph: 'text-[14px]' },
};

/* ---------- ConfidenceBadge ---------- */
function ConfidenceBadge({ tier = 'inferred', size = 'sm', showLabel = true, className = '' }) {
  const m = CONFIDENCE_META[tier];
  if (!m) return null;
  const sz = CONFIDENCE_SIZE[size] || CONFIDENCE_SIZE.sm;
  return (
    <span
      title={m.description}
      role="img"
      aria-label={`${m.label} — ${m.short}`}
      className={cn(
        'inline-flex items-center font-medium uppercase tracking-[0.08em] rounded ring-1 ring-inset whitespace-nowrap',
        m.cls, sz.box, className
      )}
    >
      <span className={cn('mono leading-none', sz.glyph)}>{m.glyph}</span>
      {showLabel && <span>{m.label}</span>}
    </span>
  );
}

/* ---------- ConfidenceLegend ----------
 * Page-footer legend. Wraps cleanly at narrow widths. Place once per surface.
 */
function ConfidenceLegend({ className = '', compact = false }) {
  const tiers = ['verified', 'inferred', 'unknown', 'contradicted'];
  return (
    <div
      role="list"
      aria-label="Confidence tiers"
      className={cn(
        'flex flex-wrap items-start gap-x-5 gap-y-2 text-[10.5px] text-slate-600',
        compact && 'gap-x-3',
        className
      )}
    >
      {tiers.map((t) => {
        const m = CONFIDENCE_META[t];
        return (
          <div key={t} role="listitem" className="flex items-start gap-2 min-w-0">
            <ConfidenceBadge tier={t} size="xs" />
            <span className="leading-snug">
              <span className="text-slate-700 font-medium">{m.label}</span>
              <span className="text-slate-500"> · {m.short}</span>
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* ---------- ConfidenceFieldHelp ----------
 * Tooltip/popover variant. Hover or focus reveals the tier description.
 *   - hover-open  (mouse)
 *   - focus-open  (keyboard)
 *   - click-pinned (stays open until outside click or Escape)
 *   - pinned-and-scrolled (popover overflow handled with a scroll container)
 */
function ConfidenceFieldHelp({ tier = 'inferred', source, label, className = '' }) {
  const m = CONFIDENCE_META[tier];
  const [hover, setHover] = React.useState(false);
  const [focused, setFocused] = React.useState(false);
  const [pinned, setPinned] = React.useState(false);
  const containerRef = React.useRef(null);

  const open = pinned || hover || focused;

  // Outside click & Escape close
  React.useEffect(() => {
    if (!pinned) return;
    function onDoc(e) {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target)) setPinned(false);
    }
    function onKey(e) {
      if (e.key === 'Escape') setPinned(false);
    }
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [pinned]);

  if (!m) return null;

  return (
    <span
      ref={containerRef}
      className={cn('relative inline-flex items-center', className)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <button
        type="button"
        aria-label={`Why is this ${m.label.toLowerCase()}?`}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setPinned((p) => !p)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') { setPinned(false); setFocused(false); e.currentTarget.blur(); }
        }}
        className={cn(
          'inline-flex items-center justify-center w-[18px] h-[18px] rounded-full',
          'mono text-[10px] leading-none',
          'border border-slate-300 text-slate-500 bg-white',
          'hover:border-slate-500 hover:text-slate-800',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/30 focus-visible:ring-offset-1'
        )}
      >
        ?
      </button>

      {open && (
        <div
          role="dialog"
          aria-label={`${m.label} — confidence tier explanation`}
          className={cn(
            'absolute left-0 top-[26px] z-30 w-[300px] max-h-[260px] overflow-auto',
            'rounded-md border border-slate-200 bg-white shadow-lg',
            'p-3.5 text-left'
          )}
          onMouseEnter={() => setHover(true)}
          onMouseLeave={() => setHover(false)}
        >
          <div className="flex items-center justify-between gap-3">
            <ConfidenceBadge tier={tier} size="sm" />
            {pinned && (
              <button
                type="button"
                onClick={() => setPinned(false)}
                aria-label="Close"
                className="text-slate-400 hover:text-slate-700 text-[11px] leading-none px-1"
              >
                ×
              </button>
            )}
          </div>
          {label && (
            <div className="mt-2 text-[12.5px] font-semibold text-slate-900 tracking-tightish">{label}</div>
          )}
          <div className="mt-1.5 text-[11.5px] leading-snug text-slate-700">{m.description}</div>
          {source && (
            <div className="mt-2 pt-2 border-t border-slate-100 flex items-baseline justify-between gap-3">
              <span className="mono text-[10px] uppercase tracking-[0.1em] text-slate-400">Source</span>
              <span className="mono text-[10.5px] text-slate-700 text-right break-words">{source}</span>
            </div>
          )}
          <div className="mt-2.5 pt-2 border-t border-slate-100 text-[10.5px] text-slate-500">
            Press <span className="mono">Esc</span> to close.
          </div>
        </div>
      )}
    </span>
  );
}

/* ---------- useConfidenceTier ----------
 * Optional helper. Derives a tier from a field metadata object.
 *   { recall: 'primary' }                                                → verified
 *   { source: 'NPPES', recall: 'primary' }                               → verified
 *   { recall: 'inferred' } or { source: 'cv-upload' } or { recall: 'document' } → inferred
 *   { recall: 'none' } or value is null/undefined/'' or { onFile: false } → unknown
 *   { conflict: true } or { recall: 'conflict' }                         → contradicted
 *
 * Surfaces are not required to use this — it's a convenience.
 */
function useConfidenceTier(field = {}) {
  return React.useMemo(() => {
    if (!field) return 'unknown';
    if (field.tier && CONFIDENCE_META[field.tier]) return field.tier;
    if (field.conflict || field.recall === 'conflict') return 'contradicted';
    const empty = field.value == null || field.value === '' || field.onFile === false || field.recall === 'none';
    if (empty) return 'unknown';
    if (field.recall === 'primary') return 'verified';
    if (field.recall === 'inferred' || field.recall === 'document' || field.source === 'cv-upload') return 'inferred';
    // Heuristic: known primary-source registries
    const primaries = ['NPPES', 'DEA', 'PECOS', 'NPDB', 'OIG', 'SAM', 'NURSYS', 'CAQH'];
    if (field.source && primaries.some((p) => String(field.source).toUpperCase().includes(p))) return 'verified';
    return 'inferred';
  }, [field && field.value, field && field.source, field && field.recall, field && field.tier, field && field.conflict, field && field.onFile]);
}

/* ===========================================================================
 * v1 carryovers below — preserved without behavior change.
 * =========================================================================== */

/* ---------- Identity field row ---------- */
function IdentityField({ field, dense }) {
  const m = CONFIDENCE_META[field.confidence];
  return (
    <div className={cn('flex items-start justify-between gap-4 border-b border-slate-100 last:border-b-0',
      dense ? 'py-2' : 'py-2.5')}>
      <div className="min-w-0">
        <div className="mono text-[10px] uppercase tracking-[0.12em] text-slate-500">{field.label}</div>
        <div className="mt-0.5 flex items-center flex-wrap gap-2">
          <span className={cn(
            'text-[12.5px]',
            field.confidence === 'verified' && 'text-slate-900 font-medium',
            field.confidence === 'inferred' && 'text-slate-700',
            field.confidence === 'unknown'  && 'text-slate-500 italic',
            field.confidence === 'contradicted' && 'text-slate-900 font-medium'
          )}>
            {field.value}
          </span>
          <ConfidenceBadge tier={field.confidence} />
        </div>
        {field.hint && (
          <div className="text-[10.5px] text-slate-500 mt-1 leading-snug max-w-[480px]">{field.hint}</div>
        )}
      </div>
      <div className="text-right flex-shrink-0">
        <div className="mono text-[10px] uppercase tracking-[0.1em] text-slate-400">Source</div>
        <div className="mono text-[10.5px] text-slate-600 mt-0.5">{field.source}</div>
      </div>
    </div>
  );
}

/* ---------- Identity fields card ---------- */
function IdentityFieldsCard({ fields, title = 'Enriched profile', note }) {
  return (
    <div className="border border-slate-200 rounded-md bg-white overflow-hidden">
      <div className="px-5 py-2.5 border-b border-slate-200 bg-slate-50/60 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon.User size={13} className="text-slate-600" />
          <span className="text-[12.5px] font-semibold text-slate-900">{title}</span>
        </div>
        <div className="flex items-center gap-2 text-[10.5px] text-slate-500">
          <ConfidenceBadge tier="verified" size="xs" />
          <ConfidenceBadge tier="inferred" size="xs" />
          <ConfidenceBadge tier="unknown"  size="xs" />
          <ConfidenceBadge tier="contradicted" size="xs" />
        </div>
      </div>
      <div className="px-5">
        {fields.map(f => <IdentityField key={f.id} field={f} />)}
      </div>
      {note && (
        <div className="px-5 py-2 border-t border-slate-200 bg-slate-50 text-[10.5px] text-slate-500 flex items-center gap-2">
          <Icon.Info size={11} className="text-slate-400" />
          <span>{note}</span>
        </div>
      )}
    </div>
  );
}

/* ---------- Conflict resolution panel (side-by-side) ---------- */
function ConflictResolution({ conflict, onResolve }) {
  const [choice, setChoice] = React.useState(null);
  return (
    <div className="border border-purple-200 rounded-md overflow-hidden">
      <div className="px-4 py-2 border-b border-purple-200 bg-purple-50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon.GitBranch size={12} className="text-purple-700" />
          <span className="mono text-[10.5px] uppercase tracking-[0.12em] text-purple-800">Sources disagree · human reconciliation required</span>
        </div>
        <span className="mono text-[10px] text-purple-600">advisory · not blocking</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-200 bg-white">
        {[conflict.a, conflict.b].map((side, idx) => {
          const sel = choice === idx;
          return (
            <div key={idx} className={cn('p-4', sel && 'bg-slate-50')}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="mono text-[10px] uppercase tracking-[0.12em] text-slate-500">Source {String.fromCharCode(65 + idx)}</span>
                  <ConfidenceBadge tier={side.badge} size="xs" />
                </div>
                <span className="mono text-[10.5px] text-slate-700">{side.source}</span>
              </div>
              <div className="text-[14px] font-semibold text-slate-900 tracking-tightish">{side.org}</div>
              <div className="mt-2 space-y-1 text-[11.5px] text-slate-600">
                <div><span className="mono text-[10px] text-slate-400 uppercase tracking-[0.1em] mr-1.5">Role</span>{side.role}</div>
                <div><span className="mono text-[10px] text-slate-400 uppercase tracking-[0.1em] mr-1.5">Dates</span><span className="mono text-slate-700">{side.dates}</span></div>
                <div><span className="mono text-[10px] text-slate-400 uppercase tracking-[0.1em] mr-1.5">Loc</span>{side.location}</div>
              </div>
              <div className="mt-3 pt-2 border-t border-slate-100 text-[10.5px] text-slate-500">{side.confidence}</div>
              <button
                onClick={() => setChoice(idx)}
                className={cn(
                  'mt-3 w-full text-[11.5px] font-medium rounded-md px-3 h-8 border transition-colors',
                  sel
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-900 border-slate-300 hover:border-slate-500'
                )}
              >
                {sel ? '✓ Use this record' : 'Prefer this record'}
              </button>
            </div>
          );
        })}
      </div>

      <div className="px-4 py-2.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
        <div className="text-[11px] text-slate-500">
          Resolution is logged to audit trail. Federal source typically prevails for reimbursement questions.
        </div>
        <div className="flex items-center gap-2">
          <button className="text-[11px] text-slate-600 hover:text-slate-900">Keep both · flag</button>
          <button
            disabled={choice === null}
            className={cn('text-[11.5px] px-3 h-7 rounded-md border',
              choice === null ? 'border-slate-200 text-slate-400 cursor-not-allowed' : 'border-slate-300 text-slate-900 bg-white hover:border-slate-500')}
          >
            Resolve conflict
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- v1 exports preserved ---------- */
window.CONFIDENCE_META = CONFIDENCE_META;
window.ConfidenceBadge = ConfidenceBadge;
window.IdentityField = IdentityField;
window.IdentityFieldsCard = IdentityFieldsCard;
window.ConflictResolution = ConflictResolution;

/* ---------- v2 additions ---------- */
window.CONFIDENCE_SIZE = CONFIDENCE_SIZE;
window.ConfidenceLegend = ConfidenceLegend;
window.ConfidenceFieldHelp = ConfidenceFieldHelp;
window.useConfidenceTier = useConfidenceTier;
window.confidenceDoctrineNarrative = confidenceDoctrineNarrative;

/* ---------- NCQA Compliance Tag ---------- */
const NCQA_STATUS_META = {
  satisfied: { label: 'Satisfied',      cls: 'text-emerald-700 bg-emerald-50 ring-emerald-600/20' },
  pending:   { label: 'Pending',        cls: 'text-amber-800 bg-amber-50 ring-amber-600/20' },
  access:    { label: 'Pending Access', cls: 'text-indigo-700 bg-indigo-50 ring-indigo-600/20' },
  na:        { label: 'N/A',            cls: 'text-slate-600 bg-slate-100 ring-slate-300' },
};

function NCQATag({ laneId, size = 'sm' }) {
  const m = NCQA_MAP[laneId];
  if (!m) return null;
  const st = NCQA_STATUS_META[m.status];
  const sz = size === 'xs'
    ? 'text-[9.5px] px-1.5 py-[1px] gap-1'
    : 'text-[10px] px-1.5 py-[2px] gap-1';
  return (
    <span title={`${m.code} — ${m.desc}`}
      className={cn('mono inline-flex items-center uppercase tracking-[0.08em] rounded ring-1 ring-inset whitespace-nowrap font-medium', st.cls, sz)}>
      <span>[{m.code}:</span>
      <span className="font-semibold">{st.label}</span>
      <span>]</span>
    </span>
  );
}
window.NCQATag = NCQATag;
window.NCQA_STATUS_META = NCQA_STATUS_META;

/* ---------- Freshness / Decay Indicator ----------
 * Trust has a half-life. Render a monospaced countdown or "stale" marker
 * next to each lane based on observation age vs. authoritative refresh window.
 */
function FreshnessIndicator({ laneId, state }) {
  const f = (typeof FRESHNESS !== 'undefined') && FRESHNESS[laneId];
  if (!f) return null;

  // Not applicable for un-run / gated lanes — the data has never been observed here.
  if (state === 'access' || state === 'pending' || state === 'unknown' || f.ageDays == null) {
    return (
      <span className="mono text-[10px] uppercase tracking-[0.12em] text-slate-400 mt-1" title={f.cadence}>
        not observed
      </span>
    );
  }

  const remaining = f.window - f.ageDays;
  // Tier: fresh (>50% remaining), aging (>0), stale (<=0)
  let tone = 'fresh';
  if (remaining <= 0) tone = 'stale';
  else if (remaining / f.window < 0.5) tone = 'aging';

  const toneCls = {
    fresh: 'text-emerald-700',
    aging: 'text-amber-700',
    stale: 'text-rose-700',
  };
  const toneBar = {
    fresh: 'bg-emerald-500',
    aging: 'bg-amber-500',
    stale: 'bg-rose-500',
  };
  const pct = Math.max(2, Math.min(100, Math.round((remaining / f.window) * 100)));
  const label =
    tone === 'stale' ? `stale · ${-remaining}d past`
    : tone === 'aging' ? `valid ${remaining}d`
    : `valid ${remaining}d`;

  return (
    <div className="flex flex-col items-end mt-1 gap-0.5" title={`${f.cadence} · window ${f.window}d · age ${f.ageDays}d`}>
      <span className={cn('mono text-[10px] uppercase tracking-[0.12em]', toneCls[tone])}>
        · {label}
      </span>
      <div className="h-[2px] w-[76px] bg-slate-200 rounded-full overflow-hidden">
        <div className={cn('h-full', toneBar[tone])} style={{ width: `${tone === 'stale' ? 100 : pct}%` }} />
      </div>
    </div>
  );
}
window.FreshnessIndicator = FreshnessIndicator;
