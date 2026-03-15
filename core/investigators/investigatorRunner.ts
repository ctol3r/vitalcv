import { buildFindingExplanation } from './findingExplainer';
import { rankFinding } from './findingRanker';
import type { FindingStore } from './findingStore';
import type {
  FindingEntityLink,
  FindingEvidence,
  InvestigatorDefinition,
  InvestigatorExecutionContext,
  InvestigatorFindingDraft,
  InvestigatorFindingRecord,
  InvestigatorRunRequest,
  InvestigatorRunResult,
  InvestigatorSeverity,
} from './investigatorTypes';

function simpleHash(input: string): string {
  let hash = 0;
  for (const char of input) {
    hash = (Math.imul(31, hash) + char.charCodeAt(0)) | 0;
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

function severityRank(severity: InvestigatorSeverity): number {
  if (severity === 'critical') return 4;
  if (severity === 'high') return 3;
  if (severity === 'medium') return 2;
  return 1;
}

function dedupeEntities(entities: FindingEntityLink[]): FindingEntityLink[] {
  const seen = new Set<string>();
  return entities.filter((entity) => {
    const key = `${entity.entityType}:${entity.entityId}:${entity.relationship ?? ''}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function dedupeEvidence(evidence: FindingEvidence[]): FindingEvidence[] {
  const seen = new Set<string>();
  return evidence.filter((entry) => {
    const key = `${entry.evidenceType}:${entry.recordType ?? ''}:${entry.recordId ?? ''}:${entry.sourceId ?? ''}:${entry.snippet ?? ''}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function mergeDrafts(left: InvestigatorFindingDraft, right: InvestigatorFindingDraft): InvestigatorFindingDraft {
  const higherSeverity = severityRank(right.severity) > severityRank(left.severity) ? right.severity : left.severity;
  const higherConfidence = Math.max(left.confidence, right.confidence);
  const preferredTitle = severityRank(right.severity) > severityRank(left.severity) ? right.title : left.title;
  const preferredSummary = severityRank(right.severity) > severityRank(left.severity) ? right.summary : left.summary;

  return {
    ...left,
    severity: higherSeverity,
    title: preferredTitle,
    summary: preferredSummary,
    entityIds: [...new Set([...left.entityIds, ...right.entityIds])],
    entities: dedupeEntities([...(left.entities ?? []), ...(right.entities ?? [])]),
    supportingEvidence: dedupeEvidence([...left.supportingEvidence, ...right.supportingEvidence]),
    confidence: higherConfidence,
    explanation: [left.explanation, right.explanation].filter(Boolean).join(' ').trim() || undefined,
    audienceRoles: [...new Set([...(left.audienceRoles ?? []), ...(right.audienceRoles ?? [])])],
    scoreSignals: {
      ...left.scoreSignals,
      ...right.scoreSignals,
    },
    metadata: {
      ...(left.metadata ?? {}),
      ...(right.metadata ?? {}),
    },
    dedupeKey: left.dedupeKey ?? right.dedupeKey,
    storylineKey: left.storylineKey ?? right.storylineKey,
  };
}

function normalizeFindingDraft<TDependencies>(
  investigator: InvestigatorDefinition<TDependencies>,
  draft: InvestigatorFindingDraft,
): InvestigatorFindingDraft {
  return {
    ...draft,
    investigatorId: investigator.id,
    entities: dedupeEntities(draft.entities ?? []),
    supportingEvidence: dedupeEvidence(draft.supportingEvidence),
    audienceRoles: [...new Set([...(draft.audienceRoles ?? []), ...investigator.audienceRoles])],
    metadata: draft.metadata ?? {},
  };
}

function createStorylineKey(finding: InvestigatorFindingDraft): string {
  if (finding.storylineKey?.trim()) {
    return finding.storylineKey.trim();
  }

  return `${finding.investigatorId}:${finding.findingType}:${[...new Set(finding.entityIds)].sort().join('|')}`;
}

function createDedupeKey(finding: InvestigatorFindingDraft): string {
  if (finding.dedupeKey?.trim()) {
    return finding.dedupeKey.trim();
  }

  return `${createStorylineKey(finding)}:${simpleHash(finding.title.toLowerCase())}`;
}

function mergeStorylines<TDependencies>(
  investigator: InvestigatorDefinition<TDependencies>,
  drafts: InvestigatorFindingDraft[],
): { drafts: InvestigatorFindingDraft[]; mergedCount: number } {
  const storylineMap = new Map<string, InvestigatorFindingDraft>();

  for (const rawDraft of drafts) {
    const draft = normalizeFindingDraft(investigator, rawDraft);
    const storylineKey = createStorylineKey(draft);
    const existing = storylineMap.get(storylineKey);
    if (!existing) {
      storylineMap.set(storylineKey, {
        ...draft,
        storylineKey,
        dedupeKey: createDedupeKey({ ...draft, storylineKey }),
      });
      continue;
    }

    storylineMap.set(
      storylineKey,
      {
        ...mergeDrafts(existing, draft),
        storylineKey,
        dedupeKey: existing.dedupeKey ?? createDedupeKey({ ...existing, storylineKey }),
      },
    );
  }

  return {
    drafts: [...storylineMap.values()],
    mergedCount: Math.max(0, drafts.length - storylineMap.size),
  };
}

function finalizeFinding<TDependencies>(
  investigator: InvestigatorDefinition<TDependencies>,
  draft: InvestigatorFindingDraft,
  now: string,
  existing: InvestigatorFindingRecord | undefined,
): InvestigatorFindingRecord {
  const ranked = rankFinding({
    severity: draft.severity,
    confidence: draft.confidence,
    scoreSignals: draft.scoreSignals,
    occurrenceCount: existing?.occurrenceCount,
  });

  const explanation = buildFindingExplanation(investigator, draft);

  return {
    findingId: existing?.findingId ?? `ifd_${simpleHash(`${draft.dedupeKey}:${now}`)}`,
    investigatorId: investigator.id,
    findingType: draft.findingType,
    scope: investigator.scope,
    severity: draft.severity,
    title: draft.title.trim(),
    summary: draft.summary.trim(),
    entityIds: [...new Set(draft.entityIds)].sort(),
    entities: dedupeEntities(draft.entities ?? []),
    supportingEvidence: dedupeEvidence(draft.supportingEvidence),
    confidence: Math.max(0, Math.min(1, draft.confidence)),
    explanation,
    status: existing && (existing.status === 'dismissed' || existing.status === 'resolved')
      ? 'new'
      : existing?.status ?? 'new',
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    firstSeenAt: existing?.firstSeenAt ?? now,
    lastSeenAt: now,
    occurrenceCount: (existing?.occurrenceCount ?? 0) + 1,
    priorityScore: ranked.priorityScore,
    scoreSignals: ranked.scoreSignals,
    rankBreakdown: ranked.rankBreakdown,
    audienceRoles: [...new Set([...(draft.audienceRoles ?? []), ...investigator.audienceRoles])],
    metadata: draft.metadata ?? {},
    dedupeKey: draft.dedupeKey ?? createDedupeKey(draft),
    storylineKey: draft.storylineKey ?? createStorylineKey(draft),
  };
}

export class InvestigatorRunner<TDependencies = Record<string, never>> {
  constructor(private readonly store: FindingStore) {}

  async run(
    investigator: InvestigatorDefinition<TDependencies>,
    request: InvestigatorRunRequest<TDependencies>,
  ): Promise<InvestigatorRunResult> {
    const now = request.now ?? new Date().toISOString();
    const startedAt = now;
    const targetEntityIds = [...new Set(request.targetEntityIds ?? [])];
    const coveredEntityIds = new Set<string>(targetEntityIds);
    const runId = `irn_${simpleHash(`${investigator.id}:${request.trigger}:${now}:${targetEntityIds.join('|')}`)}`;

    await this.store.beginRun({
      runId,
      investigatorId: investigator.id,
      trigger: request.trigger,
      scope: investigator.scope,
      entityType: request.entityType ?? null,
      targetEntityIds,
      startedAt,
      metadata: request.metadata,
    });

    try {
      const context: InvestigatorExecutionContext<TDependencies> = {
        now,
        trigger: request.trigger,
        investigatorId: investigator.id,
        entityType: request.entityType ?? null,
        targetEntityIds,
        batchSize: investigator.schedule.batchSize,
        dependencies: request.dependencies,
        markEntityCovered(entityId: string): void {
          if (entityId.trim().length > 0) {
            coveredEntityIds.add(entityId.trim());
          }
        },
      };

      const rawFindings = await investigator.run(context);
      const merged = mergeStorylines(investigator, rawFindings);
      const dedupeKeys = merged.drafts.map((finding) => finding.dedupeKey ?? createDedupeKey(finding));
      const existingFindings = await this.store.loadByDedupeKeys(dedupeKeys);
      const existingByDedupeKey = new Map(existingFindings.map((finding) => [finding.dedupeKey, finding]));

      const finalizedFindings = merged.drafts.map((draft) => {
        const dedupeKey = draft.dedupeKey ?? createDedupeKey(draft);
        return finalizeFinding(investigator, { ...draft, dedupeKey }, now, existingByDedupeKey.get(dedupeKey));
      });

      const suppressedCount = finalizedFindings.filter((finding) => {
        const existing = existingByDedupeKey.get(finding.dedupeKey);
        if (!existing) {
          return false;
        }

        const elapsedMs = new Date(now).getTime() - new Date(existing.lastSeenAt).getTime();
        return elapsedMs < (investigator.schedule.suppressionWindowMinutes * 60_000);
      }).length;

      const persistResult = await this.store.persistFindings({
        runId,
        investigator,
        findings: finalizedFindings,
      });

      const findingsResolved = coveredEntityIds.size > 0
        ? await this.store.resolveMissingFindings({
          investigatorId: investigator.id,
          coveredEntityIds: [...coveredEntityIds],
          activeDedupeKeys: finalizedFindings.map((finding) => finding.dedupeKey),
          resolvedAt: now,
          note: 'Signal not reproduced in the latest investigator run.',
        })
        : 0;

      const completedAt = new Date().toISOString();
      const durationMs = Math.max(0, new Date(completedAt).getTime() - new Date(startedAt).getTime());

      await this.store.finishRun({
        runId,
        status: 'succeeded',
        completedAt,
        durationMs,
        entitiesScanned: coveredEntityIds.size,
        findingsGenerated: finalizedFindings.length,
        findingsCreated: persistResult.findingsCreated,
        findingsUpdated: persistResult.findingsUpdated,
        findingsResolved,
        findingsSuppressed: suppressedCount,
        storylinesMerged: merged.mergedCount,
      });

      return {
        runId,
        investigatorId: investigator.id,
        trigger: request.trigger,
        startedAt,
        completedAt,
        durationMs,
        findingsGenerated: finalizedFindings.length,
        findingsCreated: persistResult.findingsCreated,
        findingsUpdated: persistResult.findingsUpdated,
        findingsResolved,
        findingsSuppressed: suppressedCount,
        storylinesMerged: merged.mergedCount,
        coveredEntityIds: [...coveredEntityIds],
      };
    } catch (error) {
      const completedAt = new Date().toISOString();
      const durationMs = Math.max(0, new Date(completedAt).getTime() - new Date(startedAt).getTime());
      await this.store.finishRun({
        runId,
        status: 'failed',
        completedAt,
        durationMs,
        entitiesScanned: coveredEntityIds.size,
        findingsGenerated: 0,
        findingsCreated: 0,
        findingsUpdated: 0,
        findingsResolved: 0,
        findingsSuppressed: 0,
        storylinesMerged: 0,
        errorMessage: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}
