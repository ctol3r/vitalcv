/**
 * passport.ts — Portable clinician passport routes
 *
 * Public routes:
 *   GET /api/passport/:npi
 *   GET /api/passport/:npi/trust
 *   GET /api/passport/:npi/embed.svg
 *   GET /api/passport/:npi/card.json
 */

import type { Express, Request, Response } from 'express';
import prisma from '../graphql/prisma_client';
import { proofRateLimit } from '../middleware/rateLimitFactory';
import { log } from '../obs/logger';
import { generateShareLink } from '../services/passport/shareLink';
import {
  getCachedTrustState,
  type ClinicianTrustState,
  type TrustBand as ReadinessLevel,
} from '../services/trust/trustStateEngine';

const NPI_RE = /^\d{10}$/;
const PUBLIC_TYPES = new Set(['NPI_ENROLLMENT', 'STATE_LICENSE', 'BOARD_CERTIFICATION']);

type PublicTrustBand = 'GREEN' | 'YELLOW' | 'RED';
type PassportCredentialStatus =
  | 'ACTIVE'
  | 'PENDING'
  | 'EXPIRED'
  | 'REVOKED'
  | 'SUSPENDED'
  | 'UNKNOWN';

type CredentialType =
  | 'NPI_ENROLLMENT'
  | 'STATE_LICENSE'
  | 'BOARD_CERTIFICATION'
  | 'DEA_REGISTRATION'
  | 'OIG_EXCLUSION'
  | 'PRIMARY_SOURCE_VERIFICATION';

type ProviderRecord = {
  fullName: string | null;
  taxonomyCode: string | null;
  providerType: string | null;
  stateOfPractice: string | null;
};

type VerificationArtifactRecord = {
  id: string;
  source: string;
  status: string;
  verifiedAt: Date | null;
  expiresAt: Date | null;
  createdAt: Date;
  rawPayload: unknown;
};

type PassportCredential = {
  id: string;
  type: CredentialType;
  name: string;
  issuer: string;
  status: PassportCredentialStatus;
  verifiedAt: string | null;
  expiresAt: string | null;
  isPublic: boolean;
};

type PassportDocument = {
  npi: string;
  public: {
    name: string;
    specialty: string;
    providerType: string;
    state: string;
    trustBand: PublicTrustBand;
    readinessScore: number;
    totalCredentials: number;
    activeCredentials: number;
    shareUrl: string;
    embedUrl: string;
  };
  credentials: PassportCredential[];
  meta: {
    methodology: string;
    computedAt: string;
    passportVersion: '1.0';
  };
};

type TrustDocument = {
  npi: string;
  trustBand: PublicTrustBand;
  readinessScore: number;
  readinessStatus: string;
  computedAt: string;
  shareUrl: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function pickPayload(rawPayload: unknown): Record<string, unknown> | null {
  if (!isRecord(rawPayload)) {
    return null;
  }

  const nestedPayload = rawPayload.payload_json;
  if (isRecord(nestedPayload)) {
    return nestedPayload;
  }

  return rawPayload;
}

function normalizeStatus(value: string): PassportCredentialStatus {
  const normalized = value.trim().toUpperCase();
  if (normalized === 'ACTIVE' || normalized === 'VERIFIED' || normalized === 'CLEAR') {
    return 'ACTIVE';
  }
  if (normalized === 'PENDING' || normalized === 'NOT_FOUND' || normalized === 'NOT_AVAILABLE') {
    return 'PENDING';
  }
  if (normalized === 'EXPIRED') {
    return 'EXPIRED';
  }
  if (normalized === 'REVOKED' || normalized === 'EXCLUDED') {
    return 'REVOKED';
  }
  if (normalized === 'SUSPENDED' || normalized === 'DEACTIVATED' || normalized === 'CHECK_FAILED') {
    return 'SUSPENDED';
  }
  return 'UNKNOWN';
}

function mapReadinessLevel(level: ReadinessLevel): PublicTrustBand {
  if (level === 'L3' || level === 'L2') {
    return 'GREEN';
  }
  if (level === 'L1') {
    return 'YELLOW';
  }
  return 'RED';
}

function mapCredentialType(source: string, payload: Record<string, unknown> | null): CredentialType {
  const rawType = typeof payload?.credential_type === 'string'
    ? payload.credential_type.trim().toUpperCase()
    : null;

  if (rawType === 'NPI_ENROLLMENT' || rawType === 'STATE_LICENSE' || rawType === 'BOARD_CERTIFICATION'
    || rawType === 'DEA_REGISTRATION' || rawType === 'OIG_EXCLUSION') {
    return rawType;
  }

  const normalizedSource = source.trim().toUpperCase();
  if (normalizedSource === 'NPPES' || normalizedSource === 'CMS' || normalizedSource === 'NPI_REGISTRY') {
    return 'NPI_ENROLLMENT';
  }
  if (
    normalizedSource === 'STATE_BOARD'
    || normalizedSource === 'NURSYS'
    || normalizedSource === 'FSMB'
    || normalizedSource.includes('LICENSE')
  ) {
    return 'STATE_LICENSE';
  }
  if (normalizedSource === 'ABMS' || normalizedSource.includes('BOARD_CERT')) {
    return 'BOARD_CERTIFICATION';
  }
  if (normalizedSource === 'DEA' || normalizedSource.includes('DEA')) {
    return 'DEA_REGISTRATION';
  }
  if (
    normalizedSource === 'OIG'
    || normalizedSource === 'SAM'
    || normalizedSource === 'NPDB'
    || normalizedSource.includes('EXCLUSION')
    || normalizedSource.includes('SANCTION')
  ) {
    return 'OIG_EXCLUSION';
  }

  return 'PRIMARY_SOURCE_VERIFICATION';
}

function inferIssuer(
  credentialType: CredentialType,
  source: string,
  payload: Record<string, unknown> | null,
  isPublic: boolean,
): string {
  if (!isPublic) {
    return 'Restricted';
  }

  const boardName = typeof payload?.board_name === 'string' ? payload.board_name.trim() : '';
  if (boardName) {
    return boardName;
  }

  if (credentialType === 'NPI_ENROLLMENT') {
    return 'CMS NPPES';
  }
  if (credentialType === 'DEA_REGISTRATION') {
    return 'U.S. Drug Enforcement Administration';
  }
  if (credentialType === 'BOARD_CERTIFICATION') {
    return 'Specialty Board';
  }

  return source;
}

function inferName(
  credentialType: CredentialType,
  payload: Record<string, unknown> | null,
  isPublic: boolean,
): string {
  if (!isPublic) {
    return 'Restricted credential';
  }

  if (credentialType === 'NPI_ENROLLMENT') {
    return 'NPI Enrollment';
  }
  if (credentialType === 'STATE_LICENSE') {
    const state = typeof payload?.state === 'string' ? payload.state.trim() : '';
    return state ? `${state} State License` : 'State License';
  }
  if (credentialType === 'BOARD_CERTIFICATION') {
    const specialty =
      typeof payload?.specialty === 'string' ? payload.specialty.trim()
        : typeof payload?.specialty_name === 'string' ? payload.specialty_name.trim()
          : '';
    return specialty ? `${specialty} Board Certification` : 'Board Certification';
  }
  if (credentialType === 'DEA_REGISTRATION') {
    return 'DEA Registration';
  }
  if (credentialType === 'OIG_EXCLUSION') {
    return 'Sanctions Check';
  }

  return 'Primary Source Verification';
}

function inferSpecialty(
  provider: ProviderRecord | null,
  artifacts: readonly VerificationArtifactRecord[],
): string {
  if (provider?.taxonomyCode && provider.taxonomyCode.trim().length > 0) {
    return provider.taxonomyCode.trim();
  }

  for (const artifact of artifacts) {
    const payload = pickPayload(artifact.rawPayload);
    const specialty =
      typeof payload?.specialty === 'string' ? payload.specialty.trim()
        : typeof payload?.specialty_name === 'string' ? payload.specialty_name.trim()
          : typeof payload?.taxonomy_description === 'string' ? payload.taxonomy_description.trim()
            : '';
    if (specialty) {
      return specialty;
    }

    if (Array.isArray(payload?.taxonomy_descriptions)) {
      const firstLabel = payload.taxonomy_descriptions.find(
        (entry): entry is string => typeof entry === 'string' && entry.trim().length > 0,
      );
      if (firstLabel) {
        return firstLabel.trim();
      }
    }
  }

  return 'Clinical';
}

function inferState(
  provider: ProviderRecord | null,
  artifacts: readonly VerificationArtifactRecord[],
): string {
  if (provider?.stateOfPractice && provider.stateOfPractice.trim().length > 0) {
    return provider.stateOfPractice.trim();
  }

  for (const artifact of artifacts) {
    const payload = pickPayload(artifact.rawPayload);
    const state =
      typeof payload?.state === 'string' ? payload.state.trim()
        : typeof payload?.practice_state === 'string' ? payload.practice_state.trim()
          : '';
    if (state) {
      return state;
    }
  }

  return 'Unknown';
}

function inferClinicianName(
  npi: string,
  provider: ProviderRecord | null,
  artifacts: readonly VerificationArtifactRecord[],
): string {
  if (provider?.fullName && provider.fullName.trim().length > 0) {
    return provider.fullName.trim();
  }

  for (const artifact of artifacts) {
    const payload = pickPayload(artifact.rawPayload);
    const providerName =
      typeof payload?.provider_name === 'string' ? payload.provider_name.trim()
        : typeof payload?.licensee === 'string' ? payload.licensee.trim()
          : '';
    if (providerName) {
      return providerName;
    }
  }

  return `Clinician ${npi}`;
}

function credentialKey(
  credentialType: CredentialType,
  source: string,
  payload: Record<string, unknown> | null,
): string {
  const state = typeof payload?.state === 'string' ? payload.state.trim().toUpperCase() : '';
  const boardName = typeof payload?.board_name === 'string' ? payload.board_name.trim().toUpperCase() : '';
  return [credentialType, source.trim().toUpperCase(), state, boardName].filter(Boolean).join(':');
}

function buildPublicUrls(npi: string): { shareUrl: string; embedUrl: string } {
  const shareCandidate = generateShareLink(npi).url.split('?')[0];

  try {
    const origin = new URL(shareCandidate).origin;
    return {
      shareUrl: shareCandidate,
      embedUrl: `${origin}/api/passport/${encodeURIComponent(npi)}/embed.svg`,
    };
  } catch {
    return {
      shareUrl: shareCandidate,
      embedUrl: `${shareCandidate.replace(/\/p\/[^/]+$/, '')}/api/passport/${encodeURIComponent(npi)}/embed.svg`,
    };
  }
}

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function truncateSvgText(value: string, limit: number): string {
  return value.length <= limit ? value : `${value.slice(0, limit - 1)}…`;
}

function buildBadgeSvg(passport: PassportDocument): string {
  const { name, trustBand, readinessScore } = passport.public;
  const chipColor = trustBand === 'GREEN' ? '#10b981' : trustBand === 'YELLOW' ? '#f59e0b' : '#ef4444';
  const chipText = trustBand === 'YELLOW' ? '#111827' : '#ffffff';
  const safeName = escapeXml(truncateSvgText(name, 26));
  const safeBand = escapeXml(trustBand);

  return [
    '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="80" viewBox="0 0 320 80" role="img"',
    ` aria-label="${escapeXml(`${name} ${trustBand} badge`)}">`,
    '<rect x="0" y="0" width="320" height="80" rx="16" fill="#080e1a"/>',
    '<rect x="16" y="16" width="48" height="48" rx="14" fill="#0f172a" stroke="#1f2937"/>',
    '<path d="M40 26l-10 4v8c0 6 4.3 11.4 10 13 5.7-1.6 10-7 10-13v-8l-10-4Z" fill="#0b1220" stroke="#7dd3fc" stroke-width="1.4"/>',
    '<path d="m35.5 38 3.5 3.5 6.5-7" fill="none" stroke="#7dd3fc" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"/>',
    `<text x="78" y="30" fill="#f8fafc" font-family="ui-sans-serif, system-ui, sans-serif" font-size="16" font-weight="700">${safeName}</text>`,
    '<text x="78" y="50" fill="#94a3b8" font-family="ui-sans-serif, system-ui, sans-serif" font-size="11">Verified by VitalCV</text>',
    `<rect x="78" y="56" width="82" height="18" rx="9" fill="${chipColor}"/>`,
    `<text x="119" y="69" fill="${chipText}" font-family="ui-sans-serif, system-ui, sans-serif" font-size="10" font-weight="700" text-anchor="middle">${safeBand}</text>`,
    `<text x="244" y="38" fill="#f8fafc" font-family="ui-sans-serif, system-ui, sans-serif" font-size="24" font-weight="700" text-anchor="middle">${readinessScore}</text>`,
    '<text x="244" y="54" fill="#94a3b8" font-family="ui-sans-serif, system-ui, sans-serif" font-size="10" text-anchor="middle">Readiness score</text>',
    '</svg>',
  ].join('');
}

async function loadPassportData(npi: string): Promise<{
  passport: PassportDocument;
  trust: TrustDocument;
} | null> {
  const [provider, artifacts, trustState] = await Promise.all([
    prisma.provider.findFirst({
      where: { npi },
      select: {
        fullName: true,
        taxonomyCode: true,
        providerType: true,
        stateOfPractice: true,
      },
    }),
    prisma.verificationArtifact.findMany({
      where: {
        npi,
        source: { not: 'TRUST_STATE_ENGINE' },
      },
      select: {
        id: true,
        source: true,
        status: true,
        verifiedAt: true,
        expiresAt: true,
        createdAt: true,
        rawPayload: true,
      },
      orderBy: [
        { verifiedAt: 'desc' },
        { createdAt: 'desc' },
      ],
    }),
    getCachedTrustState(npi),
  ]);

  if (!trustState) {
    return null;
  }

  if (!provider && artifacts.length === 0) {
    return null;
  }

  const deduped = new Map<string, PassportCredential>();
  for (const artifact of artifacts) {
    const payload = pickPayload(artifact.rawPayload);
    const type = mapCredentialType(artifact.source, payload);
    const isPublic = PUBLIC_TYPES.has(type);
    const key = credentialKey(type, artifact.source, payload);
    if (deduped.has(key)) {
      continue;
    }

    deduped.set(key, {
      id: artifact.id,
      type,
      name: inferName(type, payload, isPublic),
      issuer: inferIssuer(type, artifact.source, payload, isPublic),
      status: normalizeStatus(artifact.status),
      verifiedAt: artifact.verifiedAt?.toISOString() ?? null,
      expiresAt: artifact.expiresAt?.toISOString() ?? null,
      isPublic,
    });
  }

  const credentials = Array.from(deduped.values());
  const activeCredentials = credentials.filter((credential) => credential.status === 'ACTIVE').length;
  const trustBand = mapReadinessLevel(trustState.readiness_level);
  const { shareUrl, embedUrl } = buildPublicUrls(npi);

  const passport: PassportDocument = {
    npi,
    public: {
      name: inferClinicianName(npi, provider, artifacts),
      specialty: inferSpecialty(provider, artifacts),
      providerType: provider?.providerType?.trim() || 'Unknown',
      state: inferState(provider, artifacts),
      trustBand,
      readinessScore: trustState.readiness_score,
      totalCredentials: credentials.length,
      activeCredentials,
      shareUrl,
      embedUrl,
    },
    credentials,
    meta: {
      methodology: trustState.methodology_version,
      computedAt: trustState.computed_at,
      passportVersion: '1.0',
    },
  };

  const trust: TrustDocument = {
    npi,
    trustBand,
    readinessScore: trustState.readiness_score,
    readinessStatus: trustState.readiness_status,
    computedAt: trustState.computed_at,
    shareUrl,
  };

  return { passport, trust };
}

function validateNpi(res: Response, npi: string | undefined): boolean {
  if (!npi || !NPI_RE.test(npi)) {
    res.status(400).json({
      error: 'invalid_npi',
      error_description: 'NPI must be a 10-digit string.',
    });
    return false;
  }

  return true;
}

function maybeNotFound(res: Response, npi: string, doc: PassportDocument | TrustDocument | null): boolean {
  if (!doc) {
    res.status(404).json({
      error: 'passport_not_available',
      error_description: `Passport not available for NPI ${npi}.`,
    });
    return true;
  }

  return false;
}

function logPassportError(route: string, npi: string, error: unknown): void {
  log('error', route, {
    npi,
    error: error instanceof Error ? error.message : String(error),
  });
}

export function registerPassportRoutes(app: Express): void {
  app.get('/api/passport/:npi', async (req: Request, res: Response) => {
    const { npi } = req.params;
    if (!validateNpi(res, npi)) {
      return;
    }

    try {
      const data = await loadPassportData(npi);
      const passport = data?.passport ?? null;
      if (passport === null) {
        maybeNotFound(res, npi, passport);
        return;
      }

      res.json(passport);
    } catch (error) {
      logPassportError('passport_route_failed', npi, error);
      res.status(500).json({ error: 'Failed to generate passport' });
    }
  });

  app.get('/api/passport/:npi/trust', proofRateLimit, async (req: Request, res: Response) => {
    const { npi } = req.params;
    if (!validateNpi(res, npi)) {
      return;
    }

    try {
      const data = await loadPassportData(npi);
      const trust = data?.trust ?? null;
      if (trust === null) {
        maybeNotFound(res, npi, trust);
        return;
      }

      res.json(trust);
    } catch (error) {
      logPassportError('passport_trust_route_failed', npi, error);
      res.status(500).json({ error: 'Failed to generate passport trust summary' });
    }
  });

  app.get('/api/passport/:npi/embed.svg', async (req: Request, res: Response) => {
    const { npi } = req.params;
    if (!validateNpi(res, npi)) {
      return;
    }

    try {
      const data = await loadPassportData(npi);
      if (!data?.passport) {
        res.status(404).type('image/svg+xml').send('');
        return;
      }

      res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
      res.setHeader('Cache-Control', 'public, max-age=3600');
      res.status(200).send(buildBadgeSvg(data.passport));
    } catch (error) {
      logPassportError('passport_embed_route_failed', npi, error);
      res.status(500).type('image/svg+xml').send('');
    }
  });

  app.get('/api/passport/:npi/card.json', async (req: Request, res: Response) => {
    const { npi } = req.params;
    if (!validateNpi(res, npi)) {
      return;
    }

    try {
      const data = await loadPassportData(npi);
      const passport = data?.passport ?? null;
      if (passport === null) {
        maybeNotFound(res, npi, passport);
        return;
      }

      res.setHeader('Content-Type', 'application/ld+json; charset=utf-8');
      res.json({
        '@context': 'https://vitalcv.com/schema/v1',
        '@type': 'ClinicianPassport',
        npi,
        name: passport.public.name,
        trustBand: passport.public.trustBand,
        readinessScore: passport.public.readinessScore,
        shareUrl: passport.public.shareUrl,
        badgeUrl: passport.public.embedUrl,
        verifiedAt: passport.meta.computedAt,
        issuer: 'VitalCV',
      });
    } catch (error) {
      logPassportError('passport_card_route_failed', npi, error);
      res.status(500).json({ error: 'Failed to generate passport card' });
    }
  });
}
