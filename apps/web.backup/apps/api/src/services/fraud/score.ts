import type { CrossSourceMismatch, CrossSourceValidationResult } from './cross-source';

export interface FraudScoreInput {
  clinicianId: string;
  tamperLikelihood: number;
  tamperReasons?: string[];
  sanctionsFrequency: number;
  crossSource: CrossSourceValidationResult;
}

export interface FraudScoreResult {
  fraudScore: number;
  warnings: string[];
  breakdown: {
    tamper: number;
    sanctions: number;
    dataIntegrity: number;
  };
  mismatchedFields: CrossSourceMismatch[];
  evaluatedAt: string;
}

export function aggregateFraudSignals(input: FraudScoreInput): FraudScoreResult {
  const tamper = clamp01(input.tamperLikelihood);
  const sanctions = clamp01(input.sanctionsFrequency / 6); // normalize to 6 events / yr
  const dataIntegrity = clamp01((input.crossSource.mismatchRatio ?? 0) * 1.4);

  const fraudScore = Number(
    clamp01(tamper * 0.5 + sanctions * 0.2 + dataIntegrity * 0.3).toFixed(4),
  );

  const warnings = buildWarnings({
    tamper,
    sanctions,
    dataIntegrity,
    tamperReasons: input.tamperReasons ?? [],
    mismatches: input.crossSource.mismatches,
  });

  return {
    fraudScore,
    warnings,
    breakdown: {
      tamper,
      sanctions,
      dataIntegrity,
    },
    mismatchedFields: input.crossSource.mismatches,
    evaluatedAt: new Date().toISOString(),
  };
}

function buildWarnings(params: {
  tamper: number;
  sanctions: number;
  dataIntegrity: number;
  tamperReasons: string[];
  mismatches: CrossSourceMismatch[];
}): string[] {
  const messages: string[] = [];

  if (params.tamper > 0.45) {
    messages.push(
      params.tamperReasons[0] ??
        'Tamper heuristics triggered; escalate to human-in-the-loop review.',
    );
  }

  if (params.sanctions > 0.3) {
    messages.push('Sanctions velocity elevated compared to peer cohort.');
  }

  if (params.dataIntegrity > 0.4 && params.mismatches.length) {
    const criticalField = params.mismatches[0];
    messages.push(
      `Data mismatch (${criticalField.field}) with ${criticalField.source.toUpperCase()} registry.`,
    );
  }

  if (!messages.length) {
    messages.push('No critical fraud indicators detected; continue monitoring.');
  }

  return messages;
}

function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(1, value));
}










