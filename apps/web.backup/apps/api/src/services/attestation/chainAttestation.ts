import { PrismaClient } from '@prisma/client';
import { ChainClient } from '../chain/client';

const prisma = new PrismaClient();
const chainClient = new ChainClient();

export interface ChainAttestationData {
  attestations: Array<{
    attestationId: string;
    credentialId: string;
    chainId: string;
    network: string;
    issuerDid: string;
    proofType: string;
    issuedAt: string;
    revokedAt?: string;
    trustScore: number;
  }>;
  crossChainMappings: Array<{
    sourceChain: string;
    targetChain: string;
    wrappedCredentialId: string;
  }>;
  updatedAt: string;
}

/**
 * Task 278.2 — Attestation issuance engine v4
 * Issue attestation VCs with chain context
 */
export async function issueChainAttestation(
  clinicianId: string,
  credentialId: string,
  issuerDid: string,
  chainId: string = 'pilot-l2',
): Promise<{ attestationId: string; txHash: string }> {
  const attestation = await getOrCreateAttestations(clinicianId);

  const attestationId = `attest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // Check issuer trust
  const issuerTrust = await checkIssuerTrust(issuerDid, chainId);
  if (issuerTrust.trustScore < 0.5) {
    throw new Error('Issuer trust score too low');
  }

  // Issue on chain
  const receipt = await chainClient.submitAuditEvent({
    eventType: 'attestationIssued',
    payload: {
      clinicianId,
      credentialId,
      issuerDid,
      chainId,
      attestationId,
    },
  });

  attestation.attestations.push({
    attestationId,
    credentialId,
    chainId,
    network: chainId,
    issuerDid,
    proofType: 'BBS+',
    issuedAt: new Date().toISOString(),
    trustScore: issuerTrust.trustScore,
  });

  await saveAttestations(clinicianId, attestation);

  return {
    attestationId,
    txHash: receipt.txHash,
  };
}

/**
 * Task 278.3 — Chain-aware proof resolver
 * Resolve proofs based on chain-specific parameters
 */
export async function resolveChainProof(
  attestationId: string,
  chainId: string,
): Promise<{ proof: Record<string, unknown>; valid: boolean; chainContext: Record<string, unknown> }> {
  const proof = await chainClient.getProof(attestationId);

  const chainContext = {
    chainId,
    network: chainId,
    blockHeight: proof.blockNumber,
    finality: 'finalized',
  };

  return {
    proof: proof as any,
    valid: proof !== null,
    chainContext,
  };
}

/**
 * Task 278.4 — Issuer attestation trust analysis
 * Check issuer trust + chain validity
 */
export async function checkIssuerTrust(
  issuerDid: string,
  chainId: string,
): Promise<{ trustScore: number; valid: boolean; factors: string[] }> {
  const factors: string[] = [];

  // Check trusted issuer registry
  const trustedIssuer = await prisma.trustedIssuer.findUnique({
    where: { did: issuerDid },
  });

  if (trustedIssuer) {
    factors.push('Issuer in trusted registry');
  }

  // Check trust anchor
  const trustAnchor = await prisma.nCITrustAnchor.findUnique({
    where: { entityId: issuerDid },
  });

  let trustScore = 0.5;

  if (trustedIssuer) {
    trustScore = 0.9;
  } else if (trustAnchor) {
    trustScore = 0.7;
    factors.push('Issuer has trust anchor');
  }

  // Check chain validity
  const chainValid = chainId === 'pilot-l2' || chainId.startsWith('test');
  if (!chainValid) {
    factors.push('Warning: Unknown chain');
    trustScore *= 0.8;
  }

  return {
    trustScore,
    valid: trustScore >= 0.5,
    factors,
  };
}

/**
 * Task 278.6 — Revocation-aware attestation updater
 * Rebuild attestations after revocations
 */
export async function updateAttestationAfterRevocation(
  clinicianId: string,
  credentialId: string,
): Promise<void> {
  const attestation = await getOrCreateAttestations(clinicianId);

  // Mark attestations as revoked
  for (const att of attestation.attestations) {
    if (att.credentialId === credentialId && !att.revokedAt) {
      att.revokedAt = new Date().toISOString();

      // Anchor revocation
      await chainClient.submitAuditEvent({
        eventType: 'attestationRevoked',
        payload: {
          attestationId: att.attestationId,
          credentialId,
          revokedAt: att.revokedAt,
        },
      });
    }
  }

  await saveAttestations(clinicianId, attestation);
}

/**
 * Task 278.7 — Cross-chain attestation adapter
 * Wrap attestations for EVM/Cosmos networks
 */
export async function adaptAttestationForChain(
  attestationId: string,
  targetChain: 'evm' | 'cosmos' | 'polkadot',
): Promise<{ wrappedCredentialId: string; adapterType: string }> {
  const attestation = await prisma.chainAttestation.findFirst({
    where: {
      attestations: {
        path: ['attestations'],
        array_contains: { attestationId },
      } as any,
    },
  });

  if (!attestation) {
    throw new Error('Attestation not found');
  }

  const wrappedCredentialId = `wrapped_${targetChain}_${attestationId}`;

  // Add to cross-chain mappings
  const data = attestation.attestations as ChainAttestationData;
  data.crossChainMappings.push({
    sourceChain: 'pilot-l2',
    targetChain,
    wrappedCredentialId,
  });

  await prisma.chainAttestation.update({
    where: { id: attestation.id },
    data: {
      attestations: data as any,
    },
  });

  return {
    wrappedCredentialId,
    adapterType: targetChain === 'evm' ? 'ERC721' : targetChain === 'cosmos' ? 'NFT' : 'Pallet',
  };
}

/**
 * Task 278.8 — Tamper-evidence proof builder
 * Attach tamper-evidence signatures
 */
export async function buildTamperEvidenceProof(
  attestationId: string,
): Promise<{ proofHash: string; signatures: Array<{ signer: string; signature: string }> }> {
  // Get attestation by searching through all chain attestations
  const allAttestations = await prisma.chainAttestation.findMany();
  const attestation = allAttestations.find((att) => {
    const data = att.attestations as ChainAttestationData;
    return data.attestations.some((a) => a.attestationId === attestationId);
  });

  if (!attestation) {
    throw new Error('Attestation not found');
  }

  const data = attestation.attestations as ChainAttestationData;
  const att = data.attestations.find((a) => a.attestationId === attestationId);

  if (!att) {
    throw new Error('Attestation not found in data');
  }

  // Build proof hash
  const proofData = {
    attestationId,
    credentialId: att.credentialId,
    issuerDid: att.issuerDid,
    issuedAt: att.issuedAt,
  };

  const proofHash = require('crypto')
    .createHash('sha256')
    .update(JSON.stringify(proofData))
    .digest('hex');

  // Generate signatures (simplified - would use actual signing)
  const signatures = [
    {
      signer: att.issuerDid,
      signature: `sig_${proofHash.substring(0, 16)}`,
    },
  ];

  return {
    proofHash,
    signatures,
  };
}

/**
 * Task 278.9 — Attestation export pack
 * PDF + JSON for regulators
 */
export async function exportAttestationPack(
  clinicianId: string,
): Promise<{ pdfUrl: string; jsonData: Record<string, unknown> }> {
  const attestation = await getOrCreateAttestations(clinicianId);

  const jsonData = {
    clinicianId,
    attestations: attestation.attestations.map((att) => ({
      attestationId: att.attestationId,
      credentialId: att.credentialId,
      chainId: att.chainId,
      issuerDid: att.issuerDid,
      issuedAt: att.issuedAt,
      trustScore: att.trustScore,
    })),
    exportedAt: new Date().toISOString(),
  };

  // Generate PDF (simplified - would use actual PDF generation)
  const pdfUrl = `/exports/attestations_${clinicianId}_${Date.now()}.pdf`;

  return {
    pdfUrl,
    jsonData,
  };
}

/**
 * Get or create chain attestations
 */
async function getOrCreateAttestations(clinicianId: string): Promise<ChainAttestationData> {
  let attestation = await prisma.chainAttestation.findUnique({
    where: { clinicianId },
  });

  if (!attestation) {
    attestation = await prisma.chainAttestation.create({
      data: {
        clinicianId,
        attestations: {
          attestations: [],
          crossChainMappings: [],
          updatedAt: new Date().toISOString(),
        },
      },
    });
  }

  return attestation.attestations as ChainAttestationData;
}

async function saveAttestations(
  clinicianId: string,
  data: ChainAttestationData,
): Promise<void> {
  await prisma.chainAttestation.upsert({
    where: { clinicianId },
    create: {
      clinicianId,
      attestations: data as any,
    },
    update: {
      attestations: data as any,
      updatedAt: new Date(),
    },
  });
}

/**
 * Task 278.10 — Anchor attestation snapshot
 */
export async function anchorAttestationSnapshot(clinicianId: string): Promise<string | null> {
  try {
    const attestation = await prisma.chainAttestation.findUnique({
      where: { clinicianId },
    });

    if (!attestation) {
      return null;
    }

    const data = attestation.attestations as ChainAttestationData;

    const receipt = await chainClient.submitAuditEvent({
      eventType: 'chainAttestationAnchored',
      payload: {
        clinicianId,
        attestationCount: data.attestations.length,
        activeAttestations: data.attestations.filter((a) => !a.revokedAt).length,
        crossChainMappings: data.crossChainMappings.length,
      },
    });

    return receipt.txHash;
  } catch (error) {
    console.error('[ChainAttestation] Failed to anchor snapshot', error);
    return null;
  }
}

