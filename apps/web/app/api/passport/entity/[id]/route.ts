import { NextRequest, NextResponse } from 'next/server';
import { BACKEND_URL as B } from '@/lib/backend-url';
export const runtime = 'nodejs';

/**
 * Proxy for employer review — transforms legacy passport response to PassportData shape.
 * Falls back to entity route for UUID-based lookups.
 */
export async function GET(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const isNpi = /^\d{10}$/.test(id);

  if (!isNpi) {
    // UUID — try entity route directly
    const res = await fetch(`${B}/api/passport/entity/${id}`);
    return NextResponse.json(await res.json().catch(() => ({})), { status: res.status });
  }

  // NPI — fetch from legacy passport + identity + trust-state, transform to PassportData shape
  const headers = { 'x-organization-context': 'direct-share' };
  const [passportRes, identityRes, trustRes] = await Promise.all([
    fetch(`${B}/api/passport/${id}`, { headers }).catch(() => null),
    fetch(`${B}/api/identity/${id}`, { headers }).catch(() => null),
    fetch(`${B}/api/trust-state/${id}`, { headers }).catch(() => null),
  ]);

  const passport = await passportRes?.json().catch(() => null);
  const identity = await identityRes?.json().catch(() => null);
  const trust = await trustRes?.json().catch(() => null);

  if (!passport?.public && !identity?.identity) {
    return NextResponse.json({ error: 'Passport not available' }, { status: 404 });
  }

  const pub = passport?.public ?? {};
  const ident = identity?.identity ?? {};
  const creds = passport?.credentials ?? [];
  const sanctions = passport?.sanctions ?? {};
  const trustBand = trust?.trustBand ?? pub.trustBand ?? 'UNKNOWN';
  const trustScore = trust?.trustScore ?? pub.readinessScore ?? 0;
  const gaps = trust?.gaps ?? [];
  const sources = trust?.sources ?? [];

  // Map credentials to authority format
  const authorityCredentials = creds.map((c: Record<string, unknown>) => ({
    id: c.id ?? '',
    domain: String(c.type ?? '').toLowerCase(),
    type: c.type ?? 'UNKNOWN',
    status: c.status ?? 'UNKNOWN',
    verificationLevel: c.status === 'ACTIVE' ? 'PRIMARY_SOURCE' : 'UNVERIFIED',
    issuerName: c.issuer ?? '',
    sourceId: c.issuer ?? '',
    verifiedAt: c.verifiedAt ?? null,
    expiresAt: c.expiresAt ?? null,
    observedAt: c.verifiedAt ?? null,
    stale: false,
    confidenceLabel: 'HIGH',
    claimConfidenceLabel: 'HIGH',
    dataFreshness: 'CURRENT',
    isPublic: c.isPublic ?? true,
  }));

  // Build PassportData shape
  const passportData = {
    entityId: id,
    npi: id,
    identity: {
      displayName: pub.name ?? `${ident.firstName ?? ''} ${ident.lastName ?? ''}`.trim() ?? `NPI ${id}`,
      specialty: ident.specialties?.[0]?.description ?? pub.specialty ?? '',
      entityType: pub.providerType ?? 'Individual',
      status: ident.npiStatus === 'A' ? 'ACTIVE' : 'UNKNOWN',
      npi: id,
    },
    authority: {
      credentials: authorityCredentials,
    },
    readiness: {
      level: trustBand,
      score: trustScore,
      status: trust?.readiness_status ?? 'Unknown',
      blockers: gaps,
    },
    standing: {
      sanctionsStatus: sanctions.status ?? 'UNCHECKED',
      sanctionsCheckedAt: sanctions.checkedAt ?? null,
      exclusionStatus: ident.exclusionStatus ?? 'UNCHECKED',
      medicareEnrolled: ident.medicareEnrolled ?? false,
    },
    sourceCoverage: {
      checks: (sources ?? []).map((s: Record<string, unknown>) => ({
        sourceId: s.sourceId ?? '',
        state: s.state ?? 'UNKNOWN',
        checkedAt: s.checkedAt ?? null,
      })),
      total: sources?.length ?? 0,
      checked: (sources ?? []).filter((s: Record<string, unknown>) => s.state === 'checked').length,
    },
    meta: {
      methodology: passport?.meta?.methodology ?? '',
      computedAt: passport?.meta?.computedAt ?? new Date().toISOString(),
      passportVersion: passport?.meta?.passportVersion ?? '2.0',
    },
  };

  return NextResponse.json(passportData, { status: 200 });
}
