import {
  buildSubstrateAnchor,
  type CanonicalAnchor,
  type SubstratePalletId,
} from '@vitalcv/shared/onvitalcvn';

export type ObservedSubstrateEvent = Readonly<{
  pallet: SubstratePalletId;
  event_name: string;
  block_number: number;
  extrinsic_index: number;
  payload_hash: string;
}>;

/**
 * Converts a substrate event into a deterministic canonical anchor.
 * This adapter is intentionally pure: no persistence, no side effects.
 */
export function toCanonicalSubstrateAnchor(event: ObservedSubstrateEvent): CanonicalAnchor {
  return buildSubstrateAnchor({
    pallet: event.pallet,
    event_name: event.event_name,
    block_number: event.block_number,
    extrinsic_index: event.extrinsic_index,
    payload_hash: event.payload_hash,
  });
}
