import { PrismaClient, type ClinicianCompactWallet } from '@prisma/client';
import { normalizeStateCode } from '../../services/compacts/models/CompactParticipation.js';
import type { CompactConsentType } from '../../services/compacts/models/CompactConsent.js';

const prisma = new PrismaClient();
const DEFAULT_DUE_DAYS = 30;

export interface CompactReevaluationChange {
  clinicianId: string;
  clinicianDid: string;
  compactType: CompactConsentType;
  addedStates: string[];
  removedStates: string[];
}

export interface CompactReevaluationSummary {
  processedClinicians: number;
  walletUpdates: number;
  revalidationTasks: number;
  skippedClinicians: string[];
  changes: CompactReevaluationChange[];
  runAt: Date;
}

export interface CompactReevaluationOptions {
  dryRun?: boolean;
  prisma?: PrismaClient;
  dueInDays?: number;
}

export async function runAnnualCompactReevaluation(
  options: CompactReevaluationOptions = {},
): Promise<CompactReevaluationSummary> {
  const prismaClient = options.prisma ?? prisma;
  const dueInDays = options.dueInDays ?? DEFAULT_DUE_DAYS;

  const summary: CompactReevaluationSummary = {
    processedClinicians: 0,
    walletUpdates: 0,
    revalidationTasks: 0,
    skippedClinicians: [],
    changes: [],
    runAt: new Date(),
  };

  const consents = await prismaClient.compactConsent.findMany({
    select: { clinicianId: true, compactType: true },
  });

  if (consents.length === 0) {
    return summary;
  }

  const consentsByClinician = groupConsentsByClinician(consents);
  const clinicianIds = Array.from(consentsByClinician.keys());

  const clinicianProfiles = await prismaClient.clinicianProfile.findMany({
    where: { id: { in: clinicianIds } },
    select: {
      id: true,
      state: true,
      user: {
        select: {
          did: true,
          didLinks: { select: { did: true } },
        },
      },
    },
  });

  const profileMap = new Map(clinicianProfiles.map((profile) => [profile.id, profile]));
  const didByClinician = new Map<string, string>();

  for (const profile of clinicianProfiles) {
    const did = profile.user.did || profile.user.didLinks[0]?.did;
    if (did) {
      didByClinician.set(profile.id, did);
    } else {
      summary.skippedClinicians.push(profile.id);
    }
  }

  const clinicianDids = Array.from(didByClinician.values());
  const statuses = await prismaClient.compactsStatus.findMany({
    where: { clinicianDid: { in: clinicianDids } },
  });
  const statusByDid = new Map(statuses.map((record) => [record.clinicianDid, record]));

  const psypactRecords = await prismaClient.pSYPACTCompact.findMany({
    where: { clinicianDid: { in: clinicianDids } },
  });
  const psypactByDid = new Map(psypactRecords.map((record) => [record.clinicianDid, record]));

  const walletRecords = await prismaClient.clinicianCompactWallet.findMany({
    where: { clinicianId: { in: clinicianIds } },
  });
  const walletIndex = buildWalletIndex(walletRecords);

  for (const clinicianId of clinicianIds) {
    const profile = profileMap.get(clinicianId);
    const clinicianDid = profile ? didByClinician.get(clinicianId) : undefined;
    if (!profile || !clinicianDid) {
      continue;
    }

    const statusRecord = statusByDid.get(clinicianDid);
    if (!statusRecord) {
      summary.skippedClinicians.push(clinicianDid);
      continue;
    }

    summary.processedClinicians += 1;
    const consentTypes = consentsByClinician.get(clinicianId)!;
    const walletMap = walletIndex.get(clinicianId) ?? new Map<CompactConsentType, ClinicianCompactWallet>();
    walletIndex.set(clinicianId, walletMap);

    for (const compactType of consentTypes) {
      const desiredStates = deriveStates(compactType, statusRecord);
      const normalizedStates = [...new Set(desiredStates.map(normalizeStateCode))].sort();
      const wallet = walletMap.get(compactType);
      const previousStates = wallet ? [...wallet.privileges] : [];
      const { added, removed } = diffStates(previousStates, normalizedStates);

      if (added.length === 0 && removed.length === 0) {
        continue;
      }

      summary.changes.push({
        clinicianId,
        clinicianDid,
        compactType,
        addedStates: added,
        removedStates: removed,
      });

      const homeState = resolveHomeState(
        compactType,
        statusRecord,
        profile.state,
        psypactByDid.get(clinicianDid)?.primaryState ?? null,
      );

      if (!options.dryRun) {
        if (wallet) {
          await prismaClient.clinicianCompactWallet.update({
            where: { id: wallet.id },
            data: {
              privileges: normalizedStates,
              homeState,
            },
          });
        } else {
          await prismaClient.clinicianCompactWallet.create({
            data: {
              clinicianId,
              compactType,
              homeState,
              privileges: normalizedStates,
            },
          });
        }
      }

      walletMap.set(compactType, {
        ...(wallet ?? {
          id: 'dry-run',
          clinicianId,
          compactType,
          homeState,
          privileges: normalizedStates,
          issuedAt: new Date(),
          updatedAt: new Date(),
        }),
        privileges: normalizedStates,
        homeState,
      } as ClinicianCompactWallet);

      summary.walletUpdates += 1;

      if (removed.length > 0) {
        const tasksCreated = await createRevalidationTasks({
          clinicianId,
          clinicianDid,
          compactType,
          removedStates: removed,
          previousStates,
          currentStates: normalizedStates,
          dueInDays,
          prisma: prismaClient,
          dryRun: options.dryRun === true,
        });
        summary.revalidationTasks += tasksCreated;
      }
    }
  }

  if (!options.dryRun) {
    console.log(
      `[compacts] Annual re-evaluation processed ${summary.processedClinicians} clinicians, ` +
        `${summary.walletUpdates} wallet updates, ${summary.revalidationTasks} tasks`,
    );
  }

  return summary;
}

export async function closeCompactReevaluationClient(): Promise<void> {
  await prisma.$disconnect();
}

function groupConsentsByClinician(consents: { clinicianId: string; compactType: string }[]) {
  const map = new Map<string, CompactConsentType[]>();
  for (const consent of consents) {
    const compactType = consent.compactType as CompactConsentType;
    const list = map.get(consent.clinicianId) ?? [];
    list.push(compactType);
    map.set(consent.clinicianId, list);
  }
  return map;
}

function buildWalletIndex(wallets: ClinicianCompactWallet[]) {
  const index = new Map<string, Map<CompactConsentType, ClinicianCompactWallet>>();
  for (const wallet of wallets) {
    const map = index.get(wallet.clinicianId) ?? new Map();
    map.set(wallet.compactType as CompactConsentType, wallet);
    index.set(wallet.clinicianId, map);
  }
  return index;
}

function deriveStates(compactType: CompactConsentType, statusRecord: any): string[] {
  if (compactType === 'IMLC') {
    return statusRecord.imlcCompactStates ?? [];
  }
  if (compactType === 'PSYPACT') {
    return statusRecord.psypactStates ?? [];
  }
  if (compactType === 'COUNSELING') {
    return statusRecord.counselingStates ?? [];
  }
  return [];
}

function diffStates(previous: string[], next: string[]) {
  const previousSet = new Set(previous.map(normalizeStateCode));
  const nextSet = new Set(next.map(normalizeStateCode));

  const added = [...nextSet].filter((state) => !previousSet.has(state));
  const removed = [...previousSet].filter((state) => !nextSet.has(state));

  return { added, removed };
}

function resolveHomeState(
  compactType: CompactConsentType,
  statusRecord: any,
  fallbackState: string,
  psypactPrimaryState: string | null,
) {
  if (compactType === 'IMLC') {
    return normalizeStateCode(statusRecord.imlcHomeState ?? fallbackState);
  }
  if (compactType === 'PSYPACT') {
    return normalizeStateCode(psypactPrimaryState ?? fallbackState);
  }
  if (compactType === 'COUNSELING') {
    return normalizeStateCode(statusRecord.counselingHomeState ?? fallbackState);
  }
  return normalizeStateCode(fallbackState);
}

async function createRevalidationTasks(args: {
  clinicianId: string;
  clinicianDid: string;
  compactType: CompactConsentType;
  removedStates: string[];
  previousStates: string[];
  currentStates: string[];
  dueInDays: number;
  prisma: PrismaClient;
  dryRun: boolean;
}): Promise<number> {
  let created = 0;
  const dueDate = addDays(new Date(), args.dueInDays);

  for (const state of args.removedStates) {
    if (args.dryRun) {
      created += 1;
      continue;
    }

    const existingTask = await args.prisma.revalidationTask.findFirst({
      where: {
        clinicianId: args.clinicianId,
        type: 'CREDENTIALING',
        status: { in: ['OPEN', 'IN_PROGRESS'] },
        metadata: {
          path: ['compactState'],
          equals: state,
        },
      },
    });

    if (existingTask) {
      continue;
    }

    await args.prisma.revalidationTask.create({
      data: {
        clinicianId: args.clinicianId,
        type: 'CREDENTIALING',
        dueDate,
        notes: `Compact ${args.compactType} privilege removed for ${state}`,
        metadata: {
          reason: 'COMPACT_STATE_REMOVED',
          compactType: args.compactType,
          compactState: state,
          clinicianDid: args.clinicianDid,
          previousStates: args.previousStates,
          currentStates: args.currentStates,
        },
      },
    });

    created += 1;
  }

  return created;
}

function addDays(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}
