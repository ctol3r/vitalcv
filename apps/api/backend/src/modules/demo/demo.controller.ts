import crypto from 'crypto';
import type { Request, Response } from 'express';
import { log } from '../../obs/logger';
import { fetchNpiFromCMS } from '../identity/nppes.service';
import { normalizeProvider } from '../identity/nppes.validator';
import { generateIdentityArtifact } from '../identity/nppes.artifact.generator';
import { signArtifact } from '../identity/signer';
import {
  DEMO_STATUS_LIST_INDEX,
  STATUS_LIST_URL,
  type BitstringStatusListEntry,
} from '../../services/ledger/statusListManager';

const NPI_PATTERN = /^\d{10}$/;
const BOOT_TIME = Date.now();

/**
 * GET /demo/provider?npi=:npi
 *
 * Public NPPES lookup — no auth required.
 * Falls back to cached sample data if CMS NPPES is unreachable.
 */
export async function handleDemoProviderLookup(
  req: Request,
  res: Response,
): Promise<void> {
  const npi = typeof req.query.npi === 'string' ? req.query.npi.trim() : '';

  if (!NPI_PATTERN.test(npi)) {
    res.status(400).json({ error: 'NPI must be exactly 10 digits' });
    return;
  }

  try {
    const { rawPayload } = await fetchNpiFromCMS(npi);
    const provider = normalizeProvider(rawPayload);

    log('info', 'demo_provider_lookup', { npi, source: 'CMS_NPPES_LIVE' });

    res.json({
      provider,
      source: 'CMS_NPPES_LIVE',
      provenance: { system: 'CMS NPPES Registry', endpoint: 'https://npiregistry.cms.hhs.gov/api/?version=2.1' },
      lastVerifiedAt: new Date().toISOString(),
    });
  } catch (err) {
    const status = (err as { status?: number }).status;
    if (status === 404) {
      res.status(404).json({ error: `NPI ${npi} not found in CMS NPPES Registry` });
      return;
    }

    log('error', 'demo_provider_lookup_failed', {
      npi,
      error: err instanceof Error ? err.message : 'unknown',
    });

    res.status(502).json({
      error: 'CMS NPPES Registry is unreachable. No fallback data is served.',
      code: 'UPSTREAM_UNAVAILABLE',
    });
  }
}

/**
 * POST /demo/verify
 *
 * Full identity verification pipeline — no auth required.
 * Returns signed artifact bundle (or unsigned if signing key unavailable).
 * Falls back to cached artifact if CMS NPPES is unreachable.
 */
export async function handleDemoVerify(
  req: Request,
  res: Response,
): Promise<void> {
  const { npi } = req.body as { npi?: string };

  if (!npi || !NPI_PATTERN.test(npi)) {
    res.status(400).json({ error: 'NPI must be exactly 10 digits' });
    return;
  }

  try {
    const { rawPayload, payloadHash } = await fetchNpiFromCMS(npi);
    const provider = normalizeProvider(rawPayload);
    const { artifact, artifact_hash } = generateIdentityArtifact(
      provider,
      payloadHash,
      'demo-ephemeral',
    );

    let signature: string | null = null;
    let signing_available = false;

    try {
      signature = await signArtifact(artifact, artifact_hash);
      signing_available = true;
    } catch {
      log('info', 'demo_verify_signing_unavailable', { npi });
    }

    log('info', 'demo_verify_success', { npi, source: 'CMS_NPPES_LIVE', signing_available });

    res.json({
      success: true,
      artifact,
      artifact_hash,
      signature,
      signing_available,
      source: 'CMS_NPPES_LIVE',
      provenance: { system: 'CMS NPPES Registry', endpoint: 'https://npiregistry.cms.hhs.gov/api/?version=2.1' },
      lastVerifiedAt: new Date().toISOString(),
    });
  } catch (err) {
    const status = (err as { status?: number }).status;
    if (status === 404) {
      res.status(404).json({ error: `NPI ${npi} not found in CMS NPPES Registry` });
      return;
    }

    log('error', 'demo_verify_failed', {
      npi,
      error: err instanceof Error ? err.message : 'unknown',
    });

    res.status(502).json({
      error: 'CMS NPPES Registry is unreachable. No fallback data is served.',
      code: 'UPSTREAM_UNAVAILABLE',
    });
  }
}

/**
 * GET /demo/sample-npis
 *
 * Nominates no NPI. This route published `1003000126` as the suggested demo
 * subject until 2026-07-27; that is a real physician who never agreed to stand in
 * for our demo. Appearing in the public registry does not make someone a public
 * demo subject, and this route is unauthenticated, so whatever it names is
 * handed to anyone who asks.
 *
 * The demo runs against whatever NPI the caller supplies, so it does not need to
 * nominate one. Keep `samples` empty rather than substituting another registrant:
 * every check-digit-valid NPI belongs to someone, and a check-digit-invalid
 * placeholder would 404 against CMS NPPES and so teach nothing.
 */
export function handleDemoSampleNpis(
  _req: Request,
  res: Response,
): void {
  res.json({
    samples: [],
    source: 'STATIC_REFERENCE',
    notice:
      'Use /demo/provider?npi=<NPI> with any 10-digit NPI for live CMS NPPES data. ' +
      'No synthetic data is served, and no clinician is nominated as a demo subject.',
  });
}

/**
 * GET /demo/status
 *
 * When called with a `clinician_id` query param (other than `_ping`), returns
 * a mock trust-state response matching the TrustStateResponse shape the web
 * frontend expects. Otherwise returns service metadata (version, uptime, etc.).
 */
export function handleDemoStatus(
  req: Request,
  res: Response,
): void {
  const clinicianId =
    typeof req.query.clinician_id === 'string' ? req.query.clinician_id.trim() : '';

  // Trust-state: no mock data — return 503 if trust-state engine is not available.
  if (clinicianId && clinicianId !== '_ping') {
    res.status(503).json({
      error: 'Trust-state data requires live verification. No synthetic trust scores are served.',
      code: 'NO_MOCK_TRUST_STATE',
      clinician_id: clinicianId,
    });
    return;
  }

  // Service metadata (health ping and status checks).
  const uptimeMs = Date.now() - BOOT_TIME;
  const uptimeMin = Math.floor(uptimeMs / 60_000);

  res.json({
    service: 'vitalcv-api',
    version: process.env.npm_package_version || '1.0.0',
    git_sha: process.env.RAILWAY_GIT_COMMIT_SHA || process.env.COMMIT_SHA || null,
    git_branch: process.env.RAILWAY_GIT_BRANCH || null,
    uptime_seconds: Math.floor(uptimeMs / 1000),
    uptime_human: uptimeMin < 60
      ? `${uptimeMin}m`
      : `${Math.floor(uptimeMin / 60)}h ${uptimeMin % 60}m`,
    node_env: process.env.NODE_ENV || 'development',
    demo_mode: process.env.YC_DEMO_MODE === 'true' || process.env.YC_DEMO_MODE === '1',
  });
}

/**
 * POST /demo/issue
 *
 * Issues a W3C Verifiable Credential backed by live CMS NPPES data.
 * Accepts { npi } in the body. Returns a VC in W3C VC Data Model 2.0 format.
 * No synthetic/sample data — upstream must be reachable.
 */
export async function handleDemoIssue(
  req: Request,
  res: Response,
): Promise<void> {
  const { npi } = req.body as { npi?: string };

  if (!npi || !NPI_PATTERN.test(npi)) {
    res.status(400).json({ error: 'NPI must be exactly 10 digits' });
    return;
  }

  let provider;
  try {
    const { rawPayload } = await fetchNpiFromCMS(npi);
    provider = normalizeProvider(rawPayload);
  } catch (err) {
    const status = (err as { status?: number }).status;
    if (status === 404) {
      res.status(404).json({ error: `NPI ${npi} not found in CMS NPPES Registry` });
      return;
    }
    log('error', 'demo_issue_nppes_failed', { npi, error: err instanceof Error ? err.message : 'unknown' });
    res.status(502).json({ error: 'CMS NPPES Registry is unreachable. No fallback data is served.', code: 'UPSTREAM_UNAVAILABLE' });
    return;
  }

  const issuedAt = new Date().toISOString();
  const credentialId = `urn:uuid:${crypto.randomUUID()}`;

  const credential = {
    '@context': [
      'https://www.w3.org/ns/credentials/v2',
      'https://vitalcv.com/credentials/healthcare/v1',
    ],
    type: ['VerifiableCredential', 'HealthcareProviderCredential'],
    id: credentialId,
    issuer: {
      id: 'did:web:vitalcv.com',
      name: 'VitalCV Demo Issuer',
    },
    issuanceDate: issuedAt,
    expirationDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    credentialSubject: {
      id: `did:npi:${provider.npi}`,
      npi: provider.npi,
      name: provider.display_name,
      specialty: provider.primary_taxonomy,
      status: provider.status === 'A' ? 'active' : 'inactive',
      enumerationType: provider.enumeration_type,
    },
    credentialStatus: {
      id: `${credentialId}#status`,
      type: 'BitstringStatusListEntry',
      statusPurpose: 'revocation',
      statusListIndex: DEMO_STATUS_LIST_INDEX,
      statusListCredential: STATUS_LIST_URL,
    } satisfies BitstringStatusListEntry,
    proof: {
      type: 'DemoProof2026',
      created: issuedAt,
      proofPurpose: 'assertionMethod',
      verificationMethod: 'did:web:vitalcv.com#demo-key-1',
      note: 'This is a demo credential. Production credentials use ES256 JWS proofs.',
    },
  };

  log('info', 'demo_issue_success', { npi, credential_id: credentialId });

  res.json({
    success: true,
    credential,
    metadata: {
      demo: true,
      credential_id: credentialId,
      issued_at: issuedAt,
    },
    source: 'CMS_NPPES_LIVE',
    provenance: { system: 'CMS NPPES Registry', endpoint: 'https://npiregistry.cms.hhs.gov/api/?version=2.1' },
    lastVerifiedAt: issuedAt,
  });
}
