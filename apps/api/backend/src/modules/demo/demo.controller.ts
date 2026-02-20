import crypto from 'crypto';
import type { Request, Response } from 'express';
import { log } from '../../obs/logger';
import { fetchNpiFromCMS } from '../identity/nppes.service';
import { normalizeProvider } from '../identity/nppes.validator';
import { generateIdentityArtifact } from '../identity/nppes.artifact.generator';
import { signArtifact } from '../identity/signer';
import {
  SAMPLE_NPI_LIST,
  SAMPLE_PROVIDERS,
  getCachedProvider,
  getCachedArtifact,
} from './demo.fallback';

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

    log('info', 'demo_provider_lookup', { npi, source: 'live' });

    res.json({ provider, source: 'live' });
  } catch (err) {
    const cached = getCachedProvider(npi);
    if (cached) {
      log('info', 'demo_provider_lookup_fallback', { npi, source: 'cached' });
      res.json({ provider: cached, source: 'cached' });
      return;
    }

    const status = (err as { statusCode?: number }).statusCode;
    if (status === 404) {
      res.status(404).json({ error: `NPI ${npi} not found` });
      return;
    }

    log('error', 'demo_provider_lookup_failed', {
      npi,
      error: err instanceof Error ? err.message : 'unknown',
    });

    res.status(502).json({
      error: 'Unable to reach CMS NPPES. Try a sample NPI.',
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

    log('info', 'demo_verify_success', { npi, source: 'live', signing_available });

    res.json({
      success: true,
      artifact,
      artifact_hash,
      signature,
      signing_available,
      source: 'live',
    });
  } catch (err) {
    const cached = getCachedArtifact(npi);
    if (cached) {
      log('info', 'demo_verify_fallback', { npi, source: 'cached' });
      res.json({
        success: true,
        artifact: cached.artifact,
        artifact_hash: cached.artifact_hash,
        signature: null,
        signing_available: false,
        source: 'cached',
      });
      return;
    }

    const status = (err as { statusCode?: number }).statusCode;
    if (status === 404) {
      res.status(404).json({ error: `NPI ${npi} not found` });
      return;
    }

    log('error', 'demo_verify_failed', {
      npi,
      error: err instanceof Error ? err.message : 'unknown',
    });

    res.status(502).json({
      error: 'Unable to complete verification. Try a sample NPI.',
    });
  }
}

/**
 * GET /demo/sample-npis
 *
 * Returns a list of known-good NPIs for the demo wizard.
 */
export function handleDemoSampleNpis(
  _req: Request,
  res: Response,
): void {
  res.json({ samples: SAMPLE_NPI_LIST });
}

/**
 * GET /demo/status
 *
 * Returns service version, git SHA, and uptime. Always responds — no auth.
 */
export function handleDemoStatus(
  _req: Request,
  res: Response,
): void {
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
 * Issues a mock W3C Verifiable Credential for a sample provider.
 * Accepts { npi } in the body. Returns a VC in W3C VC Data Model 2.0 format.
 */
export function handleDemoIssue(
  req: Request,
  res: Response,
): void {
  const { npi } = req.body as { npi?: string };

  if (!npi || !NPI_PATTERN.test(npi)) {
    res.status(400).json({ error: 'NPI must be exactly 10 digits' });
    return;
  }

  const provider = SAMPLE_PROVIDERS[npi] ?? getCachedProvider(npi);
  if (!provider) {
    res.status(404).json({
      error: `NPI ${npi} not in demo dataset. Try: ${SAMPLE_NPI_LIST.map((s) => s.npi).join(', ')}`,
    });
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
      name: `${provider.first_name} ${provider.last_name}`,
      specialty: provider.primary_taxonomy,
      status: provider.status === 'A' ? 'active' : 'inactive',
      enumerationType: provider.enumeration_type,
    },
    credentialStatus: {
      type: 'StatusList2021Entry',
      statusPurpose: 'revocation',
      statusListIndex: '0',
      statusListCredential: 'https://api.vitalcv.com/credentials/status/demo',
    },
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
  });
}
