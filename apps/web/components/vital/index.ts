// components/vital — the canonical, production shared design primitives.
// The consolidation target for the fragmented badge/row/state components; the
// onboarding vertical slice is the first consumer. NOT a re-export of the
// design-wave1505 reference implementation — these are real product components
// built on the existing --vt-* tokens.

export { NpiInput, type NpiInputProps } from './NpiInput';
export { StateChip } from './StateChip';
export { TrustGlyph } from './TrustGlyph';
export { EvidenceRow, type EvidenceRowData } from './EvidenceRow';
export { ProofContinuityRail, type ProofLane } from './ProofContinuityRail';
export { OfflineBanner } from './OfflineBanner';
export { EmptyState } from './EmptyState';
export { SkeletonStack } from './SkeletonStack';

export {
  type EvidenceState,
  type EvidenceTone,
  EVIDENCE_STATE,
  TONE_COLOR,
  evidenceStateMeta,
} from '@/lib/vital/evidenceState';
export { checkNpi, isValidNpiChecksum, npiDigits, type NpiCheck, type NpiValidity } from '@/lib/vital/npi';
