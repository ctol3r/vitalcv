import {
  CredentialTimelineEventType,
  TimelineEventSeverity,
  type ClinicianCompactWallet,
  type CompactsStatus,
} from '@prisma/client';
import { determineIMLCEligibility } from '../../compacts/imlcEngine';
import { determinePSYPACTEligibility } from '../../compacts/psyEngine';
import { determineCounselingCompactEligibility } from '../../compacts/counselingEngine';
import {
  recordCompactComputedEvent,
  recordCompactRefreshedEvent,
} from '../../audit/compactsEvents';
import {
  resolveClinicianContext,
  fetchStateLicenses,
  fetchClinicianCredentials,
  buildCheck,
  emitTimelineEvent,
  getPrismaClient,
} from './shared';
import type {
  AgentRoutineContext,
  AgentRoutineResult,
  RoutineActionRecommendation,
  RoutineCheckResult,
} from './types';

const prisma = getPrismaClient();

function toLicenseHistory(licenses: Awaited<ReturnType<typeof fetchStateLicenses>>) {
  return licenses.map(license => ({
    state: license.state,
    licenseNumber: license.licenseNumber,
    issueDate: license.issueDate ?? license.createdAt,
    expirationDate: license.expiryDate ?? undefined,
    status: license.status.toLowerCase(),
    isPrimary: license.state === license.issuingAuthority,
    disciplinaryActions: Array.isArray(license.disciplinaryHistory)
      ? (license.disciplinaryHistory as any[])
      : [],
  }));
}

function extractCredentialLicenses(
  credentials: Awaited<ReturnType<typeof fetchClinicianCredentials>>,
  targetType: string,
) {
  return credentials
    .filter(
      credential =>
        credential.type === targetType &&
        credential.status === 'active' &&
        (!credential.expiresAt || credential.expiresAt.getTime() > Date.now()),
    )
    .map(credential => {
      const metadata = (credential.metadata as Record<string, unknown> | null) ?? {};
      return {
        state: String(metadata.state ?? metadata.homeState ?? ''),
        licenseNumber: String(metadata.licenseNumber ?? credential.id),
        licenseType: String(metadata.licenseType ?? targetType),
        issueDate: credential.issuedAt ?? new Date(),
        expirationDate: credential.expiresAt ?? undefined,
        status: 'active',
        isPrimary: Boolean(metadata.isPrimary ?? true),
      };
    })
    .filter(license => license.state.length === 2);
}

function diffStates(previous: string[], current: string[]) {
  const prevSet = new Set(previous);
  const currSet = new Set(current);
  const added = current.filter(state => !prevSet.has(state));
  const removed = previous.filter(state => !currSet.has(state));
  return { added, removed };
}

async function upsertWalletEntry(options: {
  clinicianId: string;
  compactType: ClinicianCompactWallet['compactType'];
  homeState: string;
  states: string[];
  existing?: ClinicianCompactWallet;
  dryRun?: boolean;
}) {
  if (options.dryRun) {
    return;
  }

  if (options.existing) {
    await prisma.clinicianCompactWallet.update({
      where: { id: options.existing.id },
      data: {
        homeState: options.homeState,
        privileges: options.states,
      },
    });
    return;
  }

  await prisma.clinicianCompactWallet.create({
    data: {
      clinicianId: options.clinicianId,
      compactType: options.compactType,
      homeState: options.homeState,
      privileges: options.states,
    },
  });
}

export async function runAutoCompactRefreshRoutine(
  context: AgentRoutineContext,
): Promise<AgentRoutineResult> {
  const startedAt = new Date();
  const checks: RoutineCheckResult[] = [];
  const recommendations: RoutineActionRecommendation[] = [];

  try {
    const resolved = await resolveClinicianContext(context);
    if (!resolved.clinicianDid) {
      throw new Error('Clinician DID is required for compact refresh.');
    }

    const [licenses, credentials, currentStatus, walletEntries] = await Promise.all([
      fetchStateLicenses(resolved.clinicianId),
      fetchClinicianCredentials(resolved.userId),
      prisma.compactsStatus.findUnique({
        where: { clinicianDid: resolved.clinicianDid },
      }),
      prisma.clinicianCompactWallet.findMany({
        where: { clinicianId: resolved.clinicianId },
      }),
    ]);

    const licenseHistory = toLicenseHistory(licenses);
    const psychologyLicenses = extractCredentialLicenses(credentials, 'PsychologyLicense');
    const counselingLicenses = extractCredentialLicenses(credentials, 'CounselingLicense');

    const [imlcResult, psypactResult, counselingResult] = await Promise.all([
      determineIMLCEligibility(resolved.clinicianDid, resolved.state, licenseHistory),
      determinePSYPACTEligibility(
        resolved.clinicianDid,
        psychologyLicenses[0]?.state ?? resolved.state,
        psychologyLicenses,
      ),
      determineCounselingCompactEligibility(
        resolved.clinicianDid,
        counselingLicenses[0]?.state ?? resolved.state,
        counselingLicenses,
      ),
    ]);

    const now = new Date();
    const newStatusPayload = {
      clinicianDid: resolved.clinicianDid,
      imlcStatus: imlcResult?.status ?? 'NOT_ELIGIBLE',
      imlcHomeState: imlcResult?.homeState ?? resolved.state,
      imlcCompactStates: imlcResult?.compactStates ?? [],
      psypactStatus: psypactResult?.status ?? 'NOT_ELIGIBLE',
      psypactStates: psypactResult?.participatingStates ?? [],
      counselingStatus: counselingResult?.status ?? 'NOT_ELIGIBLE',
      counselingHomeState: counselingResult?.homeState ?? resolved.state,
      counselingStates: counselingResult?.compactStates ?? [],
      lastComputedAt: now,
      nextRefreshAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
    };

    const storedStatus = (await prisma.compactsStatus.upsert({
      where: { clinicianDid: resolved.clinicianDid },
      create: newStatusPayload,
      update: newStatusPayload,
    })) as CompactsStatus;

    if (currentStatus) {
      await recordCompactRefreshedEvent(
        prisma,
        resolved.clinicianDid,
        currentStatus,
        storedStatus,
      );
    } else {
      await recordCompactComputedEvent(prisma, resolved.clinicianDid, storedStatus);
    }

    const consentSet = resolved.compactConsents;
    const walletChanges: RoutineCheckResult[] = [];

    const walletMap = new Map(walletEntries.map(entry => [entry.compactType, entry]));
    const compactConfigs: Array<{
      type: ClinicianCompactWallet['compactType'];
      status: string;
      states: string[];
      homeState?: string | null;
      result: unknown;
    }> = [
      {
        type: 'IMLC',
        status: newStatusPayload.imlcStatus,
        states: newStatusPayload.imlcCompactStates,
        homeState: newStatusPayload.imlcHomeState,
        result: imlcResult,
      },
      {
        type: 'PSYPACT',
        status: newStatusPayload.psypactStatus,
        states: newStatusPayload.psypactStates,
        homeState: psypactResult?.primaryState ?? resolved.state,
        result: psypactResult,
      },
      {
        type: 'COUNSELING',
        status: newStatusPayload.counselingStatus,
        states: newStatusPayload.counselingStates,
        homeState: newStatusPayload.counselingHomeState,
        result: counselingResult,
      },
    ];

    for (const config of compactConfigs) {
      const consented = consentSet.has(config.type);
      const existing = walletMap.get(config.type);
      const previousStates = existing?.privileges ?? [];
      const diff = diffStates(previousStates, config.states);

      if (consented && (diff.added.length || diff.removed.length)) {
        await upsertWalletEntry({
          clinicianId: resolved.clinicianId,
          compactType: config.type,
          homeState: config.homeState ?? resolved.state,
          states: config.states,
          existing,
          dryRun: context.dryRun,
        });

        walletChanges.push(
          buildCheck({
            id: `wallet-${config.type}`,
            title: `${config.type} compact wallet`,
            status: diff.removed.length ? 'warning' : 'pass',
            summary:
              diff.added.length || diff.removed.length
                ? `Added ${diff.added.join(', ') || 'none'}, removed ${diff.removed.join(', ') || 'none'}.`
                : 'No wallet changes required.',
            evidence: {
              added: diff.added,
              removed: diff.removed,
            },
          }),
        );
      }

      if (!consented && config.status !== 'NOT_ELIGIBLE') {
        recommendations.push({
          id: `consent-${config.type}`,
          label: `Obtain ${config.type} compact consent`,
          detail: `${config.type} eligibility available but consent missing.`,
          type: 'task',
        });
      }

      checks.push(
        buildCheck({
          id: `status-${config.type}`,
          title: `${config.type} eligibility`,
          status: config.status === 'NOT_ELIGIBLE' ? 'warning' : 'pass',
          summary:
            config.status === 'NOT_ELIGIBLE'
              ? `${config.type} eligibility not met.`
              : `${config.states.length} states authorized.`,
          evidence: config.result as Record<string, unknown>,
        }),
      );
    }

    checks.push(...walletChanges);

    await emitTimelineEvent({
      clinicianId: resolved.clinicianId,
      eventType: CredentialTimelineEventType.COMPACT_ELIGIBILITY_UPDATED,
      severity: TimelineEventSeverity.INFO,
      metadata: {
        imlcStatus: newStatusPayload.imlcStatus,
        psypactStatus: newStatusPayload.psypactStatus,
        counselingStatus: newStatusPayload.counselingStatus,
      },
      dryRun: context.dryRun,
    });

    const summary = 'Compact eligibility refreshed and wallet synchronized.';
    return {
      routineId: 'auto-compact-refresh',
      clinicianId: resolved.clinicianId,
      clinicianDid: resolved.clinicianDid,
      npi: resolved.npi,
      startedAt,
      completedAt: new Date(),
      status: 'completed',
      summary,
      checks,
      recommendations,
    };
  } catch (error) {
    return {
      routineId: 'auto-compact-refresh',
      startedAt,
      completedAt: new Date(),
      status: 'failed',
      summary: 'Auto compact refresh routine failed',
      error: error instanceof Error ? error.message : 'Unexpected error',
      checks,
      recommendations,
    };
  }
}

import {
  CredentialTimelineEventType,
  TimelineEventSeverity,
  type ClinicianCompactWallet,
  type CompactsStatus,
} from '@prisma/client';
import { determineIMLCEligibility } from '../../compacts/imlcEngine';
import { determinePSYPACTEligibility } from '../../compacts/psyEngine';
import { determineCounselingCompactEligibility } from '../../compacts/counselingEngine';
import {
  recordCompactComputedEvent,
  recordCompactRefreshedEvent,
} from '../../audit/compactsEvents';
import {
  resolveClinicianContext,
  fetchStateLicenses,
  fetchClinicianCredentials,
  buildCheck,
  emitTimelineEvent,
  getPrismaClient,
} from './shared';
import type {
  AgentRoutineContext,
  AgentRoutineResult,
  RoutineActionRecommendation,
  RoutineCheckResult,
} from './types';

const prisma = getPrismaClient();

function toLicenseHistory(licenses: Awaited<ReturnType<typeof fetchStateLicenses>>) {
  return licenses.map(license => ({
    state: license.state,
    licenseNumber: license.licenseNumber,
    issueDate: license.issueDate ?? license.createdAt,
    expirationDate: license.expiryDate ?? undefined,
    status: license.status.toLowerCase(),
    isPrimary: license.state === license.issuingAuthority,
    disciplinaryActions: Array.isArray(license.disciplinaryHistory)
      ? (license.disciplinaryHistory as any[])
      : [],
  }));
}

function extractCredentialLicenses(
  credentials: Awaited<ReturnType<typeof fetchClinicianCredentials>>,
  targetType: string,
) {
  return credentials
    .filter(
      credential =>
        credential.type === targetType &&
        credential.status === 'active' &&
        (!credential.expiresAt || credential.expiresAt.getTime() > Date.now()),
    )
    .map(credential => {
      const metadata = (credential.metadata as Record<string, unknown> | null) ?? {};
      return {
        state: String(metadata.state ?? metadata.homeState ?? ''),
        licenseNumber: String(metadata.licenseNumber ?? credential.id),
        licenseType: String(metadata.licenseType ?? targetType),
        issueDate: credential.issuedAt ?? new Date(),
        expirationDate: credential.expiresAt ?? undefined,
        status: 'active',
        isPrimary: Boolean(metadata.isPrimary ?? true),
      };
    })
    .filter(license => license.state.length === 2);
}

function diffStates(previous: string[], current: string[]) {
  const prevSet = new Set(previous);
  const currSet = new Set(current);
  const added = current.filter(state => !prevSet.has(state));
  const removed = previous.filter(state => !currSet.has(state));
  return { added, removed };
}

async function upsertWalletEntry(options: {
  clinicianId: string;
  compactType: ClinicianCompactWallet['compactType'];
  homeState: string;
  states: string[];
  existing?: ClinicianCompactWallet;
  dryRun?: boolean;
}) {
  if (options.dryRun) {
    return;
  }

  if (options.existing) {
    await prisma.clinicianCompactWallet.update({
      where: { id: options.existing.id },
      data: {
        homeState: options.homeState,
        privileges: options.states,
      },
    });
    return;
  }

  await prisma.clinicianCompactWallet.create({
    data: {
      clinicianId: options.clinicianId,
      compactType: options.compactType,
      homeState: options.homeState,
      privileges: options.states,
    },
  });
}

export async function runAutoCompactRefreshRoutine(
  context: AgentRoutineContext,
): Promise<AgentRoutineResult> {
  const startedAt = new Date();
  const checks: RoutineCheckResult[] = [];
  const recommendations: RoutineActionRecommendation[] = [];

  try {
    const resolved = await resolveClinicianContext(context);
    if (!resolved.clinicianDid) {
      throw new Error('Clinician DID is required for compact refresh.');
    }

    const [licenses, credentials, currentStatus, walletEntries] = await Promise.all([
      fetchStateLicenses(resolved.clinicianId),
      fetchClinicianCredentials(resolved.userId),
      prisma.compactsStatus.findUnique({
        where: { clinicianDid: resolved.clinicianDid },
      }),
      prisma.clinicianCompactWallet.findMany({
        where: { clinicianId: resolved.clinicianId },
      }),
    ]);

    const licenseHistory = toLicenseHistory(licenses);
    const psychologyLicenses = extractCredentialLicenses(credentials, 'PsychologyLicense');
    const counselingLicenses = extractCredentialLicenses(credentials, 'CounselingLicense');

    const [imlcResult, psypactResult, counselingResult] = await Promise.all([
      determineIMLCEligibility(resolved.clinicianDid, resolved.state, licenseHistory),
      determinePSYPACTEligibility(
        resolved.clinicianDid,
        psychologyLicenses[0]?.state ?? resolved.state,
        psychologyLicenses,
      ),
      determineCounselingCompactEligibility(
        resolved.clinicianDid,
        counselingLicenses[0]?.state ?? resolved.state,
        counselingLicenses,
      ),
    ]);

    const now = new Date();
    const newStatusPayload = {
      clinicianDid: resolved.clinicianDid,
      imlcStatus: imlcResult?.status ?? 'NOT_ELIGIBLE',
      imlcHomeState: imlcResult?.homeState ?? resolved.state,
      imlcCompactStates: imlcResult?.compactStates ?? [],
      psypactStatus: psypactResult?.status ?? 'NOT_ELIGIBLE',
      psypactStates: psypactResult?.participatingStates ?? [],
      counselingStatus: counselingResult?.status ?? 'NOT_ELIGIBLE',
      counselingHomeState: counselingResult?.homeState ?? resolved.state,
      counselingStates: counselingResult?.compactStates ?? [],
      lastComputedAt: now,
      nextRefreshAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
    };

    const storedStatus = (await prisma.compactsStatus.upsert({
      where: { clinicianDid: resolved.clinicianDid },
      create: newStatusPayload,
      update: newStatusPayload,
    })) as CompactsStatus;

    if (currentStatus) {
      await recordCompactRefreshedEvent(
        prisma,
        resolved.clinicianDid,
        currentStatus,
        storedStatus,
      );
    } else {
      await recordCompactComputedEvent(prisma, resolved.clinicianDid, storedStatus);
    }

    const consentSet = resolved.compactConsents;
    const walletChanges: RoutineCheckResult[] = [];

    const walletMap = new Map(walletEntries.map(entry => [entry.compactType, entry]));
    const compactConfigs: Array<{
      type: ClinicianCompactWallet['compactType'];
      status: string;
      states: string[];
      homeState?: string | null;
      result: unknown;
    }> = [
      {
        type: 'IMLC',
        status: newStatusPayload.imlcStatus,
        states: newStatusPayload.imlcCompactStates,
        homeState: newStatusPayload.imlcHomeState,
        result: imlcResult,
      },
      {
        type: 'PSYPACT',
        status: newStatusPayload.psypactStatus,
        states: newStatusPayload.psypactStates,
        homeState: psypactResult?.primaryState ?? resolved.state,
        result: psypactResult,
      },
      {
        type: 'COUNSELING',
        status: newStatusPayload.counselingStatus,
        states: newStatusPayload.counselingStates,
        homeState: newStatusPayload.counselingHomeState,
        result: counselingResult,
      },
    ];

    for (const config of compactConfigs) {
      const consented = consentSet.has(config.type);
      const existing = walletMap.get(config.type);
      const previousStates = existing?.privileges ?? [];
      const diff = diffStates(previousStates, config.states);

      if (consented && (diff.added.length || diff.removed.length)) {
        await upsertWalletEntry({
          clinicianId: resolved.clinicianId,
          compactType: config.type,
          homeState: config.homeState ?? resolved.state,
          states: config.states,
          existing,
          dryRun: context.dryRun,
        });

        walletChanges.push(
          buildCheck({
            id: `wallet-${config.type}`,
            title: `${config.type} compact wallet`,
            status: diff.removed.length ? 'warning' : 'pass',
            summary:
              diff.added.length || diff.removed.length
                ? `Added ${diff.added.join(', ') || 'none'}, removed ${diff.removed.join(', ') || 'none'}.`
                : 'No wallet changes required.',
            evidence: {
              added: diff.added,
              removed: diff.removed,
            },
          }),
        );
      }

      if (!consented && config.status !== 'NOT_ELIGIBLE') {
        recommendations.push({
          id: `consent-${config.type}`,
          label: `Obtain ${config.type} compact consent`,
          detail: `${config.type} eligibility available but consent missing.`,
          type: 'task',
        });
      }

      checks.push(
        buildCheck({
          id: `status-${config.type}`,
          title: `${config.type} eligibility`,
          status: config.status === 'NOT_ELIGIBLE' ? 'warning' : 'pass',
          summary:
            config.status === 'NOT_ELIGIBLE'
              ? `${config.type} eligibility not met.`
              : `${config.states.length} states authorized.`,
          evidence: config.result as Record<string, unknown>,
        }),
      );
    }

    checks.push(...walletChanges);

    await emitTimelineEvent({
      clinicianId: resolved.clinicianId,
      eventType: CredentialTimelineEventType.COMPACT_ELIGIBILITY_UPDATED,
      severity: TimelineEventSeverity.INFO,
      metadata: {
        imlcStatus: newStatusPayload.imlcStatus,
        psypactStatus: newStatusPayload.psypactStatus,
        counselingStatus: newStatusPayload.counselingStatus,
      },
      dryRun: context.dryRun,
    });

    const summary = 'Compact eligibility refreshed and wallet synchronized.';
    return {
      routineId: 'auto-compact-refresh',
      clinicianId: resolved.clinicianId,
      clinicianDid: resolved.clinicianDid,
      npi: resolved.npi,
      startedAt,
      completedAt: new Date(),
      status: 'completed',
      summary,
      checks,
      recommendations,
    };
  } catch (error) {
    return {
      routineId: 'auto-compact-refresh',
      startedAt,
      completedAt: new Date(),
      status: 'failed',
      summary: 'Auto compact refresh routine failed',
      error: error instanceof Error ? error.message : 'Unexpected error',
      checks,
      recommendations,
    };
  }
}


