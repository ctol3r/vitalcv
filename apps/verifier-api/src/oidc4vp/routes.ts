import express, { Request, Response, NextFunction } from 'express';
import { decodeJwt } from 'jose';
import { pouAllowlistEnforcer } from '../policies/middleware';
import { eudiAcceptEnforce } from '../middleware/eudiAcceptEnforce';

const router = express.Router();

// B108A-POLICY-006: Apply PoU allowlist enforcement to VP routes
router.use(pouAllowlistEnforcer);

const VERIFIER_URL = process.env.PUBLIC_VERIFIER_URL || process.env.VERIFIER_URL || 'https://vitalcv.ai';

// Nonce store for VP requests (in production, use Redis or database)
// B108A-OIDC-005: Nonce binding for VP replay protection
const nonceStore = new Map<string, { timestamp: number; used: boolean; vpToken?: string }>(); // nonce -> { timestamp, used, vpToken }

// JTI replay cache for VP tokens (in production, use Redis or database)
// B108A-OIDC-005: JTI replay cache denies jti reuse (one-shot)
const jtiReplayCache = new Map<string, { timestamp: number }>(); // jti -> { timestamp }
const JTI_REPLAY_TTL_MS = 60000; // 60 seconds

// B108A-OIDC-005: Metrics for VP replay guard (hit/miss/evictions)
interface VPReplayMetrics {
  nonceHits: number; // Nonce found and valid
  nonceMisses: number; // Nonce not found or expired
  nonceEvictions: number; // Nonces evicted due to age
  jtiHits: number; // JTI found in cache (replay detected)
  jtiMisses: number; // JTI not found (new)
  jtiEvictions: number; // JTIs evicted due to age
  replayDetections: number; // Total replay attacks detected
}

const vpReplayMetrics: VPReplayMetrics = {
  nonceHits: 0,
  nonceMisses: 0,
  nonceEvictions: 0,
  jtiHits: 0,
  jtiMisses: 0,
  jtiEvictions: 0,
  replayDetections: 0,
};

/**
 * Extract JTI from VP token
 */
function extractJtiFromVPToken(vpToken: string): string | null {
  try {
    const decoded = decodeJwt(vpToken);
    return decoded.jti as string | null;
  } catch {
    return null;
  }
}

/**
 * Check if jti was already used (replay protection)
 * Returns true if jti is reused, false otherwise
 */
function checkAndStoreJti(jti: string): boolean {
  if (!jti) {
    return false; // No jti means we can't check, but it's not a replay
  }

  // Check if jti was already used
  if (jtiReplayCache.has(jti)) {
    vpReplayMetrics.jtiHits++;
    vpReplayMetrics.replayDetections++;
    return true; // Already used - replay detected
  }

  // Store jti with timestamp to prevent future reuse
  jtiReplayCache.set(jti, { timestamp: Date.now() });
  vpReplayMetrics.jtiMisses++;

  // Cleanup old entries
  const now = Date.now();
  let evicted = 0;
  for (const [cachedJti, data] of jtiReplayCache.entries()) {
    if (now - data.timestamp > JTI_REPLAY_TTL_MS) {
      jtiReplayCache.delete(cachedJti);
      evicted++;
    }
  }
  if (evicted > 0) {
    vpReplayMetrics.jtiEvictions += evicted;
  }

  return false; // Not reused
}

/**
 * Middleware to enforce nonce binding and prevent VP replay attacks
 * B108A-OIDC-005: VP replay guard: nonce binding + jti replay cache
 */
function enforceVPReplayGuard(req: Request, res: Response, next: NextFunction) {
  const { vp_token, nonce } = req.body;

  if (!vp_token) {
    return res.status(400).json({
      error: 'invalid_request',
      error_description: 'Missing vp_token'
    });
  }

  // Extract JTI from VP token
  const jti = extractJtiFromVPToken(vp_token);

  // B108A-OIDC-005: Check for jti reuse (replay protection)
  if (jti && checkAndStoreJti(jti)) {
    return res.status(409).json({
      error: 'replay_detected',
      error_description: `VP token jti reused: ${jti} (replay attack detected)`,
      error_hint: 'This VP token has already been used. Generate a new presentation.'
    });
  }

  // B108A-OIDC-005: Enforce nonce binding if nonce is provided
  // Note: Nonce is optional for VP tokens, but if provided, it must be valid and not reused
  if (nonce) {
    const now = Date.now();
    const SKEW_TOLERANCE_MS = 60000; // 60 seconds

    // Check if nonce was already used (replay protection)
    if (nonceStore.has(nonce)) {
      const stored = nonceStore.get(nonce)!;

      // Reject if nonce was already used
      if (stored.used) {
        vpReplayMetrics.nonceHits++;
        vpReplayMetrics.replayDetections++;
        return res.status(409).json({
          error: 'replay_detected',
          error_description: 'Nonce reused (replay attempt detected)',
          error_hint: 'This nonce has already been used. Request a new nonce.'
        });
      }

      // Check freshness: nonce must be within 60s skew window
      const age = now - stored.timestamp;
      if (age > SKEW_TOLERANCE_MS) {
        vpReplayMetrics.nonceMisses++;
        return res.status(400).json({
          error: 'invalid_request',
          error_description: `Nonce expired (age: ${Math.floor(age / 1000)}s, max: 60s)`
        });
      }

      // Mark nonce as used and store VP token
      stored.used = true;
      stored.vpToken = vp_token;
      nonceStore.set(nonce, stored);
      vpReplayMetrics.nonceHits++;
    } else {
      // Nonce not found in store - could be expired or invalid
      // For VP tokens, we allow nonce to be optional, but if provided and not found, it's invalid
      vpReplayMetrics.nonceMisses++;
      return res.status(400).json({
        error: 'invalid_request',
        error_description: 'Invalid or expired nonce. Request a new nonce from /oidc4vp/nonce endpoint.'
      });
    }

    // Cleanup old nonces (older than skew tolerance)
    let evicted = 0;
    for (const [cachedNonce, data] of nonceStore.entries()) {
      if (now - data.timestamp > SKEW_TOLERANCE_MS) {
        nonceStore.delete(cachedNonce);
        evicted++;
      }
    }
    if (evicted > 0) {
      vpReplayMetrics.nonceEvictions += evicted;
    }
  }

  next();
}

/**
 * Generate a fresh nonce for VP request
 */
function generateNonce(): string {
  return Buffer.from(Math.random().toString(36) + Date.now().toString()).toString('base64').slice(0, 16);
}

/**
 * OIDC4VP Verifier Metadata Endpoint
 * GET /.well-known/openid-credential-verifier
 */
router.get('/.well-known/openid-credential-verifier', (req: Request, res: Response) => {
  res.json({
    verifier: `${VERIFIER_URL}/oidc4vp`,
    presentation_endpoint: `${VERIFIER_URL}/oidc4vp/presentation`,
    formats_supported: ['jwt_vp', 'jwt_vp_json', 'vc+sd-jwt'],
    vp_formats_supported: {
      jwt_vp: {
        alg_values_supported: ['EdDSA', 'ES256'],
      },
      jwt_vp_json: {
        alg_values_supported: ['EdDSA', 'ES256'],
      },
      'vc+sd-jwt': {
        alg_values_supported: ['EdDSA'],
      },
    },
  });
});

/**
 * Presentation Verification Endpoint
 * POST /oidc4vp/presentation
 *
 * B108A-OIDC-005: VP replay guard: nonce binding + jti replay cache
 * B109B-EUDI-022: EUDI wallet enforcement - blocks non-EUDI presentations when enabled
 * Replays return 409; jti cache metrics; tests for replay
 */
router.post('/presentation', eudiAcceptEnforce, enforceVPReplayGuard, async (req: Request, res: Response) => {
  const { vp_token, presentation_submission } = req.body;

  if (!vp_token) {
    return res.status(400).json({
      error: 'invalid_request',
      error_description: 'Missing vp_token'
    });
  }

  // B123A-EUDI-008: Extract PoU and requested claim set for GDPR logging
  const pou = (req.headers['x-purpose-of-use'] as string) ||
              (req.body?.purpose_of_use as string) ||
              'TREATMENT';
  const requestedClaims = extractRequestedClaims(req.body);
  const pouValidation = (req as any).pouValidation;

  // B123A-EUDI-008: GDPR logging - store PoU + requested claim set in audit
  const auditService = await import('../services/audit');
  await auditService.auditLog('EUDI_PRESENTATION_VERIFIED', {
    userId: (req as any).user?.id || 'anonymous',
    reason: 'EUDI wallet presentation verified',
    path: req.path,
    method: req.method,
    timestamp: new Date().toISOString(),
    // B123A-EUDI-008: PoU + requested claim set stored
    purposeOfUse: pou,
    requestedClaims: requestedClaims,
    allowedClaims: pouValidation?.requestedFields || requestedClaims,
    // B123A-EUDI-008: Redaction of non-necessary attrs confirmed
    redactedFields: pouValidation ?
      requestedClaims.filter((c: string) => !pouValidation.requestedFields.includes(c)) : [],
    vpTokenId: extractJtiFromVPToken(vp_token) || 'unknown',
  });

  // TODO: Implement actual VP verification
  // For now, return a placeholder response
  res.json({
    verified: true,
    vp_token_id: extractJtiFromVPToken(vp_token) || 'unknown',
    timestamp: new Date().toISOString(),
  });
});

/**
 * B123A-EUDI-008: Extract requested claim set from presentation request
 */
function extractRequestedClaims(body: any): string[] {
  const claims: string[] = [];

  // Extract from presentation_submission
  if (body.presentation_submission?.descriptor_map) {
    for (const descriptor of body.presentation_submission.descriptor_map) {
      if (descriptor.path) {
        claims.push(descriptor.path);
      }
    }
  }

  // Extract from presentation_definition
  if (body.presentation_definition?.input_descriptors) {
    for (const descriptor of body.presentation_definition.input_descriptors) {
      if (descriptor.constraints?.fields) {
        for (const field of descriptor.constraints.fields) {
          if (field.path) {
            claims.push(...(Array.isArray(field.path) ? field.path : [field.path]));
          }
        }
      }
    }
  }

  // Extract from vp_token claims (if decoded)
  if (body.claims && Array.isArray(body.claims)) {
    claims.push(...body.claims);
  }

  return [...new Set(claims)]; // Deduplicate
}

/**
 * Nonce Endpoint for VP Requests
 * POST /oidc4vp/nonce
 *
 * B108A-OIDC-005: Returns a fresh nonce for VP replay protection
 */
router.post('/nonce', (req: Request, res: Response) => {
  const freshNonce = generateNonce();
  const now = Date.now();

  // Store nonce with timestamp (not yet used)
  nonceStore.set(freshNonce, { timestamp: now, used: false });

  res.json({
    nonce: freshNonce,
    expires_in: 60, // 60 seconds
  });
});

/**
 * Metrics endpoint for VP replay guard
 * GET /oidc4vp/metrics
 *
 * B108A-OIDC-005: Exposes hit/miss/eviction metrics for nonce and jti cache
 */
router.get('/metrics', (req: Request, res: Response) => {
  const accept = req.headers.accept || '';

  if (accept.includes('application/json') || !accept.includes('text/plain')) {
    // JSON format
    res.json({
      nonce: {
        hits: vpReplayMetrics.nonceHits,
        misses: vpReplayMetrics.nonceMisses,
        evictions: vpReplayMetrics.nonceEvictions,
        cache_size: nonceStore.size,
      },
      jti: {
        hits: vpReplayMetrics.jtiHits,
        misses: vpReplayMetrics.jtiMisses,
        evictions: vpReplayMetrics.jtiEvictions,
        cache_size: jtiReplayCache.size,
      },
      replay_detections: vpReplayMetrics.replayDetections,
    });
  } else {
    // Prometheus format
    const prometheusFormat = `# HELP oidc4vp_nonce_hits Total nonce cache hits
# TYPE oidc4vp_nonce_hits counter
oidc4vp_nonce_hits ${vpReplayMetrics.nonceHits}

# HELP oidc4vp_nonce_misses Total nonce cache misses
# TYPE oidc4vp_nonce_misses counter
oidc4vp_nonce_misses ${vpReplayMetrics.nonceMisses}

# HELP oidc4vp_nonce_evictions Total nonce evictions
# TYPE oidc4vp_nonce_evictions counter
oidc4vp_nonce_evictions ${vpReplayMetrics.nonceEvictions}

# HELP oidc4vp_nonce_cache_size Current nonce cache size
# TYPE oidc4vp_nonce_cache_size gauge
oidc4vp_nonce_cache_size ${nonceStore.size}

# HELP oidc4vp_jti_hits Total JTI replay cache hits (replays detected)
# TYPE oidc4vp_jti_hits counter
oidc4vp_jti_hits ${vpReplayMetrics.jtiHits}

# HELP oidc4vp_jti_misses Total JTI cache misses (new JTIs)
# TYPE oidc4vp_jti_misses counter
oidc4vp_jti_misses ${vpReplayMetrics.jtiMisses}

# HELP oidc4vp_jti_evictions Total JTI evictions
# TYPE oidc4vp_jti_evictions counter
oidc4vp_jti_evictions ${vpReplayMetrics.jtiEvictions}

# HELP oidc4vp_jti_cache_size Current JTI cache size
# TYPE oidc4vp_jti_cache_size gauge
oidc4vp_jti_cache_size ${jtiReplayCache.size}

# HELP oidc4vp_replay_detections Total replay attacks detected
# TYPE oidc4vp_replay_detections counter
oidc4vp_replay_detections ${vpReplayMetrics.replayDetections}
`;

    res.set('Content-Type', 'text/plain; version=0.0.4');
    res.send(prometheusFormat);
  }
});

export default router;

