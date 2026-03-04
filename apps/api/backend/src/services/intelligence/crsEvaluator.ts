/**
 * crsEvaluator.ts — Wave 51: Credential Readiness Score Evaluator
 *
 * Deterministic scoring engine that computes a clinician's CRS against
 * an employer's policy requirements. Queries VerificationArtifacts and
 * checks credential status to produce a scored, banded result.
 *
 * Scoring: each required credential carries equal weight. GREEN >= 80,
 * YELLOW >= 50, RED < 50. isCleared = all required met AND GREEN band.
 */

import prisma from '../../graphql/prisma_client';
import { log } from '../../obs/logger';

// ── Types ─────────────────────────────────────────────────────────────────

export interface PolicyRequirement {
  type: string;
  label: string;
  priority: 'required' | 'preferred';
  constraints?: { state?: string; specialty?: string };
}

export type CredentialMatchStatus =
  | 'active'
  | 'expiring'
  | 'expired'
  | 'revoked'
  | 'missing';

export type ClaimLevel = 'L0' | 'L1' | 'L2' | 'L3';

export interface MatchedCredential {
  requirementType: string;
  requirementLabel: string;
  credentialId: string | null;
  credentialLabel: string | null;
  verified: boolean;
  claimLevel: ClaimLevel;
  status: CredentialMatchStatus;
}

export type CrsBand = 'GREEN' | 'YELLOW' | 'RED';

export interface CrsEvaluationResult {
  npi: string;
  policyId: string;
  crsScore: number;
  crsBand: CrsBand;
  isCleared: boolean;
  matchedCredentials: MatchedCredential[];
  missingCredentials: MatchedCredential[];
  evaluatedAt: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────

function computeBand(score: number): CrsBand {
  if (score >= 80) return 'GREEN';
  if (score >= 50) return 'YELLOW';
  return 'RED';
}

function deriveClaimLevel(status: string, lifecycleState: string | null): ClaimLevel {
  if (status === 'REVOKED' || status === 'SUSPENDED') return 'L0';
  if (!lifecycleState || lifecycleState === 'UNVERIFIED') return 'L1';
  if (lifecycleState === 'VERIFIED') return 'L2';
  if (lifecycleState === 'PSV_COMPLETE') return 'L3';
  return 'L1';
}

function deriveMatchStatus(
  artifact: { status: string; expiresAt: Date | null; revokedAt: Date | null },
): CredentialMatchStatus {
  if (artifact.revokedAt || artifact.status === 'REVOKED') return 'revoked';
  if (artifact.status === 'SUSPENDED') return 'revoked';

  if (artifact.expiresAt) {
    const now = Date.now();
    const expiresMs = artifact.expiresAt.getTime();
    if (expiresMs < now) return 'expired';
    // Expiring within 30 days
    if (expiresMs - now < 30 * 24 * 60 * 60 * 1000) return 'expiring';
  }

  return 'active';
}

function parseRequirements(json: unknown): PolicyRequirement[] {
  if (!Array.isArray(json)) return [];
  return json.filter(
    (r): r is PolicyRequirement =>
      typeof r === 'object' &&
      r !== null &&
      typeof (r as Record<string, unknown>).type === 'string' &&
      typeof (r as Record<string, unknown>).label === 'string',
  );
}

// ── Evaluator ─────────────────────────────────────────────────────────────

async function evaluateCrs(
  npi: string,
  policyId: string,
): Promise<CrsEvaluationResult> {
  const evaluatedAt = new Date().toISOString();

  // ── Step 1: Load policy ───────────────────────────────────────────────
  const policy = await prisma.employerPolicy.findUnique({
    where: { id: policyId },
  });

  if (!policy) {
    log('warn', 'crs_evaluator: policy not found', { policyId });
    return {
      npi,
      policyId,
      crsScore: 0,
      crsBand: 'RED',
      isCleared: false,
      matchedCredentials: [],
      missingCredentials: [],
      evaluatedAt,
    };
  }

  const required = parseRequirements(policy.requiredCredentials);
  const optional = parseRequirements(policy.optionalCredentials);

  // ── Step 2: Load clinician artifacts ──────────────────────────────────
  const artifacts = await prisma.verificationArtifact.findMany({
    where: { npi },
    orderBy: { createdAt: 'desc' },
  });

  // ── Step 3: Match requirements ────────────────────────────────────────
  const matched: MatchedCredential[] = [];
  const missing: MatchedCredential[] = [];

  for (const req of required) {
    const artifact = artifacts.find((a) => {
      const sourceMatch = a.source.toLowerCase().includes(req.type.toLowerCase());
      if (!sourceMatch) return false;
      // State constraint check
      if (req.constraints?.state) {
        const payload = a.rawPayload as Record<string, unknown> | null;
        const artifactState =
          typeof payload?.state === 'string' ? payload.state : '';
        if (
          artifactState.toLowerCase() !==
          req.constraints.state.toLowerCase()
        ) {
          return false;
        }
      }
      return true;
    });

    if (artifact) {
      const status = deriveMatchStatus(artifact);
      const claimLevel = deriveClaimLevel(
        artifact.status,
        artifact.lifecycleState,
      );
      const verified = status === 'active' || status === 'expiring';

      matched.push({
        requirementType: req.type,
        requirementLabel: req.label,
        credentialId: artifact.id,
        credentialLabel: `${artifact.source} (${artifact.npi})`,
        verified,
        claimLevel,
        status,
      });
    } else {
      missing.push({
        requirementType: req.type,
        requirementLabel: req.label,
        credentialId: null,
        credentialLabel: null,
        verified: false,
        claimLevel: 'L0',
        status: 'missing',
      });
    }
  }

  // ── Step 4: Score ─────────────────────────────────────────────────────
  const totalRequired = required.length;
  const satisfiedRequired = matched.filter(
    (m) => m.status === 'active' || m.status === 'expiring',
  ).length;

  let baseScore =
    totalRequired > 0
      ? (satisfiedRequired / totalRequired) * 100
      : 100;

  // Optional credentials bonus (up to +5 points)
  if (optional.length > 0) {
    const optionalMatched = optional.filter((opt) =>
      artifacts.some((a) =>
        a.source.toLowerCase().includes(opt.type.toLowerCase()) &&
        deriveMatchStatus(a) === 'active',
      ),
    ).length;
    const optionalBonus = (optionalMatched / optional.length) * 5;
    baseScore = Math.min(100, baseScore + optionalBonus);
  }

  const crsScore = Math.round(baseScore * 100) / 100;
  const crsBand = computeBand(crsScore);
  const isCleared = missing.length === 0 && crsBand === 'GREEN';

  // ── Step 5: Persist MatchResult ───────────────────────────────────────
  await prisma.matchResult.create({
    data: {
      clinicianNpi: npi,
      policyId,
      crsScore,
      crsBand,
      isCleared,
      matchedCreds: JSON.parse(JSON.stringify(matched)),
      missingCreds: JSON.parse(JSON.stringify(missing)),
      gapAnalysis: JSON.parse(JSON.stringify({ computed: false })),
      evaluatedAt: new Date(evaluatedAt),
    },
  });

  log('info', 'crs_evaluator: evaluation complete', {
    npi: npi.slice(0, 4) + '****',
    policyId,
    crsScore,
    crsBand,
    isCleared,
    matched: matched.length,
    missing: missing.length,
  });

  return {
    npi,
    policyId,
    crsScore,
    crsBand,
    isCleared,
    matchedCredentials: matched,
    missingCredentials: missing,
    evaluatedAt,
  };
}

export const crsEvaluator = { evaluateCrs, computeBand };
