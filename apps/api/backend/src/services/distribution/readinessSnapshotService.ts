/**
 * readinessSnapshotService — Wave M. The share-once / reuse-by-many readiness
 * artifact.
 *
 * Issued at apply-share time: `content` captures the readiness summary and
 * the canonical source-coverage report EXACTLY as they were at issuance, and
 * `contentHash` (sha256 over the canonical JSON) pins it — the row is never
 * updated. Freshness against each source's refresh SLA is recomputed at read
 * time as an overlay in the response; stale data is labeled stale, never
 * silently served as current and never rewritten.
 *
 * Fail-closed rules: a revoked snapshot — its own revokedAt, or any revoked
 * BundleShareEvent for the linked bundle (the clinician's existing
 * share-revoke control) — serves nothing. Deploy-order safe: issuance
 * degrades to null until the migration deploys; sharing proceeds unchanged.
 *
 * Zero PHI: readiness states, source ids, and timestamps only.
 */

import { randomUUID } from 'node:crypto';
import prisma from '../../graphql/prisma_client';
import { log } from '../../obs/logger';
import { sha256ForPayload } from '../../utils/deterministic';
import { getSourceFreshnessWindowHours } from '../identity/sourceCatalog';

export interface ReadinessSnapshotContent {
  schema: 'vitalcv.readiness-snapshot.v1';
  npi: string;
  bundleId: string | null;
  issuedAt: string;
  readiness: {
    level: string;
    score: number;
    status: string;
    checkedAt: string;
  };
  sourceCoverage: unknown; // CanonicalSourceCoverageReport, stored verbatim
}

export interface IssueReadinessSnapshotInput {
  npi: string;
  entityId?: string | null;
  bundleId?: string | null;
  scope?: {
    organizationId?: string;
    organizationName?: string;
    purposeOfUse?: string;
  } | null;
  readiness: { level: string; score: number; status: string; checkedAt: string };
  sourceCoverage: unknown;
}

export interface IssuedReadinessSnapshot {
  snapshotId: string;
  contentHash: string;
}

function toPlainJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/**
 * Persist one immutable snapshot row. Returns null (and never throws) when
 * the table is not deployed yet or the DB hiccups — the share flow must not
 * break on snapshot issuance.
 */
export async function issueReadinessSnapshot(
  input: IssueReadinessSnapshotInput,
): Promise<IssuedReadinessSnapshot | null> {
  const snapshotId = randomUUID();
  const issuedAt = new Date().toISOString();

  const content: ReadinessSnapshotContent = toPlainJson({
    schema: 'vitalcv.readiness-snapshot.v1',
    npi: input.npi,
    bundleId: input.bundleId ?? null,
    issuedAt,
    readiness: input.readiness,
    sourceCoverage: input.sourceCoverage,
  });
  const contentHash = sha256ForPayload(content);

  try {
    await prisma.readinessSnapshot.create({
      data: {
        id: snapshotId,
        npi: input.npi,
        entityId: input.entityId ?? null,
        bundleId: input.bundleId ?? null,
        contentHash,
        content: content as object,
        scope: input.scope ? toPlainJson(input.scope) : undefined,
      },
    });
    log('info', 'readiness_snapshot_issued', {
      snapshotId,
      bundleId: input.bundleId ?? null,
      npi_prefix: input.npi.slice(0, 4) + '····',
      contentHash,
    });
    return { snapshotId, contentHash };
  } catch (err) {
    log('warn', 'readiness_snapshot_issue_degraded', {
      reason: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

// ── Read-time freshness overlay ──────────────────────────────────────────────

export interface SnapshotStaleSource {
  sourceId: string;
  checkedAt: string;
  freshnessWindowHours: number;
  hoursSinceChecked: number;
}

export interface SnapshotFreshnessOverlay {
  evaluatedAt: string;
  /** Sources whose checkedAt is beyond their refresh SLA. */
  staleSources: SnapshotStaleSource[];
  /** Sources issued without a checkedAt — freshness cannot be evaluated. */
  unevaluatedSources: string[];
  reverifyRecommended: boolean;
  note: string;
}

interface CoverageCheckLike {
  sourceId?: unknown;
  checkedAt?: unknown;
  freshnessWindowHours?: unknown;
}

function coverageChecks(sourceCoverage: unknown): CoverageCheckLike[] {
  if (!sourceCoverage || typeof sourceCoverage !== 'object') return [];
  const checks = (sourceCoverage as { checks?: unknown }).checks;
  return Array.isArray(checks) ? (checks as CoverageCheckLike[]) : [];
}

/**
 * Evaluate the snapshot's source checks against each source's refresh SLA
 * (freshnessWindowHours captured at issue time, else the live catalog). Pure
 * read-time computation — the stored content is never modified.
 */
export function buildFreshnessOverlay(
  content: ReadinessSnapshotContent,
  now: Date = new Date(),
): SnapshotFreshnessOverlay {
  const staleSources: SnapshotStaleSource[] = [];
  const unevaluatedSources: string[] = [];

  for (const check of coverageChecks(content.sourceCoverage)) {
    const sourceId = typeof check.sourceId === 'string' ? check.sourceId : null;
    if (!sourceId) continue;

    const checkedAtRaw = typeof check.checkedAt === 'string' ? check.checkedAt : null;
    if (!checkedAtRaw) {
      unevaluatedSources.push(sourceId);
      continue;
    }
    const checkedAt = new Date(checkedAtRaw);
    if (Number.isNaN(checkedAt.getTime())) {
      unevaluatedSources.push(sourceId);
      continue;
    }

    const windowHours =
      typeof check.freshnessWindowHours === 'number' && check.freshnessWindowHours > 0
        ? check.freshnessWindowHours
        : getSourceFreshnessWindowHours(sourceId);
    const hoursSinceChecked = (now.getTime() - checkedAt.getTime()) / 3_600_000;

    if (hoursSinceChecked > windowHours) {
      staleSources.push({
        sourceId,
        checkedAt: checkedAtRaw,
        freshnessWindowHours: windowHours,
        hoursSinceChecked: Math.round(hoursSinceChecked * 10) / 10,
      });
    }
  }

  const reverifyRecommended = staleSources.length > 0;
  return {
    evaluatedAt: now.toISOString(),
    staleSources,
    unevaluatedSources,
    reverifyRecommended,
    note: reverifyRecommended
      ? `${staleSources.length} source check${staleSources.length === 1 ? ' is' : 's are'} past the refresh window. This snapshot shows evidence as issued — request a refreshed share before relying on the stale items.`
      : 'All source checks in this snapshot are within their refresh windows as of this read.',
  };
}

// ── Serving ──────────────────────────────────────────────────────────────────

export type SnapshotServeResult =
  | { outcome: 'not_found' }
  | { outcome: 'revoked'; revokedAt: string | null }
  | {
      outcome: 'ok';
      snapshotId: string;
      npi: string;
      bundleId: string | null;
      issuedAt: string;
      contentHash: string;
      content: ReadinessSnapshotContent;
      scope: unknown;
      freshness: SnapshotFreshnessOverlay;
    };

/**
 * Load a snapshot for serving: fail closed on unknown ids, direct revocation,
 * and revocation of any share of the linked bundle. Attaches the read-time
 * freshness overlay; the stored content travels verbatim.
 */
export async function loadReadinessSnapshotForServing(
  snapshotId: string,
  now: Date = new Date(),
): Promise<SnapshotServeResult> {
  const row = await prisma.readinessSnapshot.findUnique({ where: { id: snapshotId } });
  if (!row) return { outcome: 'not_found' };

  if (row.revokedAt) {
    return { outcome: 'revoked', revokedAt: row.revokedAt.toISOString() };
  }

  if (row.bundleId) {
    const revokedShare = await prisma.bundleShareEvent.findFirst({
      where: { bundleId: row.bundleId, revokedAt: { not: null } },
      select: { revokedAt: true },
    });
    if (revokedShare) {
      return {
        outcome: 'revoked',
        revokedAt: revokedShare.revokedAt?.toISOString() ?? null,
      };
    }
  }

  const content = row.content as unknown as ReadinessSnapshotContent;
  return {
    outcome: 'ok',
    snapshotId: row.id,
    npi: row.npi,
    bundleId: row.bundleId,
    issuedAt: row.issuedAt.toISOString(),
    contentHash: row.contentHash,
    content,
    scope: row.scope ?? null,
    freshness: buildFreshnessOverlay(content, now),
  };
}
