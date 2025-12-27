import express, { Request, Response } from 'express';
import { createHash } from 'crypto';
import { auditLog } from '../services/audit';
import { createLogger } from '@chai-vc/logging-core';

const router = express.Router();
const log = createLogger({ service: process.env.SERVICE_NAME || 'verifier-api' });

interface MerkleProofNode {
  hash: string;
  position?: 'left' | 'right';
}

function isHex(input: string): boolean {
  return /^[0-9a-fA-F]+$/.test(input);
}

function hashPair(left: Buffer, right: Buffer): Buffer {
  return createHash('sha256').update(Buffer.concat([left, right])).digest();
}

function normalizeProofNode(node: any): MerkleProofNode {
  if (typeof node === 'string') {
    const [direction, hash] = node.includes(':') ? node.split(':', 2) : [undefined, node];
    return {
      hash: hash.trim(),
      position: direction === 'left' || direction === 'right' ? direction : undefined,
    };
  }

  if (node && typeof node === 'object' && typeof node.hash === 'string') {
    const position = node.position === 'left' || node.position === 'right' ? node.position : undefined;
    return { hash: node.hash.trim(), position };
  }

  throw new Error('Invalid Merkle proof entry. Use comma-separated hashes or JSON array.');
}

function parseMerkleProof(param: any): MerkleProofNode[] {
  if (!param) return [];

  if (Array.isArray(param)) {
    return param.map(normalizeProofNode);
  }

  if (typeof param === 'string') {
    try {
      const parsed = JSON.parse(param);
      return parseMerkleProof(parsed);
    } catch {
      const parts = param
        .split(',')
        .map((part: string) => part.trim())
        .filter(Boolean);
      return parts.map(normalizeProofNode);
    }
  }

  return [];
}

function computeMerkleRoot(proofHash: string, proofPath: MerkleProofNode[]): string {
  if (!isHex(proofHash)) {
    throw new Error('proofHash must be a hex string');
  }

  let current = Buffer.from(proofHash, 'hex');

  for (const node of proofPath) {
    if (!node.hash || !isHex(node.hash)) {
      throw new Error('Merkle proof entries must be hex strings');
    }

    const sibling = Buffer.from(node.hash, 'hex');

    if (node.position === 'left') {
      current = hashPair(sibling, current);
    } else if (node.position === 'right') {
      current = hashPair(current, sibling);
    } else {
      const [first, second] = [current, sibling].sort(Buffer.compare);
      current = hashPair(first, second);
    }
  }

  return current.toString('hex');
}

function getQueryParam(queryValue: any): string | undefined {
  if (typeof queryValue === 'string') return queryValue;
  if (Array.isArray(queryValue) && queryValue.length > 0) return queryValue[0];
  return undefined;
}

router.get('/', async (req: Request, res: Response) => {
  const proofHash = getQueryParam(req.query.proofHash)?.trim();
  const expectedRoot = getQueryParam(req.query.root)?.trim();
  const proofParam = req.query.path ?? req.query.merkleProof ?? req.query.proof ?? req.query.siblings;

  if (!proofHash || !expectedRoot) {
    return res.status(400).json({
      valid: false,
      error: 'Missing required query parameters: proofHash and root',
    });
  }

  let proofPath: MerkleProofNode[] = [];
  try {
    proofPath = parseMerkleProof(proofParam);
  } catch (error) {
    return res.status(400).json({
      valid: false,
      error: error instanceof Error ? error.message : 'Invalid Merkle proof format',
    });
  }

  try {
    const computedRoot = computeMerkleRoot(proofHash, proofPath);
    const expected = expectedRoot.toLowerCase();
    const valid = computedRoot.toLowerCase() === expected;
    const timestamp = new Date().toISOString();

    auditLog('public_merkle_verification', {
      reason: valid ? 'merkle_root_match' : 'merkle_root_mismatch',
      path: req.path,
      method: req.method,
      timestamp,
      proofHash,
      expectedRoot: expected,
      computedRoot,
      proofDepth: proofPath.length,
      valid,
    }).catch((auditError) => {
      log.warn('Audit log failed for public verification', {
        error: auditError instanceof Error ? auditError.message : 'unknown error',
      });
    });

    return res.json({
      valid,
      proofHash,
      expectedRoot: expected,
      computedRoot,
      proofDepth: proofPath.length,
      timestamp,
    });
  } catch (error) {
    return res.status(400).json({
      valid: false,
      error: error instanceof Error ? error.message : 'Merkle verification failed',
      timestamp: new Date().toISOString(),
    });
  }
});

export default router;
