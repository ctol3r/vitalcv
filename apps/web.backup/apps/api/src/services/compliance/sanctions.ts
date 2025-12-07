import {
  Prisma,
  PrismaClient,
  PrivilegeSafetySignalType,
  PrivilegeSafetySeverity,
  type ComplianceCheck,
} from '@prisma/client';
import {
  ReadinessEngine,
  buildDefaultSignals,
  type ReadinessOverrides,
} from '../readiness/engine';

const prismaSingleton = new PrismaClient();

const SANCTIONS_CACHE_TTL_MINUTES = Number(
  process.env.SANCTIONS_CACHE_TTL_MINUTES ?? '720',
);
const NPDB_CACHE_TTL_MINUTES = Number(
  process.env.NPDB_CACHE_TTL_MINUTES ?? '1440',
);
const SANCTIONS_API_BASE_URL = process.env.OIG_LEIE_API_BASE_URL ?? '';
const NPDB_SNAPSHOT_URL = process.env.NPDB_SNAPSHOT_URL ?? '';
const SANCTIONS_API_TIMEOUT_MS = Number(
  process.env.SANCTIONS_API_TIMEOUT_MS ?? '8000',
);
const NPDB_SNAPSHOT_TIMEOUT_MS = Number(
  process.env.NPDB_SNAPSHOT_TIMEOUT_MS ?? '12000',
);

const severityWeight: Record<SanctionMatchSeverity, number> = {
  low: 0.25,
  medium: 0.45,
  high: 0.75,
  critical: 0.95,
};

const CLINICIAN_FIELDS = {
  id: true,
  npi: true,
  state: true,
  user: {
    select: {
      name: true,
      email: true,
      did: true,
    },
  },
} satisfies Prisma.ClinicianProfileSelect;

type ClinicianContext = Prisma.ClinicianProfileGetPayload<{
  select: typeof CLINICIAN_FIELDS;
}>;

export interface SanctionsAutomationOptions {
  clinicianId: string;
  forceRefresh?: boolean;
  prisma?: PrismaClient;
}

export interface SanctionsAutomationResult {
  clinicianId: string;
  sanctions: SanctionMatch[];
  npdb: NpdbAdverseAction[];
  complianceChecks: {
    sanctions?: string;
    npdb?: string;
  };
  triggeredAutoRevoke: boolean;
  readinessScore?: number;
  refreshed: {
    sanctions: boolean;
    npdb: boolean;
  };
  checkedAt: string;
}

export type SanctionMatchSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface SanctionMatch {
  id: string;
  source: 'oig' | 'leie';
  status: 'active' | 'cleared';
  severity: SanctionMatchSeverity;
  entityName: string;
  action: string;
  effectiveDate?: string | null;
  expiresAt?: string | null;
  matchConfidence?: number;
  metadata?: Record<string, unknown>;
}

export interface NpdbAdverseAction {
  reportId: string;
  actionType: string;
  severity: SanctionMatchSeverity;
  reportedAt: string;
  description?: string;
  metadata?: Record<string, unknown>;
}

interface ResolvedSnapshot<T> {
  matches: T[];
  refreshed: boolean;
  source: string;
  cachedAt?: string;
}

export async function runSanctionsAutomation(
  options: SanctionsAutomationOptions,
): Promise<SanctionsAutomationResult> {
  if (!options.clinicianId) {
    throw new Error('clinicianId is required for sanctions automation');
  }

  const client = options.prisma ?? prismaSingleton;
  const clinician = await client.clinicianProfile.findUnique({
    where: { id: options.clinicianId },
    select: CLINICIAN_FIELDS,
  });

  if (!clinician) {
    throw new Error(`Clinician ${options.clinicianId} not found`);
  }

  const [sanctionsSnapshot, npdbSnapshot] = await Promise.all([
    resolveSanctionsSnapshot({
      client,
      clinician,
      forceRefresh: options.forceRefresh ?? false,
    }),
    resolveNpdbSnapshot({
      client,
      clinician,
      forceRefresh: options.forceRefresh ?? false,
    }),
  ]);

  const checkedAt = new Date().toISOString();

  const [sanctionsCheckId, npdbCheckId] = await Promise.all([
    recordComplianceCheck(client, clinician.id, 'sanctions', sanctionsSnapshot, checkedAt),
    recordComplianceCheck(client, clinician.id, 'npdb', npdbSnapshot, checkedAt),
  ]);

  const autoRevoke = await maybeTriggerAutoRevoke(client, clinician.id, {
    sanctions: sanctionsSnapshot.matches,
    npdb: npdbSnapshot.matches,
  });

  const readinessScore = await recomputeReadiness(
    clinician.id,
    sanctionsSnapshot.matches,
    npdbSnapshot.matches,
  );

  return {
    clinicianId: clinician.id,
    sanctions: sanctionsSnapshot.matches,
    npdb: npdbSnapshot.matches,
    complianceChecks: {
      sanctions: sanctionsCheckId,
      npdb: npdbCheckId,
    },
    triggeredAutoRevoke: autoRevoke.triggered,
    readinessScore,
    refreshed: {
      sanctions: sanctionsSnapshot.refreshed,
      npdb: npdbSnapshot.refreshed,
    },
    checkedAt,
  };
}

async function resolveSanctionsSnapshot(input: {
  client: PrismaClient;
  clinician: ClinicianContext;
  forceRefresh: boolean;
}): Promise<ResolvedSnapshot<SanctionMatch>> {
  const cached = await findFreshCheck(
    input.client,
    input.clinician.id,
    'sanctions',
    SANCTIONS_CACHE_TTL_MINUTES,
  );

  if (cached && !input.forceRefresh) {
    return {
      matches: extractSanctionsFromCheck(cached),
      refreshed: false,
      source: cached.source ?? 'compliance_cache',
      cachedAt: cached.createdAt.toISOString(),
    };
  }

  let matches: SanctionMatch[] = [];
  let refreshed = false;

  if (SANCTIONS_API_BASE_URL) {
    try {
      matches = await queryOigLeieFeed(input.clinician);
      refreshed = true;
    } catch (error) {
      console.warn('[sanctionsAutomation] OIG/LEIE lookup failed', {
        clinicianId: input.clinician.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  if (matches.length === 0 && cached) {
    return {
      matches: extractSanctionsFromCheck(cached),
      refreshed: false,
      source: cached.source ?? 'compliance_cache',
      cachedAt: cached.createdAt.toISOString(),
    };
  }

  return {
    matches,
    refreshed,
    source: matches.length > 0 ? 'oig_leie_api' : 'compliance_cache',
  };
}

async function resolveNpdbSnapshot(input: {
  client: PrismaClient;
  clinician: ClinicianContext;
  forceRefresh: boolean;
}): Promise<ResolvedSnapshot<NpdbAdverseAction>> {
  const cached = await findFreshCheck(
    input.client,
    input.clinician.id,
    'npdb',
    NPDB_CACHE_TTL_MINUTES,
  );

  if (cached && !input.forceRefresh) {
    return {
      matches: extractNpdbFromCheck(cached),
      refreshed: false,
      source: cached.source ?? 'npdb_snapshot',
      cachedAt: cached.createdAt.toISOString(),
    };
  }

  let matches: NpdbAdverseAction[] = [];
  let refreshed = false;

  if (NPDB_SNAPSHOT_URL) {
    try {
      matches = await queryNpdbSnapshot(input.clinician);
      refreshed = true;
    } catch (error) {
      console.warn('[sanctionsAutomation] NPDB snapshot lookup failed', {
        clinicianId: input.clinician.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  if (matches.length === 0 && cached) {
    return {
      matches: extractNpdbFromCheck(cached),
      refreshed: false,
      source: cached.source ?? 'npdb_snapshot',
      cachedAt: cached.createdAt.toISOString(),
    };
  }

  return {
    matches,
    refreshed,
    source: matches.length > 0 ? 'npdb_snapshot' : 'compliance_cache',
  };
}

async function queryOigLeieFeed(clinician: ClinicianContext): Promise<SanctionMatch[]> {
  if (!SANCTIONS_API_BASE_URL) {
    return [];
  }

  const controller =
    typeof AbortController !== 'undefined' ? new AbortController() : undefined;
  const timer =
    controller &&
    setTimeout(() => controller.abort(), SANCTIONS_API_TIMEOUT_MS);

  try {
    const response = await fetch(`${SANCTIONS_API_BASE_URL}/matches/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        npi: clinician.npi,
        name: buildClinicianDisplayName(clinician),
        state: clinician.state,
        did: clinician.user?.did,
      }),
      signal: controller?.signal,
    });

    if (!response.ok) {
      throw new Error(`OIG/LEIE API responded with ${response.status}`);
    }

    const payload = (await response.json()) as {
      matches?: Array<Record<string, unknown>>;
    };

    const matches = Array.isArray(payload.matches) ? payload.matches : [];
    return matches.map((entry, index) => ({
      id: String(entry.caseNumber ?? entry.id ?? `sanction-${index}`),
      source:
        String(entry.registry ?? '').toLowerCase() === 'leie' ? 'leie' : 'oig',
      status:
        String(entry.status ?? '').toLowerCase() === 'cleared'
          ? 'cleared'
          : 'active',
      severity: normalizeSanctionSeverity(entry.severity),
      entityName:
        (entry.name as string) ??
        buildClinicianDisplayName(clinician) ??
        clinician.id,
      action:
        (entry.action as string) ??
        (entry.violation as string) ??
        'Disciplinary action',
      effectiveDate: toIso(entry.effectiveDate as string | undefined),
      expiresAt: toIso(entry.expiresAt as string | undefined),
      matchConfidence: Number(entry.matchConfidence ?? 0),
      metadata: ensurePlainObject(entry),
    }));
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

async function queryNpdbSnapshot(clinician: ClinicianContext): Promise<NpdbAdverseAction[]> {
  if (!NPDB_SNAPSHOT_URL) {
    return [];
  }

  const controller =
    typeof AbortController !== 'undefined' ? new AbortController() : undefined;
  const timeout =
    controller &&
    setTimeout(() => controller.abort(), NPDB_SNAPSHOT_TIMEOUT_MS);

  try {
    const response = await fetch(
      `${NPDB_SNAPSHOT_URL}?npi=${encodeURIComponent(clinician.npi ?? '')}`,
      {
        headers: { Accept: 'application/json' },
        signal: controller?.signal,
      },
    );

    if (!response.ok) {
      throw new Error(`NPDB snapshot responded with ${response.status}`);
    }

    const payload = (await response.json()) as {
      adverseActions?: Array<Record<string, unknown>>;
    };

    const records = Array.isArray(payload.adverseActions)
      ? payload.adverseActions
      : [];

    return records.map((record, index) => ({
      reportId: String(record.reportId ?? record.id ?? `npdb-${index}`),
      actionType: (record.actionType as string) ?? 'Adverse Action',
      severity: normalizeSanctionSeverity(record.severity),
      reportedAt:
        toIso(
          (record.reportedAt as string | undefined) ??
            (record.actionDate as string | undefined),
        ) ?? new Date().toISOString(),
      description:
        (record.description as string) ??
        (record.summary as string) ??
        undefined,
      metadata: ensurePlainObject(record),
    }));
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}

async function recordComplianceCheck(
  client: PrismaClient,
  clinicianId: string,
  type: string,
  snapshot: ResolvedSnapshot<SanctionMatch | NpdbAdverseAction>,
  checkedAt: string,
): Promise<string | undefined> {
  try {
    const record = await client.complianceCheck.create({
      data: {
        clinicianId,
        type,
        source: snapshot.source,
        result: {
          matches: snapshot.matches,
          refreshedFromApi: snapshot.refreshed,
          checkedAt,
          cachedAt: snapshot.cachedAt ?? null,
        } as Prisma.InputJsonValue,
      },
    });
    return record.id;
  } catch (error) {
    console.error('[sanctionsAutomation] Failed to record compliance check', {
      clinicianId,
      type,
      error: error instanceof Error ? error.message : String(error),
    });
    return undefined;
  }
}

async function maybeTriggerAutoRevoke(
  client: PrismaClient,
  clinicianId: string,
  signals: { sanctions: SanctionMatch[]; npdb: NpdbAdverseAction[] },
): Promise<{ triggered: boolean; signalId?: string }> {
  const sanctionScore = signals.sanctions
    .filter((match) => match.status === 'active')
    .reduce(
      (max, match) => Math.max(max, severityWeight[match.severity] ?? 0),
      0,
    );
  const npdbScore = signals.npdb.reduce(
    (max, action) => Math.max(max, severityWeight[action.severity] ?? 0),
    0,
  );
  const highest = Math.max(sanctionScore, npdbScore);

  if (highest < severityWeight.high) {
    return { triggered: false };
  }

  try {
    const reason =
      npdbScore >= sanctionScore
        ? 'NPDB adverse action flagged'
        : 'Sanctions registry hit';

    const signal = await client.privilegeSafetySignal.create({
      data: {
        clinicianId,
        signalType:
          npdbScore >= sanctionScore
            ? PrivilegeSafetySignalType.NPDB_FLAG
            : PrivilegeSafetySignalType.LICENSE_RISK,
        severity:
          (highest >= severityWeight.critical
            ? PrivilegeSafetySeverity.CRITICAL
            : PrivilegeSafetySeverity.HIGH) ?? PrivilegeSafetySeverity.HIGH,
        privilegeCodes: [],
        summary: reason,
        source: 'compliance:sanctions',
        recommendedAction: 'AUTO_REVOKE',
        details: {
          sanctions: signals.sanctions,
          npdb: signals.npdb,
          triggeredAt: new Date().toISOString(),
        } as Prisma.InputJsonValue,
      },
    });

    return { triggered: true, signalId: signal.id };
  } catch (error) {
    console.error('[sanctionsAutomation] Failed to create safety signal', {
      clinicianId,
      error: error instanceof Error ? error.message : String(error),
    });
    return { triggered: false };
  }
}

async function recomputeReadiness(
  clinicianId: string,
  sanctions: SanctionMatch[],
  npdb: NpdbAdverseAction[],
): Promise<number | undefined> {
  try {
    const overrides = await loadReadinessOverrides(clinicianId);
    const signals = buildDefaultSignals(clinicianId, overrides);
    signals.sanctionsProbability = deriveSanctionsProbability(sanctions, npdb);
    signals.npdbHistory = {
      adverseActions: npdb.length,
      lastReportAt: npdb[0]?.reportedAt ?? null,
    };

    const engine = new ReadinessEngine();
    const result = await engine.evaluateAndStore(signals);
    return result.score;
  } catch (error) {
    console.warn('[sanctionsAutomation] Readiness recompute failed', {
      clinicianId,
      error: error instanceof Error ? error.message : String(error),
    });
    return undefined;
  }
}

async function loadReadinessOverrides(
  clinicianId: string,
): Promise<ReadinessOverrides> {
  const record = await prismaSingleton.clinicianReadinessScore.findUnique({
    where: { clinicianId },
    select: { factors: true },
  });

  const factors = (record?.factors as Record<string, unknown>) ?? {};
  const licenseFreshnessDays = Number(factors.licenseFreshnessDays ?? 45);
  const compactEligibility = (factors.compactEligibility as ReadinessOverrides['compactEligibility']) ?? 'PARTIAL';

  return {
    licenseFreshnessDays: Number.isFinite(licenseFreshnessDays)
      ? licenseFreshnessDays
      : 45,
    compactEligibility,
  };
}

function deriveSanctionsProbability(
  sanctions: SanctionMatch[],
  npdb: NpdbAdverseAction[],
): number {
  if (sanctions.length === 0 && npdb.length === 0) {
    return 0.08;
  }
  const sanctionSeverity = sanctions.reduce(
    (score, match) => Math.max(score, severityWeight[match.severity] ?? 0.35),
    0,
  );
  const npdbSeverity = npdb.reduce(
    (score, action) => Math.max(score, severityWeight[action.severity] ?? 0.45),
    0,
  );
  return clamp01(0.1 + Math.max(sanctionSeverity, npdbSeverity));
}

async function findFreshCheck(
  client: PrismaClient,
  clinicianId: string,
  type: string,
  ttlMinutes: number,
): Promise<ComplianceCheck | null> {
  const record = await client.complianceCheck.findFirst({
    where: { clinicianId, type },
    orderBy: { createdAt: 'desc' },
  });

  if (!record) {
    return null;
  }

  const ageMs = Date.now() - record.createdAt.getTime();
  if (ageMs > ttlMinutes * 60 * 1000) {
    return null;
  }

  return record;
}

function extractSanctionsFromCheck(record: ComplianceCheck): SanctionMatch[] {
  const payload = (record.result as Record<string, unknown>) ?? {};
  const matches = safeArrayFrom<SanctionMatch>(payload.matches);
  return matches;
}

function extractNpdbFromCheck(record: ComplianceCheck): NpdbAdverseAction[] {
  const payload = (record.result as Record<string, unknown>) ?? {};
  const matches = safeArrayFrom<NpdbAdverseAction>(payload.matches);
  return matches;
}

function normalizeSanctionSeverity(value?: unknown): SanctionMatchSeverity {
  const normalized = String(value ?? '').toLowerCase();
  if (normalized.includes('critical') || normalized === 'block') {
    return 'critical';
  }
  if (normalized.includes('high') || normalized === 'suspended') {
    return 'high';
  }
  if (normalized.includes('medium') || normalized === 'probation') {
    return 'medium';
  }
  return 'low';
}

function toIso(value?: string | null): string | null {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function ensurePlainObject(value: unknown): Record<string, unknown> | undefined {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return undefined;
}

function clamp01(value: number): number {
  if (Number.isNaN(value)) {
    return 0;
  }
  return Math.max(0, Math.min(1, value));
}

function safeArrayFrom<T>(value: unknown): T[] {
  if (Array.isArray(value)) {
    return value as T[];
  }
  return [];
}

function buildClinicianDisplayName(clinician: ClinicianContext): string {
  return clinician.user?.name ?? clinician.id;
}

