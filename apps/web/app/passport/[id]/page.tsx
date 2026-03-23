import Link from 'next/link';
import PassportWallet from '@/components/passport/PassportWallet';

export const dynamic = 'force-dynamic';

const B =
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_BASE ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  'http://localhost:4000';

// ── Types (spec-aligned) ──────────────────────────────────────────────────────

export type ReadinessStatus = 'READY' | 'PARTIAL' | 'BLOCKED';

export interface PassportData {
  entityId:    string;
  npi?:        string;
  identity: {
    displayName: string;
    specialty?:  string;
    entityType:  string;
    status:      string;
    npi?:        string;
  };
  authority: {
    credentials: Array<{
      id:                string;
      domain:            string;
      type:              string;
      status:            string;
      verificationLevel: string;
      issuerEntityId?:   string;
      issuerName?:       string;
      sourceId?:         string;
      jurisdiction?:     string;
      issuedAt?:         string;
      expiresAt?:        string;
      verifiedAt?:       string;
      observedAt?:       string;
      stale:             boolean;
      confidenceLabel:   string;
      claimConfidenceLabel: string;
      matchConfidence?:  string;
      sourceLatency?:    string;
      dataFreshness:     string;
      dataFreshnessLabel: string;
      dataFreshnessCadence?: string;
      claimState?:       string;
      statusLabel?:      string;
      dataVersion?:      string;
      identityOnly?:     boolean;
      sourceDisclaimer?: string;
      reviewRequired:    boolean;
    }>;
    summary: { active: number; expired: number; stale: number; missing: string[] };
  };
  training: {
    records: Array<{
      id:               string;
      recordType:       string;
      degreeOrTitle?:   string;
      specialty?:       string;
      programName?:     string;
      institutionName?: string;
      endYear?:         number;
      completed:        boolean;
      verificationLevel: string;
    }>;
    hasDegree:        boolean;
    degreeVerified:   boolean;
    hasResidency:     boolean;
    fellowshipCount:  number;
  };
  standing: {
    exclusionClear:   boolean;
    exclusionStatus:  'CLEAR' | 'EXCLUDED' | 'POSSIBLE_MATCH' | 'UNCHECKED' | 'UNKNOWN';
    exclusionCheckedAt?: string;
    exclusionConfidenceLabel?: string;
    licensureStatus:  'verified' | 'pending' | 'expired' | 'unknown';
    deaStatus:        'registered' | 'none' | 'unknown';
    pecosStatus:      'enrolled' | 'not_enrolled' | 'unknown';
    enrollmentObservedAt?: string;
    enrollmentDataVersion?: string;
    enrollmentStatusLabel?: string;
    enrollmentFreshnessLabel?: string;
    enrollmentConfidenceLabel?: string;
    negativeFindings: string[];
  };
  readiness: {
    status:             ReadinessStatus;
    score:              number;
    level:              string;
    blockers:           string[];
    gaps:               string[];
    estimatedStartDays: number | null;
  };
  sources: { checked: string[]; lastFetch: Record<string, string> };
  lastCheckedAt: string;
}

// ── Fetch ─────────────────────────────────────────────────────────────────────

async function fetchPassport(entityId: string): Promise<PassportData | null> {
  try {
    const res = await fetch(`${B}/api/passport/entity/${entityId}`, {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;
    return await res.json() as PassportData;
  } catch {
    return null;
  }
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function PassportEntityPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const passport = await fetchPassport(id);

  if (!passport) {
    return (
      <main className="min-h-screen bg-vt-surface-ops-base flex flex-col items-center justify-center px-4">
        <p className="text-white/35 text-sm">Passport not found.</p>
        <Link href="/passport" className="text-white/50 text-xs mt-4 underline underline-offset-2">
          Try another NPI
        </Link>
      </main>
    );
  }

  return <PassportWallet passport={passport} />;
}
