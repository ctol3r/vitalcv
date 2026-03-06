/**
 * didRegistry.ts — Wave 100: Decentralized Identifier Registry
 *
 * Maintains a registry of DIDs for clinicians, issuers, and verifiers.
 * In-memory with seed data. Production would use a distributed ledger
 * or IPFS-backed DID document store.
 *
 * Supported DID method: did:vitalcv:<type>:<identifier>
 */

import { randomUUID } from 'node:crypto';
import { log } from '../../obs/logger';

// ── Types ─────────────────────────────────────────────────────────────

export type DIDStatus = 'ACTIVE' | 'DEACTIVATED' | 'REVOKED';
export type DIDSubjectType = 'clinician' | 'issuer' | 'verifier' | 'system';

export interface DIDDocument {
  /** The DID string e.g. did:vitalcv:clinician:1234567890 */
  did: string;
  /** Controller DID (self-sovereign = same as did) */
  controller: string;
  /** SPKI PEM public key for verifying signatures */
  publicKey: string;
  /** Subject type */
  subjectType: DIDSubjectType;
  /** Human-readable label */
  label?: string;
  /** ISO-8601 creation timestamp */
  createdAt: string;
  /** Current DID status */
  status: DIDStatus;
  /** Arbitrary service endpoints */
  serviceEndpoints?: Array<{ type: string; endpoint: string }>;
  /** Extra metadata */
  metadata?: Record<string, unknown>;
}

export interface RegisterDIDRequest {
  subjectType: DIDSubjectType;
  /** Optional — auto-generated if omitted */
  identifier?: string;
  publicKey: string;
  label?: string;
  controller?: string;
  serviceEndpoints?: DIDDocument['serviceEndpoints'];
  metadata?: Record<string, unknown>;
}

// ── Storage ───────────────────────────────────────────────────────────

const documents = new Map<string, DIDDocument>();

// ── DID generation ────────────────────────────────────────────────────

export function buildDID(subjectType: DIDSubjectType, identifier: string): string {
  return `did:vitalcv:${subjectType}:${identifier}`;
}

// ── Seed data ─────────────────────────────────────────────────────────

const SEED_DOCUMENTS: Omit<DIDDocument, 'createdAt'>[] = [
  {
    did: 'did:vitalcv:issuer:ca-medical-board',
    controller: 'did:vitalcv:issuer:ca-medical-board',
    publicKey: '',
    subjectType: 'issuer',
    label: 'California Medical Board',
    status: 'ACTIVE',
    metadata: { jurisdiction: 'CA', type: 'state_medical_board' },
  },
  {
    did: 'did:vitalcv:issuer:abim',
    controller: 'did:vitalcv:issuer:abim',
    publicKey: '',
    subjectType: 'issuer',
    label: 'American Board of Internal Medicine',
    status: 'ACTIVE',
    metadata: { type: 'specialty_board' },
  },
  {
    did: 'did:vitalcv:issuer:npi-registry',
    controller: 'did:vitalcv:issuer:npi-registry',
    publicKey: '',
    subjectType: 'issuer',
    label: 'NPI Registry (CMS)',
    status: 'ACTIVE',
    metadata: { type: 'federal_registry' },
  },
  {
    did: 'did:vitalcv:system:vitalcv-core',
    controller: 'did:vitalcv:system:vitalcv-core',
    publicKey: '',
    subjectType: 'system',
    label: 'VitalCV Core',
    status: 'ACTIVE',
    serviceEndpoints: [
      { type: 'CredentialIssuance', endpoint: '/api/credentials/issue' },
      { type: 'PresentationVerification', endpoint: '/api/verifier/accept' },
    ],
  },
];

for (const seed of SEED_DOCUMENTS) {
  documents.set(seed.did, {
    ...seed,
    createdAt: '2025-01-01T00:00:00Z',
  });
}

// ── Public API ────────────────────────────────────────────────────────

/** Register a new DID document. Returns the created DID. */
export function registerDID(req: RegisterDIDRequest): DIDDocument {
  const identifier = req.identifier ?? randomUUID();
  const did = buildDID(req.subjectType, identifier);
  const controller = req.controller ?? did;

  if (documents.has(did)) {
    throw new Error(`DID ${did} is already registered`);
  }

  const doc: DIDDocument = {
    did,
    controller,
    publicKey: req.publicKey,
    subjectType: req.subjectType,
    label: req.label,
    createdAt: new Date().toISOString(),
    status: 'ACTIVE',
    serviceEndpoints: req.serviceEndpoints,
    metadata: req.metadata,
  };

  documents.set(did, doc);

  log('info', 'did_registered', { did, subjectType: req.subjectType });
  return doc;
}

/** Resolve a DID to its document. */
export function resolveDID(did: string): DIDDocument | null {
  return documents.get(did) ?? null;
}

/** List all registered DIDs, optionally filtered by type. */
export function listDIDs(subjectType?: DIDSubjectType): DIDDocument[] {
  const all = Array.from(documents.values());
  return subjectType ? all.filter((d) => d.subjectType === subjectType) : all;
}

/** Update DID status. */
export function updateDIDStatus(did: string, status: DIDStatus): DIDDocument | null {
  const doc = documents.get(did);
  if (!doc) return null;
  const updated: DIDDocument = { ...doc, status };
  documents.set(did, updated);
  log('info', 'did_status_updated', { did, status });
  return updated;
}

/** Update public key for a DID (key rotation). */
export function rotateDIDKey(did: string, newPublicKey: string): DIDDocument | null {
  const doc = documents.get(did);
  if (!doc || doc.status !== 'ACTIVE') return null;
  const updated: DIDDocument = { ...doc, publicKey: newPublicKey };
  documents.set(did, updated);
  log('info', 'did_key_rotated', { did });
  return updated;
}

/** Registry size. */
export function didRegistrySize(): number {
  return documents.size;
}
