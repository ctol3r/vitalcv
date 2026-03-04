import type { Express, Request, Response } from 'express';
import prisma from '../graphql/prisma_client';
import { publicApiRateLimit } from '../middleware/publicSafety';
import { log } from '../obs/logger';
import { redisJsonCache, type JsonCache } from '../services/cache/redisJsonCache';
import {
  signShareProofToken,
  type ShareProofTokenInput,
} from '../services/mobile/shareProofToken';

const MOBILE_CACHE_TTL_SECONDS = 15;
const MOBILE_TRUST_CACHE_PREFIX = 'mobile:trust-state:v1:';
const NETWORK_ACTIVITY_CACHE_KEY = 'mobile:network-activity:v1';
const DEFAULT_NETWORK_ACTIVITY_LIMIT = 25;
const NPI_RE = /^\d{10}$/;

const VERIFICATION_EVENT_TYPES = [
  'VERIFICATION_REQUESTED',
  'VERIFICATION_COMPLETED',
  'VERIFICATION_FAILED',
] as const;

const REVOCATION_ACTIONS = ['revoke', 'suspend', 'expire'] as const;

type VerificationEventType = (typeof VERIFICATION_EVENT_TYPES)[number];
type RevocationAction = (typeof REVOCATION_ACTIONS)[number];

type MobileTrustTimelineEntry = {
  id: string;
  type: string;
  label: string;
  timestamp: string;
  employer: string | null;
  facility: string | null;
  metadata: Record<string, unknown>;
};

type MobileTrustResponse = {
  recognized: boolean;
  accepted: boolean;
  started: boolean;
  start_ready: boolean;
  crs: {
    score: number;
    band: 'GREEN' | 'YELLOW' | 'RED';
    factors: Record<string, unknown>;
  };
  blocking_reasons: string[];
  timeline_preview: MobileTrustTimelineEntry[];
  recognitionId?: string;
  acceptanceId?: string;
  startId?: string;
  recognizedAt?: string;
  acceptedAt?: string;
  attestedAt?: string;
  acceptanceDetails?: {
    employerId: string;
    facilityId: string;
    role: string;
    acceptedAt: string;
  } | null;
  generated_at: string;
};

type NetworkVerificationEvent = {
  id: string;
  type: VerificationEventType;
  reference_id: string | null;
  clinician_id: string | null;
  organization_id: string | null;
  occurred_at: string;
};

type RevocationBroadcast = {
  id: string;
  action: RevocationAction;
  artifact_id: string | null;
  npi: string | null;
  reason: string | null;
  occurred_at: string;
};

type NetworkActivityResponse = {
  generated_at: string;
  verification_events: NetworkVerificationEvent[];
  revocation_broadcasts: RevocationBroadcast[];
};

type RecognitionRow = {
  recognitionId: string;
  employerId: string;
  recognizedAt: Date;
  expiresAt: Date | null;
  revokedAt: Date | null;
  verificationRef: string;
};

type AcceptanceRow = {
  acceptanceId: string;
  recognitionId: string;
  employerId: string;
  facilityId: string;
  acceptedAt: Date;
  psvReportId: string;
};

type StartRow = {
  startId: string;
  acceptanceId: string;
  employerId: string;
  attestedAt: Date;
};

type LatestArtifactRow = {
  id: string;
  trustState: string;
  status: string;
  monitoring: boolean;
  verifiedAt: Date;
  expiresAt: Date | null;
};

type VerificationEventRow = {
  id: string;
  type: string;
  referenceId: string | null;
  clinicianId: string | null;
  organizationId: string | null;
  createdAt: Date;
};

type TrustLedgerRow = {
  id: string;
  action: string;
  artifactId: string | null;
  npi: string | null;
  metadata: unknown;
  createdAt: Date;
};

type MobileTrustSnapshotRows = {
  recognition: RecognitionRow | null;
  acceptances: AcceptanceRow[];
  starts: StartRow[];
  latestArtifact: LatestArtifactRow | null;
};

type NetworkActivityRows = {
  verificationEvents: VerificationEventRow[];
  revocationRows: TrustLedgerRow[];
};

interface MobileTrustDatabase {
  loadTrustSnapshotRows(npi: string): Promise<MobileTrustSnapshotRows>;
  loadNetworkActivityRows(limit: number): Promise<NetworkActivityRows>;
  loadArtifactNpiMap(artifactIds: string[]): Promise<Map<string, string>>;
}

type SignShareToken = (input: ShareProofTokenInput) => Promise<string>;

type MobileTrustRouteDependencies = {
  cache: JsonCache;
  db: MobileTrustDatabase;
  signShareToken: SignShareToken;
  now: () => Date;
  baseUrl: string;
};

function isValidNpi(value: string): boolean {
  return NPI_RE.test(value);
}

function mapCrsFromArtifact(artifact: LatestArtifactRow | null): MobileTrustResponse['crs'] {
  if (!artifact) {
    return {
      score: 0,
      band: 'RED',
      factors: { source: 'none' },
    };
  }

  switch (artifact.trustState) {
    case 'verified_monitoring':
      return {
        score: 92,
        band: 'GREEN',
        factors: {
          trust_state: artifact.trustState,
          monitoring: artifact.monitoring,
          verified_at: artifact.verifiedAt.toISOString(),
        },
      };
    case 'verified':
      return {
        score: 86,
        band: 'GREEN',
        factors: {
          trust_state: artifact.trustState,
          monitoring: artifact.monitoring,
          verified_at: artifact.verifiedAt.toISOString(),
        },
      };
    case 'expiring_soon':
      return {
        score: 64,
        band: 'YELLOW',
        factors: {
          trust_state: artifact.trustState,
          expires_at: artifact.expiresAt?.toISOString() ?? null,
        },
      };
    case 'expired':
      return {
        score: 20,
        band: 'RED',
        factors: {
          trust_state: artifact.trustState,
          expires_at: artifact.expiresAt?.toISOString() ?? null,
        },
      };
    default:
      return {
        score: 40,
        band: 'RED',
        factors: {
          trust_state: artifact.trustState,
          status: artifact.status,
        },
      };
  }
}

function buildBlockingReasons(input: {
  recognized: boolean;
  accepted: boolean;
  started: boolean;
  crsBand: 'GREEN' | 'YELLOW' | 'RED';
  recognition: RecognitionRow | null;
  now: Date;
}): string[] {
  const reasons: string[] = [];

  if (!input.recognized) {
    reasons.push('MISSING_RECOGNITION');
    reasons.push('MISSING_PSV');
  }

  if (!input.accepted) {
    reasons.push('MISSING_ACCEPTANCE');
  }

  if (input.started) {
    reasons.push('START_ALREADY_ATTESTED');
  }

  if (input.recognition?.revokedAt) {
    reasons.push('REVOKED_PSV');
  }

  if (input.recognition?.expiresAt && input.recognition.expiresAt.getTime() <= input.now.getTime()) {
    reasons.push('EXPIRED_PSV');
  }

  if (input.crsBand !== 'GREEN') {
    reasons.push('CRS_BELOW_THRESHOLD');
  }

  return [...new Set(reasons)];
}

function buildTimeline(rows: {
  recognition: RecognitionRow | null;
  acceptances: AcceptanceRow[];
  starts: StartRow[];
}): MobileTrustTimelineEntry[] {
  const timeline: MobileTrustTimelineEntry[] = [];

  if (rows.recognition) {
    timeline.push({
      id: rows.recognition.recognitionId,
      type: 'VERIFICATION_COMPLETED',
      label: 'Verification completed',
      timestamp: rows.recognition.recognizedAt.toISOString(),
      employer: rows.recognition.employerId,
      facility: null,
      metadata: {
        verificationRef: rows.recognition.verificationRef,
        expiresAt: rows.recognition.expiresAt?.toISOString() ?? null,
        revokedAt: rows.recognition.revokedAt?.toISOString() ?? null,
      },
    });
  }

  for (const acceptance of rows.acceptances) {
    timeline.push({
      id: acceptance.acceptanceId,
      type: 'ACCEPTED',
      label: 'Employer accepted',
      timestamp: acceptance.acceptedAt.toISOString(),
      employer: acceptance.employerId,
      facility: acceptance.facilityId,
      metadata: {
        recognitionId: acceptance.recognitionId,
        psvReportId: acceptance.psvReportId,
      },
    });
  }

  for (const start of rows.starts) {
    timeline.push({
      id: start.startId,
      type: 'STARTED',
      label: 'Work started',
      timestamp: start.attestedAt.toISOString(),
      employer: start.employerId,
      facility: null,
      metadata: {
        acceptanceId: start.acceptanceId,
      },
    });
  }

  timeline.sort((left, right) => Date.parse(right.timestamp) - Date.parse(left.timestamp));
  return timeline.slice(0, 5);
}

function parseRevocationReason(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== 'object') {
    return null;
  }

  const record = metadata as Record<string, unknown>;
  const reason = record.reason;
  return typeof reason === 'string' && reason.trim().length > 0 ? reason : null;
}

async function computeMobileTrustState(
  npi: string,
  deps: MobileTrustRouteDependencies,
): Promise<MobileTrustResponse> {
  const cacheKey = `${MOBILE_TRUST_CACHE_PREFIX}${npi}`;
  const cached = await deps.cache.get<MobileTrustResponse>(cacheKey);
  if (cached) {
    return cached;
  }

  const snapshot = await deps.db.loadTrustSnapshotRows(npi);
  const now = deps.now();
  const generatedAt = now.toISOString();

  const recognized = snapshot.recognition !== null;
  const accepted = snapshot.acceptances.length > 0;
  const started = snapshot.starts.length > 0;
  const latestAcceptance = snapshot.acceptances[0] ?? null;
  const latestStart = snapshot.starts[0] ?? null;

  const crs = mapCrsFromArtifact(snapshot.latestArtifact);
  const blockingReasons = buildBlockingReasons({
    recognized,
    accepted,
    started,
    crsBand: crs.band,
    recognition: snapshot.recognition,
    now,
  });

  const response: MobileTrustResponse = {
    recognized,
    accepted,
    started,
    start_ready: blockingReasons.length === 0,
    crs,
    blocking_reasons: blockingReasons,
    timeline_preview: buildTimeline(snapshot),
    recognitionId: snapshot.recognition?.recognitionId,
    acceptanceId: latestAcceptance?.acceptanceId,
    startId: latestStart?.startId,
    recognizedAt: snapshot.recognition?.recognizedAt.toISOString(),
    acceptedAt: latestAcceptance?.acceptedAt.toISOString(),
    attestedAt: latestStart?.attestedAt.toISOString(),
    acceptanceDetails: latestAcceptance
      ? {
          employerId: latestAcceptance.employerId,
          facilityId: latestAcceptance.facilityId,
          role: 'Unspecified',
          acceptedAt: latestAcceptance.acceptedAt.toISOString(),
        }
      : null,
    generated_at: generatedAt,
  };

  await deps.cache.set(cacheKey, response, MOBILE_CACHE_TTL_SECONDS);
  return response;
}

async function computeNetworkActivity(
  deps: MobileTrustRouteDependencies,
): Promise<NetworkActivityResponse> {
  const cached = await deps.cache.get<NetworkActivityResponse>(NETWORK_ACTIVITY_CACHE_KEY);
  if (cached) {
    return cached;
  }

  const rows = await deps.db.loadNetworkActivityRows(DEFAULT_NETWORK_ACTIVITY_LIMIT);
  const artifactIds = rows.revocationRows
    .map((row) => row.artifactId)
    .filter((artifactId): artifactId is string => typeof artifactId === 'string' && artifactId.length > 0);
  const artifactNpiMap = await deps.db.loadArtifactNpiMap([...new Set(artifactIds)]);

  const verificationEvents: NetworkVerificationEvent[] = rows.verificationEvents.map((event) => ({
    id: event.id,
    type: event.type as VerificationEventType,
    reference_id: event.referenceId,
    clinician_id: event.clinicianId,
    organization_id: event.organizationId,
    occurred_at: event.createdAt.toISOString(),
  }));

  const revocationBroadcasts: RevocationBroadcast[] = rows.revocationRows.map((row) => ({
    id: row.id,
    action: row.action as RevocationAction,
    artifact_id: row.artifactId,
    npi: row.npi ?? (row.artifactId ? artifactNpiMap.get(row.artifactId) ?? null : null),
    reason: parseRevocationReason(row.metadata),
    occurred_at: row.createdAt.toISOString(),
  }));

  const response: NetworkActivityResponse = {
    generated_at: deps.now().toISOString(),
    verification_events: verificationEvents,
    revocation_broadcasts: revocationBroadcasts,
  };

  await deps.cache.set(NETWORK_ACTIVITY_CACHE_KEY, response, MOBILE_CACHE_TTL_SECONDS);
  return response;
}

const defaultMobileTrustDatabase: MobileTrustDatabase = {
  async loadTrustSnapshotRows(npi: string): Promise<MobileTrustSnapshotRows> {
    const [recognition, acceptances, starts, latestArtifact] = await Promise.all([
      prisma.recognition.findFirst({
        where: { subjectId: npi },
        orderBy: { recognizedAt: 'desc' },
        select: {
          recognitionId: true,
          employerId: true,
          recognizedAt: true,
          expiresAt: true,
          revokedAt: true,
          verificationRef: true,
        },
      }),
      prisma.acceptance.findMany({
        where: { subjectId: npi },
        orderBy: { acceptedAt: 'desc' },
        take: 5,
        select: {
          acceptanceId: true,
          recognitionId: true,
          employerId: true,
          facilityId: true,
          acceptedAt: true,
          psvReportId: true,
        },
      }),
      prisma.start.findMany({
        where: { subjectId: npi },
        orderBy: { attestedAt: 'desc' },
        take: 5,
        select: {
          startId: true,
          acceptanceId: true,
          employerId: true,
          attestedAt: true,
        },
      }),
      prisma.verificationArtifact.findFirst({
        where: { npi },
        orderBy: { verifiedAt: 'desc' },
        select: {
          id: true,
          trustState: true,
          status: true,
          monitoring: true,
          verifiedAt: true,
          expiresAt: true,
        },
      }),
    ]);

    return {
      recognition,
      acceptances,
      starts,
      latestArtifact,
    };
  },

  async loadNetworkActivityRows(limit: number): Promise<NetworkActivityRows> {
    const [verificationEvents, revocationRows] = await Promise.all([
      prisma.auditEvent.findMany({
        where: {
          type: {
            in: [...VERIFICATION_EVENT_TYPES],
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        select: {
          id: true,
          type: true,
          referenceId: true,
          clinicianId: true,
          organizationId: true,
          createdAt: true,
        },
      }),
      prisma.trustLedgerEntry.findMany({
        where: {
          action: {
            in: [...REVOCATION_ACTIONS],
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        select: {
          id: true,
          action: true,
          artifactId: true,
          npi: true,
          metadata: true,
          createdAt: true,
        },
      }),
    ]);

    return {
      verificationEvents,
      revocationRows,
    };
  },

  async loadArtifactNpiMap(artifactIds: string[]): Promise<Map<string, string>> {
    if (artifactIds.length === 0) {
      return new Map<string, string>();
    }

    const artifacts = await prisma.verificationArtifact.findMany({
      where: {
        id: {
          in: artifactIds,
        },
      },
      select: {
        id: true,
        npi: true,
      },
    });

    return new Map<string, string>(artifacts.map((artifact) => [artifact.id, artifact.npi]));
  },
};

function resolveBaseUrl(): string {
  const raw = process.env.VITALCV_BASE_URL?.trim() || 'https://app.vitalcv.com';
  return raw.endsWith('/') ? raw.slice(0, -1) : raw;
}

function buildDependencies(
  overrides?: Partial<MobileTrustRouteDependencies>,
): MobileTrustRouteDependencies {
  return {
    cache: overrides?.cache ?? redisJsonCache,
    db: overrides?.db ?? defaultMobileTrustDatabase,
    signShareToken: overrides?.signShareToken ?? signShareProofToken,
    now: overrides?.now ?? (() => new Date()),
    baseUrl: overrides?.baseUrl ?? resolveBaseUrl(),
  };
}

export function registerMobileTrustRoutes(
  app: Express,
  overrides?: Partial<MobileTrustRouteDependencies>,
): void {
  const deps = buildDependencies(overrides);

  app.get('/mobile/trust/:npi', publicApiRateLimit, async (req: Request, res: Response) => {
    const npi = typeof req.params.npi === 'string' ? req.params.npi.trim() : '';
    if (!isValidNpi(npi)) {
      return res.status(400).json({
        error: 'invalid_npi',
        error_description: 'NPI must be a 10-digit string.',
      });
    }

    try {
      const response = await computeMobileTrustState(npi, deps);
      res.setHeader('Cache-Control', 'public, max-age=15, stale-while-revalidate=15');
      return res.status(200).json(response);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to compute mobile trust state';
      log('error', 'mobile_trust_state_error', {
        event: 'mobile_trust_state_error',
        npi_prefix: npi.slice(0, 4) + '****',
        error: message,
      });
      return res.status(500).json({ error: 'Unable to compute mobile trust state.' });
    }
  });

  app.post('/share-proof', publicApiRateLimit, async (req: Request, res: Response) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const npi = typeof body.npi === 'string' ? body.npi.trim() : '';
    if (!isValidNpi(npi)) {
      return res.status(400).json({
        error: 'invalid_npi',
        error_description: 'npi is required and must be a 10-digit string.',
      });
    }

    const requestedTtl = Number(body.expires_in_seconds);
    const expiresInSeconds = Number.isFinite(requestedTtl) ? requestedTtl : 300;

    try {
      const trustState = await computeMobileTrustState(npi, deps);
      const signedShareToken = await deps.signShareToken({
        claims: {
          npi,
          start_ready: trustState.start_ready,
          crs_score: trustState.crs.score,
          crs_band: trustState.crs.band,
        },
        expiresInSeconds,
        now: deps.now(),
      });

      const verifyUrl = `${deps.baseUrl}/verify/${npi}`;
      const deepLink = `vitalcv://share-proof?token=${encodeURIComponent(signedShareToken)}&npi=${encodeURIComponent(npi)}`;
      const qrPayload = {
        type: 'vitalcv.share_proof.v1',
        npi,
        verify_url: verifyUrl,
        token: signedShareToken,
      };

      return res.status(200).json({
        signed_share_token: signedShareToken,
        qr_payload: qrPayload,
        deep_link: deepLink,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to generate share proof';
      log('error', 'share_proof_issue_failed', {
        event: 'share_proof_issue_failed',
        npi_prefix: npi.slice(0, 4) + '****',
        error: message,
      });

      if (message.toLowerCase().includes('signing key')) {
        return res.status(503).json({
          error: 'share_token_signing_unavailable',
          error_description: 'Share-proof signing key is unavailable.',
        });
      }

      return res.status(500).json({ error: 'Unable to generate share proof.' });
    }
  });

  app.get('/network/activity', publicApiRateLimit, async (_req: Request, res: Response) => {
    try {
      const response = await computeNetworkActivity(deps);
      res.setHeader('Cache-Control', 'public, max-age=15, stale-while-revalidate=15');
      return res.status(200).json(response);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to load network activity';
      log('error', 'network_activity_feed_error', {
        event: 'network_activity_feed_error',
        error: message,
      });
      return res.status(500).json({ error: 'Unable to load network activity.' });
    }
  });
}
