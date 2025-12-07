import {
  ChainClient,
  type StatusListEntry,
  type TrustLinkRecord,
} from '../chain/client';
import type { StatusListProof } from '../statuslist/proof';
import { verifyStatusListProof } from '../statuslist/proof';
import { createPublicKey, verify as verifySignature } from 'crypto';

export interface OnChainVerificationInput {
  statusIndex: number;
  npi: string;
  jurisdiction?: string;
  expectedDid?: string;
  credentialHash?: string;
  merkleProof?: StatusListProof;
  issuerSignature?: string;
  issuerPublicKeyHex?: string;
}

export interface ChainVerificationResult {
  revoked: boolean;
  statusIndex: number;
  statusPage: number;
  statusUpdatedAt: string;
  trustLink?: TrustLinkRecord | null;
  checks: Array<{
    name: string;
    passed: boolean;
    detail?: string;
  }>;
  resolvedAt: string;
  merkleRoot?: string;
  credentialHash?: string;
  issuerSignatureValid?: boolean;
}

const chainClient = new ChainClient();

export async function verifyOnChain(
  input: OnChainVerificationInput
): Promise<ChainVerificationResult> {
  const [status, trustLink] = await Promise.all([
    chainClient.getStatusAt(input.statusIndex),
    chainClient.resolveTrustLink(input.npi, input.jurisdiction),
  ]);

  const checks = buildChecks(status, trustLink, input.expectedDid);
  const signatureCheck = await evaluateIssuerSignature(input);
  if (signatureCheck) {
    checks.push(signatureCheck);
  }

  const merkleCheck = evaluateMerkleProof(input);
  if (merkleCheck) {
    checks.push(merkleCheck);
  }

  return {
    revoked: status.revoked,
    statusIndex: status.index,
    statusPage: status.page,
    statusUpdatedAt: status.updatedAt,
    trustLink,
    checks,
    resolvedAt: new Date().toISOString(),
    merkleRoot: input.merkleProof?.root,
    credentialHash: input.credentialHash,
    issuerSignatureValid:
      signatureCheck?.name === 'issuer_signature' ? signatureCheck.passed : undefined,
  };
}

function buildChecks(
  status: StatusListEntry,
  trustLink: TrustLinkRecord | null,
  expectedDid?: string
): ChainVerificationResult['checks'] {
  const checks: ChainVerificationResult['checks'] = [
    {
      name: 'statuslist',
      passed: !status.revoked,
      detail: status.revoked ? 'Credential index marked as revoked' : 'StatusList bit unset',
    },
  ];

  if (trustLink) {
    const didMatches = expectedDid ? trustLink.did === expectedDid : true;
    checks.push({
      name: 'trustlink',
      passed: didMatches,
      detail: didMatches
        ? `TrustLink resolved to ${trustLink.did}`
        : `Resolved DID ${trustLink.did} does not match expected ${expectedDid}`,
    });
  } else {
    checks.push({
      name: 'trustlink',
      passed: false,
      detail: 'No TrustLink record found for supplied NPI',
    });
  }

  return checks;
}

function evaluateMerkleProof(
  input: OnChainVerificationInput,
): ChainVerificationResult['checks'][number] | null {
  if (!input.merkleProof || !input.credentialHash) {
    return null;
  }

  const matchesHash =
    normalizeHex(input.credentialHash) === normalizeHex(input.merkleProof.credentialHash);

  if (!matchesHash) {
    return {
      name: 'credential_hash',
      passed: false,
      detail: 'Credential hash does not match proof leaf.',
    };
  }

  const proofValid = verifyStatusListProof({
    ...input.merkleProof,
    credentialHash: normalizeHex(input.credentialHash),
  });

  return {
    name: 'merkle_proof',
    passed: proofValid,
    detail: proofValid ? 'Merkle branch matches declared root.' : 'Merkle proof invalid.',
  };
}

async function evaluateIssuerSignature(
  input: OnChainVerificationInput,
): Promise<ChainVerificationResult['checks'][number] | null> {
  if (!input.issuerSignature || !input.issuerPublicKeyHex || !input.credentialHash) {
    return null;
  }

  const payload = Buffer.from(normalizeHex(input.credentialHash), 'hex');
  const signature = coerceSignature(input.issuerSignature);
  const publicKey = buildEd25519Key(input.issuerPublicKeyHex);

  let passed = false;
  try {
    passed = verifySignature(null, payload, publicKey, signature);
  } catch {
    passed = false;
  }

  return {
    name: 'issuer_signature',
    passed,
    detail: passed ? 'Credential hash signed by issuer key.' : 'Issuer signature invalid.',
  };
}

function buildEd25519Key(publicKeyHex: string) {
  const raw = Buffer.from(normalizeHex(publicKeyHex), 'hex');
  const derPrefix = Buffer.from('302a300506032b6570032100', 'hex');
  const der = Buffer.concat([derPrefix, raw]);
  return createPublicKey({
    key: der,
    format: 'der',
    type: 'spki',
  });
}

function coerceSignature(value: string): Buffer {
  // Prefer base64url, fallback to hex.
  try {
    return Buffer.from(value, 'base64url');
  } catch {
    return Buffer.from(normalizeHex(value), 'hex');
  }
}

function normalizeHex(value: string): string {
  return value.startsWith('0x') ? value.slice(2) : value;
}


