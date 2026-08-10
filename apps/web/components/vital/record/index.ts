// components/vital/record — the Living Evidence Record illustration kit (ILL-03).
//
// One protagonist object in several faces, plus the two actors that stand
// outside it. The anatomy is Z0's (docs/design/vitalcv-cinematic-storyboard.md)
// and the narrative law is EC-27; this directory is the code that draws them,
// never a second definition of either.
//
// Scope: static illustration for public/reference surfaces. Nothing here is
// interactive, nothing here renders real returned state, and nothing here is
// registered as a VisualScene — the EC-28 inventory is closed at ten and a new
// scene id needs an EC-22 amendment (see docs/design/illustrated-journey-baseline.md §4.2).

export { LivingRecord, IllustrationLabel, type LivingRecordProps } from './LivingRecord';
export { SourceKiosk, type SourceKioskKind, type SourceKioskProps } from './SourceKiosk';
export { ReviewDesk, type ReviewDeskProps } from './ReviewDesk';
export { ConsentGate, type ConsentGateProps } from './ConsentGate';
export { RelationshipScene } from './RelationshipScene';
export {
  RECORD_FACES,
  IMPLEMENTED_FACES,
  RECORD_PROPORTION,
  RECORD_EDGE,
  RECORD_RADIUS,
  APERTURE_COUNT,
  ILLUSTRATION_LABEL,
  ILLUSTRATIVE_STATES,
  type RecordFace,
  type ImplementedFace,
  type IllustrativeState,
} from './anatomy';
