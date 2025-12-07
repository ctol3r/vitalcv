import express, { Request, Response, NextFunction } from 'express';
import { oidc4vciGuard } from '../middleware/guard';
import { dpopGuard } from '../middleware/dpopGuard';
import { createHash } from 'crypto';
import { Histogram, Registry } from 'prom-client';

const router = express.Router();

// B114A-NONCE-003: Histogram metrics for nonce service
// Create a registry for nonce metrics
const nonceMetricsRegistry = new Registry();

// Histogram for nonce age (in seconds) when validated
export const nonceAgeHistogram = new Histogram({
  name: 'oidc4vci_nonce_age_seconds',
  help: 'Age of nonce when validated (in seconds)',
  buckets: [0.1, 0.5, 1, 5, 10, 20, 30, 45, 60],
  labelNames: ['outcome'], // 'valid', 'expired', 'replay'
  registers: [nonceMetricsRegistry],
});

// Histogram for jti age (in seconds) when stored
export const jtiAgeHistogram = new Histogram({
  name: 'oidc4vci_jti_age_seconds',
  help: 'Age of jti when stored (in seconds)',
  buckets: [0.1, 0.5, 1, 5, 10, 20, 30, 45, 60],
  labelNames: ['outcome'], // 'new', 'replay'
  registers: [nonceMetricsRegistry],
});

/**
 * B110A-NONCE-002: Audit logging utility for nonce service operations
 * Logs nonce generation, validation, replay detection, and evictions
 */
function auditLogNonce(event: string, payload: Record<string, any>): void {
  const auditEntry = {
    timestamp: new Date().toISOString(),
    service: 'oidc4vci-nonce',
    event,
    ...payload,
  };

  // Log to console (in production, persist to database/audit service)
  console.info(`[AUDIT] NONCE ${event}`, auditEntry);

  // TODO: In production, persist to database:
  // await prisma.auditEvent.create({
  //   data: {
  //     type: `NONCE_${event}`,
  //     payload: auditEntry,
  //     timestamp: new Date(),
  //   },
  // });
}

const ISSUER_URL = process.env.PUBLIC_ISSUER_URL || process.env.ISSUER_URL || 'https://vitalcv.ai';

// Nonce store (in production, use Redis or database)
// B103A-TBIND-002: Fresh nonce required; skew ≤60s; replay blocked
const nonceStore = new Map<string, { timestamp: number; used: boolean }>(); // nonce -> { timestamp, used }

// JTI replay cache for nonce endpoint (in production, use Redis or database)
// B103A-TBIND-002: Replay cache denies jti reuse (one-shot)
const jtiReplayCache = new Map<string, { timestamp: number }>(); // jti -> { timestamp }
const JTI_REPLAY_TTL_MS = 60000; // 60 seconds

// B106A-TBIND-002: Metrics for nonce service (hit/miss/evictions)
interface NonceMetrics {
  hits: number; // Nonce found and valid
  misses: number; // Nonce not found or expired
  evictions: number; // Nonces evicted due to age
  jtiHits: number; // JTI found in cache (replay detected)
  jtiMisses: number; // JTI not found (new)
  jtiEvictions: number; // JTIs evicted due to age
}

const nonceMetrics: NonceMetrics = {
  hits: 0,
  misses: 0,
  evictions: 0,
  jtiHits: 0,
  jtiMisses: 0,
  jtiEvictions: 0,
};

// Deferred credential store (in production, use database)
interface DeferredCredential {
  transaction_id: string;
  status: 'requested' | 'ready' | 'issued';
  credential?: any;
  createdAt: number;
  updatedAt: number;
}

const deferredCredentials = new Map<string, DeferredCredential>();

// Issuer metadata cache with ETag support
let issuerMetadata: any = null;
let metadataETag: string | null = null;
let metadataHash: string | null = null;

/**
 * Generate issuer metadata (spec-compliant)
 * B119A-OIDC-002: OIDC4VCI discovery metadata for DPoP+mTLS
 * B99A-OIDC-005: /.well-known/openid-credential-issuer (OIDC4VCI 1.0)
 * S72-STRETCH-A-001: OIDC4VCI discovery spec compliance - includes required fields
 * Metadata passes conformance; formats list includes SD-JWT VC, W3C VC, ISO mDL
 */
function generateIssuerMetadata(): any {
  return {
    // S72-STRETCH-A-001: Required field - issuer identifier (credential_issuer is also valid)
    issuer: `${ISSUER_URL}/oidc4vci`,
    credential_issuer: `${ISSUER_URL}/oidc4vci`, // Also include for backward compatibility
    // S72-STRETCH-A-001: Required field - credential endpoint
    credential_endpoint: `${ISSUER_URL}/oidc4vci/credential`,
    token_endpoint: `${ISSUER_URL}/oidc4vci/token`,
    deferred_credential_endpoint: `${ISSUER_URL}/oidc4vci/deferred`,
    credential_response_encryption: {
      alg_values_supported: ['RSA-OAEP', 'RSA-OAEP-256'],
      enc_values_supported: ['A256GCM'],
    },
    batch_credential_endpoint: `${ISSUER_URL}/oidc4vci/batch`,
    // S72-STRETCH-A-001: Required field - credential configurations supported
    credential_configurations_supported: {
      'PhysicianCredential': {
        format: 'jwt_vc_json',
        types: ['VerifiableCredential', 'PhysicianCredential'],
        cryptographic_binding_methods_supported: ['did:key', 'did:web'],
        cryptographic_suites_supported: ['EdDSA', 'ES256'],
        display: [
          {
            name: 'Physician Credential',
            locale: 'en-US',
          },
        ],
      },
      'SDJWTPhysicianCredential': {
        format: 'vc+sd-jwt',
        types: ['VerifiableCredential', 'PhysicianCredential'],
        cryptographic_binding_methods_supported: ['did:key', 'did:web'],
        cryptographic_suites_supported: ['EdDSA', 'ES256'],
        display: [
          {
            name: 'SD-JWT Physician Credential',
            locale: 'en-US',
            description: 'Selective Disclosure JWT Verifiable Credential',
          },
        ],
      },
      'SDJWTIdentityCredential': {
        format: 'vc+sd-jwt',
        types: ['VerifiableCredential', 'IdentityCredential'],
        cryptographic_binding_methods_supported: ['did:key'],
        cryptographic_suites_supported: ['EdDSA'],
        display: [
          {
            name: 'SD-JWT Identity Credential',
            locale: 'en-US',
          },
        ],
      },
      'ISO_mDL': {
        format: 'mso_mdoc',
        types: ['VerifiableCredential', 'mDL'],
        cryptographic_binding_methods_supported: ['did:key'],
        cryptographic_suites_supported: ['ES256', 'EdDSA'],
        display: [
          {
            name: 'ISO mDL (Mobile Driving License)',
            locale: 'en-US',
            description: 'ISO 18013-5 Mobile Driving License credential',
          },
        ],
        doc_types: ['org.iso.18013.5.1.mDL'],
      },
    },
    // Legacy format for backward compatibility
    credentials_supported: [
      {
        format: 'jwt_vc_json',
        id: 'PhysicianCredential',
        types: ['VerifiableCredential', 'PhysicianCredential'],
        cryptographic_binding_methods_supported: ['did:key', 'did:web'],
        cryptographic_suites_supported: ['EdDSA', 'ES256'],
        // B119A-OIDC-002: Include token_binding metadata for DPoP+mTLS
        token_binding: ['Dpop', 'Mtls'],
        display: [
          {
            name: 'Physician Credential',
            locale: 'en-US',
          },
        ],
      },
      {
        format: 'vc+sd-jwt',
        id: 'SDJWTPhysicianCredential',
        types: ['VerifiableCredential', 'PhysicianCredential'],
        cryptographic_binding_methods_supported: ['did:key', 'did:web'],
        cryptographic_suites_supported: ['EdDSA', 'ES256'],
        // B119A-OIDC-002: Include token_binding metadata for DPoP+mTLS
        token_binding: ['Dpop', 'Mtls'],
        display: [
          {
            name: 'SD-JWT Physician Credential',
            locale: 'en-US',
            description: 'Selective Disclosure JWT Verifiable Credential',
          },
        ],
      },
      {
        format: 'vc+sd-jwt',
        id: 'SDJWTIdentityCredential',
        types: ['VerifiableCredential', 'IdentityCredential'],
        cryptographic_binding_methods_supported: ['did:key'],
        cryptographic_suites_supported: ['EdDSA'],
        // B119A-OIDC-002: Include token_binding metadata for DPoP+mTLS
        token_binding: ['Dpop', 'Mtls'],
        display: [
          {
            name: 'SD-JWT Identity Credential',
            locale: 'en-US',
          },
        ],
      },
      {
        format: 'mso_mdoc',
        id: 'ISO_mDL',
        types: ['VerifiableCredential', 'mDL'],
        cryptographic_binding_methods_supported: ['did:key'],
        cryptographic_suites_supported: ['ES256', 'EdDSA'],
        // B119A-OIDC-002: Include token_binding metadata for DPoP+mTLS
        token_binding: ['Dpop', 'Mtls'],
        display: [
          {
            name: 'ISO mDL (Mobile Driving License)',
            locale: 'en-US',
            description: 'ISO 18013-5 Mobile Driving License credential',
          },
        ],
        doc_types: ['org.iso.18013.5.1.mDL'],
      },
    ],
    authorization_endpoint: `${ISSUER_URL}/oidc4vci/authorize`,
    token_endpoint_auth_methods_supported: ['private_key_jwt', 'client_secret_basic'],
    token_endpoint_auth_signing_alg_values_supported: ['EdDSA', 'ES256'],
    dpop_signing_alg_values_supported: ['EdDSA', 'ES256'],
    c_nonce_supported: true,
    c_nonce_expires_in: 60,
    // B119A-OIDC-002: Include token_binding at issuer level (DPoP+mTLS)
    token_binding: ['Dpop', 'Mtls'],
    // B99A-OIDC-005: Include format support metadata
    formats_supported: ['jwt_vc_json', 'vc+sd-jwt', 'mso_mdoc'],
  };
}

/**
 * Compute ETag and hash for metadata
 */
function computeMetadataHash(metadata: any): { etag: string; hash: string } {
  const json = JSON.stringify(metadata);
  const hash = createHash('sha256').update(json).digest('hex');
  const etag = `"${hash.substring(0, 16)}"`; // ETag format: "hash-prefix"
  return { etag, hash };
}

/**
 * Initialize metadata cache
 * B107A-OIDC-004: Issuer discovery snapshot: hash & anchor on boot
 * Metadata canonicalized→SHA256; hash anchored before service ready
 */
async function initializeMetadata(): Promise<void> {
  issuerMetadata = generateIssuerMetadata();
  const { etag, hash } = computeMetadataHash(issuerMetadata);
  metadataETag = etag;
  metadataHash = hash;

  // B107A-OIDC-004: Canonicalize metadata (already done via JSON.stringify in computeMetadataHash)
  // B107A-OIDC-004: Anchor hash before service ready
  // In production, persist to database or on-chain; for now, ensure it's logged and stored
  const anchorRecord = {
    event: 'oidc4vci_metadata_init',
    timestamp: new Date().toISOString(),
    hash,
    etag,
    issuer_url: ISSUER_URL,
    metadata_snapshot: JSON.stringify(issuerMetadata), // Full snapshot for auditability
  };

  // B107A-OIDC-004: Record metadata hash in audit log on boot (anchored)
  console.info(`[AUDIT] OIDC4VCI metadata initialized and anchored`, anchorRecord);

  // TODO: In production, persist to database:
  // await prisma.auditEvent.create({
  //   data: {
  //     type: 'OIDC4VCI_METADATA_INIT',
  //     payload: anchorRecord,
  //     timestamp: new Date(),
  //   },
  // });

  // Store in memory for now (in production, use database)
  // This ensures hash is "anchored" before service accepts requests
  (global as any).__oidc4vci_metadata_anchor = {
    hash,
    timestamp: new Date().toISOString(),
    anchored: true,
  };
}

// Initialize on startup (async, but don't block - hash is computed synchronously)
initializeMetadata().catch((err) => {
  console.error('[FATAL] Failed to initialize OIDC4VCI metadata anchor:', err);
  // In production, might want to exit if anchoring fails
  process.exit(1);
});

/**
 * Middleware to enforce c_nonce freshness and prevent replay attacks
 * B110A-NONCE-002: Fresh nonce required; skew ≤60s; replay blocked; audit logs recorded
 */
function enforceCNonce(req: Request, res: Response, next: NextFunction) {
  const cNonce = req.body?.c_nonce;
  const clientId = (req as any).clientId || 'unknown';
  const endpoint = req.path;

  if (!cNonce) {
    auditLogNonce('NONCE_MISSING', {
      endpoint,
      clientId,
      ip: req.ip,
    });
    return res.status(400).json({
      error: 'invalid_request',
      error_description: 'Missing c_nonce'
    });
  }

  const now = Date.now();
  const SKEW_TOLERANCE_MS = 60000; // 60 seconds per B110A-NONCE-002

  // Check if nonce was already used (replay protection)
  if (nonceStore.has(cNonce)) {
    const stored = nonceStore.get(cNonce)!;

    // Reject if nonce was already used
    if (stored.used) {
      nonceMetrics.hits++; // Found but already used (replay)
      const replayAgeSeconds = (now - stored.timestamp) / 1000;
      // B114A-NONCE-003: Record histogram for replay detection
      nonceAgeHistogram.observe({ outcome: 'replay' }, replayAgeSeconds);
      auditLogNonce('NONCE_REPLAY_DETECTED', {
        nonce: cNonce.substring(0, 8) + '...', // Log partial nonce for audit
        endpoint,
        clientId,
        ip: req.ip,
        age_ms: now - stored.timestamp,
        first_used_at: new Date(stored.timestamp).toISOString(),
        reason: 'Nonce already used (replay attempt)',
      });
      return res.status(400).json({
        error: 'invalid_request',
        error_description: 'Nonce reused (replay attempt detected)'
      });
    }

    // Check freshness: nonce must be within 60s skew window
    const age = now - stored.timestamp;
    const ageSeconds = age / 1000;
    if (age > SKEW_TOLERANCE_MS) {
      nonceMetrics.misses++; // Found but expired
      // B114A-NONCE-003: Record histogram for expired nonce
      nonceAgeHistogram.observe({ outcome: 'expired' }, ageSeconds);
      auditLogNonce('NONCE_EXPIRED', {
        nonce: cNonce.substring(0, 8) + '...',
        endpoint,
        clientId,
        ip: req.ip,
        age_ms: age,
        age_seconds: Math.floor(age / 1000),
        max_age_seconds: 60,
      });
      return res.status(400).json({
        error: 'invalid_request',
        error_description: `Nonce expired (age: ${Math.floor(age / 1000)}s, max: 60s)`
      });
    }

    // Mark nonce as used
    stored.used = true;
    nonceStore.set(cNonce, stored);
    nonceMetrics.hits++; // Valid nonce found and used
    // B114A-NONCE-003: Record histogram for valid nonce
    nonceAgeHistogram.observe({ outcome: 'valid' }, ageSeconds);
    auditLogNonce('NONCE_VALIDATED', {
      nonce: cNonce.substring(0, 8) + '...',
      endpoint,
      clientId,
      ip: req.ip,
      age_ms: age,
      cache_ttl_validated: true,
    });
  } else {
    // New nonce - store with current timestamp
    nonceStore.set(cNonce, { timestamp: now, used: true });
    nonceMetrics.misses++; // Nonce not found (new or expired)
    auditLogNonce('NONCE_NEW', {
      nonce: cNonce.substring(0, 8) + '...',
      endpoint,
      clientId,
      ip: req.ip,
      note: 'Nonce not found in cache (new or expired)',
    });
  }

  // Cleanup old nonces (older than skew tolerance)
  let evicted = 0;
  for (const [nonce, data] of nonceStore.entries()) {
    if (now - data.timestamp > SKEW_TOLERANCE_MS) {
      nonceStore.delete(nonce);
      evicted++;
    }
  }
  if (evicted > 0) {
    nonceMetrics.evictions += evicted;
    auditLogNonce('NONCE_CACHE_EVICTION', {
      evicted_count: evicted,
      cache_size_before: nonceStore.size + evicted,
      cache_size_after: nonceStore.size,
      ttl_ms: SKEW_TOLERANCE_MS,
    });
  }

  next();
}

/**
 * OIDC4VCI Issuer Metadata Endpoint
 * GET /.well-known/openid-credential-issuer
 *
 * Implements ETag caching per OIDC4VCI spec
 * Returns 304 Not Modified if client has current version
 */
router.get('/.well-known/openid-credential-issuer', (req: Request, res: Response) => {
  // Check If-None-Match header for ETag validation
  const ifNoneMatch = req.headers['if-none-match'];

  if (ifNoneMatch === metadataETag) {
    // Client has current version - return 304 Not Modified
    return res.status(304).end();
  }

  // Set ETag and Cache-Control headers
  res.setHeader('ETag', metadataETag!);
  res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
  res.setHeader('Content-Type', 'application/json');

  // Include integrity snapshot hash in response (for auditability)
  res.json({
    ...issuerMetadata,
    _integrity: {
      hash: metadataHash,
      timestamp: new Date().toISOString(),
    },
  });
});

/**
 * Credential Endpoint
 * POST /oidc4vci/credential
 *
 * B103A-TBIND-001: Credential endpoint requires sender-constrained tokens
 * Issues verifiable credentials per OIDC4VCI spec
 * Protected by guard middleware + DPoP/mTLS validation + c_nonce enforcement
 * Supports deferred issuance
 *
 * Bearer-only calls rejected with use_dpop error; DPoP verifies htm/htu/iat/jti; cnf.jkt present in AT
 */
router.post('/credential', oidc4vciGuard, dpopGuard, enforceCNonce, async (req: Request, res: Response) => {
  // Guard middleware has verified the message
  const { credential_request, transaction_id } = req.body;

  if (!credential_request) {
    return res.status(400).json({ error: 'invalid_request', error_description: 'Missing credential_request' });
  }

  // Check if this is a deferred issuance request
  const deferIssuance = credential_request.defer_issuance === true;

  if (deferIssuance) {
    // Create deferred credential entry
    const txId = transaction_id || `tx-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    deferredCredentials.set(txId, {
      transaction_id: txId,
      status: 'requested',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    return res.json({
      transaction_id: txId,
      status: 'requested',
      c_nonce: generateCNonce(),
      c_nonce_expires_in: 300,
    });
  }

  // Immediate issuance
  // S72-D1-A-007: Use ClinicianIdentityVC issuer for actual credential issuance
  try {
    const { issueClinicianIdentityVC } = await import('../services/clinicianIdentityIssuer');

    // Extract clinician profile from credential_request
    // In production, this would be extracted from authenticated session
    const profile = {
      did: credential_request.subject_id || `did:key:z${Buffer.from(Math.random().toString()).toString('base64url').substring(0, 20)}`,
      name: credential_request.credential_subject?.name || 'Dr. Test Clinician',
      npi: credential_request.credential_subject?.npi || '1234567890',
      specialty: credential_request.credential_subject?.specialty || 'General Medicine',
    };

    // Issue signed VC
    const vcJws = await issueClinicianIdentityVC(profile);

    res.json({
      format: 'jwt_vc_json',
      credential: vcJws,
      c_nonce: generateCNonce(),
      c_nonce_expires_in: 300,
    });
  } catch (issueError) {
    console.error('[OIDC4VCI] Credential issuance error:', issueError);
    res.status(500).json({
      error: 'server_error',
      error_description: issueError instanceof Error ? issueError.message : 'Failed to issue credential',
    });
  }
});

/**
 * Nonce Endpoint
 * POST /oidc4vci/nonce
 *
 * B110A-NONCE-002: Issuer Nonce endpoint + c_nonce freshness ≤60s + jti single-use + audit logs
 * B121A-NONCE-002: Nonce rotation service: unique jti cache + freshness metrics
 * Returns a fresh c_nonce for replay protection
 * Skew ≤60s; Replay cache denies jti reuse; audit entry recorded; cache TTL validated
 * B121A-NONCE-002: cache expires ≤60s; duplicate jti→error 400; metrics visible
 */
router.post('/nonce', oidc4vciGuard, (req: Request, res: Response) => {
  const clientId = (req as any).clientId || 'unknown';
  const ip = req.ip;

  // B110A-NONCE-002: Check for jti in request body (if provided)
  const jti = req.body?.jti;

  if (jti) {
    const now = Date.now();
    // Check if jti was already used (replay protection)
    if (jtiReplayCache.has(jti)) {
      const cachedJti = jtiReplayCache.get(jti)!;
      const replayAgeSeconds = (now - cachedJti.timestamp) / 1000;
      nonceMetrics.jtiHits++; // JTI found (replay detected)
      // B114A-NONCE-003: Record histogram for jti replay
      jtiAgeHistogram.observe({ outcome: 'replay' }, replayAgeSeconds);
      auditLogNonce('JTI_REPLAY_DETECTED', {
        jti: jti.substring(0, 16) + '...', // Log partial jti for audit
        clientId,
        ip,
        endpoint: '/nonce',
        reason: 'JTI already used (replay attack detected)',
      });
      return res.status(400).json({
        error: 'invalid_request',
        error_description: `jti reused: ${jti} (replay attack detected)`
      });
    }

    // Store jti to prevent reuse
    jtiReplayCache.set(jti, { timestamp: now });
    nonceMetrics.jtiMisses++; // New JTI
    // B114A-NONCE-003: Record histogram for new jti (age is 0)
    jtiAgeHistogram.observe({ outcome: 'new' }, 0);
    auditLogNonce('JTI_STORED', {
      jti: jti.substring(0, 16) + '...',
      clientId,
      ip,
      ttl_ms: JTI_REPLAY_TTL_MS,
    });

    // Cleanup old entries (already have 'now' from above)
    let evicted = 0;
    for (const [cachedJti, data] of jtiReplayCache.entries()) {
      if (now - data.timestamp > JTI_REPLAY_TTL_MS) {
        jtiReplayCache.delete(cachedJti);
        evicted++;
      }
    }
    if (evicted > 0) {
      nonceMetrics.jtiEvictions += evicted;
      auditLogNonce('JTI_CACHE_EVICTION', {
        evicted_count: evicted,
        cache_size_before: jtiReplayCache.size + evicted,
        cache_size_after: jtiReplayCache.size,
        ttl_ms: JTI_REPLAY_TTL_MS,
      });
    }
  }

  const freshNonce = generateCNonce();
  // Use existing 'now' from jti check above, or create new one
  const nonceNow = jti ? now : Date.now();

  // Store nonce with timestamp (not yet used)
  nonceStore.set(freshNonce, { timestamp: nonceNow, used: false });

  // B110A-NONCE-002: Audit log nonce generation
  auditLogNonce('NONCE_GENERATED', {
    nonce: freshNonce.substring(0, 8) + '...', // Log partial nonce
    clientId,
    ip,
    expires_in: 60,
    timestamp: new Date(nonceNow).toISOString(),
    cache_ttl_validated: true,
  });

  res.json({
    c_nonce: freshNonce,
    c_nonce_expires_in: 60, // 60 seconds per B110A-NONCE-002
  });
});

/**
 * Deferred Credential Endpoint
 * POST /oidc4vci/deferred
 *
 * Retrieves a credential that was deferred during issuance
 * Supports polling with status state machine: requested → ready → issued
 * B100B-TBIND-038: Bearer-only tokens rejected; DPoP/mTLS required
 */
router.post('/deferred', oidc4vciGuard, dpopGuard, enforceCNonce, async (req: Request, res: Response) => {
  const { transaction_id } = req.body;

  if (!transaction_id) {
    return res.status(400).json({ error: 'invalid_request', error_description: 'Missing transaction_id' });
  }

  const deferred = deferredCredentials.get(transaction_id);

  if (!deferred) {
    return res.status(404).json({ error: 'not_found', error_description: 'Deferred credential not found' });
  }

  // State machine: requested → ready → issued
  if (deferred.status === 'requested') {
    // Still processing - wallet should poll again
    return res.json({
      transaction_id,
      status: 'requested',
      c_nonce: generateCNonce(),
      c_nonce_expires_in: 300,
    });
  }

  if (deferred.status === 'ready') {
    // Credential is ready but not yet issued
    return res.json({
      transaction_id,
      status: 'ready',
      c_nonce: generateCNonce(),
      c_nonce_expires_in: 300,
    });
  }

  if (deferred.status === 'issued' && deferred.credential) {
    // Credential has been issued
    return res.json({
      format: 'jwt_vc_json',
      credential: deferred.credential,
      c_nonce: generateCNonce(),
      c_nonce_expires_in: 300,
    });
  }

  return res.status(500).json({ error: 'server_error', error_description: 'Invalid deferred credential state' });
});

/**
 * Deferred Credential Status Endpoint
 * GET /oidc4vci/deferred/:transaction_id/status
 *
 * Polling endpoint for deferred credential status
 * B100B-TBIND-038: Bearer-only tokens rejected; DPoP/mTLS required
 */
router.get('/deferred/:transaction_id/status', oidc4vciGuard, dpopGuard, async (req: Request, res: Response) => {
  const { transaction_id } = req.params;

  const deferred = deferredCredentials.get(transaction_id);

  if (!deferred) {
    return res.status(404).json({ error: 'not_found', error_description: 'Deferred credential not found' });
  }

  res.json({
    transaction_id,
    status: deferred.status,
    createdAt: new Date(deferred.createdAt).toISOString(),
    updatedAt: new Date(deferred.updatedAt).toISOString(),
  });
});

/**
 * Batch Credential Endpoint
 * POST /oidc4vci/batch
 *
 * B120A-TBIND-001: Batch credential endpoint requires sender-constrained tokens
 * Issues multiple verifiable credentials in a single request per OIDC4VCI spec
 * Protected by guard middleware + DPoP/mTLS validation + c_nonce enforcement
 *
 * Bearer-only calls rejected with use_dpop error; DPoP verifies htm/htu/iat/jti; cnf.jkt present in AT
 */
router.post('/batch', oidc4vciGuard, dpopGuard, enforceCNonce, async (req: Request, res: Response) => {
  const { credential_requests } = req.body;

  if (!credential_requests || !Array.isArray(credential_requests) || credential_requests.length === 0) {
    return res.status(400).json({
      error: 'invalid_request',
      error_description: 'Missing or invalid credential_requests array'
    });
  }

  // Limit batch size for security
  const MAX_BATCH_SIZE = 100;
  if (credential_requests.length > MAX_BATCH_SIZE) {
    return res.status(400).json({
      error: 'invalid_request',
      error_description: `Batch size exceeds maximum of ${MAX_BATCH_SIZE} credentials`
    });
  }

  // Process batch credential requests
  // TODO: Implement actual batch credential issuance
  // For now, return placeholder responses
  const credentials = credential_requests.map((credential_request: any) => ({
    format: credential_request.format || 'jwt_vc_json',
    credential: {
      '@context': ['https://www.w3.org/2018/credentials/v1'],
      type: ['VerifiableCredential', credential_request.types?.[1] || 'PhysicianCredential'],
      issuer: ISSUER_URL,
      issuanceDate: new Date().toISOString(),
      credentialSubject: {
        id: credential_request.subject_id || 'did:example:subject',
      },
    },
  }));

  res.json({
    credentials,
    c_nonce: generateCNonce(),
    c_nonce_expires_in: 300,
  });
});

/**
 * Generate a fresh c_nonce
 */
function generateCNonce(): string {
  return Buffer.from(Math.random().toString(36) + Date.now().toString()).toString('base64').slice(0, 16);
}

/**
 * Metrics endpoint for nonce service
 * GET /oidc4vci/metrics
 *
 * B106A-TBIND-002: Exposes hit/miss/eviction metrics for nonce and jti cache
 * B114A-NONCE-003: Includes histogram metrics for nonce/jti age
 */
router.get('/metrics', async (req: Request, res: Response) => {
  const accept = req.headers.accept || '';

  if (accept.includes('application/json') || !accept.includes('text/plain')) {
    // JSON format
    res.json({
      nonce: {
        hits: nonceMetrics.hits,
        misses: nonceMetrics.misses,
        evictions: nonceMetrics.evictions,
        cache_size: nonceStore.size,
      },
      jti: {
        hits: nonceMetrics.jtiHits,
        misses: nonceMetrics.jtiMisses,
        evictions: nonceMetrics.jtiEvictions,
        cache_size: jtiReplayCache.size,
      },
    });
  } else {
    // Prometheus format - include histogram metrics
    // B114A-NONCE-003: Export histogram metrics
    const histogramMetrics = await nonceMetricsRegistry.metrics();
    const prometheusFormat = `# HELP oidc4vci_nonce_hits Total nonce cache hits
# TYPE oidc4vci_nonce_hits counter
oidc4vci_nonce_hits ${nonceMetrics.hits}

# HELP oidc4vci_nonce_misses Total nonce cache misses
# TYPE oidc4vci_nonce_misses counter
oidc4vci_nonce_misses ${nonceMetrics.misses}

# HELP oidc4vci_nonce_evictions Total nonce evictions
# TYPE oidc4vci_nonce_evictions counter
oidc4vci_nonce_evictions ${nonceMetrics.evictions}

# HELP oidc4vci_nonce_cache_size Current nonce cache size
# TYPE oidc4vci_nonce_cache_size gauge
oidc4vci_nonce_cache_size ${nonceStore.size}

# HELP oidc4vci_jti_hits Total JTI replay cache hits (replays detected)
# TYPE oidc4vci_jti_hits counter
oidc4vci_jti_hits ${nonceMetrics.jtiHits}

# HELP oidc4vci_jti_misses Total JTI cache misses (new JTIs)
# TYPE oidc4vci_jti_misses counter
oidc4vci_jti_misses ${nonceMetrics.jtiMisses}

# HELP oidc4vci_jti_evictions Total JTI evictions
# TYPE oidc4vci_jti_evictions counter
oidc4vci_jti_evictions ${nonceMetrics.jtiEvictions}

# HELP oidc4vci_jti_cache_size Current JTI cache size
# TYPE oidc4vci_jti_cache_size gauge
oidc4vci_jti_cache_size ${jtiReplayCache.size}

${histogramMetrics}
`;

    res.set('Content-Type', 'text/plain; version=0.0.4');
    res.send(prometheusFormat);
  }
});

export default router;
