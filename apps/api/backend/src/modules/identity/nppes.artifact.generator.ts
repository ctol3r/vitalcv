import { sha256ForPayload } from '../../utils/deterministic';
import type {
  NormalizedProvider,
  IdentityArtifact,
  ArtifactGenerationResult,
} from './types';

const SCHEMA_VERSION = 'vcv-identity-2026-01';
const ARTIFACT_VERSION = '1.0';
const ARTIFACT_TYPE = 'nppes_identity_validation';
const SOURCE_SYSTEM = 'CMS NPPES Registry';
const SOURCE_ENDPOINT =
  'https://npiregistry.cms.hhs.gov/api/?version=2.1';

/**
 * Generate a deterministic identity validation artifact from normalized
 * provider data and the raw payload hash.
 *
 * Keys are in stable order. The only volatile field is `retrieved_at`.
 * The artifact hash is computed over the canonical (sorted-key) JSON.
 */
export function generateIdentityArtifact(
  provider: NormalizedProvider,
  payloadHash: string,
  storageRef: string,
): ArtifactGenerationResult {
  const artifact: IdentityArtifact = {
    schema_version: SCHEMA_VERSION,
    artifact_version: ARTIFACT_VERSION,
    artifact_type: ARTIFACT_TYPE,
    provider,
    source: {
      system: SOURCE_SYSTEM,
      endpoint: SOURCE_ENDPOINT,
      retrieved_at: new Date().toISOString(),
    },
    raw_capture: {
      payload_sha256: payloadHash,
      storage_ref: storageRef,
    },
  };

  const artifactHash = sha256ForPayload(artifact);

  return { artifact, artifact_hash: artifactHash };
}
