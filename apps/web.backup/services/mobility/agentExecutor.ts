import { PrismaClient } from '@prisma/client';
import { MobilityEngineResult } from './engine.js';
import { npdbService } from '../privileging/npdbIntegration.js';
import { runPSV } from '../psv/psvOrchestrator.js';
import { determineIMLCEligibility } from '../compacts/imlcEngine.js';
import type { LicenseHistory } from '../compacts/models/IMLCEligibility.js';
import { bootstrapEhrPrivileges } from './ehrBootstrap.js';

const prisma = new PrismaClient();

export type MobilityAgentTaskType = 'npdb' | 'license' | 'compact' | 'ehr';

export interface MobilityAgentTaskResult {
  task: MobilityAgentTaskType;
  status: 'skipped' | 'success' | 'failed';
  detail: string;
  error?: string;
  metadata?: Record<string, unknown>;
  referenceIds?: string[];
}

export interface MobilityAgentExecutorOptions {
  clinicianId: string;
  sourceOrgId: string;
  targetOrgId: string;
  plan: MobilityEngineResult;
  privilegeSetIds?: string[];
}

export interface MobilityAgentExecutionResult {
  tasks: MobilityAgentTaskResult[];
  startedAt: string;
  finishedAt: string;
}

export async function executeMobilityAgentPlan(
  options: MobilityAgentExecutorOptions
): Promise<MobilityAgentExecutionResult> {
  const startedAt = new Date();
  const tasks: MobilityAgentTaskResult[] = [];

  const clinician = await prisma.clinicianProfile.findUnique({
    where: { id: options.clinicianId },
    include: { user: true },
  });

  if (!clinician) {
    throw new Error(`Clinician ${options.clinicianId} not found`);
  }

  const targetOrg = await prisma.partnerConfig.findUnique({
    where: { id: options.targetOrgId },
  });

  if (!targetOrg) {
    throw new Error(`Org ${options.targetOrgId} not found`);
  }

  const licenseRecords = await prisma.stateLicenseVerification.findMany({
    where: { clinicianId: options.clinicianId },
    orderBy: { lastCheckedAt: 'desc' },
  });

  if (shouldRunNpdb(options.plan)) {
    tasks.push(await runNpdbRefreshTask(clinician, targetOrg.partnerName));
  } else {
    tasks.push({
      task: 'npdb',
      status: 'skipped',
      detail: 'NPDB refresh not required by plan',
    });
  }

  if (options.plan.categories.psv.status !== 'automaticallySatisfied') {
    tasks.push(await runLicenseRecheckTask(clinician, targetOrg.id, licenseRecords));
  } else {
    tasks.push({
      task: 'license',
      status: 'skipped',
      detail: 'PSV already fresh',
    });
  }

  if (options.plan.categories.enrollment.status !== 'automaticallySatisfied') {
    tasks.push(await runCompactRefreshTask(clinician, licenseRecords));
  } else {
    tasks.push({
      task: 'compact',
      status: 'skipped',
      detail: 'Enrollment satisfied; compact refresh unnecessary',
    });
  }

  if (
    options.privilegeSetIds &&
    options.privilegeSetIds.length > 0 &&
    options.plan.categories.privileges.status === 'automaticallySatisfied'
  ) {
    tasks.push(await runEhrSyncTask(options, clinician));
  } else {
    tasks.push({
      task: 'ehr',
      status: 'skipped',
      detail:
        !options.privilegeSetIds || options.privilegeSetIds.length === 0
          ? 'No privilege sets supplied for EHR bootstrap'
          : 'Privileges not ready for EHR sync',
    });
  }

  return {
    tasks,
    startedAt: startedAt.toISOString(),
    finishedAt: new Date().toISOString(),
  };
}

function shouldRunNpdb(plan: MobilityEngineResult): boolean {
  return (
    plan.categories.privileges.status !== 'automaticallySatisfied' ||
    plan.categories.compliance.status !== 'automaticallySatisfied'
  );
}

async function runNpdbRefreshTask(
  clinician: { npi: string | null; user: { did: string | null; name: string | null } | null },
  requestingOrganization: string
): Promise<MobilityAgentTaskResult> {
  if (!clinician.npi) {
    return {
      task: 'npdb',
      status: 'skipped',
      detail: 'Clinician missing NPI; cannot run NPDB query',
    };
  }

  const [firstName, ...rest] = (clinician.user?.name ?? '').split(' ').filter(Boolean);
  const lastName = rest.pop() ?? firstName ?? '';

  try {
    const result = await npdbService.queryNPDB({
      npi: clinician.npi,
      firstName,
      lastName,
      requestingOrganization,
      requestingOfficer: 'MobilityAgent',
      purpose: 'renewal',
    });

    return {
      task: 'npdb',
      status: 'success',
      detail: result.status === 'clear' ? 'NPDB query clear' : `NPDB status: ${result.status}`,
      metadata: {
        queryId: result.queryId,
        adverseActions: result.adverseActions.length,
      },
    };
  } catch (error) {
    return {
      task: 'npdb',
      status: 'failed',
      detail: 'NPDB query failed',
      error: error instanceof Error ? error.message : 'Unknown NPDB error',
    };
  }
}

async function runLicenseRecheckTask(
  clinician: {
    id: string;
    npi: string | null;
    user: { did: string | null } | null;
    state: string;
  },
  orgId: string,
  licenseRecords: Array<{
    state: string;
    licenseNumber: string;
    status: string;
  }>
): Promise<MobilityAgentTaskResult> {
  if (!clinician.npi) {
    return {
      task: 'license',
      status: 'skipped',
      detail: 'Clinician missing NPI; cannot rerun PSV',
    };
  }

  const activeLicense =
    licenseRecords.find((record) => record.state === clinician.state && record.status === 'ACTIVE') ??
    licenseRecords.find((record) => record.status === 'ACTIVE');

  if (!activeLicense) {
    return {
      task: 'license',
      status: 'skipped',
      detail: 'No active license on file for PSV rerun',
    };
  }

  try {
    const result = await runPSV({
      clinicianId: clinician.id,
      clinicianDid: clinician.user?.did ?? undefined,
      orgId,
      npi: clinician.npi,
      state: activeLicense.state,
      licenseNumber: activeLicense.licenseNumber,
    });

    if ('psvResultId' in result) {
      return {
        task: 'license',
        status: 'success',
        detail: `PSV rerun complete with status ${result.overallStatus}`,
        referenceIds: [result.psvResultId],
      };
    }

    return {
      task: 'license',
      status: 'failed',
      detail: `PSV rerun failed: ${result.error}`,
    };
  } catch (error) {
    return {
      task: 'license',
      status: 'failed',
      detail: 'PSV rerun failed',
      error: error instanceof Error ? error.message : 'Unknown PSV error',
    };
  }
}

async function runCompactRefreshTask(
  clinician: {
    user: { did: string | null } | null;
    state: string;
  },
  licenseRecords: Array<{
    state: string;
    licenseNumber: string;
    issueDate: Date | null;
    expiryDate: Date | null;
    status: string;
    disciplinaryFlag: boolean;
  }>
): Promise<MobilityAgentTaskResult> {
  if (!clinician.user?.did) {
    return {
      task: 'compact',
      status: 'skipped',
      detail: 'Clinician DID unavailable; cannot compute compact eligibility',
    };
  }

  const licenseHistory: LicenseHistory[] = licenseRecords.map((record) => ({
    state: record.state,
    licenseNumber: record.licenseNumber,
    issueDate: (record.issueDate ?? new Date()).toISOString(),
    expirationDate: record.expiryDate?.toISOString(),
    status: record.status.toLowerCase() as LicenseHistory['status'],
    isPrimary: record.state === clinician.state,
    disciplinaryActions: record.disciplinaryFlag
      ? [
          {
            date: new Date().toISOString(),
            type: 'disciplinary',
            description: 'Flagged by state board',
          },
        ]
      : undefined,
  }));

  try {
    const imlcResult = await determineIMLCEligibility(clinician.user.did, clinician.state, licenseHistory);

    await prisma.iMLCEligibility.upsert({
      where: { clinicianDid: clinician.user.did },
      update: {
        homeState: imlcResult.homeState,
        compactStates: imlcResult.compactStates,
        status: imlcResult.status,
        licenseHistory: imlcResult.licenseHistory ?? [],
        metadata: imlcResult.metadata ?? {},
        lastCheckedAt: new Date(),
      },
      create: {
        clinicianDid: clinician.user.did,
        homeState: imlcResult.homeState,
        compactStates: imlcResult.compactStates,
        status: imlcResult.status,
        licenseHistory: imlcResult.licenseHistory ?? [],
        metadata: imlcResult.metadata ?? {},
        lastCheckedAt: new Date(),
      },
    });

    await prisma.compactsStatus.upsert({
      where: { clinicianDid: clinician.user.did },
      update: {
        imlcStatus: imlcResult.status,
        imlcHomeState: imlcResult.homeState,
        imlcCompactStates: imlcResult.compactStates,
        lastComputedAt: new Date(),
        nextRefreshAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
      create: {
        clinicianDid: clinician.user.did,
        imlcStatus: imlcResult.status,
        imlcHomeState: imlcResult.homeState,
        imlcCompactStates: imlcResult.compactStates,
        lastComputedAt: new Date(),
      },
    });

    return {
      task: 'compact',
      status: 'success',
      detail: `IMLC status updated to ${imlcResult.status}`,
      metadata: {
        homeState: imlcResult.homeState,
        compactStates: imlcResult.compactStates,
      },
    };
  } catch (error) {
    return {
      task: 'compact',
      status: 'failed',
      detail: 'Compact eligibility refresh failed',
      error: error instanceof Error ? error.message : 'Unknown compact error',
    };
  }
}

async function runEhrSyncTask(
  options: MobilityAgentExecutorOptions,
  clinician: { id: string; user: { did: string | null } | null }
): Promise<MobilityAgentTaskResult> {
  try {
    const result = await bootstrapEhrPrivileges({
      clinicianId: clinician.id,
      orgId: options.targetOrgId,
      privilegeSetIds: options.privilegeSetIds ?? [],
    });

    return {
      task: 'ehr',
      status: 'success',
      detail: result.message,
      metadata: {
        queued: result.queued,
      },
    };
  } catch (error) {
    return {
      task: 'ehr',
      status: 'failed',
      detail: 'EHR bootstrap failed',
      error: error instanceof Error ? error.message : 'Unknown EHR error',
    };
  }
}

