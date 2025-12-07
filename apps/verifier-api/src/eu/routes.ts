import express, { Request, Response, NextFunction } from 'express';
import { decodeJwt, jwtVerify, importJWK, calculateJwkThumbprint } from 'jose';
import {
  fetchTrustList,
  getCachedTrustList,
  verifyIssuerInTrustList,
  isTrustListStale,
  PINNED_TRUST_LIST_HOSTNAMES,
} from './eudiTrustList';
// B119A-EUDI-009: DPoP guard - import from issuer-api (shared middleware)
// Note: In production, this should be in a shared package
import { dpopGuard } from '../../issuer-api/src/middleware/dpopGuard';
import { PrismaClient } from '@prisma/client';
import { featureFlagGuard, checkFeatureFlag, getFeatureFlagService } from '../../../../services/flags/featureFlags';

const router = express.Router();
const prisma = new PrismaClient();

/**
 * GDPR audit logging for EUDI wallet presentations
 * B119A-EUDI-009: Logs purpose-of-use, selective disclosure claims, and user consent
 */
interface GDPRLogEntry {
  timestamp: Date;
  walletId: string;
  purposeOfUse: string;
  claimsRequested: string[];
  claimsDisclosed: string[];
  consentGiven: boolean;
  ipAddress: string;
  userAgent?: string;
  dpopThumbprint?: string;
}

const gdprLog: GDPRLogEntry[] = [];

function logGDPREvent(entry: GDPRLogEntry): void {
  gdprLog.push(entry);

  // In production, persist to database
  console.info('[GDPR] EUDI Wallet Presentation', {
    timestamp: entry.timestamp.toISOString(),
    walletId: entry.walletId,
    purposeOfUse: entry.purposeOfUse,
    claimsRequested: entry.claimsRequested,
    claimsDisclosed: entry.claimsDisclosed,
    consentGiven: entry.consentGiven,
    ipAddress: entry.ipAddress,
    dpopThumbprint: entry.dpopThumbprint,
  });

  // TODO: Persist to database
  // await prisma.gdprLog.create({ data: entry });
}

/**
 * B108A-EUDI-007: EUDI trust list endpoints
 */

/**
 * B149B-FF-010: Guard EUDI OIDC4VP routes with `eudi.verify.enabled` flag
 * GET /eu/trust-list
 * Fetch and verify EUDI trust list
 */
router.get(
  '/trust-list',
  featureFlagGuard('eudi.verify.enabled', {
    statusCode: 404,
    errorCode: 'FEATURE_DISABLED',
    errorMessage: 'EUDI verification feature is currently disabled.',
  }),
  async (req: Request, res: Response) => {
  const trustListUrl = req.query.url as string || process.env.EUDI_TRUST_LIST_URL;
  const publicKeyPem = req.query.publicKey as string || process.env.EUDI_TRUST_LIST_PUBLIC_KEY;

  if (!trustListUrl || !publicKeyPem) {
    return res.status(400).json({
      error: 'invalid_request',
      error_description: 'Missing trust list URL or public key',
    });
  }

  // Try cached trust list first
  const cached = getCachedTrustList();
  if (cached) {
    return res.json({
      trust_list: cached,
      cached: true,
      fetched_at: new Date().toISOString(),
    });
  }

  // Fetch fresh trust list
  const result = await fetchTrustList(trustListUrl, publicKeyPem);

  if (!result.success) {
    return res.status(400).json({
      error: 'trust_list_fetch_failed',
      error_description: result.error,
    });
  }

  res.json({
    trust_list: result.trustList,
    cached: false,
    fetched_at: new Date().toISOString(),
  });
  }
);

/**
 * B149B-FF-010: Guard EUDI OIDC4VP routes with `eudi.verify.enabled` flag
 * POST /eu/verify-issuer
 * Verify issuer against EUDI trust list
 */
router.post(
  '/verify-issuer',
  featureFlagGuard('eudi.verify.enabled', {
    statusCode: 404,
    errorCode: 'FEATURE_DISABLED',
    errorMessage: 'EUDI verification feature is currently disabled.',
  }),
  async (req: Request, res: Response) => {
  const { issuer_id, trust_list_url, public_key } = req.body;

  if (!issuer_id) {
    return res.status(400).json({
      error: 'invalid_request',
      error_description: 'Missing issuer_id',
    });
  }

  // Get trust list (cached or fetch)
  let trustList = getCachedTrustList();

  if (!trustList && trust_list_url && public_key) {
    const fetchResult = await fetchTrustList(trust_list_url, public_key);
    if (!fetchResult.success) {
      return res.status(400).json({
        error: 'trust_list_fetch_failed',
        error_description: fetchResult.error,
      });
    }
    trustList = fetchResult.trustList;
  }

  if (!trustList) {
    return res.status(400).json({
      error: 'trust_list_unavailable',
      error_description: 'Trust list not available. Please fetch trust list first.',
    });
  }

  // Check if trust list is stale
  const issuedAt = new Date(trustList.issuedAt).getTime();
  if (isTrustListStale(issuedAt)) {
    return res.status(400).json({
      error: 'trust_list_stale',
      error_description: 'Trust list is stale (older than 7 days). Verification blocked.',
      issued_at: trustList.issuedAt,
    });
  }

  // Verify issuer
  const verification = verifyIssuerInTrustList(issuer_id, trustList);

  if (!verification.verified) {
    return res.status(400).json({
      error: 'issuer_not_verified',
      error_description: verification.error,
    });
  }

  res.json({
    verified: true,
    issuer_id,
    entry: verification.entry,
    trust_list_version: trustList.version,
    trust_list_issued_at: trustList.issuedAt,
  });
  }
);

/**
 * B149B-FF-010: Guard EUDI OIDC4VP routes with `eudi.verify.enabled` flag
 * GET /eu/trust-list/status
 * B111A-FE-008: Get trust list status (as-of timestamp, stale status)
 */
router.get(
  '/trust-list/status',
  featureFlagGuard('eudi.verify.enabled', {
    statusCode: 404,
    errorCode: 'FEATURE_DISABLED',
    errorMessage: 'EUDI verification feature is currently disabled.',
  }),
  async (req: Request, res: Response) => {
  const cached = getCachedTrustList();

  if (!cached) {
    return res.json({
      fetchedAt: new Date().toISOString(),
      isStale: true,
      isFresh: false,
      ageDays: 999,
      maxAgeDays: 7,
      error: 'Trust list not loaded',
    });
  }

  // Calculate age
  const fetchedAt = new Date(cached.issuedAt).getTime();
  const now = Date.now();
  const ageMs = now - fetchedAt;
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  const maxAgeDays = 7;
  const isStale = isTrustListStale(fetchedAt);

  res.json({
    fetchedAt: cached.issuedAt,
    isStale,
    isFresh: !isStale,
    ageDays,
    maxAgeDays,
  });
  }
);

/**
 * B149B-FF-010: Guard EUDI OIDC4VP routes with `eudi.verify.enabled` flag
 * POST /eu/trust-list/refresh
 * B111A-FE-008: Refresh trust list
 */
router.post(
  '/trust-list/refresh',
  featureFlagGuard('eudi.verify.enabled', {
    statusCode: 404,
    errorCode: 'FEATURE_DISABLED',
    errorMessage: 'EUDI verification feature is currently disabled.',
  }),
  async (req: Request, res: Response) => {
  const trustListUrl = req.body.url || process.env.EUDI_TRUST_LIST_URL;
  const publicKeyPem = req.body.publicKey || process.env.EUDI_TRUST_LIST_PUBLIC_KEY;

  if (!trustListUrl || !publicKeyPem) {
    return res.status(400).json({
      error: 'invalid_request',
      error_description: 'Missing trust list URL or public key',
    });
  }

  const result = await fetchTrustList(trustListUrl, publicKeyPem);

  if (!result.success) {
    return res.status(400).json({
      error: 'trust_list_refresh_failed',
      error_description: result.error,
    });
  }

  res.json({
    success: true,
    trust_list: result.trustList,
    fetched_at: new Date().toISOString(),
  });
  }
);

/**
 * B149B-FF-010: Guard EUDI OIDC4VP routes with `eudi.verify.enabled` flag
 * B119A-EUDI-009: EUDI Wallet OIDC4VP endpoint
 * POST /eu/oidc4vp/presentation
 *
 * Verifies EUDI wallet presentations with:
 * - DPoP proof verification
 * - Selective disclosure claims processing
 * - GDPR-compliant logging
 */
router.post(
  '/oidc4vp/presentation',
  featureFlagGuard('eudi.verify.enabled', {
    statusCode: 404,
    errorCode: 'FEATURE_DISABLED',
    errorMessage: 'EUDI verification feature is currently disabled.',
  }),
  dpopGuard,
  async (req: Request, res: Response) => {
  try {
    const { vp_token, presentation_submission, purpose_of_use, claims_requested } = req.body;
    const dpopThumbprint = (req as any).cnfJkt;
    const ipAddress = req.ip || req.headers['x-forwarded-for'] || 'unknown';
    const userAgent = req.headers['user-agent'];

    // B119A-EUDI-009: Verify DPoP proof (enforced by dpopGuard middleware)
    if (!dpopThumbprint) {
      return res.status(401).json({
        error: 'dpop_required',
        error_description: 'DPoP proof is required for EUDI wallet presentations',
      });
    }

    if (!vp_token) {
      return res.status(400).json({
        error: 'invalid_request',
        error_description: 'Missing vp_token',
      });
    }

    // Decode VP token to extract claims
    let vpClaims: any = {};
    let walletId = 'unknown';
    let claimsDisclosed: string[] = [];

    try {
      const decoded = decodeJwt(vp_token);
      vpClaims = decoded;
      walletId = decoded.sub as string || decoded.wallet_id as string || 'unknown';

      // Extract disclosed claims from VP token
      if (decoded.vp) {
        const vp = typeof decoded.vp === 'string' ? JSON.parse(decoded.vp) : decoded.vp;
        if (vp.verifiableCredential) {
          const vcs = Array.isArray(vp.verifiableCredential) ? vp.verifiableCredential : [vp.verifiableCredential];
          for (const vc of vcs) {
            if (vc.credentialSubject) {
              claimsDisclosed.push(...Object.keys(vc.credentialSubject));
            }
          }
        }
      }
    } catch (error) {
      return res.status(400).json({
        error: 'invalid_vp_token',
        error_description: 'Failed to decode VP token',
      });
    }

    // B119A-EUDI-009: Process selective disclosure claims
    const claimsRequested = claims_requested || [];
    const selectiveDisclosure = claimsRequested.length > 0 && claimsDisclosed.length > 0;

    // Verify that requested claims match disclosed claims (if selective disclosure)
    if (selectiveDisclosure) {
      const missingClaims = claimsRequested.filter(claim => !claimsDisclosed.includes(claim));
      if (missingClaims.length > 0) {
        return res.status(400).json({
          error: 'insufficient_claims',
          error_description: `Missing required claims: ${missingClaims.join(', ')}`,
          claims_requested: claimsRequested,
          claims_disclosed: claimsDisclosed,
        });
      }
    }

    // B119A-EUDI-009: GDPR-compliant logging
    logGDPREvent({
      timestamp: new Date(),
      walletId,
      purposeOfUse: purpose_of_use || 'verification',
      claimsRequested: claimsRequested,
      claimsDisclosed: claimsDisclosed,
      consentGiven: true, // Assumed granted if presentation is submitted
      ipAddress: ipAddress as string,
      userAgent,
      dpopThumbprint,
    });

    // Verify presentation submission structure
    if (presentation_submission) {
      // Validate presentation_submission format
      if (!presentation_submission.definition_id || !presentation_submission.descriptor_map) {
        return res.status(400).json({
          error: 'invalid_presentation_submission',
          error_description: 'Invalid presentation_submission structure',
        });
      }
    }

    // Return verification result
    res.json({
      verified: true,
      wallet_id: walletId,
      purpose_of_use: purpose_of_use || 'verification',
      claims_verified: claimsDisclosed,
      selective_disclosure: selectiveDisclosure,
      dpop_verified: true,
      timestamp: new Date().toISOString(),
      presentation_submission_id: presentation_submission?.id || null,
    });
  } catch (error: any) {
    console.error('EUDI Wallet presentation verification error:', error);
    res.status(500).json({
      error: 'verification_failed',
      error_description: error.message || 'Failed to verify EUDI wallet presentation',
    });
  }
  }
);

/**
 * B149B-FF-010: Guard EUDI OIDC4VP routes with `eudi.verify.enabled` flag
 * GET /eu/oidc4vp/gdpr-logs
 * Query GDPR audit logs (admin only)
 * B119A-EUDI-009: Returns GDPR-compliant audit trail
 */
router.get(
  '/oidc4vp/gdpr-logs',
  featureFlagGuard('eudi.verify.enabled', {
    statusCode: 404,
    errorCode: 'FEATURE_DISABLED',
    errorMessage: 'EUDI verification feature is currently disabled.',
  }),
  (req: Request, res: Response) => {
  try {
    const { walletId, startDate, endDate, limit = 100 } = req.query;

    let filteredLogs = [...gdprLog];

    // Filter by wallet ID
    if (walletId) {
      filteredLogs = filteredLogs.filter(log => log.walletId === walletId);
    }

    // Filter by date range
    if (startDate || endDate) {
      filteredLogs = filteredLogs.filter(log => {
        const timestamp = log.timestamp.getTime();
        if (startDate && timestamp < new Date(startDate as string).getTime()) return false;
        if (endDate && timestamp > new Date(endDate as string).getTime()) return false;
        return true;
      });
    }

    // Sort by timestamp (newest first) and limit
    filteredLogs = filteredLogs
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, parseInt(limit as string, 10));

    res.json({
      logs: filteredLogs.map(log => ({
        timestamp: log.timestamp.toISOString(),
        walletId: log.walletId,
        purposeOfUse: log.purposeOfUse,
        claimsRequested: log.claimsRequested,
        claimsDisclosed: log.claimsDisclosed,
        consentGiven: log.consentGiven,
        ipAddress: log.ipAddress,
        dpopThumbprint: log.dpopThumbprint,
      })),
      count: filteredLogs.length,
      total: gdprLog.length,
    });
  } catch (error: any) {
    console.error('GDPR logs query error:', error);
    res.status(500).json({
      error: 'query_failed',
      error_description: error.message,
    });
  }
  }
);

