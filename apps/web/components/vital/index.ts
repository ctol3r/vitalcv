// components/vital — the canonical, production shared design primitives.
// The consolidation target for the fragmented badge/row/state components; the
// onboarding vertical slice is the first consumer. NOT a re-export of the
// design-wave1505 reference implementation — these are real product components
// built on the existing --vt-* tokens.

export { NpiInput, type NpiInputProps } from './NpiInput';
export { StateChip } from './StateChip';

// ── D-02 scene primitives (docs/design/VITALCV_2026_VISUAL_LANGUAGE.md) ─────
export { VitalAction, type VitalActionProps } from './VitalAction';
export { VitalGhostAction, type VitalGhostActionProps } from './VitalGhostAction';
export { VitalPill, type VitalPillProps } from './VitalPill';
export { VitalFrostPanel, type VitalFrostPanelProps } from './VitalFrostPanel';
export { VitalSceneFrame, type VitalSceneFrameProps } from './VitalSceneFrame';
// VitalProofRow is EvidenceRow — the proof row already exists and forking it
// would recreate the fragmentation this library was built to end. The D-series
// name resolves to the canonical component; there is deliberately no second
// implementation.
export { EvidenceRow as VitalProofRow } from './EvidenceRow';
export { TrustGlyph } from './TrustGlyph';
export { EvidenceRow, type EvidenceRowData } from './EvidenceRow';
export { ProofContinuityRail, type ProofLane } from './ProofContinuityRail';
export { OfflineBanner } from './OfflineBanner';
export { EmptyState } from './EmptyState';
export { SkeletonStack } from './SkeletonStack';

// ── ILL-03 the Living Evidence Record illustration kit ──────────────────────
// Static illustration only; the Z0 anatomy is its definition of record. Kept in
// a subdirectory because it is artwork, not a product primitive — a call site
// reaching for a record face should have to say so.
export {
  LivingRecord,
  IllustrationLabel,
  SourceKiosk,
  ReviewDesk,
  type LivingRecordProps,
  type SourceKioskKind,
  type ImplementedFace,
} from './record';

export {
  type EvidenceState,
  type EvidenceTone,
  EVIDENCE_STATE,
  TONE_COLOR,
  evidenceStateMeta,
} from '@/lib/vital/evidenceState';
export { checkNpi, isValidNpiChecksum, npiDigits, type NpiCheck, type NpiValidity } from '@/lib/vital/npi';
