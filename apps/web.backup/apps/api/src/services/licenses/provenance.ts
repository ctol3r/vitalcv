import { createHash, timingSafeEqual } from 'crypto';

export interface GlobalLicenseProvenanceInput {
  clinicianId: string;
  authority: string;
  country: string;
  licenseNumber: string;
  status: string;
  payloadHash: string;
  issuedAt?: string | null;
  expiresAt?: string | null;
  lastVerified?: string | null;
  previousHash?: string | null;
}

export interface GlobalLicenseProvenanceVerdict {
  verdict: 'trusted' | 'review';
  score: number;
  issues: string[];
  recordHash: string;
  matchedHash: boolean;
  stale: boolean;
  computedAt: string;
}

const STALE_THRESHOLD_DAYS = Number(process.env.GLOBAL_LICENSE_STALE_DAYS ?? '90');

export function validateGlobalLicenseProvenance(
  input: GlobalLicenseProvenanceInput,
): GlobalLicenseProvenanceVerdict {
  if (!input.clinicianId) throw new Error('clinicianId is required for provenance check');
  if (!input.licenseNumber) throw new Error('licenseNumber is required for provenance check');

  const normalizedAuthority = input.authority.trim().toUpperCase();
  const normalizedCountry = input.country.trim().toUpperCase();

  const recordHash = createHash('sha256')
    .update(
      [
        input.clinicianId,
        normalizedAuthority,
        normalizedCountry,
        input.licenseNumber,
        input.status.toLowerCase(),
        input.expiresAt ?? 'null',
      ].join(':'),
    )
    .digest('hex');

  const normalizedPayloadHash = normalizeHash(input.payloadHash);
  const matchedHash =
    normalizedPayloadHash.length === recordHash.length &&
    safeEqual(Buffer.from(recordHash, 'hex'), Buffer.from(normalizedPayloadHash, 'hex'));

  const issues: string[] = [];
  let score = 0.58;
  if (matchedHash) {
    score += 0.25;
  } else {
    issues.push('Board hash mismatch');
    score -= 0.25;
  }

  if (input.previousHash && input.previousHash !== normalizedPayloadHash) {
    issues.push('Hash rotated since last ingest');
    score -= 0.05;
  }

  const stale = isStale(input.lastVerified);
  if (stale) {
    issues.push(`Verification older than ${STALE_THRESHOLD_DAYS} days`);
    score -= 0.1;
  }

  if (isExpired(input.expiresAt)) {
    issues.push('License marked expired by issuing board');
    score -= 0.12;
  }

  if (input.status.toLowerCase() === 'suspended') {
    issues.push('Board returned suspension status');
    score -= 0.18;
  }

  score = clamp(score, 0, 1);
  const verdict: GlobalLicenseProvenanceVerdict['verdict'] =
    score >= 0.72 && !issues.some((issue) => /suspension|mismatch/i.test(issue))
      ? 'trusted'
      : 'review';

  return {
    verdict,
    score: Number(score.toFixed(4)),
    issues,
    recordHash,
    matchedHash,
    stale,
    computedAt: new Date().toISOString(),
  };
}

function normalizeHash(value: string | undefined): string {
  if (!value) return '';
  return value.replace(/^0x/i, '').trim().toLowerCase();
}

function safeEqual(a: Buffer, b: Buffer): boolean {
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

function isStale(lastVerified?: string | null): boolean {
  if (!lastVerified) return true;
  const parsed = new Date(lastVerified);
  if (Number.isNaN(parsed.getTime())) {
    return true;
  }
  const ageDays = (Date.now() - parsed.getTime()) / (1000 * 60 * 60 * 24);
  return ageDays > STALE_THRESHOLD_DAYS;
}

function isExpired(expiresAt?: string | null): boolean {
  if (!expiresAt) return false;
  const parsed = new Date(expiresAt);
  if (Number.isNaN(parsed.getTime())) {
    return false;
  }
  return parsed.getTime() < Date.now();
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}









