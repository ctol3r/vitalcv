import {
  CreateRevalidationTaskInput,
  RevalidationTaskMetadata,
  RevalidationTaskSource,
  RevalidationTaskStatus,
  RevalidationTaskType,
} from './models/RevalidationTask.js';

export interface PecosProviderStatus {
  enrollmentId: string;
  payerName?: string;
  revalidationDueDate?: Date;
  cycle?: 'STANDARD' | 'DMEPOS';
  status?: 'APPROVED' | 'PENDING' | 'DENIED';
}

export interface MedicaidEnrollment {
  program: string;
  enrollmentId: string;
  revalidationDueDate?: Date;
  status?: 'ACTIVE' | 'PENDING' | 'TERMINATED';
}

export interface StateLicenseVerification {
  state: string;
  licenseNumber: string;
  expiresAt?: Date;
  status?: 'ACTIVE' | 'EXPIRED' | 'SUSPENDED';
  board?: string;
  evidenceUrl?: string;
}

export interface DeaRegistration {
  registrationNumber: string;
  expiresAt?: Date;
  status?: 'ACTIVE' | 'SUSPENDED';
  evidenceUrl?: string;
}

export interface BoardCertificationRecord {
  board: string;
  specialty: string;
  expiresAt?: Date;
  status?: 'ACTIVE' | 'LAPSED';
  evidenceUrl?: string;
}

export interface RevalidationCalculatorInput {
  clinicianId: string;
  clinicianName?: string;
  npi?: string;
  pecos?: PecosProviderStatus[];
  medicaid?: MedicaidEnrollment[];
  licenses?: StateLicenseVerification[];
  dea?: DeaRegistration[];
  boardCerts?: BoardCertificationRecord[];
  referenceDate?: Date;
}

export interface CalculatedRevalidationTask extends CreateRevalidationTaskInput {
  metadata?: RevalidationTaskMetadata;
}

const DEFAULT_THRESHOLDS = {
  pecosDays: 180,
  medicaidDays: 120,
  licenseDays: 90,
  deaDays: 60,
  boardDays: 120,
};

export function calculateRevalidationTasks(
  input: RevalidationCalculatorInput
): CalculatedRevalidationTask[] {
  const {
    clinicianId,
    pecos = [],
    medicaid = [],
    licenses = [],
    dea = [],
    boardCerts = [],
    referenceDate,
  } = input;

  const now = referenceDate ?? new Date();
  const tasks: CalculatedRevalidationTask[] = [];

  const pushTask = (task: CalculatedRevalidationTask) => {
    tasks.push({
      clinicianId,
      source: task.source ?? RevalidationTaskSource.SYSTEM,
      status: task.status,
      type: task.type,
      dueDate: task.dueDate,
      notes: task.notes,
      metadata: task.metadata,
    });
  };

  pecos.forEach((record) => {
    if (!record.revalidationDueDate) return;

    const { status, isRelevant } = evaluateDueStatus(
      record.revalidationDueDate,
      DEFAULT_THRESHOLDS.pecosDays,
      now
    );

    if (!isRelevant) return;

    pushTask({
      clinicianId,
      type: RevalidationTaskType.PECOS,
      dueDate: record.revalidationDueDate,
      status,
      notes: `PECOS revalidation due ${record.revalidationDueDate.toDateString()}`,
      metadata: {
        category: 'PECOS',
        referenceId: record.enrollmentId,
        payerName: record.payerName,
        details: {
          cycle: record.cycle,
          status: record.status,
        },
      },
    });
  });

  medicaid.forEach((record) => {
    if (!record.revalidationDueDate) return;
    const { status, isRelevant } = evaluateDueStatus(
      record.revalidationDueDate,
      DEFAULT_THRESHOLDS.medicaidDays,
      now
    );
    if (!isRelevant) return;

    pushTask({
      clinicianId,
      type: RevalidationTaskType.MEDICAID,
      dueDate: record.revalidationDueDate,
      status,
      notes: `${record.program} revalidation due ${record.revalidationDueDate.toDateString()}`,
      metadata: {
        category: 'MEDICAID',
        referenceId: record.enrollmentId,
        payerName: record.program,
        details: {
          status: record.status,
        },
      },
    });
  });

  licenses.forEach((license) => {
    if (!license.expiresAt) return;
    const { status, isRelevant } = evaluateDueStatus(
      license.expiresAt,
      DEFAULT_THRESHOLDS.licenseDays,
      now
    );
    if (!isRelevant) return;

    pushTask({
      clinicianId,
      type: RevalidationTaskType.CREDENTIALING,
      dueDate: license.expiresAt,
      status,
      notes: `${license.state} medical license ${status === RevalidationTaskStatus.OVERDUE ? 'expired' : 'expiring'} ${license.expiresAt.toDateString()}`,
      metadata: {
        category: 'STATE_LICENSE',
        referenceId: `${license.state}-${license.licenseNumber}`,
        state: license.state,
        evidenceUrl: license.evidenceUrl,
        details: {
          licenseNumber: license.licenseNumber,
          board: license.board,
          status: license.status,
        },
      },
    });
  });

  dea.forEach((reg) => {
    if (!reg.expiresAt) return;
    const { status, isRelevant } = evaluateDueStatus(
      reg.expiresAt,
      DEFAULT_THRESHOLDS.deaDays,
      now
    );
    if (!isRelevant) return;

    pushTask({
      clinicianId,
      type: RevalidationTaskType.CREDENTIALING,
      dueDate: reg.expiresAt,
      status,
      notes: `DEA registration ${status === RevalidationTaskStatus.OVERDUE ? 'expired' : 'expiring'} ${reg.expiresAt.toDateString()}`,
      metadata: {
        category: 'DEA',
        referenceId: reg.registrationNumber,
        evidenceUrl: reg.evidenceUrl,
        details: {
          status: reg.status,
        },
      },
    });
  });

  boardCerts.forEach((cert) => {
    if (!cert.expiresAt) return;
    const { status, isRelevant } = evaluateDueStatus(
      cert.expiresAt,
      DEFAULT_THRESHOLDS.boardDays,
      now
    );
    if (!isRelevant) return;

    pushTask({
      clinicianId,
      type: RevalidationTaskType.CREDENTIALING,
      dueDate: cert.expiresAt,
      status,
      notes: `${cert.board} (${cert.specialty}) certification ${status === RevalidationTaskStatus.OVERDUE ? 'lapsed' : 'expiring'} ${cert.expiresAt.toDateString()}`,
      metadata: {
        category: 'BOARD',
        referenceId: `${cert.board}-${cert.specialty}`,
        specialty: cert.specialty,
        evidenceUrl: cert.evidenceUrl,
        details: {
          board: cert.board,
          status: cert.status,
        },
      },
    });
  });

  return tasks.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
}

function evaluateDueStatus(
  dueDate: Date,
  thresholdDays: number,
  now: Date
): { status: RevalidationTaskStatus; isRelevant: boolean } {
  const nowMs = now.getTime();
  const dueMs = dueDate.getTime();

  if (dueMs <= nowMs) {
    return { status: RevalidationTaskStatus.OVERDUE, isRelevant: true };
  }

  const diffDays = (dueMs - nowMs) / (1000 * 60 * 60 * 24);
  const isRelevant = diffDays <= thresholdDays;

  return {
    status: RevalidationTaskStatus.OPEN,
    isRelevant,
  };
}
