import { NCIVerifiableProofType, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface TrustEvidencePack {
  issuerDid: string;
  metadata: {
    orgName?: string | null;
    orgNpi?: string | null;
    jurisdiction?: string | null;
    trustAnchorId?: string | null;
    nodeType?: string | null;
  };
  issuanceCount: number;
  revocationCount: number;
  revocationRate: number;
  chainAnchors: Array<{
    txHash: string;
    chainId?: string | null;
    anchoredAt: string;
  }>;
  generatedAt: string;
}

export async function buildTrustEvidencePack(issuerDid: string): Promise<TrustEvidencePack> {
  if (!issuerDid) {
    throw new Error('issuerDid is required for trust evidence');
  }

  const [issuer, node, issuanceCount, revocationCount, anchorSamples] = await Promise.all([
    prisma.trustedIssuer.findUnique({ where: { did: issuerDid } }),
    prisma.nCINode.findUnique({ where: { did: issuerDid } }),
    prisma.nCIVerifiableProof.count({
      where: {
        did: issuerDid,
        proofType: NCIVerifiableProofType.ISSUANCE,
      },
    }),
    prisma.nCIVerifiableProof.count({
      where: {
        did: issuerDid,
        proofType: NCIVerifiableProofType.REVOCATION,
      },
    }),
    prisma.nCIVerifiableProof.findMany({
      where: {
        did: issuerDid,
        anchorTxHash: {
          not: null,
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 5,
      select: {
        anchorTxHash: true,
        chainId: true,
        createdAt: true,
      },
    }),
  ]);

  const revocationRate = issuanceCount ? Number((revocationCount / issuanceCount).toFixed(3)) : 0;
  const metadata = {
    orgName: issuer?.orgName ?? (node?.metadata as Record<string, any> | null)?.orgName ?? null,
    orgNpi: issuer?.orgNpi ?? null,
    jurisdiction: node?.jurisdiction ?? null,
    trustAnchorId: node?.trustAnchorId ?? null,
    nodeType: node?.nodeType ?? null,
  };

  return {
    issuerDid,
    metadata,
    issuanceCount,
    revocationCount,
    revocationRate,
    chainAnchors: anchorSamples
      .filter((sample) => Boolean(sample.anchorTxHash))
      .map((sample) => ({
        txHash: sample.anchorTxHash!,
        chainId: sample.chainId,
        anchoredAt: sample.createdAt.toISOString(),
      })),
    generatedAt: new Date().toISOString(),
  };
}










