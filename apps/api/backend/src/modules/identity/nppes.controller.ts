import type { Request, Response } from 'express';
import { HttpError } from '../../utils/httpError';
import { log } from '../../obs/logger';
import { fetchNpiFromCMS } from './nppes.service';
import { normalizeProvider } from './nppes.validator';
import { generateIdentityArtifact } from './nppes.artifact.generator';
import { signArtifact } from './signer';
import { LocalStorageProvider } from './storage';

const NPI_PATTERN = /^\d{10}$/;
const storageProvider = new LocalStorageProvider();

/**
 * Handler for POST /identity/validate-npi
 *
 * Validates an NPI against CMS NPPES, generates a deterministic artifact,
 * signs it, and returns the complete signed identity package.
 */
export async function handleValidateNpi(
  req: Request,
  res: Response,
): Promise<void> {
  const { npi } = req.body as { npi?: string };

  if (!npi || !NPI_PATTERN.test(npi)) {
    throw new HttpError(400, 'NPI must be exactly 10 digits');
  }

  const { rawPayload, payloadHash } = await fetchNpiFromCMS(npi);

  const provider = normalizeProvider(rawPayload);
  const storageRef = await storageProvider.storeRawPayload(npi, rawPayload);

  const { artifact, artifact_hash } = generateIdentityArtifact(
    provider,
    payloadHash,
    storageRef,
  );

  const signature = await signArtifact(artifact, artifact_hash);

  log('info', 'identity_npi_validated', {
    npi,
    enumeration_type: provider.enumeration_type,
    status: provider.status,
  });

  res.json({
    success: true,
    artifact,
    artifact_hash,
    signature,
  });
}
