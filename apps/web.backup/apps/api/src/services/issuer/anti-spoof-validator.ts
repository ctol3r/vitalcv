import { createHash } from 'crypto';

export interface DidDocumentSummary {
  id: string;
  controller?: string | string[];
  verificationMethod?: Array<{
    id: string;
    controller?: string;
    type?: string;
    publicKeyJwk?: Record<string, unknown>;
    publicKeyMultibase?: string;
  }>;
  service?: Array<{
    id: string;
    type?: string;
    serviceEndpoint: string | Record<string, unknown>;
  }>;
  updated?: string;
}

export interface IssuerAntiSpoofVerdict {
  accepted: boolean;
  score: number;
  issues: string[];
  checks: {
    didConsistency: boolean;
    keyRotationHealthy: boolean;
    mtlsFingerprintTrusted: boolean;
  };
}

export interface AntiSpoofInput {
  issuerDid: string;
  didDocument?: DidDocumentSummary | null;
  mtlsFingerprint?: string | null;
}

const rotationHistory = new Map<
  string,
  {
    hash: string;
    updatedAt: number;
  }
>();

const trustedFingerprints = new Set(
  (process.env.ISSUER_MTLS_FINGERPRINTS || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean),
);

export function validateIssuerAntiSpoof(input: AntiSpoofInput): IssuerAntiSpoofVerdict {
  const issues: string[] = [];

  const didConsistency = checkDidConsistency(input.issuerDid, input.didDocument, issues);
  const keyRotationHealthy = checkKeyRotation(input.issuerDid, input.didDocument, issues);
  const mtlsFingerprintTrusted = checkMtlsFingerprint(input.mtlsFingerprint, issues);

  const issueCount = issues.length;
  const score = clamp(issueCount * 0.35);

  return {
    accepted: score < 0.75,
    score,
    issues,
    checks: {
      didConsistency,
      keyRotationHealthy,
      mtlsFingerprintTrusted,
    },
  };
}

function checkDidConsistency(
  issuerDid: string,
  didDocument: DidDocumentSummary | null | undefined,
  issues: string[],
): boolean {
  if (!didDocument) {
    issues.push('did_document_unavailable');
    return false;
  }

  const idMatches = didDocument.id === issuerDid;
  const controller = Array.isArray(didDocument.controller)
    ? didDocument.controller
    : didDocument.controller
      ? [didDocument.controller]
      : [];
  const controllerMatches = controller.length === 0 || controller.includes(issuerDid);
  if (!idMatches) {
    issues.push('did_mismatch');
  }
  if (!controllerMatches) {
    issues.push('did_controller_mismatch');
  }

  const services = didDocument.service ?? [];
  const endpointMismatch = services.some((svc) => {
    if (typeof svc.serviceEndpoint !== 'string') {
      return false;
    }
    try {
      const endpointUrl = new URL(svc.serviceEndpoint);
      if (issuerDid.startsWith('did:web:')) {
        const didHost = issuerDid.replace('did:web:', '').split(':')[0];
        return endpointUrl.hostname !== didHost;
      }
      return false;
    } catch {
      return true;
    }
  });

  if (endpointMismatch) {
    issues.push('service_endpoint_mismatch');
  }

  return idMatches && controllerMatches && !endpointMismatch;
}

function checkKeyRotation(
  issuerDid: string,
  didDocument: DidDocumentSummary | null | undefined,
  issues: string[],
): boolean {
  const methods = didDocument?.verificationMethod ?? [];
  if (!methods.length) {
    issues.push('verification_methods_missing');
    return false;
  }

  const keyMaterial = methods
    .map((method) => `${method.id}:${method.type}:${normalize(method.publicKeyJwk) ?? method.publicKeyMultibase ?? ''}`)
    .join('|');
  const hash = createHash('sha256').update(keyMaterial).digest('hex');
  const previous = rotationHistory.get(issuerDid);
  const now = Date.now();

  let healthy = true;
  if (previous && previous.hash !== hash) {
    const deltaMs = now - previous.updatedAt;
    if (deltaMs < 10 * 60 * 1000) {
      issues.push('key_rotation_frequency');
      healthy = false;
    }
  }

  rotationHistory.set(issuerDid, { hash, updatedAt: now });
  return healthy;
}

function checkMtlsFingerprint(fingerprint: string | null | undefined, issues: string[]): boolean {
  if (!fingerprint) {
    issues.push('mtls_fingerprint_missing');
    return false;
  }
  if (trustedFingerprints.size === 0) {
    return true;
  }
  if (!trustedFingerprints.has(fingerprint.trim())) {
    issues.push('mtls_fingerprint_untrusted');
    return false;
  }
  return true;
}

function normalize(value?: Record<string, unknown>): string | null {
  if (!value) return null;
  try {
    const sorted = Object.keys(value)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = value[key];
        return acc;
      }, {});
    return JSON.stringify(sorted);
  } catch {
    return null;
  }
}

function clamp(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, Number(value.toFixed(4))));
}



