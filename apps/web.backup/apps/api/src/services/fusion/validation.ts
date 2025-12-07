import type {
  FusedCredentialRecord,
  FusionSourceSnapshot,
  FusionValidationFinding,
} from './types';

export interface ValidationContext {
  now: Date;
}

export function runFusionValidations(params: {
  fused: FusedCredentialRecord;
  sources: FusionSourceSnapshot;
  now: Date;
}): FusionValidationFinding[] {
  return [
    ...ensureSignedVcs(params.sources),
    ...detectExpiredComponents(params.fused, params.now),
    ...detectRevokedSources(params.fused, params.sources),
  ];
}

function ensureSignedVcs(sources: FusionSourceSnapshot): FusionValidationFinding[] {
  const findings: FusionValidationFinding[] = [];
  sources.employment.forEach((credential) => {
    const hasSignature =
      typeof (credential as Record<string, unknown>).signature === 'string' ||
      hasProof((credential as Record<string, unknown>).proof) ||
      hasProof((credential.metadata as Record<string, unknown> | null | undefined)?.proof);
    if (!hasSignature) {
      findings.push({
        id: `validation:${credential.id}`,
        level: 'error',
        message: `Employment credential ${credential.id} is missing a cryptographic proof`,
        componentId: `employment:${credential.id}`,
        field: 'proof',
      });
    }
  });
  return findings;
}

function detectExpiredComponents(
  fused: FusedCredentialRecord,
  now: Date,
): FusionValidationFinding[] {
  const findings: FusionValidationFinding[] = [];
  fused.components.forEach((component) => {
    const expiresAt =
      parseDate(component.fields.expiresAt) ??
      parseDate(component.fields.expiryDate) ??
      parseDate(component.fields.expires_on);
    if (expiresAt && expiresAt.getTime() < now.getTime()) {
      findings.push({
        id: `expired:${component.id}`,
        level: 'warning',
        message: `${component.label} expired on ${expiresAt.toISOString()}`,
        componentId: component.id,
        field: 'expiresAt',
      });
    }
  });
  return findings;
}

function detectRevokedSources(
  fused: FusedCredentialRecord,
  sources: FusionSourceSnapshot,
): FusionValidationFinding[] {
  const findings: FusionValidationFinding[] = [];
  const revoked = new Set(
    fused.components.filter((component) => component.status === 'revoked').map((component) => component.id),
  );
  sources.usLicenses.forEach((license) => {
    const status = (license.status ?? '').toString().toLowerCase();
    if (status.includes('revoked') || (license as any).disciplinaryFlag) {
      findings.push({
        id: `revoked:license:${license.id}`,
        level: 'error',
        message: `License ${license.state ?? ''} ${license.licenseNumber ?? ''} carries a revoked indicator`,
        componentId: `us_license:${license.state ?? ''}:${license.licenseNumber ?? license.id}`,
      });
    }
  });
  sources.employment.forEach((credential) => {
    const status = (credential.status ?? '').toString().toLowerCase();
    if (status.includes('revoked')) {
      findings.push({
        id: `revoked:employment:${credential.id}`,
        level: 'error',
        message: `Employment credential ${credential.id} is marked revoked`,
        componentId: `employment:${credential.id}`,
      });
    }
  });
  revoked.forEach((componentId) => {
    findings.push({
      id: `revoked:${componentId}`,
      level: 'error',
      message: `${componentId} resolved to revoked status`,
      componentId,
    });
  });
  return dedupeFindings(findings);
}

function hasProof(value: unknown): boolean {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const cast = value as Record<string, unknown>;
  if (typeof cast.signature === 'string') return true;
  if (typeof cast.proofValue === 'string') return true;
  if (typeof cast.jwt === 'string') return true;
  return false;
}

function parseDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}

function dedupeFindings(findings: FusionValidationFinding[]): FusionValidationFinding[] {
  const map = new Map<string, FusionValidationFinding>();
  findings.forEach((finding) => {
    map.set(finding.id, finding);
  });
  return Array.from(map.values());
}









