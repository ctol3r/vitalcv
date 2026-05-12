'use client';

/**
 * FailureTaxonomyMatrix — 5-state failure taxonomy for hospital reviewers.
 *
 * VISUAL OWNERSHIP GRAMMAR (non-negotiable):
 *   Solid border  = known, owned, internal infrastructure
 *   Dashed border = external, uncertain, not our infrastructure
 *
 * A — SOURCE UNREACHABLE      (amber-50, dashed amber-300)  — INFRASTRUCTURE-SIDE
 * B — ANONYMOUS RESTRICTION   (gray-50,  dashed gray-300)   — UNBOUND
 * C — INFRASTRUCTURE OUTAGE   (amber-50, solid  amber-400)  — VITALCV-SIDE (owned, known)
 * D — NO ADVERSE FINDINGS     (green-50, solid  green-400)  — SUCCESS ✓
 * E — ISSUER UNAVAILABLE      (rose-50,  dashed red-300)    — ISSUER-SIDE (external)
 *
 * States A–E must be distinguishable within 15 seconds.
 */

export type FailureState =
  | 'source_unreachable'    // A
  | 'anonymous_restriction' // B
  | 'infrastructure_outage' // C
  | 'no_adverse_findings'   // D — SUCCESS
  | 'issuer_unavailable';   // E

export interface FailureTaxonomyMatrixProps {
  /** If provided, highlights the active state */
  activeState?: FailureState;
  /** Show hover doctrine explanations */
  showDoctrine?: boolean;
  /** Compact mode for embedding in other surfaces */
  compact?: boolean;
}

// ─── State definitions ─────────────────────────────────────────────────────────

interface StateDefinition {
  id: FailureState;
  letter: 'A' | 'B' | 'C' | 'D' | 'E';
  name: string;
  namePrefix?: string; // e.g. "✓" for D
  ownership: string;
  explanation: string;
  doctrine: string;
  verifierGuidance: string;
  // Visual treatment — canonical spec
  outerClass: string;        // card wrapper border + bg
  headerClass: string;       // header band bg + border-b
  letterClass: string;       // letter color
  ownershipClass: string;    // badge bg + text
  ownershipWeightClass: string; // extra weight modifier
  borderStyle: 'dashed' | 'solid';
}

const STATE_DEFS: StateDefinition[] = [
  {
    id: 'source_unreachable',
    letter: 'A',
    name: 'SOURCE UNREACHABLE',
    ownership: 'INFRASTRUCTURE-SIDE',
    explanation:
      'The external source (NPPES, OIG, State Board) was unreachable at check time.',
    doctrine:
      'This is a system-side gap. The clinician is not at fault. Retry when source recovers.',
    verifierGuidance: 'Check source status. Do not penalize the clinician.',
    outerClass: 'border-amber-300 bg-amber-50',
    headerClass: 'bg-amber-50 border-b border-dashed border-amber-200',
    letterClass: 'text-amber-400',
    ownershipClass: 'bg-amber-100 text-amber-800',
    ownershipWeightClass: '',
    borderStyle: 'dashed',
  },
  {
    id: 'anonymous_restriction',
    letter: 'B',
    name: 'ANONYMOUS RESTRICTION',
    ownership: 'UNBOUND',
    explanation:
      'No authenticated actor is bound to this surface. Ownership is unverified.',
    doctrine:
      'This surface is in exploratory mode. No durable writes are attributed. Replay lineage is absent.',
    verifierGuidance:
      'Require authenticated access for production verification.',
    outerClass: 'border-gray-300 bg-gray-50',
    headerClass: 'bg-gray-50 border-b border-dashed border-gray-200',
    letterClass: 'text-gray-300',
    ownershipClass: 'bg-gray-100 text-gray-600',
    ownershipWeightClass: '',
    borderStyle: 'dashed',
  },
  {
    id: 'infrastructure_outage',
    letter: 'C',
    name: 'INFRASTRUCTURE OUTAGE',
    ownership: 'VITALCV-SIDE',
    explanation:
      'VitalCV verification infrastructure was degraded at check time.',
    doctrine:
      'VitalCV owns this degradation. The issuing source may be operational. Retry or contact support.',
    verifierGuidance:
      'Check VitalCV status page. Do not treat as clinician fault.',
    // Solid border = known, owned outage — distinct from A (dashed = uncertain/external)
    outerClass: 'border-amber-400 bg-amber-50',
    headerClass: 'bg-amber-100 border-b border-amber-300',
    letterClass: 'text-amber-500',
    ownershipClass: 'bg-amber-200 text-amber-900',
    ownershipWeightClass: 'font-semibold',
    borderStyle: 'solid',
  },
  {
    id: 'no_adverse_findings',
    letter: 'D',
    name: 'NO ADVERSE FINDINGS',
    namePrefix: '✓',
    ownership: 'SUCCESS',
    explanation:
      'Source checked. No exclusions, revocations, or sanctions found.',
    doctrine:
      'Affirmative negative finding. The source was checked and returned no adverse evidence. This is the expected operational state.',
    verifierGuidance: 'This is the target state. Proceed with confidence.',
    outerClass: 'border-green-400 bg-green-50',
    headerClass: 'bg-green-50 border-b border-green-200',
    letterClass: 'text-green-500',
    ownershipClass: 'bg-green-100 text-green-800',
    ownershipWeightClass: 'font-bold',
    borderStyle: 'solid',
  },
  {
    id: 'issuer_unavailable',
    letter: 'E',
    name: 'ISSUER UNAVAILABLE',
    ownership: 'ISSUER-SIDE',
    explanation:
      'The issuing authority (e.g. ABMS, State Board) was unavailable or did not respond.',
    doctrine:
      'Distinct from infrastructure outage (C). The issuer, not VitalCV, is the unavailable party. VitalCV infrastructure is operational.',
    verifierGuidance:
      'Contact the issuing authority directly. Do not treat VitalCV as the failure point.',
    // Dashed = external party unresponsive — distinct from C (solid = VitalCV's known outage)
    outerClass: 'border-red-300 bg-rose-50',
    headerClass: 'bg-rose-50 border-b border-dashed border-red-200',
    letterClass: 'text-red-400',
    ownershipClass: 'bg-red-100 text-red-800',
    ownershipWeightClass: 'font-semibold',
    borderStyle: 'dashed',
  },
];

// ─── State card ────────────────────────────────────────────────────────────────

interface StateCardProps {
  def: StateDefinition;
  isActive: boolean;
  showDoctrine: boolean;
  compact: boolean;
}

function StateCard({ def, isActive, showDoctrine, compact }: StateCardProps) {
  const borderClass =
    def.borderStyle === 'dashed'
      ? 'border-[1.5px] border-dashed'
      : 'border border-solid';

  const activeRing = isActive ? 'ring-2 ring-offset-2 ring-gray-900' : '';

  return (
    <div
      className={[
        'relative overflow-hidden rounded flex flex-col group',
        borderClass,
        def.outerClass,
        activeRing,
        compact ? 'min-h-[100px]' : 'min-h-[160px]',
      ].join(' ')}
      title={showDoctrine ? def.doctrine : undefined}
    >
      {/* Header band: letter + state name */}
      <div className={['flex items-center gap-2 px-3 py-2', def.headerClass].join(' ')}>
        <span
          className={`font-mono font-bold text-2xl leading-none ${def.letterClass}`}
          aria-label={`State ${def.letter}`}
        >
          {def.letter}
        </span>
        <span className="text-[10px] font-black uppercase tracking-widest text-gray-700 leading-tight">
          {def.namePrefix ? (
            <span className="text-green-600 mr-0.5">{def.namePrefix}</span>
          ) : null}
          {def.name}
        </span>
      </div>

      {/* Body */}
      <div className="p-3 flex flex-col gap-2 flex-1">
        {/* Ownership badge */}
        <div
          className={[
            'inline-flex self-start rounded px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-widest',
            def.ownershipClass,
            def.ownershipWeightClass,
          ].join(' ')}
        >
          {def.ownership}
        </div>

        {/* Explanation */}
        {!compact && (
          <p className="text-[11px] text-gray-600 leading-snug flex-1">
            {def.explanation}
          </p>
        )}

        {/* Verifier guidance */}
        {!compact && (
          <p className="text-[10px] font-semibold text-gray-500 leading-snug border-t border-current/10 pt-2 mt-auto">
            {def.verifierGuidance}
          </p>
        )}
      </div>

      {/* Hover doctrine tooltip */}
      {showDoctrine && (
        <div className="absolute bottom-full left-0 mb-2 w-64 z-10 hidden group-hover:block">
          <div className="bg-gray-900 text-white text-[11px] rounded px-3 py-2 shadow-xl leading-snug">
            <p className="font-bold uppercase tracking-wide text-[9px] text-gray-400 mb-1">
              Doctrine
            </p>
            {def.doctrine}
          </div>
        </div>
      )}

      {/* Active indicator */}
      {isActive && (
        <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-gray-900" />
      )}
    </div>
  );
}

// ─── Matrix ────────────────────────────────────────────────────────────────────

export function FailureTaxonomyMatrix({
  activeState,
  showDoctrine = true,
  compact = false,
}: FailureTaxonomyMatrixProps) {
  return (
    <div
      className={[
        'grid gap-3',
        'grid-cols-1',
        compact ? 'sm:grid-cols-3 lg:grid-cols-5' : 'sm:grid-cols-2 lg:grid-cols-5',
      ].join(' ')}
      role="list"
      aria-label="Failure Taxonomy Matrix"
    >
      {STATE_DEFS.map((def) => (
        <div key={def.id} role="listitem">
          <StateCard
            def={def}
            isActive={activeState === def.id}
            showDoctrine={showDoctrine}
            compact={compact}
          />
        </div>
      ))}
    </div>
  );
}

export default FailureTaxonomyMatrix;
