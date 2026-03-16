import type { CopilotInvestigationPayload, CopilotSignalCheckSummary } from './contracts';
import {
  buildProviderInvestigationPayload,
  buildStorylineInvestigationPayload,
} from './investigationWorkbenchService';

export interface CopilotInvestigationRequest {
  providerId?: string | null;
  storylineId?: string | null;
  objective?: string | null;
}

function clamp01(value: number, fallback = 0): number {
  if (!Number.isFinite(value)) {
    return fallback;
  }
  return Math.max(0, Math.min(1, Math.round(value * 10_000) / 10_000));
}

function confidenceLevel(score: number): 'low' | 'medium' | 'high' {
  if (score >= 0.75) {
    return 'high';
  }
  if (score >= 0.45) {
    return 'medium';
  }
  return 'low';
}

function defaultObjective(input: CopilotInvestigationRequest): string {
  if (input.storylineId) {
    return `Assess whether storyline ${input.storylineId} is coherent, actionable, and ready for escalation or archive.`;
  }
  if (input.providerId) {
    return `Assess provider ${input.providerId} for current investigative risk, network context, and next action.`;
  }
  return 'Assess the current investigative context and determine the next explainable action.';
}

function buildSignalChecks(rows: Array<{
  investigatorSource: string;
  confidence: number;
  timestamp: string;
  summary: string;
}>): CopilotSignalCheckSummary[] {
  const grouped = new Map<string, typeof rows>();
  for (const row of rows) {
    const current = grouped.get(row.investigatorSource) ?? [];
    current.push(row);
    grouped.set(row.investigatorSource, current);
  }

  return [...grouped.entries()].map(([investigatorId, items]) => ({
    investigatorId,
    findingCount: items.length,
    lastObservedAt: items.sort((left, right) => Date.parse(right.timestamp) - Date.parse(left.timestamp))[0]?.timestamp ?? null,
    confidence: items.reduce((sum, item) => sum + item.confidence, 0) / Math.max(items.length, 1),
    summary: items.slice(0, 2).map((item) => item.summary).join(' '),
  }));
}

export async function buildCopilotInvestigationPayload(
  input: CopilotInvestigationRequest,
): Promise<CopilotInvestigationPayload> {
  const objective = input.objective?.trim() || defaultObjective(input);

  if (input.storylineId) {
    const payload = await buildStorylineInvestigationPayload(input.storylineId);
    if (!payload) {
      throw new Error(`Storyline not found: ${input.storylineId}`);
    }

    const signalChecks = buildSignalChecks(payload.findingsInbox.rows.map((row) => ({
      investigatorSource: row.investigatorSource,
      confidence: row.confidence,
      timestamp: row.timestamp,
      summary: row.summary,
    })));
    const confidenceScore = clamp01(
      (payload.console.score.total * 0.45)
        + ((signalChecks[0]?.confidence ?? payload.detail.storyline.confidence) * 0.35)
        + ((payload.network.paths.shortestPath?.score ?? 0.5) * 0.2),
    );

    return {
      generatedAt: new Date().toISOString(),
      objective,
      keyQuestions: [
        'Does the storyline still represent one coherent investigative arc?',
        'Which investigators agree or disagree on the current risk posture?',
        'Is there a graph path or institution context that changes the interpretation?',
        'Should this storyline be merged, split, escalated, resolved, or archived?',
      ],
      signalChecks,
      evidenceSummary: payload.detail.evidenceRefs.slice(0, 6).map((evidence) => ({
        label: evidence.summary,
        detail: evidence.summary,
        source: evidence.source,
        observedAt: evidence.observedAt,
      })),
      networkContext: {
        focusNodeId: payload.network.focusNodeId,
        highlights: payload.network.highlights.nodeIds,
        topPaths: payload.network.paths.rankedPaths.slice(0, 3),
      },
      confidenceAssessment: {
        score: confidenceScore,
        level: confidenceLevel(confidenceScore),
        reasoning: [
          `Storyline lifecycle stage: ${payload.detail.lifecycleStage}.`,
          `Storyline score: ${payload.console.score.total.toFixed(2)}.`,
          `Signal-check count: ${signalChecks.length}.`,
          payload.network.paths.shortestPath
            ? `Shortest relevant network path scored ${payload.network.paths.shortestPath.score.toFixed(2)}.`
            : 'No meaningful graph path was available for the current storyline context.',
        ],
      },
      recommendedAction: payload.detail.lifecycleStage === 'mature'
        ? 'Escalate the storyline for analyst review and preserve the current evidence bundle.'
        : payload.detail.lifecycleStage === 'developing'
          ? 'Keep the storyline active, run the subscribed follow-on investigators, and watch for one more corroborating signal.'
          : payload.detail.lifecycleStage === 'resolved'
            ? 'Mark the storyline resolved and retain it for re-open checks.'
            : payload.detail.lifecycleStage === 'archived'
              ? 'Keep the storyline archived unless fresh evidence reactivates it.'
              : 'Maintain the storyline as emerging and wait for more corroboration before escalation.',
      followUpQueries: [
        `Show graph paths connected to storyline ${payload.storylineId}`,
        `List findings supporting storyline ${payload.storylineId}`,
        `What changed since the last storyline update for ${payload.storylineId}?`,
      ],
    };
  }

  if (!input.providerId) {
    throw new Error('providerId or storylineId is required');
  }

  const payload = await buildProviderInvestigationPayload(input.providerId);
  const signalChecks = buildSignalChecks(payload.findingsInbox.rows.map((row) => ({
    investigatorSource: row.investigatorSource,
    confidence: row.confidence,
    timestamp: row.timestamp,
    summary: row.summary,
  })));
  const confidenceScore = clamp01(
    (payload.providerSummary.trustBreakdown.confidence * 0.35)
      + ((signalChecks[0]?.confidence ?? 0.5) * 0.25)
      + ((payload.network.paths.shortestPath?.score ?? 0.5) * 0.15)
      + ((payload.storylines[0]?.score.total ?? 0.5) * 0.25),
  );

  return {
    generatedAt: new Date().toISOString(),
    objective,
    keyQuestions: [
      `What is the current trust posture for provider ${input.providerId}?`,
      'Which active findings need immediate review versus continued monitoring?',
      'What storyline or network context most changes the interpretation of the provider profile?',
      'Which explainable action would most reduce uncertainty right now?',
    ],
    signalChecks,
    evidenceSummary: [
      ...payload.providerSummary.searchEvidence.slice(0, 3).map((evidence) => ({
        label: evidence.title,
        detail: evidence.snippet,
        source: evidence.provenance,
        observedAt: payload.providerSummary.trustBreakdown.timeline[payload.providerSummary.trustBreakdown.timeline.length - 1]?.recordedAt
          ?? new Date().toISOString(),
      })),
      ...payload.storylines.slice(0, 3).map((storyline) => ({
        label: storyline.headline,
        detail: storyline.summary,
        source: 'storyline_console',
        observedAt: storyline.lastUpdated,
      })),
    ].slice(0, 6),
    networkContext: {
      focusNodeId: payload.network.focusNodeId,
      highlights: payload.network.highlights.nodeIds,
      topPaths: payload.network.paths.rankedPaths.slice(0, 3),
    },
    confidenceAssessment: {
      score: confidenceScore,
      level: confidenceLevel(confidenceScore),
      reasoning: [
        `Trust breakdown confidence: ${payload.providerSummary.trustBreakdown.confidence.toFixed(2)}.`,
        `Active storyline count: ${payload.storylines.length}.`,
        `Active signal-check count: ${signalChecks.length}.`,
        payload.network.paths.shortestPath
          ? `Primary graph path score: ${payload.network.paths.shortestPath.score.toFixed(2)}.`
          : 'Graph investigation did not produce a direct path of interest.',
      ],
    },
    recommendedAction: payload.findingsInbox.rows.some((row) => row.severity === 'critical')
      ? 'Escalate the provider investigation and confirm the highest-severity finding with source evidence.'
      : payload.storylines.some((storyline) => storyline.lifecycleStage === 'mature')
        ? 'Open the highest-maturity storyline and compare it with active findings before final action.'
        : 'Keep the provider in active monitoring and run focused follow-up checks on the newest findings.',
    followUpQueries: [
      `Summarize the latest findings for provider ${input.providerId}`,
      `Show network changes affecting provider ${input.providerId}`,
      `Which storyline is most actionable for provider ${input.providerId}?`,
    ],
  };
}
