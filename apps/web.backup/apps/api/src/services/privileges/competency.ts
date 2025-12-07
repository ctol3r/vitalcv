import { ProcedureVolumeSummary } from './volume';

export interface BoardCertificationRecord {
  board: string;
  specialty?: string;
  certifiedAt?: string;
  expiresAt?: string | null;
  verified?: boolean;
}

export interface TrainingProgramRecord {
  name: string;
  completedAt?: string | null;
  expiresAt?: string | null;
  sponsoringOrg?: string;
}

export interface RecencyEvidence {
  procedure: string;
  lastPerformed?: string | null;
  caseCount?: number;
}

export interface CompetencyEvaluationInput {
  clinicianId: string;
  boardCertifications: BoardCertificationRecord[];
  trainingPrograms: TrainingProgramRecord[];
  recencyEvidence?: RecencyEvidence[];
  requiredBoards?: string[];
  requiredTrainings?: string[];
  recencyThresholdMonths?: number;
  volumeSummary?: ProcedureVolumeSummary;
}

export interface CompetencyEvaluationResult {
  clinicianId: string;
  competencyScore: number;
  missingCompetencies: string[];
  boardStatus: {
    hasActiveBoard: boolean;
    expiringBoards: string[];
    deficits: string[];
  };
  trainingStatus: {
    completed: string[];
    missing: string[];
    expiringSoon: string[];
  };
  recencyStatus: Array<{
    procedure: string;
    lastPerformed?: string | null;
    withinThreshold: boolean;
    ageInMonths?: number;
  }>;
}

const DEFAULT_RECENCY_MONTHS = 24;
const EXPIRY_BUFFER_MONTHS = 3;

export function evaluateCompetency(input: CompetencyEvaluationInput): CompetencyEvaluationResult {
  const recencyThreshold = input.recencyThresholdMonths ?? DEFAULT_RECENCY_MONTHS;

  const boardStatus = evaluateBoardStatus(input.boardCertifications, input.requiredBoards);
  const trainingStatus = evaluateTrainingStatus(input.trainingPrograms, input.requiredTrainings);
  const recencyEvidence = input.recencyEvidence ?? deriveRecencyFromVolume(input.volumeSummary);
  const recencyStatus = evaluateRecency(recencyEvidence, recencyThreshold);

  const boardScore = boardStatus.hasActiveBoard ? 1 : boardStatus.deficits.length > 0 ? 0.2 : 0.6;
  const trainingScore =
    trainingStatus.missing.length === 0
      ? 1
      : Math.max(0, 1 - trainingStatus.missing.length / Math.max(input.requiredTrainings?.length ?? 1, 1));
  const recencyScore =
    recencyStatus.length === 0
      ? 0.6
      : recencyStatus.reduce((sum, status) => sum + (status.withinThreshold ? 1 : 0), 0) / recencyStatus.length;

  const componentScores = [boardScore, trainingScore, recencyScore];
  const competencyScore = Number(
    (componentScores.reduce((sum, value) => sum + value, 0) / componentScores.length).toFixed(3),
  );

  const missingCompetencies = [...boardStatus.deficits, ...trainingStatus.missing];
  const staleProcedures = recencyStatus.filter((record) => !record.withinThreshold);
  staleProcedures.forEach((record) => {
    missingCompetencies.push(
      `${record.procedure} recency beyond ${recencyThreshold} months${record.ageInMonths ? ` (${record.ageInMonths}m)` : ''}`,
    );
  });

  return {
    clinicianId: input.clinicianId,
    competencyScore,
    missingCompetencies,
    boardStatus,
    trainingStatus,
    recencyStatus,
  };
}

function evaluateBoardStatus(
  boards: BoardCertificationRecord[],
  requiredBoards?: string[],
): CompetencyEvaluationResult['boardStatus'] {
  if (!boards.length) {
    return {
      hasActiveBoard: false,
      expiringBoards: [],
      deficits: requiredBoards?.length ? [`Missing board certification: ${requiredBoards.join(', ')}`] : ['No active board certification on file'],
    };
  }

  const now = Date.now();
  const bufferMs = monthsToMs(EXPIRY_BUFFER_MONTHS);
  const normalizedRequired = (requiredBoards ?? []).map((board) => board.toLowerCase());

  const expiringBoards: string[] = [];
  const deficits: string[] = [];
  let hasActiveBoard = false;

  for (const record of boards) {
    const expiresAt = record.expiresAt ? new Date(record.expiresAt).getTime() : null;
    if (expiresAt && expiresAt < now) {
      deficits.push(`Board certification expired: ${record.board}`);
      continue;
    }
    if (expiresAt && expiresAt - bufferMs < now) {
      expiringBoards.push(`${record.board} (${record.specialty ?? 'core'})`);
    }

    if (!normalizedRequired.length) {
      hasActiveBoard = true;
    } else if (
      normalizedRequired.some((required) => record.board.toLowerCase().includes(required) || record.specialty?.toLowerCase().includes(required))
    ) {
      hasActiveBoard = true;
    }
  }

  if (!hasActiveBoard && normalizedRequired.length) {
    deficits.push(`Required board certification not found: ${requiredBoards?.join(', ')}`);
  }

  return {
    hasActiveBoard,
    expiringBoards,
    deficits,
  };
}

function evaluateTrainingStatus(
  trainings: TrainingProgramRecord[],
  requiredTrainings?: string[],
): CompetencyEvaluationResult['trainingStatus'] {
  if (!requiredTrainings?.length) {
    return {
      completed: trainings.map((training) => training.name),
      missing: [],
      expiringSoon: trainings
        .filter((training) => training.expiresAt && new Date(training.expiresAt).getTime() - monthsToMs(EXPIRY_BUFFER_MONTHS) < Date.now())
        .map((training) => training.name),
    };
  }

  const completed = new Set(
    trainings
      .filter((training) => !training.expiresAt || new Date(training.expiresAt).getTime() > Date.now())
      .map((training) => training.name.toLowerCase()),
  );

  const missing = requiredTrainings
    .filter((training) => !completed.has(training.toLowerCase()))
    .map((training) => training);

  const expiringSoon = trainings
    .filter(
      (training) =>
        training.expiresAt &&
        new Date(training.expiresAt).getTime() - monthsToMs(EXPIRY_BUFFER_MONTHS) < Date.now() &&
        requiredTrainings.some((required) => required.toLowerCase() === training.name.toLowerCase()),
    )
    .map((training) => training.name);

  return {
    completed: trainings.map((training) => training.name),
    missing,
    expiringSoon,
  };
}

function evaluateRecency(evidence: RecencyEvidence[], thresholdMonths: number) {
  const thresholdMs = monthsToMs(thresholdMonths);
  const now = Date.now();

  return evidence.map((record) => {
    if (!record.lastPerformed) {
      return {
        procedure: record.procedure,
        lastPerformed: null,
        withinThreshold: false,
      };
    }

    const lastPerformed = new Date(record.lastPerformed).getTime();
    const ageInMs = now - lastPerformed;
    const ageInMonths = Math.floor(ageInMs / MONTH_IN_MS);

    return {
      procedure: record.procedure,
      lastPerformed: record.lastPerformed,
      withinThreshold: ageInMs <= thresholdMs,
      ageInMonths,
    };
  });
}

function deriveRecencyFromVolume(summary?: ProcedureVolumeSummary): RecencyEvidence[] {
  if (!summary) return [];
  return summary.procedures.map((procedure) => ({
    procedure: procedure.procedure,
    lastPerformed: procedure.mostRecentCase,
    caseCount: procedure.totalCount,
  }));
}

function monthsToMs(months: number): number {
  return months * MONTH_IN_MS;
}

const MONTH_IN_MS = 30 * 24 * 60 * 60 * 1000;










