import { createQaFinding, type QaFinding } from './types';

type SafeParseResult<T> =
  | { success: true; data: T }
  | { success: false; error: unknown };

export interface CopilotResponseValidator<TResponse> {
  safeParse(input: unknown): SafeParseResult<TResponse>;
}

interface CopilotResultLike {
  id: string;
  rank: number;
  scores: {
    relevance: number;
    trustScore: number;
    freshness: number;
    sourceCoverage: number;
    total: number;
  };
}

interface CopilotExplanationLike {
  resultId: string;
  because: string[];
}

interface CopilotGraphInsightLike {
  resultId?: string;
}

interface CopilotResponseLike {
  status: 'ok' | 'limited';
  answer: string;
  sources: string[];
  confidence: number;
  results: CopilotResultLike[];
  explanations: CopilotExplanationLike[];
  graphInsights: CopilotGraphInsightLike[];
}

export interface CopilotValidationResult<TResponse> {
  valid: boolean;
  findings: QaFinding[];
  data?: TResponse;
}

function isFiniteRatio(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= 1;
}

export function validateCopilotStructuredResponse<TResponse extends CopilotResponseLike>(
  payload: unknown,
  validator: CopilotResponseValidator<TResponse>,
): CopilotValidationResult<TResponse> {
  const parsed = validator.safeParse(payload);
  if (!parsed.success) {
    return {
      valid: false,
      findings: [
        createQaFinding({
          code: 'copilot_schema_validation_failed',
          severity: 'critical',
          component: 'copilot-response-validator',
          summary: 'Copilot response failed schema validation.',
          metadata: {
            error: parsed.error instanceof Error ? parsed.error.message : String(parsed.error),
          },
        }),
      ],
    };
  }

  const data = parsed.data;
  const findings: QaFinding[] = [];

  if (typeof data.answer !== 'string' || data.answer.trim().length === 0) {
    findings.push(
      createQaFinding({
        code: 'copilot_answer_missing',
        severity: 'critical',
        component: 'copilot-response-validator',
        summary: 'Copilot response is missing a usable top-level answer.',
      }),
    );
  }

  if (!Array.isArray(data.sources)) {
    findings.push(
      createQaFinding({
        code: 'copilot_sources_missing',
        severity: 'critical',
        component: 'copilot-response-validator',
        summary: 'Copilot response is missing the top-level sources array.',
      }),
    );
  }

  if (!isFiniteRatio(data.confidence)) {
    findings.push(
      createQaFinding({
        code: 'copilot_confidence_out_of_range',
        severity: 'critical',
        component: 'copilot-response-validator',
        summary: 'Copilot response top-level confidence is missing or out of range.',
      }),
    );
  }

  if (data.status === 'limited') {
    return {
      valid: findings.every((finding) => finding.severity !== 'critical'),
      findings,
      data,
    };
  }

  const resultIds = new Set<string>();
  const ranks = new Set<number>();

  for (const result of data.results) {
    if (resultIds.has(result.id)) {
      findings.push(
        createQaFinding({
          code: 'copilot_duplicate_result_id',
          severity: 'critical',
          component: 'copilot-response-validator',
          summary: `Copilot response reused result id ${result.id}.`,
          entityIds: [result.id],
        }),
      );
    }
    resultIds.add(result.id);

    if (ranks.has(result.rank)) {
      findings.push(
        createQaFinding({
          code: 'copilot_duplicate_rank',
          severity: 'critical',
          component: 'copilot-response-validator',
          summary: `Copilot response reused rank ${result.rank}.`,
          entityIds: [result.id],
        }),
      );
    }
    ranks.add(result.rank);

    if (
      !isFiniteRatio(result.scores.relevance)
      || !isFiniteRatio(result.scores.trustScore)
      || !isFiniteRatio(result.scores.freshness)
      || !isFiniteRatio(result.scores.sourceCoverage)
      || !isFiniteRatio(result.scores.total)
    ) {
      findings.push(
        createQaFinding({
          code: 'copilot_score_out_of_range',
          severity: 'critical',
          component: 'copilot-response-validator',
          summary: `Copilot response contains out-of-range scoring values for ${result.id}.`,
          entityIds: [result.id],
        }),
      );
    }
  }

  for (let index = 0; index < data.results.length; index += 1) {
    const expectedRank = index + 1;
    if (data.results[index]?.rank !== expectedRank) {
      findings.push(
        createQaFinding({
          code: 'copilot_non_consecutive_ranks',
          severity: 'critical',
          component: 'copilot-response-validator',
          summary: 'Copilot response ranks are not consecutive starting at 1.',
        }),
      );
      break;
    }
  }

  for (const explanation of data.explanations) {
    if (!resultIds.has(explanation.resultId)) {
      findings.push(
        createQaFinding({
          code: 'copilot_explanation_missing_result',
          severity: 'critical',
          component: 'copilot-response-validator',
          summary: `Copilot explanation references unknown result id ${explanation.resultId}.`,
          entityIds: [explanation.resultId],
        }),
      );
    }

    if (explanation.because.length === 0) {
      findings.push(
        createQaFinding({
          code: 'copilot_empty_because_clause',
          severity: 'warning',
          component: 'copilot-response-validator',
          summary: `Copilot explanation for ${explanation.resultId} does not include supporting reasons.`,
          entityIds: [explanation.resultId],
        }),
      );
    }
  }

  for (const insight of data.graphInsights) {
    if (insight.resultId && !resultIds.has(insight.resultId)) {
      findings.push(
        createQaFinding({
          code: 'copilot_graph_insight_missing_result',
          severity: 'critical',
          component: 'copilot-response-validator',
          summary: `Copilot graph insight references unknown result id ${insight.resultId}.`,
          entityIds: [insight.resultId],
        }),
      );
    }
  }

  return {
    valid: findings.every((finding) => finding.severity !== 'critical'),
    findings,
    data,
  };
}
