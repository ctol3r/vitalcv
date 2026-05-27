/**
 * VitalCV visual-system component barrel.
 *
 * Ported from the design handoff (`vitalcv-app/` prototype) into
 * production Next.js. All styles scoped under `.vs-root`.
 */

export { AuditTimeline } from './AuditTimeline';
export type { AuditEvent } from './AuditTimeline';
export { AuthShell } from './AuthShell';
export type { AuthDisclosure } from './AuthShell';
export { CompactConnectorMatrix } from './CompactConnectorMatrix';
export type { CompactConnector } from './CompactConnectorMatrix';
export { Door, Doors } from './Doors';
export type { DoorProps } from './Doors';
export { EvidencePacketPreview } from './EvidencePacketPreview';
export type { PacketField, EvidencePacketPreviewProps } from './EvidencePacketPreview';
export { Footer, FooterBottom } from './Footer';
export { Nav } from './Nav';
export type { NavProps } from './Nav';
export {
  BoundaryBanner,
  Button,
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  CmdPill,
  DegradedBanner,
  Eyebrow,
  FieldGroup,
  FieldHint,
  FieldRow,
  Input,
  LinkButton,
  Section,
  Segment,
} from './primitives';
export type { ButtonProps, InputProps, LinkButtonProps } from './primitives';
export { ProofRail } from './ProofRail';
export type { RailStep } from './ProofRail';
export { Receipt } from './Receipt';
export type { ReceiptLine } from './Receipt';
export { ReceiptDrawer } from './ReceiptDrawer';
export type { ReceiptDrawerProps } from './ReceiptDrawer';
export { Shell } from './Shell';
export { LegendChip, TruthChip } from './TruthChip';
export type { LegendChipProps, TruthChipProps } from './TruthChip';
export { TRUTH_STATE_LABEL } from './types';
export type { TruthState } from './types';
