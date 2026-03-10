/**
 * Wave 207 — PSV Orchestration + Continuous Monitoring
 */
import { createHash } from 'node:crypto';
import { runDeltaScan } from './adapterRegistry';
import { storeArtifactToScrapbook } from './artifactNormalizer';
import type { PsvArtifact } from './types';
import { log } from '../../obs/logger';

interface OrchestrationResult {
  npi: string;
  artifacts: PsvArtifact[];
  readinessScore: number;
  missingCredentials: string[];
  completedAt: string;
}

const lastRunCache = new Map<string, { ts: string; score: number; count: number }>();
const enrolled = new Set<string>();
const lastStatus = new Map<string, string>();

export async function orchestrateVerification(npi: string, requestedSources?: string[]): Promise<OrchestrationResult> {
  const artifacts = await runDeltaScan(npi);
  const filtered = requestedSources ? artifacts.filter((a) => requestedSources.includes(a.source)) : artifacts;
  filtered.forEach((a) => storeArtifactToScrapbook(a));
  const activeCount = filtered.filter((a) => a.status === 'ACTIVE').length;
  const readinessScore = filtered.length > 0 ? Math.round((activeCount / filtered.length) * 100) : 0;
  const missingCredentials = filtered.filter((a) => a.status === 'NOT_FOUND' || a.status === 'ERROR').map((a) => a.source);
  const completedAt = new Date().toISOString();
  lastRunCache.set(npi, { ts: completedAt, score: readinessScore, count: filtered.length });
  return { npi, artifacts: filtered, readinessScore, missingCredentials, completedAt };
}

export function getOrchestrationStatus(npi: string): { lastRun?: string; artifactCount: number; readinessScore?: number } {
  const c = lastRunCache.get(npi);
  return c ? { lastRun: c.ts, artifactCount: c.count, readinessScore: c.score } : { artifactCount: 0 };
}

export function enrollProviderForMonitoring(npi: string): void {
  enrolled.add(npi);
  orchestrateVerification(npi).catch((err) => log('warn', 'psv_enroll_initial_scan_failed', { npi, error: String(err) }));
}

export function anchorEvidence(npi: string, artifacts: PsvArtifact[]): string {
  const sorted = [...artifacts].sort((a, b) => a.rawChecksum.localeCompare(b.rawChecksum));
  return createHash('sha256').update(sorted.map((a) => a.rawChecksum).join('|')).digest('hex');
}
