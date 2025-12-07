/**
 * B169B-REV-003: Nightly revalidation job
 *
 * Aggregates PECOS, license, DEA, and board data to compute upcoming tasks,
 * upserts rows, and sends notifications for items due within 30 days.
 */

import { PrismaClient } from '@prisma/client';
import {
  calculateRevalidationTasks,
  type RevalidationCalculatorInput,
  type PecosProviderStatus,
  type StateLicenseVerification,
  type DeaRegistration,
  type BoardCertificationRecord,
} from '../../services/revalidation/calc.js';
import {
  RevalidationTaskSource,
  type RevalidationTask,
} from '../../services/revalidation/models/RevalidationTask.js';
import {
  recordTaskNotification,
  shouldNotify,
  upsertRevalidationTask,
} from '../../services/revalidation/revalidationTaskService.js';
import { createNotification } from '../../services/notifications/notificationService.js';

const prisma = new PrismaClient();

export interface NightlyJobOptions {
  dryRun?: boolean;
  referenceDate?: Date;
}

export interface NightlyJobResult {
  success: boolean;
  cliniciansProcessed: number;
  tasksEvaluated: number;
  tasksUpserted: number;
  notificationsSent: number;
  errors: string[];
  startedAt: Date;
  finishedAt: Date;
}

interface ClinicianContext {
  id: string;
  userId: string;
  userName?: string | null;
  userEmail?: string | null;
}

type PecosProviderRow = {
  id: string;
  clinicianId: string;
  status: string | null;
  revalidationDate: Date | null;
  medicareId: string | null;
  enrollmentType: string;
  metadata: unknown;
};

type LicenseRow = {
  id: string;
  clinicianId: string;
  state: string;
  licenseNumber: string;
  status: string;
  expiryDate: Date | null;
  sourceMetadata: unknown;
};

type CredentialRow = {
  id: string;
  userId: string;
  type: string;
  status: string;
  expiresAt: Date | null;
  name: string | null;
  metadata: unknown;
};

export async function runNightlyRevalidationJob(
  options: NightlyJobOptions = {}
): Promise<NightlyJobResult> {
  const startedAt = new Date();
  const evaluationDate = options.referenceDate ?? new Date();
  const dryRun = options.dryRun ?? false;

  const result: NightlyJobResult = {
    success: true,
    cliniciansProcessed: 0,
    tasksEvaluated: 0,
    tasksUpserted: 0,
    notificationsSent: 0,
    errors: [],
    startedAt,
    finishedAt: startedAt,
  };

  try {
    const {
      clinicians,
      pecosProviders,
      licenses,
      credentialEvidence,
    } = await loadSourceData();

    if (clinicians.length === 0) {
      result.finishedAt = new Date();
      return result;
    }

    const clinicianByUser = new Map<string, ClinicianContext>();
    clinicians.forEach((c) => clinicianByUser.set(c.userId, c));

    const pecosByClinician = groupBy(pecosProviders, (p) => p.clinicianId);
    const licensesByClinician = groupBy(licenses, (l) => l.clinicianId);
    const { deaByClinician, boardByClinician } = projectCredentialEvidence(
      credentialEvidence,
      clinicianByUser
    );

    for (const clinician of clinicians) {
      result.cliniciansProcessed += 1;

      const calculatorInput: RevalidationCalculatorInput = {
        clinicianId: clinician.id,
        pecos: (pecosByClinician.get(clinician.id) ?? []).map(mapPecosRecord),
        licenses: (licensesByClinician.get(clinician.id) ?? []).map(mapLicenseRecord),
        dea: deaByClinician.get(clinician.id) ?? [],
        boardCerts: boardByClinician.get(clinician.id) ?? [],
        referenceDate: evaluationDate,
      };

      const tasks = calculateRevalidationTasks(calculatorInput);
      result.tasksEvaluated += tasks.length;

      if (dryRun || tasks.length === 0) continue;

      for (const task of tasks) {
        try {
          const persisted = await upsertRevalidationTask({
            ...task,
            clinicianId: clinician.id,
            source: task.source ?? RevalidationTaskSource.SYSTEM,
          });
          result.tasksUpserted += 1;

          if (clinician.userId && shouldNotify(persisted, evaluationDate)) {
            await recordTaskNotification(persisted.id);
            await sendNotification(clinician, persisted);
            result.notificationsSent += 1;
          }
        } catch (error) {
          result.errors.push(formatError(`Task upsert failed for clinician ${clinician.id}`, error));
          result.success = false;
        }
      }
    }
  } catch (error) {
    result.errors.push(formatError('Nightly revalidation job failed', error));
    result.success = false;
  } finally {
    result.finishedAt = new Date();
  }

  return result;
}

async function loadSourceData(): Promise<{
  clinicians: ClinicianContext[];
  pecosProviders: PecosProviderRow[];
  licenses: LicenseRow[];
  credentialEvidence: CredentialRow[];
}> {
  const [clinicians, pecosProviders, licenses, credentialEvidence] = await Promise.all([
    prisma.clinicianProfile.findMany({
      select: {
        id: true,
        userId: true,
        user: { select: { name: true, email: true } },
      },
    }),
    prisma.pECOSProvider.findMany({
      select: {
        id: true,
        clinicianId: true,
        status: true,
        revalidationDate: true,
        medicareId: true,
        enrollmentType: true,
        metadata: true,
      },
    }),
    prisma.stateLicenseVerification.findMany({
      select: {
        id: true,
        clinicianId: true,
        state: true,
        licenseNumber: true,
        status: true,
        expiryDate: true,
        sourceMetadata: true,
      },
    }),
    prisma.credential.findMany({
      where: {
        type: { in: ['DEARegistration', 'BoardCertification'] },
        status: { in: ['active', 'ACTIVE'] },
      },
      select: {
        id: true,
        userId: true,
        type: true,
        status: true,
        expiresAt: true,
        name: true,
        metadata: true,
      },
    }),
  ]);

  return {
    clinicians: clinicians.map((c) => ({
      id: c.id,
      userId: c.userId,
      userName: c.user?.name,
      userEmail: c.user?.email,
    })),
    pecosProviders,
    licenses,
    credentialEvidence,
  };
}

function projectCredentialEvidence(
  evidence: CredentialRow[],
  clinicianByUser: Map<string, ClinicianContext>
) {
  const deaByClinician = new Map<string, DeaRegistration[]>();
  const boardByClinician = new Map<string, BoardCertificationRecord[]>();

  for (const credential of evidence) {
    const clinician = clinicianByUser.get(credential.userId);
    if (!clinician) continue;

    const metadata = safeMetadata(credential.metadata);

    if (credential.type === 'DEARegistration') {
      const list = deaByClinician.get(clinician.id) ?? [];
      list.push({
        registrationNumber: metadata?.registrationNumber || credential.id,
        expiresAt: credential.expiresAt ?? undefined,
        status: normalizeCredentialStatus(credential.status),
        evidenceUrl: metadata?.documentUrl || metadata?.evidenceUrl,
      });
      deaByClinician.set(clinician.id, list);
      continue;
    }

    if (credential.type === 'BoardCertification') {
      const list = boardByClinician.get(clinician.id) ?? [];
      list.push({
        board: metadata?.board || metadata?.issuer || 'Board certification',
        specialty: metadata?.specialty || credential.name || 'Primary specialty',
        expiresAt: credential.expiresAt ?? undefined,
        status: normalizeCredentialStatus(credential.status) === 'ACTIVE' ? 'ACTIVE' : 'LAPSED',
        evidenceUrl: metadata?.documentUrl || metadata?.evidenceUrl,
      });
      boardByClinician.set(clinician.id, list);
    }
  }

  return { deaByClinician, boardByClinician };
}

async function sendNotification(clinician: ClinicianContext, task: RevalidationTask) {
  try {
    await createNotification(clinician.userId, 'revalidation.task_due', {
      taskId: task.id,
      clinicianId: task.clinicianId,
      dueDate: task.dueDate.toISOString(),
      type: task.type,
      status: task.status,
      notes: task.notes,
      metadata: task.metadata,
    });
  } catch (error) {
    console.warn(
      `[RevalidationNightly] Failed to send notification for clinician ${clinician.id}`,
      error
    );
  }
}

function mapPecosRecord(record: PecosProviderRow): PecosProviderStatus {
  const metadata = safeMetadata(record.metadata);
  return {
    enrollmentId: record.id,
    payerName: metadata?.payerName,
    revalidationDueDate: record.revalidationDate ?? undefined,
    cycle: metadata?.cycle ?? 'STANDARD',
    status: mapPecosStatus(record.status),
  };
}

function mapLicenseRecord(record: LicenseRow): StateLicenseVerification {
  const metadata = safeMetadata(record.sourceMetadata);
  return {
    state: record.state,
    licenseNumber: record.licenseNumber,
    expiresAt: record.expiryDate ?? undefined,
    status: mapLicenseStatus(record.status),
    board: metadata?.board,
    evidenceUrl: metadata?.evidenceUrl,
  };
}

function mapPecosStatus(status?: string | null): PecosProviderStatus['status'] {
  switch ((status || '').toUpperCase()) {
    case 'PENDING':
      return 'PENDING';
    case 'REJECTED':
    case 'DEACTIVATED':
      return 'DENIED';
    default:
      return 'APPROVED';
  }
}

function mapLicenseStatus(status?: string | null): StateLicenseVerification['status'] {
  switch ((status || '').toUpperCase()) {
    case 'EXPIRED':
      return 'EXPIRED';
    case 'SUSPENDED':
    case 'INACTIVE':
    case 'REVOKED':
      return 'SUSPENDED';
    default:
      return 'ACTIVE';
  }
}

function normalizeCredentialStatus(status?: string | null): 'ACTIVE' | 'SUSPENDED' {
  return (status || '').toUpperCase() === 'ACTIVE' ? 'ACTIVE' : 'SUSPENDED';
}

function safeMetadata(value: unknown): Record<string, any> | undefined {
  if (!value || typeof value !== 'object') {
    return undefined;
  }
  return value as Record<string, any>;
}

function formatError(message: string, error: unknown) {
  if (error instanceof Error) {
    return `${message}: ${error.message}`;
  }
  return `${message}: ${String(error)}`;
}

function groupBy<T, K>(items: T[], keyFn: (item: T) => K): Map<K, T[]> {
  const map = new Map<K, T[]>();
  for (const item of items) {
    const key = keyFn(item);
    const bucket = map.get(key) ?? [];
    bucket.push(item);
    map.set(key, bucket);
  }
  return map;
}

if (require.main === module) {
  runNightlyRevalidationJob()
    .then((res) => {
      console.log('[RevalidationNightly] Completed', {
        success: res.success,
        cliniciansProcessed: res.cliniciansProcessed,
        tasksEvaluated: res.tasksEvaluated,
        tasksUpserted: res.tasksUpserted,
        notificationsSent: res.notificationsSent,
        errors: res.errors,
      });
      process.exit(res.success ? 0 : 1);
    })
    .catch((error) => {
      console.error('[RevalidationNightly] Fatal error', error);
      process.exit(1);
    });
}
/**
 * B169B-REV-003: Nightly revalidation job
 *
 * Aggregates PECOS, license, DEA, and board data to compute upcoming tasks,
 * upserts rows, and sends notifications for items due within 30 days.
 */

import { PrismaClient } from '@prisma/client';
import {
  calculateRevalidationTasks,
  type RevalidationCalculatorInput,
  type PecosProviderStatus,
  type StateLicenseVerification,
  type DeaRegistration,
  type BoardCertificationRecord,
} from '../../services/revalidation/calc.js';
import {
  RevalidationTaskSource,
  type RevalidationTask,
} from '../../services/revalidation/models/RevalidationTask.js';
import {
  recordTaskNotification,
  shouldNotify,
  upsertRevalidationTask,
} from '../../services/revalidation/revalidationTaskService.js';
import { createNotification } from '../../services/notifications/notificationService.js';

const prisma = new PrismaClient();

export interface NightlyJobOptions {
  dryRun?: boolean;
  referenceDate?: Date;
}

export interface NightlyJobResult {
  success: boolean;
  cliniciansProcessed: number;
  tasksEvaluated: number;
  tasksUpserted: number;
  notificationsSent: number;
  errors: string[];
  startedAt: Date;
  finishedAt: Date;
}

interface ClinicianContext {
  id: string;
  userId: string;
  userName?: string | null;
  userEmail?: string | null;
}

type PecosProviderRow = {
  id: string;
  clinicianId: string;
  status: string | null;
  revalidationDate: Date | null;
  medicareId: string | null;
  enrollmentType: string;
  metadata: unknown;
};

type LicenseRow = {
  id: string;
  clinicianId: string;
  state: string;
  licenseNumber: string;
  status: string;
  expiryDate: Date | null;
  sourceMetadata: unknown;
};

type CredentialRow = {
  id: string;
  userId: string;
  type: string;
  status: string;
  expiresAt: Date | null;
  name: string | null;
  metadata: unknown;
};

export async function runNightlyRevalidationJob(
  options: NightlyJobOptions = {}
): Promise<NightlyJobResult> {
  const startedAt = new Date();
  const evaluationDate = options.referenceDate ?? new Date();
  const dryRun = options.dryRun ?? false;

  const result: NightlyJobResult = {
    success: true,
    cliniciansProcessed: 0,
    tasksEvaluated: 0,
    tasksUpserted: 0,
    notificationsSent: 0,
    errors: [],
    startedAt,
    finishedAt: startedAt,
  };

  try {
    const {
      clinicians,
      pecosProviders,
      licenses,
      credentialEvidence,
    } = await loadSourceData();

    if (clinicians.length === 0) {
      result.finishedAt = new Date();
      return result;
    }

    const clinicianByUser = new Map<string, ClinicianContext>();
    clinicians.forEach((c) => clinicianByUser.set(c.userId, c));

    const pecosByClinician = groupBy(pecosProviders, (p) => p.clinicianId);
    const licensesByClinician = groupBy(licenses, (l) => l.clinicianId);
    const { deaByClinician, boardByClinician } = projectCredentialEvidence(
      credentialEvidence,
      clinicianByUser
    );

    for (const clinician of clinicians) {
      result.cliniciansProcessed += 1;

      const calculatorInput: RevalidationCalculatorInput = {
        clinicianId: clinician.id,
        pecos: (pecosByClinician.get(clinician.id) ?? []).map(mapPecosRecord),
        licenses: (licensesByClinician.get(clinician.id) ?? []).map(mapLicenseRecord),
        dea: deaByClinician.get(clinician.id) ?? [],
        boardCerts: boardByClinician.get(clinician.id) ?? [],
        referenceDate: evaluationDate,
      };

      const tasks = calculateRevalidationTasks(calculatorInput);
      result.tasksEvaluated += tasks.length;

      if (dryRun || tasks.length === 0) continue;

      for (const task of tasks) {
        try {
          const persisted = await upsertRevalidationTask({
            ...task,
            clinicianId: clinician.id,
            source: task.source ?? RevalidationTaskSource.SYSTEM,
          });
          result.tasksUpserted += 1;

          if (clinician.userId && shouldNotify(persisted, evaluationDate)) {
            await recordTaskNotification(persisted.id);
            await sendNotification(clinician, persisted);
            result.notificationsSent += 1;
          }
        } catch (error) {
          result.errors.push(formatError(`Task upsert failed for clinician ${clinician.id}`, error));
          result.success = false;
        }
      }
    }
  } catch (error) {
    result.errors.push(formatError('Nightly revalidation job failed', error));
    result.success = false;
  } finally {
    result.finishedAt = new Date();
  }

  return result;
}

async function loadSourceData(): Promise<{
  clinicians: ClinicianContext[];
  pecosProviders: PecosProviderRow[];
  licenses: LicenseRow[];
  credentialEvidence: CredentialRow[];
}> {
  const [clinicians, pecosProviders, licenses, credentialEvidence] = await Promise.all([
    prisma.clinicianProfile.findMany({
      select: {
        id: true,
        userId: true,
        user: { select: { name: true, email: true } },
      },
    }),
    prisma.pECOSProvider.findMany({
      select: {
        id: true,
        clinicianId: true,
        status: true,
        revalidationDate: true,
        medicareId: true,
        enrollmentType: true,
        metadata: true,
      },
    }),
    prisma.stateLicenseVerification.findMany({
      select: {
        id: true,
        clinicianId: true,
        state: true,
        licenseNumber: true,
        status: true,
        expiryDate: true,
        sourceMetadata: true,
      },
    }),
    prisma.credential.findMany({
      where: {
        type: { in: ['DEARegistration', 'BoardCertification'] },
        status: { in: ['active', 'ACTIVE'] },
      },
      select: {
        id: true,
        userId: true,
        type: true,
        status: true,
        expiresAt: true,
        name: true,
        metadata: true,
      },
    }),
  ]);

  return {
    clinicians: clinicians.map((c) => ({
      id: c.id,
      userId: c.userId,
      userName: c.user?.name,
      userEmail: c.user?.email,
    })),
    pecosProviders,
    licenses,
    credentialEvidence,
  };
}

function projectCredentialEvidence(
  evidence: CredentialRow[],
  clinicianByUser: Map<string, ClinicianContext>
) {
  const deaByClinician = new Map<string, DeaRegistration[]>();
  const boardByClinician = new Map<string, BoardCertificationRecord[]>();

  for (const credential of evidence) {
    const clinician = clinicianByUser.get(credential.userId);
    if (!clinician) continue;

    const metadata = safeMetadata(credential.metadata);

    if (credential.type === 'DEARegistration') {
      const list = deaByClinician.get(clinician.id) ?? [];
      list.push({
        registrationNumber: metadata?.registrationNumber || credential.id,
        expiresAt: credential.expiresAt ?? undefined,
        status: normalizeCredentialStatus(credential.status),
        evidenceUrl: metadata?.documentUrl || metadata?.evidenceUrl,
      });
      deaByClinician.set(clinician.id, list);
      continue;
    }

    if (credential.type === 'BoardCertification') {
      const list = boardByClinician.get(clinician.id) ?? [];
      list.push({
        board: metadata?.board || metadata?.issuer || 'Board certification',
        specialty: metadata?.specialty || credential.name || 'Primary specialty',
        expiresAt: credential.expiresAt ?? undefined,
        status: normalizeCredentialStatus(credential.status) === 'ACTIVE' ? 'ACTIVE' : 'LAPSED',
        evidenceUrl: metadata?.documentUrl || metadata?.evidenceUrl,
      });
      boardByClinician.set(clinician.id, list);
    }
  }

  return { deaByClinician, boardByClinician };
}

async function sendNotification(clinician: ClinicianContext, task: RevalidationTask) {
  try {
    await createNotification(clinician.userId, 'revalidation.task_due', {
      taskId: task.id,
      clinicianId: task.clinicianId,
      dueDate: task.dueDate.toISOString(),
      type: task.type,
      status: task.status,
      notes: task.notes,
      metadata: task.metadata,
    });
  } catch (error) {
    console.warn(
      `[RevalidationNightly] Failed to send notification for clinician ${clinician.id}`,
      error
    );
  }
}

function mapPecosRecord(record: PecosProviderRow): PecosProviderStatus {
  const metadata = safeMetadata(record.metadata);
  return {
    enrollmentId: record.id,
    payerName: metadata?.payerName,
    revalidationDueDate: record.revalidationDate ?? undefined,
    cycle: metadata?.cycle ?? 'STANDARD',
    status: mapPecosStatus(record.status),
  };
}

function mapLicenseRecord(record: LicenseRow): StateLicenseVerification {
  const metadata = safeMetadata(record.sourceMetadata);
  return {
    state: record.state,
    licenseNumber: record.licenseNumber,
    expiresAt: record.expiryDate ?? undefined,
    status: mapLicenseStatus(record.status),
    board: metadata?.board,
    evidenceUrl: metadata?.evidenceUrl,
  };
}

function mapPecosStatus(status?: string | null): PecosProviderStatus['status'] {
  switch ((status || '').toUpperCase()) {
    case 'PENDING':
      return 'PENDING';
    case 'REJECTED':
    case 'DEACTIVATED':
      return 'DENIED';
    default:
      return 'APPROVED';
  }
}

function mapLicenseStatus(status?: string | null): StateLicenseVerification['status'] {
  switch ((status || '').toUpperCase()) {
    case 'EXPIRED':
      return 'EXPIRED';
    case 'SUSPENDED':
    case 'INACTIVE':
    case 'REVOKED':
      return 'SUSPENDED';
    default:
      return 'ACTIVE';
  }
}

function normalizeCredentialStatus(status?: string | null): 'ACTIVE' | 'SUSPENDED' {
  return (status || '').toUpperCase() === 'ACTIVE' ? 'ACTIVE' : 'SUSPENDED';
}

function safeMetadata(value: unknown): Record<string, any> | undefined {
  if (!value || typeof value !== 'object') {
    return undefined;
  }
  return value as Record<string, any>;
}

function formatError(message: string, error: unknown) {
  if (error instanceof Error) {
    return `${message}: ${error.message}`;
  }
  return `${message}: ${String(error)}`;
}

function groupBy<T, K>(items: T[], keyFn: (item: T) => K): Map<K, T[]> {
  const map = new Map<K, T[]>();
  for (const item of items) {
    const key = keyFn(item);
    const bucket = map.get(key) ?? [];
    bucket.push(item);
    map.set(key, bucket);
  }
  return map;
}

if (require.main === module) {
  runNightlyRevalidationJob()
    .then((res) => {
      console.log('[RevalidationNightly] Completed', {
        success: res.success,
        cliniciansProcessed: res.cliniciansProcessed,
        tasksEvaluated: res.tasksEvaluated,
        tasksUpserted: res.tasksUpserted,
        notificationsSent: res.notificationsSent,
        errors: res.errors,
      });
      process.exit(res.success ? 0 : 1);
    })
    .catch((error) => {
      console.error('[RevalidationNightly] Fatal error', error);
      process.exit(1);
    });
}
/**
 * B169B-REV-003: Nightly revalidation job
 *
 * Aggregates PECOS, license, DEA, and board evidence to compute upcoming tasks,
 * upserts `RevalidationTask` rows, and notifies clinicians when due within 30 days.
 */

import { PrismaClient } from '@prisma/client';
import {
  calculateRevalidationTasks,
  type DeaRegistration,
  type BoardCertificationRecord,
  type StateLicenseVerification,
  type PecosProviderStatus,
  type RevalidationCalculatorInput,
} from '../../services/revalidation/calc.js';
import {
  RevalidationTaskSource,
  type RevalidationTask,
  type RevalidationTaskMetadata,
} from '../../services/revalidation/models/RevalidationTask.js';
import {
  recordTaskNotification,
  shouldNotify,
  upsertRevalidationTask,
} from '../../services/revalidation/revalidationTaskService.js';
import { createNotification } from '../../services/notifications/notificationService.js';

const prisma = new PrismaClient();

export interface NightlyJobOptions {
  dryRun?: boolean;
  referenceDate?: Date;
}

export interface NightlyJobResult {
  success: boolean;
  cliniciansProcessed: number;
  tasksEvaluated: number;
  tasksUpserted: number;
  notificationsSent: number;
  errors: string[];
  startedAt: Date;
  finishedAt: Date;
}

interface ClinicianContext {
  id: string;
  userId: string;
  userName?: string | null;
  userEmail?: string | null;
}

export async function runNightlyRevalidationJob(
  options: NightlyJobOptions = {}
): Promise<NightlyJobResult> {
  const startedAt = new Date();
  const evaluationDate = options.referenceDate ?? new Date();
  const dryRun = options.dryRun ?? false;

  const result: NightlyJobResult = {
    success: true,
    cliniciansProcessed: 0,
    tasksEvaluated: 0,
    tasksUpserted: 0,
    notificationsSent: 0,
    errors: [],
    startedAt,
    finishedAt: startedAt,
  };

  try {
    const {
      clinicians,
      pecosProviders,
      stateLicenses,
      credentialEvidence,
    } = await loadSourceData();

    if (clinicians.length === 0) {
      result.finishedAt = new Date();
      return result;
    }

    const clinicianByUserId = new Map<string, ClinicianContext>();
    clinicians.forEach((clinician) => {
      clinicianByUserId.set(clinician.userId, clinician);
    });

    const pecosByClinician = groupBy(pecosProviders, (p) => p.clinicianId);
    const licensesByClinician = groupBy(stateLicenses, (l) => l.clinicianId);
    const { deaByClinician, boardByClinician } = projectCredentialEvidence(
      credentialEvidence,
      clinicianByUserId
    );

    for (const clinician of clinicians) {
      result.cliniciansProcessed += 1;

      const calculatorInput: RevalidationCalculatorInput = {
        clinicianId: clinician.id,
        pecos: pecosByClinician.get(clinician.id) ?? [],
        licenses: licensesByClinician.get(clinician.id) ?? [],
        dea: deaByClinician.get(clinician.id) ?? [],
        boardCerts: boardByClinician.get(clinician.id) ?? [],
        referenceDate: evaluationDate,
      };

      const tasks = calculateRevalidationTasks(calculatorInput);
      result.tasksEvaluated += tasks.length;

      if (dryRun || tasks.length === 0) {
        continue;
      }

      for (const task of tasks) {
        try {
          const persisted = await upsertRevalidationTask({
            ...task,
            clinicianId: clinician.id,
            source: task.source ?? RevalidationTaskSource.SYSTEM,
          });
          result.tasksUpserted += 1;

          if (clinician.userId && shouldNotify(persisted, evaluationDate)) {
            await recordTaskNotification(persisted.id);
            await safeCreateNotification(clinician, persisted);
            result.notificationsSent += 1;
          }
        } catch (error) {
          const message = formatError(
            `Failed to upsert task for clinician ${clinician.id}`,
            error
          );
          result.errors.push(message);
          result.success = false;
        }
      }
    }
  } catch (error) {
    result.errors.push(formatError('Nightly revalidation job failed', error));
    result.success = false;
  } finally {
    result.finishedAt = new Date();
  }

  return result;
}

async function loadSourceData() {
  const [clinicians, pecosProviders, stateLicenses, credentialEvidence] = await Promise.all([
    prisma.clinicianProfile.findMany({
      select: {
        id: true,
        userId: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    }),
    prisma.pECOSProvider.findMany({
      select: {
        id: true,
        clinicianId: true,
        medicareId: true,
        status: true,
        enrollmentType: true,
        revalidationDate: true,
        metadata: true,
      },
    }),
    prisma.stateLicenseVerification.findMany({
      select: {
        id: true,
        clinicianId: true,
        state: true,
        licenseNumber: true,
        status: true,
        expiryDate: true,
        sourceMetadata: true,
      },
    }),
    prisma.credential.findMany({
      where: {
        type: {
          in: ['DEARegistration', 'BoardCertification'],
        },
        status: {
          in: ['active', 'ACTIVE'],
        },
      },
      select: {
        id: true,
        userId: true,
        type: true,
        status: true,
        expiresAt: true,
        name: true,
        metadata: true,
      },
    }),
  ]);

  return {
    clinicians: clinicians.map<ClinicianContext>((clinician) => ({
      id: clinician.id,
      userId: clinician.userId,
      userName: clinician.user?.name,
      userEmail: clinician.user?.email,
    })),
    pecosProviders: pecosProviders.map<PecosProviderStatus>((record) => ({
      enrollmentId: record.id,
      payerName: safeMetadata(record.metadata)?.payerName,
      revalidationDueDate: record.revalidationDate ?? undefined,
      cycle: safeMetadata(record.metadata)?.cycle ?? 'STANDARD',
      status: mapPecosStatus(record.status),
    })),
    stateLicenses: stateLicenses.map<StateLicenseVerification>((license) => ({
      state: license.state,
      licenseNumber: license.licenseNumber,
      expiresAt: license.expiryDate ?? undefined,
      status: mapLicenseStatus(license.status),
      board: safeMetadata(license.sourceMetadata)?.board,
      evidenceUrl: safeMetadata(license.sourceMetadata)?.evidenceUrl,
    })),
    credentialEvidence,
  };
}

function projectCredentialEvidence(
  credentialEvidence: Array<{
    id: string;
    userId: string;
    type: string;
    status: string;
    expiresAt: Date | null;
    name: string | null;
    metadata: unknown;
  }>,
  clinicianByUserId: Map<string, ClinicianContext>
) {
  const deaByClinician = new Map<string, DeaRegistration[]>();
  const boardByClinician = new Map<string, BoardCertificationRecord[]>();

  for (const credential of credentialEvidence) {
    const clinician = clinicianByUserId.get(credential.userId);
    if (!clinician) continue;

    const metadata = safeMetadata(credential.metadata);

    if (credential.type === 'DEARegistration') {
      const list = deaByClinician.get(clinician.id) ?? [];
      list.push({
        registrationNumber: metadata?.registrationNumber || credential.id,
        expiresAt: credential.expiresAt ?? undefined,
        status: normalizeCredentialStatus(credential.status),
        evidenceUrl: metadata?.documentUrl || metadata?.evidenceUrl,
      });
      deaByClinician.set(clinician.id, list);
      continue;
    }

    if (credential.type === 'BoardCertification') {
      const list = boardByClinician.get(clinician.id) ?? [];
      list.push({
        board: metadata?.board || metadata?.issuer || 'Board Certification',
        specialty: metadata?.specialty || credential.name || 'Primary Specialty',
        expiresAt: credential.expiresAt ?? undefined,
        status: normalizeCredentialStatus(credential.status) === 'ACTIVE' ? 'ACTIVE' : 'LAPSED',
        evidenceUrl: metadata?.documentUrl || metadata?.evidenceUrl,
      });
      boardByClinician.set(clinician.id, list);
    }
  }

  return { deaByClinician, boardByClinician };
}

async function safeCreateNotification(clinician: ClinicianContext, task: RevalidationTask) {
  try {
    await createNotification(clinician.userId, 'revalidation.task_due', {
      taskId: task.id,
      clinicianId: task.clinicianId,
      dueDate: task.dueDate.toISOString(),
      type: task.type,
      status: task.status,
      notes: task.notes,
      metadata: task.metadata,
    });
  } catch (error) {
    console.warn(
      `[RevalidationNightly] Failed to enqueue notification for clinician ${clinician.id}`,
      error
    );
  }
}

function safeMetadata(value: unknown): (RevalidationTaskMetadata & Record<string, any>) | undefined {
  if (!value || typeof value !== 'object') {
    return undefined;
  }
  return value as Record<string, any>;
}

function mapPecosStatus(status?: string | null): PecosProviderStatus['status'] {
  switch ((status || '').toUpperCase()) {
    case 'PENDING':
      return 'PENDING';
    case 'REJECTED':
    case 'DEACTIVATED':
      return 'DENIED';
    default:
      return 'APPROVED';
  }
}

function mapLicenseStatus(status?: string | null): StateLicenseVerification['status'] {
  switch ((status || '').toUpperCase()) {
    case 'EXPIRED':
      return 'EXPIRED';
    case 'SUSPENDED':
    case 'REVOKED':
    case 'INACTIVE':
      return 'SUSPENDED';
    default:
      return 'ACTIVE';
  }
}

function normalizeCredentialStatus(status?: string | null): 'ACTIVE' | 'SUSPENDED' {
  return (status || '').toUpperCase() === 'ACTIVE' ? 'ACTIVE' : 'SUSPENDED';
}

function formatError(message: string, error: unknown) {
  if (error instanceof Error) {
    return `${message}: ${error.message}`;
  }
  return `${message}: ${String(error)}`;
}

function groupBy<T, K>(items: T[], keyFn: (item: T) => K): Map<K, T[]> {
  const map = new Map<K, T[]>();
  for (const item of items) {
    const key = keyFn(item);
    const arr = map.get(key) ?? [];
    arr.push(item);
    map.set(key, arr);
  }
  return map;
}

if (require.main === module) {
  runNightlyRevalidationJob()
    .then((res) => {
      console.log('[RevalidationNightly] Completed', {
        success: res.success,
        cliniciansProcessed: res.cliniciansProcessed,
        tasksEvaluated: res.tasksEvaluated,
        tasksUpserted: res.tasksUpserted,
        notificationsSent: res.notificationsSent,
        errors: res.errors,
      });
      process.exit(res.success ? 0 : 1);
    })
    .catch((error) => {
      console.error('[RevalidationNightly] Fatal error', error);
      process.exit(1);
    });
}
/**
 * B169B-REV-003: Nightly revalidation job
 *
 * - Pulls clinician credential data
 * - Runs calculator to determine tasks
 * - Creates/updates RevalidationTask rows
 * - Sends notifications for tasks due within 30 days
 */

import { PrismaClient, Prisma } from '@prisma/client';
import {
  calculateRevalidationTasks,
  CalculatedRevalidationTask,
  RevalidationCalculatorInput,
} from '../../services/revalidation/calc.js';
import { createNotification } from '../../services/notifications/notificationService.js';
import {
  RevalidationTask,
  RevalidationTaskType,
} from '../../services/revalidation/models/RevalidationTask.js';
import { shouldNotify } from '../../services/revalidation/revalidationTaskService.js';

const prisma = new PrismaClient();

export interface NightlyRevalidationJobResult {
  processedClinicians: number;
  tasksCreated: number;
  tasksUpdated: number;
  notificationsSent: number;
  errors: string[];
  startedAt: Date;
  finishedAt: Date;
}

interface ClinicianContext {
  id: string;
  userId: string;
  npi: string;
  state: string;
}

export async function runNightlyRevalidationJob(): Promise<NightlyRevalidationJobResult> {
  const startedAt = new Date();
  const summary: NightlyRevalidationJobResult = {
    processedClinicians: 0,
    tasksCreated: 0,
    tasksUpdated: 0,
    notificationsSent: 0,
    errors: [],
    startedAt,
    finishedAt: startedAt,
  };

  const clinicians = await prisma.clinicianProfile.findMany({
    select: {
      id: true,
      userId: true,
      npi: true,
      state: true,
    },
  });

  for (const clinician of clinicians) {
    summary.processedClinicians += 1;

    try {
      const inputs = await buildCalculatorInput(clinician);
      const calculated = calculateRevalidationTasks(inputs);
      const existingTasks = await prisma.revalidationTask.findMany({
        where: { clinicianId: clinician.userId },
      });

      const { created, updated, notifications } = await syncTasksForClinician(
        clinician.userId,
        calculated,
        existingTasks
      );

      summary.tasksCreated += created;
      summary.tasksUpdated += updated;
      summary.notificationsSent += notifications;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown error while processing clinician';
      summary.errors.push(`Clinician ${clinician.id}: ${message}`);
      console.error('[RevalidationNightly] Error processing clinician', clinician.id, error);
    }
  }

  summary.finishedAt = new Date();
  return summary;
}

async function buildCalculatorInput(clinician: ClinicianContext): Promise<RevalidationCalculatorInput> {
  const [pecosEnrollments, privilegeGrants] = await Promise.all([
    prisma.payerEnrollment.findMany({
      where: {
        clinicianDid: clinician.userId,
        status: 'APPROVED',
        revalidationDueAt: { not: null },
      },
      select: {
        id: true,
        payer: {
          select: { name: true },
        },
        revalidationDueAt: true,
        pecosEnrollmentId: true,
        pecosStatus: true,
      },
    }),
    prisma.privilegeGranted.findMany({
      where: {
        clinicianDid: clinician.userId,
      },
      select: {
        id: true,
        privilegeSetId: true,
        expiresAt: true,
      },
    }),
  ]);

  return {
    clinicianId: clinician.userId,
    npi: clinician.npi,
    pecos: pecosEnrollments
      .filter((rec) => rec.revalidationDueAt)
      .map((rec) => ({
        enrollmentId: rec.pecosEnrollmentId ?? rec.id,
        payerName: rec.payer?.name,
        revalidationDueDate: rec.revalidationDueAt ?? undefined,
        status: rec.pecosStatus ?? undefined,
      })),
    licenses: privilegeGrants
      .filter((grant) => Boolean(grant.expiresAt))
      .map((grant) => ({
        state: clinician.state,
        licenseNumber: grant.privilegeSetId ?? grant.id,
        expiresAt: grant.expiresAt ?? undefined,
        status: grant.expiresAt && grant.expiresAt < new Date() ? 'EXPIRED' : 'ACTIVE',
      })),
  };
}

async function syncTasksForClinician(
  clinicianId: string,
  calculated: CalculatedRevalidationTask[],
  existingTasks: (RevalidationTask & { metadata: Prisma.JsonValue | null })[]
): Promise<{ created: number; updated: number; notifications: number }> {
  let created = 0;
  let updated = 0;
  let notifications = 0;

  const existingMap = new Map<string, RevalidationTask & { metadata: Prisma.JsonValue | null }>();
  existingTasks.forEach((task) => {
    existingMap.set(buildTaskKey(task.type, task.metadata, task.dueDate), task);
  });

  for (const task of calculated) {
    const key = buildTaskKey(task.type, task.metadata, task.dueDate);
    const existing = existingMap.get(key);

    if (!existing) {
      const createdTask = await prisma.revalidationTask.create({
        data: mapTaskToPrisma(clinicianId, task),
      });
      created += 1;
      notifications += (await maybeNotifyTask(createdTask, clinicianId)) ? 1 : 0;
      continue;
    }

    const needUpdate =
      existing.status !== task.status ||
      existing.dueDate.getTime() !== task.dueDate.getTime() ||
      existing.notes !== task.notes ||
      !metadataMatches(existing.metadata, task.metadata);

    if (needUpdate) {
      const updatedTask = await prisma.revalidationTask.update({
        where: { id: existing.id },
        data: mapTaskToPrisma(clinicianId, task),
      });
      updated += 1;
      notifications += (await maybeNotifyTask(updatedTask, clinicianId)) ? 1 : 0;
    } else if (shouldNotify(existing as RevalidationTask)) {
      notifications += (await maybeNotifyTask(existing as RevalidationTask, clinicianId)) ? 1 : 0;
    }
  }

  return { created, updated, notifications };
}

function mapTaskToPrisma(clinicianId: string, task: CalculatedRevalidationTask) {
  return {
    clinicianId,
    type: task.type,
    dueDate: task.dueDate,
    status: task.status,
    source: task.source ?? undefined,
    notes: task.notes,
    metadata: task.metadata as Prisma.InputJsonValue,
  };
}

function metadataMatches(existing: Prisma.JsonValue | null, incoming?: RevalidationTask['metadata']) {
  if (!existing && !incoming) return true;
  if (!existing || !incoming) return false;
  const existingObj = existing as Record<string, unknown>;
  return (
    existingObj?.referenceId === incoming?.referenceId &&
    existingObj?.category === incoming?.category &&
    existingObj?.payerName === incoming?.payerName
  );
}

function buildTaskKey(
  type: RevalidationTaskType,
  metadata: Prisma.JsonValue | RevalidationTask['metadata'] | null | undefined,
  dueDate: Date
): string {
  if (metadata && typeof metadata === 'object' && metadata !== null) {
    const record = metadata as Record<string, unknown>;
    if (typeof record.referenceId === 'string') {
      return `${type}:${record.referenceId}`;
    }
    if (typeof record.category === 'string') {
      return `${type}:${record.category}`;
    }
  }
  return `${type}:${dueDate.toISOString()}`;
}

async function maybeNotifyTask(task: RevalidationTask, userId: string): Promise<boolean> {
  if (!shouldNotify(task)) return false;

  await createNotification(userId, 'REVALIDATION_TASK_DUE', {
    taskId: task.id,
    type: task.type,
    dueDate: task.dueDate,
    status: task.status,
    notes: task.notes,
  });

  await prisma.revalidationTask.update({
    where: { id: task.id },
    data: {
      lastNotifiedAt: new Date(),
      notificationCount: { increment: 1 },
    },
  });

  return true;
}

if (require.main === module) {
  runNightlyRevalidationJob()
    .then((result) => {
      console.log('[RevalidationNightly] Job finished', result);
      process.exit(0);
    })
    .catch((error) => {
      console.error('[RevalidationNightly] Job failed', error);
      process.exit(1);
    });
}

