import { createHash } from 'crypto';
import { Buffer } from 'node:buffer';

export type ProofWorkerType = 'sd-jwt' | 'bbs+' | 'vp-chain-check';
export type ProofJobPriority = 'standard' | 'urgent';

export interface ProofCredential {
  format: 'sd-jwt' | 'jwt-vc';
  token: string;
  disclosures?: Array<Record<string, any>>;
  revealGroups?: string[];
}

export interface ChainProofPayload {
  blockHash: string;
  merklePath: string[];
  anchorId?: string;
}

export interface ProofGraphNode {
  id: string;
  label: string;
  worker: ProofWorkerType;
  payload: Record<string, any>;
  priority: ProofJobPriority;
  dependsOn: string[];
}

export interface LinkedCredentialDigest {
  digest: string;
  count: number;
}

export interface VpBundleOptimization {
  digest: string;
  credentialCount: number;
  totalBytes: number;
  deduplicatedBytes: number;
  compressionRatio: number;
  linkedCredentialDigests: LinkedCredentialDigest[];
  signatureKids: string[];
  anchorHashes: string[];
}

export interface SignatureCrossCheckPlan {
  issuerDid?: string;
  issuerKids: string[];
  chainBlockHash?: string;
  trustRegistryHint?: string;
}

export interface ProofGraphMetadata {
  optimizedBundle: VpBundleOptimization;
  crossCheckPlan: SignatureCrossCheckPlan;
}

export interface ProofGraphInput {
  threadId: string;
  credentials: ProofCredential[];
  chainProof?: ChainProofPayload | null;
  bbsPresentation?: Record<string, any> | null;
  priority?: ProofJobPriority;
  expectedNonce?: string;
  context?: {
    issuerDid?: string;
  };
}

export interface ProofGraph {
  nodes: ProofGraphNode[];
  metadata: ProofGraphMetadata;
}

const FALLBACK_PRIORITY: ProofJobPriority = 'standard';

export function buildProofGraph(input: ProofGraphInput): ProofGraph {
  const priority = input.priority ?? FALLBACK_PRIORITY;
  const nodes: ProofGraphNode[] = [];

  const sdJwtCredentials = input.credentials.filter((cred) => cred.format === 'sd-jwt');
  sdJwtCredentials.forEach((credential, index) => {
    nodes.push({
      id: `sd-jwt-${index + 1}`,
      label: `SD-JWT Credential #${index + 1}`,
      worker: 'sd-jwt',
      payload: {
        token: credential.token,
        disclosures: credential.disclosures,
        revealGroups: credential.revealGroups,
        expectedNonce: input.expectedNonce,
      },
      priority,
      dependsOn: [],
    });
  });

  if (input.bbsPresentation) {
    nodes.push({
      id: 'bbs-plus',
      label: 'BBS+ Proof',
      worker: 'bbs+',
      payload: {
        presentation: input.bbsPresentation,
        expectedNonce: input.expectedNonce,
      },
      priority,
      dependsOn: [],
    });
  }

  if (input.chainProof) {
    nodes.push({
      id: 'vp-chain-check',
      label: 'VP Chain Check',
      worker: 'vp-chain-check',
      payload: {
        chainProof: input.chainProof,
        threadId: input.threadId,
      },
      priority,
      dependsOn: [],
    });
  }

  const metadata: ProofGraphMetadata = {
    optimizedBundle: optimizeVpBundle(input.credentials, input.chainProof),
    crossCheckPlan: buildCrossCheckPlan({
      credentials: input.credentials,
      chainProof: input.chainProof,
      issuerDid: input.context?.issuerDid,
    }),
  };

  return {
    nodes,
    metadata,
  };
}

export function optimizeVpBundle(
  credentials: ProofCredential[],
  chainProof?: ChainProofPayload | null,
): VpBundleOptimization {
  let totalBytes = 0;
  let uniqueBytes = 0;
  const digestMap = new Map<string, LinkedCredentialDigest>();

  credentials.forEach((credential) => {
    if (!credential.token) {
      return;
    }
    const digest = createHash('sha256').update(credential.token).digest('base64url');
    totalBytes += credential.token.length;
    if (!digestMap.has(digest)) {
      digestMap.set(digest, { digest, count: 1 });
      uniqueBytes += credential.token.length;
    } else {
      const entry = digestMap.get(digest)!;
      entry.count += 1;
    }
  });

  const linkedCredentialDigests = Array.from(digestMap.values());
  const signatureKids = Array.from(
    new Set(
      credentials
        .map((credential) => extractKidFromToken(credential.token))
        .filter((kid): kid is string => Boolean(kid)),
    ),
  );
  const anchorHashes = chainProof?.blockHash ? [chainProof.blockHash.toLowerCase()] : [];

  return {
    digest: createHash('sha256')
      .update(credentials.map((credential) => credential.token).sort().join('|'))
      .digest('base64url'),
    credentialCount: credentials.length,
    totalBytes,
    deduplicatedBytes: uniqueBytes,
    compressionRatio: totalBytes > 0 ? Number((uniqueBytes / totalBytes).toFixed(3)) : 1,
    linkedCredentialDigests,
    signatureKids,
    anchorHashes,
  };
}

interface CrossCheckBuilderInput {
  credentials: ProofCredential[];
  chainProof?: ChainProofPayload | null;
  issuerDid?: string;
}

export function buildCrossCheckPlan(input: CrossCheckBuilderInput): SignatureCrossCheckPlan {
  const issuerKids = Array.from(
    new Set(
      input.credentials
        .map((credential) => extractKidFromToken(credential.token))
        .filter((kid): kid is string => Boolean(kid)),
    ),
  );

  return {
    issuerDid: input.issuerDid,
    issuerKids,
    chainBlockHash: input.chainProof?.blockHash,
    trustRegistryHint: input.issuerDid ?? issuerKids[0],
  };
}

export function extractKidFromToken(token?: string): string | undefined {
  if (!token || typeof token !== 'string') {
    return undefined;
  }
  const parts = token.split('.');
  if (parts.length < 2) {
    return undefined;
  }
  try {
    const headerJson = Buffer.from(parts[0], 'base64url').toString('utf-8');
    const header = JSON.parse(headerJson);
    if (header && typeof header.kid === 'string') {
      return header.kid;
    }
  } catch {
    return undefined;
  }
  return undefined;
}









