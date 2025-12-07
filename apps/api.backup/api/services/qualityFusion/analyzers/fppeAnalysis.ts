import { QualitySignal, createQualitySignal } from '../models/QualitySignal';

export type FPPEStatus = 'OPEN' | 'IN_REVIEW' | 'COMPLETED' | 'FAILED';

export interface FppeCasePerformance {
  caseId: string;
  status: FPPEStatus;
  completionScore?: number; // 0-1 scale derived from FPPE checklists
  evidenceProvided?: number;
  evidenceRequired?: number;
  missingEvidence?: string[];
  failureReason?: string;
  updatedAt?: Date;
}

export interface FppeAnalysisInput {
  clinicianId: string;
  cases: FppeCasePerformance[];
  weakScoreThreshold?: number;
}

const DEFAULT_WEAK_THRESHOLD = 0.7;

export function analyzeFppePerformance(input: FppeAnalysisInput): QualitySignal[] {
  if (!input.cases || input.cases.length === 0) {
    return [];
  }

  const threshold = input.weakScoreThreshold ?? DEFAULT_WEAK_THRESHOLD;
  const signals: QualitySignal[] = [];

  for (const fppeCase of input.cases) {
    const timestamp = fppeCase.updatedAt ?? new Date();

    if (fppeCase.status === 'FAILED') {
      signals.push(
        createQualitySignal({
          clinicianId: input.clinicianId,
          signalType: 'FPPE_FAILURE',
          severity: 'CRITICAL',
          timestamp,
          details: {
            summary: `FPPE case ${fppeCase.caseId} failed`,
            metric: 'fppe_status',
            tags: ['fppe'],
            metadata: {
              failureReason: fppeCase.failureReason,
            },
          },
          source: 'qualityFusion/fppeAnalysis',
        }),
      );
      continue;
    }

    const evidenceRequired = fppeCase.evidenceRequired ?? 0;
    const evidenceProvided = fppeCase.evidenceProvided ?? 0;
    const missingEvidenceList = fppeCase.missingEvidence ?? [];
    const hasEvidenceGap =
      evidenceRequired > 0
        ? evidenceProvided < evidenceRequired
        : missingEvidenceList.length > 0;

    if (hasEvidenceGap) {
      signals.push(
        createQualitySignal({
          clinicianId: input.clinicianId,
          signalType: 'FPPE_FAILURE',
          severity: 'MED',
          timestamp,
          details: {
            summary: `FPPE case ${fppeCase.caseId} has missing evidence`,
            metric: 'fppe_evidence',
            observedValue: evidenceProvided,
            expectedValue: evidenceRequired || undefined,
            metadata: {
              missingEvidence: missingEvidenceList,
            },
          },
          source: 'qualityFusion/fppeAnalysis',
        }),
      );
      continue;
    }

    const score = fppeCase.completionScore ?? 1;
    if (score < threshold) {
      signals.push(
        createQualitySignal({
          clinicianId: input.clinicianId,
          signalType: 'FPPE_FAILURE',
          severity: 'HIGH',
          timestamp,
          details: {
            summary: `FPPE case ${fppeCase.caseId} is trending weak`,
            metric: 'fppe_score',
            observedValue: Number(score.toFixed(2)),
            threshold,
          },
          source: 'qualityFusion/fppeAnalysis',
        }),
      );
    }
  }

  return signals;
}

