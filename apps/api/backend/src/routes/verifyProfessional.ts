/**
 * verifyProfessional.ts — AI Professional Verification API
 *
 * Enables AI systems to verify professional authority before acting.
 * Returns a structured authorization verdict — AUTHORIZED / CONDITIONAL / BLOCKED —
 * with per-check breakdown and machine-readable signals.
 *
 * Use cases:
 *   AI hiring platforms     — verify clinician before extending offer
 *   AI telemedicine systems — verify before scheduling live session
 *   AI hospital triage      — verify before routing to care team
 *   AI workforce planners   — verify before publishing shift assignment
 *
 * Routes:
 *   POST /api/verify-professional           body: { npi, credentialType, jurisdiction }
 *   GET  /api/verify-professional/:npi      query: credentialType, jurisdiction, live
 *
 * Speed target: < 200ms p95 (cached path), < 8s with ?live=true (triggers agent swarm)
 *
 * Schema: https://vitalcv.com/verify/v1
 */

import { randomUUID } from 'crypto';
import type { Express, Request, Response } from 'express';
import prisma from '../graphql/prisma_client';
import { getCachedTrustState } from '../services/trust/trustStateEngine';
import { agentSwarm } from '../services/agents/AgentSwarm';
import { log } from '../obs/logger';
import { proofRateLimit } from '../middleware/rateLimitFactory';

// ── Types ─────────────────────────────────────────────────────────────────────

const SCHEMA = 'https://vitalcv.com/verify/v1';
const VERSION = '1.0';

export type VerificationVerdict = 'AUTHORIZED' | 'CONDITIONAL' | 'BLOCKED';
export type CheckStatus        = 'PASS' | 'WARN' | 'FAIL' | 'UNKNOWN';
export type CredentialType     = 'physician' | 'nurse' | 'pa' | 'np' | 'pharmacist' | 'therapist' | 'general';

interface CheckResult {
  status: CheckStatus;
  label: string;
  detail: string;
  expiresAt?: string | null;
  source?: string;
}

interface VerificationResponse {
  schema:        string;
  version:       string;
  auditRef:      string;                        // UUID for traceability
  npi:           string;
  credentialType: CredentialType;
  jurisdiction:  string | null;
  verifiedAt:    string;
  liveChecked:   boolean;

  authorization: {
    verdict:     VerificationVerdict;
    confidence:  'HIGH' | 'MEDIUM' | 'LOW';
    summary:     string;                        // human-readable one-liner for logs
    reasons:     string[];
  };

  trustBand:     string;
  readinessScore: number;

  checks: {
    identity:          CheckResult;
    licenseValidity:   CheckResult;
    sanctionStatus:    CheckResult;
    privilegeReadiness: CheckResult;
    boardCertification: CheckResult;
    deaRegistration:   CheckResult;
  };

  blockingIssues: string[];
  warnings:       string[];

  lastVerifiedAt: string;
  provenance: {
    identity: string;
    exclusions: string;
    licensure: string;
    endpoint: string;
  };

  passportUrl:        string;
  authorityGraphUrl:  string;
  agentsUrl:          string;
}

// ── Credential type → required checks ────────────────────────────────────────

const REQUIRED_CHECKS: Record<CredentialType, (keyof VerificationResponse['checks'])[]> = {
  physician:   ['identity', 'licenseValidity', 'sanctionStatus', 'boardCertification'],
  nurse:       ['identity', 'licenseValidity', 'sanctionStatus'],
  pa:          ['identity', 'licenseValidity', 'sanctionStatus', 'deaRegistration'],
  np:          ['identity', 'licenseValidity', 'sanctionStatus', 'boardCertification', 'deaRegistration'],
  pharmacist:  ['identity', 'licenseValidity', 'sanctionStatus', 'deaRegistration'],
  therapist:   ['identity', 'licenseValidity', 'sanctionStatus'],
  general:     ['identity', 'licenseValidity', 'sanctionStatus'],
};

// ── Verdict derivation ────────────────────────────────────────────────────────

function deriveVerdict(
  trustBand: string,
  checks: VerificationResponse['checks'],
  requiredChecks: (keyof VerificationResponse['checks'])[],
): { verdict: VerificationVerdict; confidence: 'HIGH' | 'MEDIUM' | 'LOW'; reasons: string[]; blockingIssues: string[]; warnings: string[] } {
  const blocking: string[] = [];
  const warnings: string[] = [];
  const reasons: string[] = [];

  // Trust band gate
  if (trustBand === 'L0') {
    blocking.push('Trust band L0 — insufficient verification data');
  }

  // Evaluate each required check
  for (const key of requiredChecks) {
    const check = checks[key];
    if (check.status === 'FAIL') {
      blocking.push(`${check.label}: ${check.detail}`);
    } else if (check.status === 'WARN') {
      warnings.push(`${check.label}: ${check.detail}`);
    } else if (check.status === 'PASS') {
      reasons.push(check.label);
    }
  }

  let verdict: VerificationVerdict;
  if (blocking.length > 0) {
    verdict = 'BLOCKED';
  } else if (warnings.length > 0 || trustBand === 'L1') {
    verdict = 'CONDITIONAL';
  } else {
    verdict = 'AUTHORIZED';
  }

  // Confidence: HIGH if trust band L3 + all PASS; LOW if L1 or many UNKNOWN
  const unknownCount = requiredChecks.filter(k => checks[k].status === 'UNKNOWN').length;
  const confidence: 'HIGH' | 'MEDIUM' | 'LOW' =
    (trustBand === 'L3' && unknownCount === 0) ? 'HIGH' :
    (trustBand === 'L0' || unknownCount > 2)   ? 'LOW'  : 'MEDIUM';

  return { verdict, confidence, reasons, blockingIssues: blocking, warnings };
}

// ── Core verification builder ─────────────────────────────────────────────────

async function buildVerification(
  npi: string,
  credentialType: CredentialType,
  jurisdiction: string | null,
  liveChecked: boolean,
): Promise<VerificationResponse> {
  const verifiedAt  = new Date().toISOString();
  const auditRef    = randomUUID();

  // 1. Trust state (cached — sub-ms)
  let trustBand       = 'L0';
  let readinessScore  = 0;
  try {
    const ts = await getCachedTrustState(npi);
    if (ts) {
      trustBand      = ts.readiness_level ?? ts.trustBand ?? 'L0';
      readinessScore = ts.readiness_score ?? ts.trustScore ?? 0;
    }
  } catch {
    log('warn', 'verifyProfessional: trust state unavailable', { npi });
  }

  // 2. Recent artifacts (batch query)
  const [artifacts, capsules] = await Promise.all([
    prisma.verificationArtifact.findMany({
      where: { npi, source: { not: 'TRUST_STATE_ENGINE' } },
      orderBy: { verifiedAt: 'desc' },
      take: 50,
      select: { source: true, status: true, verifiedAt: true, expiresAt: true, rawPayload: true },
    }),
    prisma.decisionCapsule.findMany({
      where: { subjectNpi: npi, status: 'VALID', decisionType: { in: ['PRIVILEGING', 'HIRING'] } },
      take: 10,
      select: { id: true, decisionType: true, status: true, metadata: true },
    }),
  ]);

  const bySource = (src: string | string[]) => {
    const sources = Array.isArray(src) ? src : [src];
    return artifacts.filter(a => sources.includes(a.source));
  };

  // ── Check: Identity ────────────────────────────────────────────────────────
  const nppesArtifact = bySource(['NPPES', 'NPI_ENROLLMENT'])[0];
  const identityCheck: CheckResult = nppesArtifact
    ? { status: 'PASS', label: 'Identity Verified', detail: 'NPI enrollment confirmed via NPPES', source: 'NPPES' }
    : { status: 'UNKNOWN', label: 'Identity', detail: 'NPI not yet verified via NPPES' };

  // ── Check: License Validity ────────────────────────────────────────────────
  const licSources  = ['STATE_BOARD', 'NURSYS'];
  const licArtifacts = bySource(licSources)
    .filter(a => !jurisdiction || (a.rawPayload as Record<string, unknown>)?.['state'] === jurisdiction);
  const activeLic   = licArtifacts.find(a => a.status === 'VERIFIED' || a.status === 'ACTIVE');
  const expiredLic  = licArtifacts.find(a => a.status === 'EXPIRED');

  let licenseCheck: CheckResult;
  if (activeLic) {
    const expiresAt = activeLic.expiresAt?.toISOString() ?? null;
    const daysLeft  = expiresAt ? (new Date(expiresAt).getTime() - Date.now()) / 86_400_000 : null;
    licenseCheck = daysLeft !== null && daysLeft < 30
      ? { status: 'WARN', label: 'License Expiring', detail: `Active license expires in ${Math.round(daysLeft)} days`, expiresAt, source: activeLic.source }
      : { status: 'PASS', label: 'License Valid', detail: `Active state license verified (${activeLic.source})`, expiresAt, source: activeLic.source };
  } else if (expiredLic) {
    licenseCheck = { status: 'FAIL', label: 'License Expired', detail: 'License has expired — renewal required', expiresAt: expiredLic.expiresAt?.toISOString() ?? null, source: expiredLic.source };
  } else {
    licenseCheck = { status: 'UNKNOWN', label: 'License', detail: `No ${jurisdiction ?? 'state'} license found in VitalCV` };
  }

  // ── Check: Sanction Status ─────────────────────────────────────────────────
  const oigArtifact = bySource(['OIG_LEIE', 'OIG', 'LEIE'])[0];
  let sanctionCheck: CheckResult;
  if (oigArtifact) {
    const payload   = oigArtifact.rawPayload as Record<string, unknown>;
    const matchType = typeof payload?.matchType === 'string' ? payload.matchType : 'NONE';
    const isExcluded = matchType !== 'NONE';
    sanctionCheck = isExcluded
      ? { status: 'FAIL', label: 'Sanction Flagged', detail: `OIG/LEIE match: ${matchType}`, source: 'OIG_LEIE' }
      : { status: 'PASS', label: 'No Sanctions', detail: 'OIG/LEIE exclusion check clear', source: 'OIG_LEIE' };
  } else {
    sanctionCheck = { status: 'UNKNOWN', label: 'Sanction Status', detail: 'OIG/LEIE check not yet run for this NPI' };
  }

  // ── Check: Privilege Readiness ─────────────────────────────────────────────
  const activeCapsules = capsules.filter(c => c.decisionType === 'PRIVILEGING' && c.status === 'VALID');
  const privilegeCheck: CheckResult = activeCapsules.length > 0
    ? { status: 'PASS', label: 'Privilege Ready', detail: `${activeCapsules.length} active hospital privilege(s)` }
    : { status: 'UNKNOWN', label: 'Privileges', detail: 'No active privileging decisions found' };

  // ── Check: Board Certification ─────────────────────────────────────────────
  const boardSources = ['ABIM', 'ABFM', 'ABEM', 'ABP', 'ABNS', 'ABOG', 'ABS', 'BOARD_CERTIFICATION'];
  const boardArtifact = bySource(boardSources)[0];
  let boardCheck: CheckResult;
  if (boardArtifact) {
    const isExpired = boardArtifact.status === 'EXPIRED';
    const expiry    = boardArtifact.expiresAt?.toISOString() ?? null;
    const daysLeft  = expiry ? (new Date(expiry).getTime() - Date.now()) / 86_400_000 : null;
    boardCheck = isExpired
      ? { status: 'WARN', label: 'Board Certification Expired', detail: 'Certification lapsed — check MOC status', source: boardArtifact.source }
      : daysLeft !== null && daysLeft < 180
        ? { status: 'WARN', label: 'Board Certification Expiring', detail: `Expires in ${Math.round(daysLeft)} days`, expiresAt: expiry, source: boardArtifact.source }
        : { status: 'PASS', label: 'Board Certified', detail: `${boardArtifact.source} certification active`, expiresAt: expiry, source: boardArtifact.source };
  } else {
    boardCheck = { status: 'UNKNOWN', label: 'Board Certification', detail: 'No board certification in VitalCV' };
  }

  // ── Check: DEA Registration ────────────────────────────────────────────────
  const deaArtifact  = bySource('DEA')[0];
  let deaCheck: CheckResult;
  if (deaArtifact) {
    const isExpired = deaArtifact.status === 'EXPIRED';
    deaCheck = isExpired
      ? { status: 'FAIL', label: 'DEA Registration Expired', detail: 'DEA registration has lapsed', source: 'DEA' }
      : { status: 'PASS', label: 'DEA Registered', detail: 'DEA registration active', expiresAt: deaArtifact.expiresAt?.toISOString() ?? null, source: 'DEA' };
  } else {
    deaCheck = { status: 'UNKNOWN', label: 'DEA Registration', detail: 'No DEA record in VitalCV' };
  }

  // ── Assemble checks object ─────────────────────────────────────────────────
  const checks: VerificationResponse['checks'] = {
    identity:           identityCheck,
    licenseValidity:    licenseCheck,
    sanctionStatus:     sanctionCheck,
    privilegeReadiness: privilegeCheck,
    boardCertification: boardCheck,
    deaRegistration:    deaCheck,
  };

  // ── Derive verdict ─────────────────────────────────────────────────────────
  const requiredChecks = REQUIRED_CHECKS[credentialType] ?? REQUIRED_CHECKS.general;
  const { verdict, confidence, reasons, blockingIssues, warnings } =
    deriveVerdict(trustBand, checks, requiredChecks);

  const summary =
    verdict === 'AUTHORIZED'  ? `${credentialType} NPI ${npi} — authorized (${trustBand}, score ${readinessScore})` :
    verdict === 'CONDITIONAL' ? `${credentialType} NPI ${npi} — conditional (${warnings.length} warning(s))` :
                                `${credentialType} NPI ${npi} — BLOCKED (${blockingIssues.length} issue(s))`;

  const base = 'https://vitalcv.com';

  log('info', 'verifyProfessional: verdict', {
    npi, credentialType, jurisdiction, verdict, trustBand, readinessScore, liveChecked,
  });

  return {
    schema: SCHEMA,
    version: VERSION,
    auditRef,
    npi,
    credentialType,
    jurisdiction,
    verifiedAt,
    lastVerifiedAt: verifiedAt,
    liveChecked,
    authorization: { verdict, confidence, summary, reasons },
    trustBand,
    readinessScore,
    checks,
    blockingIssues,
    warnings,
    provenance: {
      identity: 'CMS NPPES Registry',
      exclusions: 'OIG LEIE Monthly CSV',
      licensure: liveChecked ? 'Agent Swarm (live)' : 'Cached artifacts',
      endpoint: 'https://npiregistry.cms.hhs.gov/api/?version=2.1',
    },
    passportUrl:       `${base}/p/${npi}`,
    authorityGraphUrl: `${base}/api/authority/${npi}`,
    agentsUrl:         `${base}/api/agents/status/${npi}`,
  };
}

// ── Route handlers ────────────────────────────────────────────────────────────

function parseCredentialType(raw: unknown): CredentialType {
  const valid: CredentialType[] = ['physician', 'nurse', 'pa', 'np', 'pharmacist', 'therapist', 'general'];
  const s = String(raw ?? '').toLowerCase().trim();
  return valid.includes(s as CredentialType) ? (s as CredentialType) : 'general';
}

export function registerVerifyProfessionalRoutes(app: Express): void {

  /**
   * POST /api/verify-professional
   *
   * Body: { npi: string, credentialType?: string, jurisdiction?: string, live?: boolean }
   *
   * live=true: triggers the agent swarm for fresh data before returning verdict
   *            (adds ~2–8s latency; do not use in real-time UX hot paths)
   */
  app.post('/api/verify-professional', proofRateLimit, async (req: Request, res: Response) => {
    const { npi, credentialType, jurisdiction, live } = req.body as {
      npi?: string;
      credentialType?: string;
      jurisdiction?: string;
      live?: boolean;
    };

    if (!npi || !/^\d{10}$/.test(npi)) {
      res.status(400).json({ error: 'npi must be a 10-digit string' });
      return;
    }

    const ctype = parseCredentialType(credentialType);
    const jur   = typeof jurisdiction === 'string' && jurisdiction.trim() ? jurisdiction.trim().toUpperCase() : null;

    // Optional live agent sweep (caller opt-in — expensive)
    if (live === true) {
      try {
        await agentSwarm.run(npi);
      } catch (err) {
        log('warn', 'verifyProfessional: live swarm failed', { npi, error: String(err) });
        // Non-blocking — proceed with cached data
      }
    }

    try {
      const result = await buildVerification(npi, ctype, jur, live === true);
      res.setHeader('X-Verify-Verdict', result.authorization.verdict);
      res.setHeader('X-Verify-Schema', SCHEMA);
      res.setHeader('X-Audit-Ref', result.auditRef);
      res.json(result);
    } catch (err) {
      log('error', 'verifyProfessional: POST failed', { npi, error: String(err) });
      res.status(500).json({ error: 'Verification failed' });
    }
  });

  /**
   * GET /api/verify-professional/:npi
   *
   * Query params:
   *   credentialType=physician|nurse|pa|np|pharmacist|therapist|general
   *   jurisdiction=CA  (2-letter state code)
   *   live=true        (opt-in to agent swarm refresh)
   *
   * Idempotent — safe to call on every AI decision.
   * Cached path returns in < 200ms.
   */
  app.get('/api/verify-professional/:npi([0-9]{10})', proofRateLimit, async (req: Request, res: Response) => {
    const { npi }  = req.params;
    const ctype    = parseCredentialType(req.query.credentialType);
    const jur      = typeof req.query.jurisdiction === 'string'
      ? req.query.jurisdiction.trim().toUpperCase() : null;
    const live     = req.query.live === 'true';

    if (live) {
      try { await agentSwarm.run(npi); } catch { /* non-blocking */ }
    }

    try {
      const result = await buildVerification(npi, ctype, jur, live);
      res.setHeader('X-Verify-Verdict', result.authorization.verdict);
      res.setHeader('X-Verify-Schema', SCHEMA);
      res.setHeader('X-Audit-Ref', result.auditRef);
      res.json(result);
    } catch (err) {
      log('error', 'verifyProfessional: GET failed', { npi, error: String(err) });
      res.status(500).json({ error: 'Verification failed' });
    }
  });
}
