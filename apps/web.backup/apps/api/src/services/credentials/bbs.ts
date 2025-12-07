import { randomBytes, randomUUID } from 'crypto';
import {
  blsSign,
  createProof,
  verifyProof,
  type BlsKeyPair,
} from '@mattrglobal/node-bbs-signatures';
import { anchorDisclosureEvent } from '../audit/anchor';
import { canonicalizeJson, isJsonObject, type Json } from './sdjwt';

const BBS_PRIVATE_KEY = process.env.BBS_PRIVATE_KEY ?? process.env.BBS_SECRET_KEY ?? '';
const BBS_PUBLIC_KEY = process.env.BBS_PUBLIC_KEY ?? '';

let cachedKeyPair: BlsKeyPair | null = null;

export interface BbsProofPresentation {
  proof: string;
  nonce: string;
  revealed: Array<{ path: string; value: Json }>;
}

export async function generateBbsProof(
  credential: Json,
  revealList: string[],
): Promise<BbsProofPresentation> {
  if (!isJsonObject(credential)) {
    throw new Error('BBS+ proofs require a JSON object credential');
  }

  const claims = flattenClaims(credential, 'vc');
  const claimMap = new Map(claims.map((claim) => [claim.path, claim]));
  const revealSet = new Set(revealList);
  const missingClaims = revealList.filter((path) => !claimMap.has(path));

  if (missingClaims.length > 0) {
    throw new Error(`Unable to reveal missing claim paths: ${missingClaims.join(', ')}`);
  }

  const messages = claims.map((claim) =>
    Buffer.from(`${claim.path}|${claim.canonical}`, 'utf-8'),
  );
  const keyPair = await getKeyPair();
  const signature = await blsSign({ keyPair, messages });
  const nonceBytes = randomBytes(16);

  const revealedIndexes = claims.reduce<number[]>((acc, claim, index) => {
    if (revealSet.has(claim.path)) {
      acc.push(index);
    }
    return acc;
  }, []);

  const proofBytes = await createProof({
    signature,
    publicKey: keyPair.publicKey,
    messages,
    nonce: nonceBytes,
    revealed: revealedIndexes,
  });

  const presentation: BbsProofPresentation = {
    proof: Buffer.from(proofBytes).toString('base64url'),
    nonce: Buffer.from(nonceBytes).toString('base64url'),
    revealed: revealList.map((path) => {
      const claim = claimMap.get(path)!;
      return {
        path,
        value: claim.value,
      };
    }),
  };

  const credentialId = typeof credential.id === 'string' ? credential.id : randomUUID();
  await anchorDisclosureEvent({
    credentialId,
    disclosedFields: presentation.revealed.map((entry) => entry.path),
    proof: presentation.proof,
  });

  return presentation;
}

export async function verifyBbsProof(
  presentation: BbsProofPresentation,
  nonceOverride?: string,
): Promise<boolean> {
  const keyPair = await getKeyPair();
  const nonceSource = nonceOverride ?? presentation.nonce;
  const nonceBytes = Buffer.from(nonceSource, 'base64url');

  const revealedMessages = presentation.revealed.map((entry) =>
    Buffer.from(`${entry.path}|${canonicalizeJson(entry.value)}`, 'utf-8'),
  );

  const verification = await verifyProof({
    proof: Buffer.from(presentation.proof, 'base64url'),
    publicKey: keyPair.publicKey,
    messages: revealedMessages,
    nonce: nonceBytes,
  });

  return typeof verification === 'boolean' ? verification : Boolean(verification?.verified);
}

interface FlattenedClaim {
  path: string;
  value: Json;
  canonical: string;
}

function flattenClaims(value: Json, path: string): FlattenedClaim[] {
  if (value === null || typeof value !== 'object') {
    return [
      {
        path,
        value,
        canonical: canonicalizeJson(value),
      },
    ];
  }

  if (Array.isArray(value)) {
    return value.flatMap((entry, index) => flattenClaims(entry, `${path}[${index}]`));
  }

  return Object.entries(value)
    .filter(([, child]) => child !== undefined)
    .sort(([a], [b]) => a.localeCompare(b))
    .flatMap(([key, child]) => flattenClaims(child as Json, path ? `${path}.${key}` : key));
}

async function getKeyPair(): Promise<BlsKeyPair> {
  if (cachedKeyPair) {
    return cachedKeyPair;
  }
  if (!BBS_PRIVATE_KEY || !BBS_PUBLIC_KEY) {
    throw new Error('BBS_PRIVATE_KEY and BBS_PUBLIC_KEY must be configured');
  }

  cachedKeyPair = {
    secretKey: decodeKey(BBS_PRIVATE_KEY, 'BBS_PRIVATE_KEY'),
    publicKey: decodeKey(BBS_PUBLIC_KEY, 'BBS_PUBLIC_KEY'),
  };

  return cachedKeyPair;
}

function decodeKey(source: string, label: string): Uint8Array {
  const trimmed = source.trim();
  if (/^[0-9a-f]+$/i.test(trimmed) && trimmed.length % 2 === 0) {
    return Buffer.from(trimmed, 'hex');
  }

  const normalized = trimmed.replace(/-/g, '+').replace(/_/g, '/');
  try {
    return Buffer.from(normalized, 'base64');
  } catch (error) {
    throw new Error(`Unable to decode ${label}`);
  }
}


