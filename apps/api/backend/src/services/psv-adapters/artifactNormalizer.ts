import fs from 'node:fs';
import path from 'node:path';

import { log } from '../../obs/logger';
import type { PsvArtifact } from './types';

function scrapbookDirectory(): string {
  return path.resolve(process.cwd(), 'apps/api/backend/src/services/audit/scrapbook');
}

function fileTimestamp(isoTimestamp: string): string {
  return isoTimestamp.replace(/[:.]/g, '-');
}

export function normalizeArtifactForStorage(artifact: PsvArtifact): Record<string, unknown> {
  return {
    artifactId: artifact.artifactId,
    npi: artifact.npi,
    source: artifact.source,
    sourceUrl: artifact.sourceUrl,
    rawChecksum: artifact.rawChecksum,
    methodologyVersion: artifact.methodologyVersion,
    verifierIdentity: artifact.verifierIdentity,
    status: artifact.status,
    licenseNumber: artifact.licenseNumber,
    state: artifact.state,
    expiresAt: artifact.expiresAt,
    retrievalTimestampUtc: artifact.retrievalTimestampUtc,
  };
}

export function storeArtifactToScrapbook(artifact: PsvArtifact): void {
  const directory = scrapbookDirectory();
  const filename = `psv-${artifact.source}-${artifact.npi}-${fileTimestamp(artifact.retrievalTimestampUtc)}.json`;
  const destination = path.join(directory, filename);

  try {
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(destination, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8');
  } catch (error) {
    log('warn', 'psv_scrapbook_write_failed', {
      source: artifact.source,
      npi: artifact.npi,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
