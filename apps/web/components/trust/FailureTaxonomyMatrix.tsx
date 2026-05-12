'use client';

/**
 * FailureTaxonomyMatrix — 5-state failure taxonomy for hospital reviewers.
 *
 * States A–E must be distinguishable within 15 seconds.
 * No opacity-based degradation: dashed borders + explicit labels only.
 *
 * A — SOURCE UNREACHABLE      (amber, dashed)  — INFRASTRUCTURE-SIDE
 * B — ANONYMOUS RESTRICTION   (gray, dashed)   — UNBOUND
 * C — INFRASTRUCTURE OUTAGE   (amber, solid)   — VITALCV-SIDE
 * D — NO ADVERSE FINDINGS     (green, solid)   — SUCCESS ✓
 * E — ISSUER UNAVAILABLE      (red, dashed)    — ISSUER-SIDE
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
  ownership: string;
  explanation: string;
  doctrine: string;
  verifierGuidance: string;
  // Visual treatment
  cardClass: string;
  letterClass: string;
  ownershipClass: string;
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
    cardClass: 'bg-amber-50 border-amber-400',
    letterClass: 'text-amber-600',
    ownershipClass: 'bg-amber-100 text-amber-700',
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
    cardClass: 'bg-gray-50 border-gray-400',
    letterClass: 'text-gray-500',
    ownershipClass: 'bg-gray-200 text-gray-600',
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
    cardClass: 'bg-amber-50 border-amber-500',
    letterClass: 'text-amber-700',
    ownershipClass: 'bg-amber-200 text-amber-800',
    borderStyle: 'solid',
  },
  {
    id: 'no_adverse_findings',
    letter: 'D',
    name: 'NO ADVERSE FINDINGS',
    ownership: 'SUCCESS',
    explanation:
      'Source checked. No exclusions, revocations, or sanctions found.',
    doctrine:
      'Affirmative negative finding. The source was checked and returned no adverse evidence. This is the expected operational state.',
    verifierGuidance: 'This is the target state. Proceed with confidence.',
    cardClass: 'bg-green-50 border-green-500',
    letterClass: 'text-green-700',
    ownershipClass: 'bg-green-200 text-green-800',
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
    cardClass: 'bg-red-50 border-red-400',
    letterClass: 'text-red-600',
    ownershipClass: 'bg-red-100 text-red-700',
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
    def.borderStyle === 'dashed' ? 'border-2 border-dashed' : 'border-2 border-solid';

  const activeRing = isActive ? 'ring-2 ring-offset-2 ring-gray-900' : '';

  const height = compact ? 'min-h-[120px]' : 'min-h-[180px]';

  return (
    <div
      className={[
        'relative rounded-lg p-3 flex flex-col gap-2 group',
        borderClass,
        def.cardClass,
        activeRing,
        height,
      ].join(' ')}
      title={showDoctrine ? def.doctrine : undefined}
    >
      {/* State letter */}
      <div
        className={`font-mono text-3xl font-black leading-none ${def.letterClass}`}
        aria-label={`State ${def.letter}`}
      >
        {def.letter}
      </div>

      {/* State name */}
      <div className="text-[10px] font-black uppercase tracking-widest text-gray-700 leading-tight">
        {def.name}
      </div>

      {/* Ownership badge */}
      <div
        className={`inline-flex self-start rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest ${def.ownershipClass}`}
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
        <p className="text-[10px] font-semibold text-gray-500 leading-snug border-t border-current border-opacity-20 pt-2 mt-auto">
          {def.verifierGuidance}
        </p>
      )}

      {/* Hover doctrine tooltip (group-hover) */}
      {showDoctrine && (
        <div className="absolute bottom-full left-0 mb-2 w-64 z-10 hidden group-hover:block">
          <div className="bg-gray-900 text-white text-[11px] rounded-lg px-3 py-2 shadow-xl leading-snug">
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
