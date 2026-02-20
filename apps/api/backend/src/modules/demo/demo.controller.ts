import type { Request, Response } from 'express';
import { log } from '../../obs/logger';
import { fetchNpiFromCMS } from '../identity/nppes.service';
import { normalizeProvider } from '../identity/nppes.validator';
import { generateIdentityArtifact } from '../identity/nppes.artifact.generator';
import { signArtifact } from '../identity/signer';
import {
  SAMPLE_NPI_LIST,
  getCachedProvider,
  getCachedArtifact,
} from './demo.fallback';

const NPI_PATTERN = /^\d{10}$/;

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
