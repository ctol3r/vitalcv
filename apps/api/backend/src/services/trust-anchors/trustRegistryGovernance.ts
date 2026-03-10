/**
 * Wave 200 — Trust Registry Governance
 *
 * Governed capability system for issuer trust.
 * Persists to /tmp/vitalcv-trust-registry.json as fallback.
 * Emits to audit scrapbook on every write.
 */

import fs from 'node:fs';
import path from 'node:path';
import { log } from '../../obs/logger';

const REGISTRY_PATH = process.env.TRUST_REGISTRY_PATH ?? '/tmp/vitalcv-trust-registry.json';
const SCRAPBOOK_DIR = path.resolve(__dirname, '../audit/scrapbook');

export type CapabilityOrigin = 'onchain' | 'offchain' | 'vitalcv';

export interface IssuerRecord {
  did: string;
  name: string;
  url?: string;
  role: string;
  registeredAt: string;
  capabilities: IssuerCapabilityGrant[];
  evidence: EvidenceRecord[];
}

export interface IssuerCapabilityGrant {
  credentialType: string;
  grantedBy: string;
  grantedAt: string;
  revokedAt?: string;
  origin: CapabilityOrigin;
}

export interface EvidenceRecord {
  type: string;
  url: string;
  checksum: string;
  fetchedAt: string;
}

const issuers = new Map<string, IssuerRecord>();

function saveToDisk(): void {
  try {
    const data = Object.fromEntries(issuers);
    fs.writeFileSync(REGISTRY_PATH, JSON.stringify(data, null, 2));
  } catch { /* non-fatal */ }
}

function emitGovernanceArtifact(action: string, issuerId: string, detail: unknown): void {
  try {
    if (!fs.existsSync(SCRAPBOOK_DIR)) fs.mkdirSync(SCRAPBOOK_DIR, { recursive: true });
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const safe = issuerId.replace(/[^a-zA-Z0-9-_]/g, '_');
    const fp = path.join(SCRAPBOOK_DIR, `trust-registry-${action}-${safe}-${ts}.json`);
    fs.writeFileSync(fp, JSON.stringify({ version: 1, action, issuerId, detail, timestamp: new Date().toISOString() }, null, 2));
  } catch { /* non-fatal */ }
}

export function registerIssuer(
  did: string,
  metadata: { name: string; url?: string; role: string },
): void {
  if (issuers.has(did)) {
    log('warn', 'trust_registry_issuer_already_registered', { did });
    return;
  }
  issuers.set(did, {
    did,
    name: metadata.name,
    url: metadata.url,
    role: metadata.role,
    registeredAt: new Date().toISOString(),
    capabilities: [],
    evidence: [],
  });
  emitGovernanceArtifact('register_issuer', did, metadata);
  saveToDisk();
  log('info', 'trust_registry_issuer_registered', { did, role: metadata.role });
}

export function grantCapability(
  issuerId: string,
  credentialType: string,
  grantedBy: string,
  origin: CapabilityOrigin = 'vitalcv',
): void {
  const issuer = issuers.get(issuerId);
  if (!issuer) throw new Error(`Issuer not found: ${issuerId}`);

  // Revoke existing grant of same type first
  issuer.capabilities = issuer.capabilities.filter((c) => c.credentialType !== credentialType || c.revokedAt);

  issuer.capabilities.push({ credentialType, grantedBy, grantedAt: new Date().toISOString(), origin });
  emitGovernanceArtifact('grant_capability', issuerId, { credentialType, grantedBy });
  saveToDisk();
  log('info', 'trust_registry_capability_granted', { issuerId, credentialType });
}

export function revokeCapability(issuerId: string, credentialType: string, reason: string): void {
  const issuer = issuers.get(issuerId);
  if (!issuer) throw new Error(`Issuer not found: ${issuerId}`);

  const cap = issuer.capabilities.find((c) => c.credentialType === credentialType && !c.revokedAt);
  if (cap) cap.revokedAt = new Date().toISOString();

  emitGovernanceArtifact('revoke_capability', issuerId, { credentialType, reason });
  saveToDisk();
  log('info', 'trust_registry_capability_revoked', { issuerId, credentialType });
}

export function appendEvidence(
  issuerId: string,
  evidenceRecord: EvidenceRecord,
): void {
  const issuer = issuers.get(issuerId);
  if (!issuer) throw new Error(`Issuer not found: ${issuerId}`);
  issuer.evidence.push(evidenceRecord);
  emitGovernanceArtifact('append_evidence', issuerId, evidenceRecord);
  saveToDisk();
}

export function checkCapability(
  issuerId: string,
  credentialType: string,
): { granted: boolean; revokedAt?: string } {
  const issuer = issuers.get(issuerId);
  if (!issuer) return { granted: false };

  const active = issuer.capabilities.find(
    (c) => c.credentialType === credentialType && !c.revokedAt,
  );
  if (active) return { granted: true };

  const revoked = issuer.capabilities.find(
    (c) => c.credentialType === credentialType && c.revokedAt,
  );
  return { granted: false, revokedAt: revoked?.revokedAt };
}

export function listIssuers(filter?: { role?: string; hasCapability?: string }): IssuerRecord[] {
  return Array.from(issuers.values()).filter((i) => {
    if (filter?.role && i.role !== filter.role) return false;
    if (filter?.hasCapability) {
      const has = i.capabilities.some((c) => c.credentialType === filter.hasCapability && !c.revokedAt);
      if (!has) return false;
    }
    return true;
  });
}

export function getIssuerRecord(did: string): IssuerRecord | undefined {
  return issuers.get(did);
}

// Seed VitalCV as a trusted issuer on module load
const VITALCV_DID = process.env.ISSUER_DID ?? 'did:web:vitalcv.com';
if (!issuers.has(VITALCV_DID)) {
  issuers.set(VITALCV_DID, {
    did: VITALCV_DID,
    name: 'VitalCV Trust Authority',
    url: 'https://vitalcv.com',
    role: 'PLATFORM_ISSUER',
    registeredAt: new Date().toISOString(),
    capabilities: [
      { credentialType: 'HEALTHCARE_LICENSE', grantedBy: 'system', grantedAt: new Date().toISOString(), origin: 'vitalcv' },
      { credentialType: 'NPI_BOUND_IDENTITY', grantedBy: 'system', grantedAt: new Date().toISOString(), origin: 'vitalcv' },
      { credentialType: 'EMPLOYMENT_ELIGIBILITY', grantedBy: 'system', grantedAt: new Date().toISOString(), origin: 'vitalcv' },
      { credentialType: 'PSV_ARTIFACT', grantedBy: 'system', grantedAt: new Date().toISOString(), origin: 'vitalcv' },
    ],
    evidence: [],
  });
}
