import { buildHashAnchor } from '@vitalcv/domain-events';

export type SubstratePalletId =
  | 'credential'
  | 'status-list-bitstring'
  | 'delegated-issuance'
  | 'identity-binding';

export type CanonicalAnchorKind = 'RECOGNITION' | 'RECEIPT';

export type SubstratePrimitiveMapping = Readonly<{
  pallet: SubstratePalletId;
  maps_to: CanonicalAnchorKind;
  description: string;
}>;

export const SUBSTRATE_PRIMITIVE_MAPPINGS: readonly SubstratePrimitiveMapping[] = Object.freeze([
  Object.freeze({
    pallet: 'credential',
    maps_to: 'RECOGNITION',
    description: 'Credential issuance/revocation anchors RecognitionEvent lifecycle',
  }),
  Object.freeze({
    pallet: 'status-list-bitstring',
    maps_to: 'RECEIPT',
    description: 'Status bits anchor revocation-first receipt validity',
  }),
  Object.freeze({
    pallet: 'delegated-issuance',
    maps_to: 'RECEIPT',
    description: 'Delegation updates anchor federated issuance trust chain receipts',
  }),
  Object.freeze({
    pallet: 'identity-binding',
    maps_to: 'RECEIPT',
    description: 'Identity binding updates anchor Holder DID/NPI/license linkage receipts',
  }),
]);

export type SubstrateAnchorInput = Readonly<{
  pallet: SubstratePalletId;
  event_name: string;
  block_number: number;
  extrinsic_index: number;
  payload_hash: string;
}>;

export type CanonicalAnchor = Readonly<{
  kind: CanonicalAnchorKind;
  pallet: SubstratePalletId;
  event_name: string;
  anchor_hash: string;
  block_number: number;
  extrinsic_index: number;
  payload_hash: string;
}>;

function assertNonEmptyString(value: unknown, field: string): asserts value is string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${field} is required`);
  }
}

function assertNonNegativeInteger(value: unknown, field: string): asserts value is number {
  if (!Number.isInteger(value) || (value as number) < 0) {
    throw new Error(`${field} must be a non-negative integer`);
  }
}

function resolveMapping(pallet: SubstratePalletId): SubstratePrimitiveMapping {
  const mapping = SUBSTRATE_PRIMITIVE_MAPPINGS.find((entry) => entry.pallet === pallet);
  if (!mapping) {
    throw new Error(`unsupported substrate pallet: ${pallet}`);
  }
  return mapping;
}

export function buildSubstrateAnchor(input: SubstrateAnchorInput): CanonicalAnchor {
  assertNonEmptyString(input.pallet, 'pallet');
  assertNonEmptyString(input.event_name, 'event_name');
  assertNonNegativeInteger(input.block_number, 'block_number');
  assertNonNegativeInteger(input.extrinsic_index, 'extrinsic_index');
  assertNonEmptyString(input.payload_hash, 'payload_hash');

  const mapping = resolveMapping(input.pallet);

  const canonicalPayload = Object.freeze({
    pallet: input.pallet,
    event_name: input.event_name,
    block_number: input.block_number,
    extrinsic_index: input.extrinsic_index,
    payload_hash: input.payload_hash,
    maps_to: mapping.maps_to,
  });

  return Object.freeze({
    kind: mapping.maps_to,
    pallet: input.pallet,
    event_name: input.event_name,
    anchor_hash: buildHashAnchor(canonicalPayload),
    block_number: input.block_number,
    extrinsic_index: input.extrinsic_index,
    payload_hash: input.payload_hash,
  });
}
