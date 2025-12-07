import { Router, Request, Response } from 'express';
import { PrismaClient, NCINodeType, NCIVerifiableProofType } from '@prisma/client';
import { NCINodeService } from '../../../../../services/nci/models/NCINode.js';
import { NCITrustAnchorService } from '../../../../../services/nci/models/NCITrustAnchor.js';
import { VerifiableProofRegistry } from '../../../../../services/nci/verifiableProofRegistry.js';

const prisma = new PrismaClient();
const router = Router();
const nodeService = new NCINodeService(prisma);
const trustAnchorService = new NCITrustAnchorService(prisma);
const proofRegistry = new VerifiableProofRegistry(prisma);

interface RegisterDidRequest {
  did: string;
  nodeType: NCINodeType;
  jurisdiction?: string;
  metadata?: Record<string, unknown>;
  trustAnchorId: string;
  attestation: {
    message: string | Record<string, unknown>;
    signature: string;
    algorithm?: 'ed25519' | 'rsa-sha256';
  };
  proof?: {
    eventType: string;
    payload: unknown;
    proofType?: NCIVerifiableProofType;
    anchorTxHash?: string;
    chainId?: string;
    issuedFor?: string;
  };
}

router.post('/', async (req: Request<unknown, unknown, RegisterDidRequest>, res: Response) => {
  try {
    const payload = validateRequest(req.body);

    const verified = await trustAnchorService.verifyAttestation({
      entityId: payload.trustAnchorId,
      attestation: payload.attestation,
      expectedDid: payload.did,
    });

    if (!verified) {
      return res.status(400).json({
        error: 'invalid_attestation',
        error_description: 'Trust anchor attestation could not be verified',
      });
    }

    const node = await nodeService.registerNode({
      did: payload.did,
      nodeType: payload.nodeType,
      jurisdiction: payload.jurisdiction,
      metadata: payload.metadata,
      trustAnchorId: payload.trustAnchorId,
    });

    let proof = null;
    if (payload.proof) {
      proof = await proofRegistry.recordProof({
        did: payload.did,
        proofType: payload.proof.proofType ?? NCIVerifiableProofType.ISSUANCE,
        eventType: payload.proof.eventType,
        payload: payload.proof.payload,
        anchorTxHash: payload.proof.anchorTxHash,
        chainId: payload.proof.chainId,
        issuedFor: payload.proof.issuedFor ?? payload.trustAnchorId,
        metadata: payload.metadata ?? null,
      });
    }

    return res.status(201).json({
      success: true,
      node: serializeNode(node),
      proof,
    });
  } catch (error) {
    console.error('[NCI] DID registration failed', error);
    return res.status(400).json({
      success: false,
      error: 'nci_registration_failed',
      error_description: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

function validateRequest(body: RegisterDidRequest): RegisterDidRequest {
  if (!body?.did || typeof body.did !== 'string') {
    throw new Error('did is required');
  }
  if (!body.nodeType || !Object.values(NCINodeType).includes(body.nodeType)) {
    throw new Error('nodeType is invalid');
  }
  if (!body.trustAnchorId || typeof body.trustAnchorId !== 'string') {
    throw new Error('trustAnchorId is required');
  }
  if (body.metadata && (typeof body.metadata !== 'object' || Array.isArray(body.metadata))) {
    throw new Error('metadata must be an object');
  }
  if (!body.attestation?.signature) {
    throw new Error('attestation.signature is required');
  }
  if (!body.attestation.message) {
    throw new Error('attestation.message is required');
  }
  if (body.proof) {
    if (!body.proof.eventType || typeof body.proof.eventType !== 'string') {
      throw new Error('proof.eventType is required when proof is provided');
    }
    if (body.proof.payload === undefined) {
      throw new Error('proof.payload is required when proof is provided');
    }
  }
  return body;
}

function serializeNode(node: Awaited<ReturnType<NCINodeService['registerNode']>>) {
  return {
    nodeId: node.nodeId,
    did: node.did,
    nodeType: node.nodeType,
    jurisdiction: node.jurisdiction,
    trustAnchorId: node.trustAnchorId,
    metadata: node.metadata,
    createdAt: node.createdAt,
    updatedAt: node.updatedAt,
  };
}

export default router;
