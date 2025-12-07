import { createHash } from 'crypto';

import { PrismaClient } from '@prisma/client';

import { anchorRuleSetUpdated } from '../audit/anchor';
import { ingestCmeRequirements } from './cme';
import { ingestControlledSubstanceRules } from './controlled-substances';
import { computeRuleDiff } from './rule-diff';
import { scrapeStateBoardRules } from './state-rules';
import type {
  AuthorityCode,
  RegulatoryInsight,
  RegulatoryRuleResponse,
  RegulatoryRuleSet,
  RegulatoryTimelineEvent,
  RuleDiffSummary,
} from './types';

const FALLBACK_AUTHORITY_COUNTRY = 'US';
const REFRESH_WINDOW_MS = Number(process.env.REGULATORY_REFRESH_WINDOW_MS ?? 1000 * 60 * 60 * 6);

const AUTHORITY_PRESETS: Record<string, { country: string; apiUrl?: string }> = {
  FSMB: { country: 'US', apiUrl: 'https://www.fsmb.org/api' },
  NCSBN: { country: 'US', apiUrl: 'https://www.ncsbn.org/api' },
  GMC: { country: 'UK', apiUrl: 'https://www.gmc-uk.org/api' },
  AHPRA: { country: 'AU', apiUrl: 'https://www.ahpra.gov.au/api' },
};

type RegulatoryDelegates = PrismaClient & {
  regAuthority?: any;
  regulatoryRuleSnapshot?: any;
  regulatoryEvent?: any;
};

export interface RegulatoryRuleOptions {
  authorityCode: AuthorityCode;
  prisma?: PrismaClient;
  refresh?: boolean;
  includeTimeline?: boolean;
  signal?: AbortSignal;
}

export async function getRegulatoryRules(
  options: RegulatoryRuleOptions,
): Promise<RegulatoryRuleResponse> {
  const prisma = options.prisma ?? new PrismaClient();
  const delegates = prisma as RegulatoryDelegates;
  const authorityCode = options.authorityCode.trim().toUpperCase();

  const authority = await ensureAuthorityRecord(delegates, authorityCode);

  const snapshotDelegate = requireDelegate(delegates, 'regulatoryRuleSnapshot');
  const eventDelegate = requireDelegate(delegates, 'regulatoryEvent');

  let latestSnapshot = await snapshotDelegate.findFirst({
    where: { authorityCode },
    orderBy: { fetchedAt: 'desc' },
  });

  const stale =
    !latestSnapshot ||
    Date.now() - new Date(latestSnapshot.fetchedAt ?? latestSnapshot.createdAt ?? Date.now()).getTime() >
      REFRESH_WINDOW_MS;

  const shouldRefresh = Boolean(options.refresh ?? false) || stale;
  let diff: RuleDiffSummary | null = (latestSnapshot?.diffSummary ?? null) as RuleDiffSummary | null;
  let ruleSet: RegulatoryRuleSet | null = (latestSnapshot?.payload ?? null) as RegulatoryRuleSet | null;
  let insights: RegulatoryInsight[] = extractInsights(latestSnapshot?.summary);
  let anchorSummary = snapshotAnchor(latestSnapshot);
  let source: RegulatoryRuleResponse['source'] = 'cache';

  if (shouldRefresh) {
    const ingestion = await ingestAndPersist({
      authorityCode,
      previousSnapshot: latestSnapshot,
      snapshotDelegate,
      eventDelegate,
      signal: options.signal,
    });
    latestSnapshot = ingestion.snapshot;
    diff = ingestion.diff;
    ruleSet = ingestion.ruleSet;
    insights = ingestion.insights;
    anchorSummary = snapshotAnchor(latestSnapshot);
    source = 'refreshed';
  }

  if (!ruleSet) {
    // No snapshot existed; generate one on the fly.
    const ingestion = await ingestAndPersist({
      authorityCode,
      previousSnapshot: null,
      snapshotDelegate,
      eventDelegate,
      signal: options.signal,
    });
    latestSnapshot = ingestion.snapshot;
    diff = ingestion.diff;
    ruleSet = ingestion.ruleSet;
    insights = ingestion.insights;
    anchorSummary = snapshotAnchor(latestSnapshot);
    source = 'refreshed';
  }

  const timeline =
    options.includeTimeline === false
      ? []
      : await buildTimeline(eventDelegate, authorityCode, latestSnapshot?.id, anchorSummary);

  return {
    authority: {
      code: authorityCode,
      country: authority.country,
      apiUrl: authority.apiUrl,
      updatedAt: authority.updatedAt?.toISOString?.() ?? new Date().toISOString(),
    },
    snapshot: {
      id: latestSnapshot?.id ?? 'unknown',
      fetchedAt:
        latestSnapshot?.fetchedAt?.toISOString?.() ??
        latestSnapshot?.fetchedAt ??
        new Date().toISOString(),
      snapshotHash: latestSnapshot?.snapshotHash ?? hashRuleSet(ruleSet),
      diffHash: latestSnapshot?.diffHash ?? diff?.hash ?? null,
      ruleVersion: latestSnapshot?.ruleVersion ?? 1,
      anchor: anchorSummary,
    },
    ruleSet,
    diff: diff ?? computeRuleDiff(null, ruleSet),
    insights: insights.length ? insights : buildInsights(ruleSet),
    timeline,
    source,
  };
}

async function ingestAndPersist(params: {
  authorityCode: AuthorityCode;
  previousSnapshot: any;
  snapshotDelegate: any;
  eventDelegate: any;
  signal?: AbortSignal;
}) {
  const ruleSet = await buildRuleSet(params.authorityCode, params.signal);
  const insights = buildInsights(ruleSet);
  const diff = computeRuleDiff(params.previousSnapshot?.payload as RegulatoryRuleSet | null, ruleSet);

  const snapshot = await params.snapshotDelegate.create({
    data: {
      authorityCode: params.authorityCode,
      payload: ruleSet,
      summary: { insights },
      diffSummary: diff,
      snapshotHash: hashRuleSet(ruleSet),
      diffHash: diff.hash,
      fetchedAt: new Date(ruleSet.fetchedAt),
      previousSnapshotId: params.previousSnapshot?.id ?? null,
      ruleVersion: (params.previousSnapshot?.ruleVersion ?? 0) + 1,
    },
  });

  let anchorRecord: ReturnType<typeof anchorRuleSetUpdated> | null = null;
  if (diff.hasChanges) {
    anchorRecord = anchorRuleSetUpdated({
      authorityCode: params.authorityCode,
      snapshotId: snapshot.id,
      diffHash: diff.hash,
      changes: {
        newRequirements: diff.newRequirements.length,
        removedFields: diff.removedRequirements.length,
        changedRenewalWindows: diff.changedRenewalWindows.length,
      },
      metadata: {
        headline: diff.headline,
        tags: diff.tags,
      },
    });

    await params.snapshotDelegate.update({
      where: { id: snapshot.id },
      data: {
        anchorTxHash: anchorRecord.txHash,
        anchorNetwork: anchorRecord.network,
        anchorEventId: anchorRecord.id,
      },
    });
  }

  await params.eventDelegate.create({
    data: {
      authorityCode: params.authorityCode,
      snapshotId: snapshot.id,
      eventType: diff.hasChanges ? 'ruleSetUpdated' : 'ruleSetSynced',
      title: diff.headline,
      description: diff.hasChanges
        ? 'Detected regulatory deltas across CME or renewal windows.'
        : 'Refreshed snapshot with no detected changes.',
      payload: diff,
      tags: diff.tags,
      diffHash: diff.hash,
      occurredAt: new Date(ruleSet.fetchedAt),
    },
  });

  return {
    snapshot: {
      ...snapshot,
      anchorTxHash: anchorRecord?.txHash ?? snapshot.anchorTxHash ?? null,
      anchorNetwork: anchorRecord?.network ?? snapshot.anchorNetwork ?? null,
      anchorEventId: anchorRecord?.id ?? snapshot.anchorEventId ?? null,
    },
    diff,
    ruleSet,
    insights,
  };
}

async function buildTimeline(
  eventDelegate: any,
  authorityCode: AuthorityCode,
  latestSnapshotId?: string | null,
  anchor?: RegulatoryTimelineEvent['anchor'],
): Promise<RegulatoryTimelineEvent[]> {
  const events = await eventDelegate.findMany({
    where: { authorityCode },
    orderBy: { occurredAt: 'desc' },
    take: 20,
    include: {
      snapshot: true,
    },
  });

  return events.map((event: any) => ({
    id: event.id,
    authorityCode,
    title: event.title,
    description: event.description,
    eventType: event.eventType,
    tags: Array.isArray(event.tags) ? event.tags : [],
    diffHash: event.diffHash ?? null,
    occurredAt: event.occurredAt?.toISOString?.() ?? new Date().toISOString(),
    snapshotId: event.snapshotId ?? null,
    metadata: event.payload ?? {},
    anchor:
      event.snapshot?.anchorTxHash && event.snapshot?.snapshotHash
        ? {
            txHash: event.snapshot.anchorTxHash,
            network: event.snapshot.anchorNetwork ?? 'pilot-l2',
            anchorId: event.snapshot.anchorEventId ?? event.snapshot.id,
            timestamp: event.snapshot.fetchedAt?.toISOString?.() ?? event.snapshot.fetchedAt,
          }
        : event.snapshotId === latestSnapshotId
          ? anchor ?? null
          : null,
  }));
}

async function ensureAuthorityRecord(prisma: RegulatoryDelegates, authorityCode: AuthorityCode) {
  const delegate = requireDelegate(prisma, 'regAuthority');
  const preset = AUTHORITY_PRESETS[authorityCode] ?? { country: FALLBACK_AUTHORITY_COUNTRY };

  return delegate.upsert({
    where: { code: authorityCode },
    update: {
      country: preset.country,
      apiUrl: preset.apiUrl ?? null,
    },
    create: {
      code: authorityCode,
      country: preset.country,
      apiUrl: preset.apiUrl ?? null,
    },
  });
}

async function buildRuleSet(authorityCode: AuthorityCode, signal?: AbortSignal) {
  const [cme, controlledSubstances, stateRules] = await Promise.all([
    ingestCmeRequirements(authorityCode, { signal }),
    ingestControlledSubstanceRules(authorityCode, { signal }),
    scrapeStateBoardRules(authorityCode, { signal }),
  ]);

  const fetchedAt = new Date(
    Math.max(
      Date.parse(cme.fetchedAt),
      Date.parse(controlledSubstances.fetchedAt),
      Date.parse(stateRules.fetchedAt),
    ),
  ).toISOString();

  return {
    authorityCode,
    fetchedAt,
    cme,
    controlledSubstances,
    stateRules,
  } satisfies RegulatoryRuleSet;
}

function buildInsights(ruleSet: RegulatoryRuleSet): RegulatoryInsight[] {
  const totalCategoryHours = ruleSet.cme.categories.reduce(
    (sum, category) => sum + category.minimumHours,
    0,
  );
  const tightestWindow = ruleSet.stateRules.states.length
    ? ruleSet.stateRules.states.reduce((acc, state) =>
        state.renewalWindowMonths < acc.renewalWindowMonths ? state : acc,
      )
    : null;

  return [
    {
      title: 'Total CME category hours',
      value: `${totalCategoryHours} hrs`,
      helper: 'Sum of tracked CME category minimums.',
      tone: totalCategoryHours > 35 ? 'warning' : 'default',
    },
    {
      title: 'MATE Act floor',
      value: `${ruleSet.controlledSubstances.mateActHours} hrs`,
      helper: 'Required for CS prescribing.',
      tone: ruleSet.controlledSubstances.mateActHours > 8 ? 'warning' : 'default',
    },
    {
      title: 'Tightest renewal window',
      value: tightestWindow ? `${tightestWindow.renewalWindowMonths} months` : 'N/A',
      helper: tightestWindow ? `${tightestWindow.state} Board` : 'No board data captured',
      tone:
        tightestWindow && tightestWindow.renewalWindowMonths <= 12
          ? 'warning'
          : 'default',
    },
  ];
}

function hashRuleSet(ruleSet: RegulatoryRuleSet | null): string {
  if (!ruleSet) return '';
  return createHash('sha256').update(JSON.stringify(ruleSet)).digest('hex');
}

function requireDelegate(client: RegulatoryDelegates, key: keyof RegulatoryDelegates): any {
  const delegate = (client as Record<string, unknown>)[key as string];
  if (!delegate) {
    throw new Error(`Prisma client missing ${String(key)} delegate. Run prisma generate.`);
  }
  return delegate;
}

function extractInsights(summary: any): RegulatoryInsight[] {
  if (!summary) return [];
  const insights = summary.insights;
  if (Array.isArray(insights)) {
    return insights as RegulatoryInsight[];
  }
  return [];
}

function snapshotAnchor(snapshot: any): RegulatoryTimelineEvent['anchor'] | null {
  if (!snapshot?.anchorTxHash) return null;
  return {
    txHash: snapshot.anchorTxHash,
    network: snapshot.anchorNetwork ?? 'pilot-l2',
    anchorId: snapshot.anchorEventId ?? snapshot.id,
    timestamp: snapshot.fetchedAt?.toISOString?.() ?? snapshot.fetchedAt ?? new Date().toISOString(),
  };
}

