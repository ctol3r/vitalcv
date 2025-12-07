import { EhrSynchronizationStatus, Prisma, PrismaClient } from '@prisma/client';
import { EhrFacade } from '../../services/ehr/ehrFacade';
import { recordEhrSyncFailure, clearEhrSyncAlerts } from '../../services/credentialRisk/ehrIntegration';
import {
  recordPrivilegeSyncedEvent,
  recordPrivilegeSyncFailureEvent,
  recordEhrMismatchDetectedEvent,
} from '../../services/timeline/ehrIntegration';
import { createDriftEvent, resolveDriftEvents } from '../../services/drift/events';

const prisma = new PrismaClient();

export interface EhrReconcileJobOptions {
  clinicianId?: string;
  batchSize?: number;
}

export interface EhrReconcileJobResult {
  processed: number;
  synced: number;
  failed: number;
  driftDetected: number;
  skipped: number;
  errors: string[];
  finishedAt: string;
}

export async function runEhrReconciliationJob(
  options: EhrReconcileJobOptions = {}
): Promise<EhrReconcileJobResult> {
  const stats: EhrReconcileJobResult = {
    processed: 0,
    synced: 0,
    failed: 0,
    driftDetected: 0,
    skipped: 0,
    errors: [],
    finishedAt: new Date().toISOString(),
  };

  try {
    const targetClinicianDid = await resolveClinicianDid(options.clinicianId);
    const privileges = await prisma.privilegeGranted.findMany({
      where: {
        status: {
          in: ['ACTIVE', 'HOLD', 'TEMPORARY'],
        },
        ...(targetClinicianDid ? { clinicianDid: targetClinicianDid } : {}),
      },
      include: {
        privilegeSet: true,
        privilegeRequest: {
          include: {
            privilegeSet: true,
            privilegeSetV2: {
              include: {
                privileges: true,
              },
            },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
      take: options.batchSize ?? 50,
    });

    if (privileges.length === 0) {
      return stats;
    }

    const configs = await prisma.ehrConfig.findMany({
      where: { isActive: true },
    });
    const configByOrg = new Map(configs.map((config) => [config.orgId, config]));
    const facadeCache = new Map<string, EhrFacade | null>();
    const clinicianCache = new Map<string, Awaited<ReturnType<typeof loadClinicianProfile>> | null>();

    for (const privilege of privileges) {
      stats.processed += 1;
      const clinicianDid = privilege.clinicianDid;
      const clinician = await loadClinician(clinicianDid, clinicianCache);
      if (!clinician) {
        stats.skipped += 1;
        stats.failed += 1;
        await persistSyncRecord({
          privilege,
          clinician: null,
          status: EhrSynchronizationStatus.FAILED,
          failureReason: 'Clinician profile not found',
          localCodes: [],
          ehrCodes: [],
          ehrSystem: 'unknown',
        });
        continue;
      }

      if (!clinician.npi) {
        stats.skipped += 1;
        stats.failed += 1;
        await persistSyncRecord({
          privilege,
          clinician,
          status: EhrSynchronizationStatus.FAILED,
          failureReason: 'Clinician missing NPI',
          localCodes: [],
          ehrCodes: [],
          ehrSystem: 'unknown',
        });
        continue;
      }

      const config = configByOrg.get(privilege.orgId);
      if (!config) {
        stats.skipped += 1;
        stats.failed += 1;
        await persistSyncRecord({
          privilege,
          clinician,
          status: EhrSynchronizationStatus.FAILED,
          failureReason: 'EHR integration not configured for org',
          localCodes: [],
          ehrCodes: [],
          ehrSystem: 'not_configured',
        });
        continue;
      }

      const ehrSystemId = String(config.ehrType ?? 'ehr');
      const facade = await loadFacade(privilege.orgId, configByOrg, facadeCache);
      if (!facade) {
        stats.failed += 1;
        await persistSyncRecord({
          privilege,
          clinician,
          status: EhrSynchronizationStatus.FAILED,
          failureReason: 'Unable to initialize EHR facade',
          localCodes: [],
          ehrCodes: [],
          ehrSystem: ehrSystemId,
        });
        continue;
      }

      const localCodes = collectPrivilegeCodes(privilege);

      try {
        const { codes: ehrCodes, snapshot } = await fetchEhrAssignments(facade, clinician.npi);
        const diff = diffPrivilegeAssignments(localCodes, ehrCodes);

        if (diff.inSync) {
          stats.synced += 1;
          await persistSyncRecord({
            privilege,
            clinician,
            status: EhrSynchronizationStatus.SYNCED,
            localCodes,
            ehrCodes,
            ehrSnapshot: snapshot,
            ehrSystem: ehrSystemId,
          });
          await recordPrivilegeSyncedEvent({
            clinicianId: clinician.id,
            orgId: privilege.orgId,
            privilegeSetId: privilege.privilegeSetId,
            privilegeGrantedId: privilege.id,
            metadata: {
              ehrCodes,
              localCodes,
            },
          });
          await clearEhrSyncAlerts(clinician.id);
          await resolveDriftEvents({ clinicianId: clinician.id, category: 'privilege_assignment' });
        } else {
          stats.driftDetected += 1;
          await persistSyncRecord({
            privilege,
            clinician,
            status: EhrSynchronizationStatus.DRIFT,
            localCodes,
            ehrCodes,
            mismatchDetails: diff,
            ehrSnapshot: snapshot,
            ehrSystem: ehrSystemId,
          });
          await recordEhrMismatchDetectedEvent({
            clinicianId: clinician.id,
            orgId: privilege.orgId,
            privilegeSetId: privilege.privilegeSetId,
            privilegeGrantedId: privilege.id,
            mismatch: diff,
          });
          await recordEhrSyncFailure({
            clinicianId: clinician.id,
            privilegeSetId: privilege.privilegeSetId,
            mismatchDetails: diff,
            severity: 'HIGH',
            failureReason: 'EHR privilege assignment drift detected',
          });
          await createDriftEvent({
            orgId: privilege.orgId,
            clinicianId: clinician.id,
            clinicianDid,
            category: 'privilege_assignment',
            source: 'ehr_reconcile',
            severity: 'HIGH',
            metadata: diff,
          });
        }
      } catch (error) {
        stats.failed += 1;
        const reason = error instanceof Error ? error.message : 'Unknown EHR sync error';
        await persistSyncRecord({
          privilege,
          clinician,
          status: EhrSynchronizationStatus.FAILED,
          failureReason: reason,
          localCodes,
          ehrCodes: [],
          ehrSystem: ehrSystemId,
        });
        await recordPrivilegeSyncFailureEvent({
          clinicianId: clinician.id,
          orgId: privilege.orgId,
          privilegeSetId: privilege.privilegeSetId,
          privilegeGrantedId: privilege.id,
          error: reason,
        });
        await recordEhrSyncFailure({
          clinicianId: clinician.id,
          privilegeSetId: privilege.privilegeSetId,
          failureReason: reason,
        });
      }
    }
  } catch (error) {
    stats.errors.push(error instanceof Error ? error.message : String(error));
  } finally {
    stats.finishedAt = new Date().toISOString();
  }

  return stats;
}

async function resolveClinicianDid(clinicianId?: string): Promise<string | undefined> {
  if (!clinicianId) {
    return undefined;
  }
  const clinician = await prisma.clinicianProfile.findUnique({
    where: { id: clinicianId },
    include: { user: true },
  });
  if (!clinician?.user?.did) {
    throw new Error('Clinician does not have a DID assigned');
  }
  return clinician.user.did;
}

async function loadClinician(
  clinicianDid: string,
  cache: Map<string, Awaited<ReturnType<typeof loadClinicianProfile>> | null>
) {
  if (cache.has(clinicianDid)) {
    return cache.get(clinicianDid);
  }
  const profile = await loadClinicianProfile(clinicianDid);
  cache.set(clinicianDid, profile);
  return profile;
}

async function loadClinicianProfile(clinicianDid: string) {
  if (!clinicianDid) {
    return null;
  }
  return prisma.clinicianProfile.findFirst({
    where: {
      user: {
        did: clinicianDid,
      },
    },
    include: {
      user: true,
    },
  });
}

async function loadFacade(
  orgId: string,
  configByOrg: Map<string, any>,
  cache: Map<string, EhrFacade | null>
) {
  if (cache.has(orgId)) {
    return cache.get(orgId);
  }
  const config = configByOrg.get(orgId);
  if (!config) {
    cache.set(orgId, null);
    return null;
  }
  try {
    const facade = new EhrFacade(config as any);
    cache.set(orgId, facade);
    return facade;
  } catch (error) {
    console.error('[EHR Reconcile] Failed to instantiate facade', error);
    cache.set(orgId, null);
    return null;
  }
}

async function fetchEhrAssignments(facade: EhrFacade, npi: string) {
  const practitionerResult = await facade.searchPractitioner({ npi });
  if (!practitionerResult.success || !practitionerResult.data) {
    throw new Error(practitionerResult.error || 'EHR practitioner lookup failed');
  }

  const practitionerId = extractPractitionerId(practitionerResult.data);
  if (!practitionerId) {
    throw new Error('Practitioner ID not found in EHR response');
  }

  const roleResult = await facade.searchPractitionerRole({ practitioner: practitionerId });
  if (!roleResult.success || !roleResult.data) {
    throw new Error(roleResult.error || 'EHR practitioner role query failed');
  }

  const codes = extractEhrPrivilegeCodes(roleResult.data);
  return {
    codes,
    snapshot: roleResult.data,
  };
}

export function diffPrivilegeAssignments(localCodes: string[], ehrCodes: string[]) {
  const normalizedLocal = localCodes.map((code) => code.toUpperCase());
  const normalizedEhr = ehrCodes.map((code) => code.toUpperCase());
  const localSet = new Set(normalizedLocal);
  const ehrSet = new Set(normalizedEhr);
  const missing = normalizedLocal.filter((code) => !ehrSet.has(code));
  const unexpected = normalizedEhr.filter((code) => !localSet.has(code));
  return {
    missing,
    unexpected,
    inSync: missing.length === 0 && unexpected.length === 0,
  };
}

function extractPractitionerId(bundle: any): string | undefined {
  const entries: any[] = bundle?.entry ?? [];
  for (const entry of entries) {
    if (entry?.resource?.resourceType === 'Practitioner' && entry.resource.id) {
      return entry.resource.id;
    }
  }
  return entries[0]?.resource?.id;
}

function extractEhrPrivilegeCodes(bundle: any): string[] {
  const entries: any[] = bundle?.entry ?? [];
  const codes = new Set<string>();
  for (const entry of entries) {
    const resource = entry.resource;
    if (!resource || resource.resourceType !== 'PractitionerRole') {
      continue;
    }
    const codingArrays = resource.code ?? [];
    for (const codingEntry of codingArrays) {
      const coding = codingEntry?.coding ?? [];
      for (const code of coding) {
        if (code?.code) {
          codes.add(String(code.code).toUpperCase());
        }
      }
    }
  }
  return Array.from(codes);
}

function collectPrivilegeCodes(privilege: any): string[] {
  const request = privilege.privilegeRequest;
  if (request?.privilegeSetV2?.privileges?.length) {
    return Array.from(
      new Set(
        request.privilegeSetV2.privileges
          .map((record: any) => record.privilegeCode)
          .filter(Boolean)
          .map((code: string) => code.toUpperCase())
      )
    );
  }

  const fallbackProcedures =
    request?.privilegeSet?.procedures ?? privilege.privilegeSet?.procedures ?? null;
  const derived = normalizePrivilegeCodes(fallbackProcedures);
  if (derived.length > 0) {
    return derived;
  }
  return [`SET-${privilege.privilegeSetId}`];
}

export function normalizePrivilegeCodes(source: unknown): string[] {
  if (!source) {
    return [];
  }
  if (Array.isArray(source)) {
    return Array.from(
      new Set(
        source
          .map((entry) => {
            if (typeof entry === 'string') {
              return entry;
            }
            if (entry && typeof entry === 'object') {
              const value = (entry as any).code ?? (entry as any).name;
              return value;
            }
            return undefined;
          })
          .filter(Boolean)
          .map((code) => String(code).toUpperCase())
      )
    );
  }
  if (typeof source === 'object' && Array.isArray((source as any).procedures)) {
    return normalizePrivilegeCodes((source as any).procedures);
  }
  return [];
}

async function persistSyncRecord(params: {
  privilege: any;
  clinician: Awaited<ReturnType<typeof loadClinicianProfile>> | null;
  status: EhrSynchronizationStatus;
  failureReason?: string;
  mismatchDetails?: { missing: string[]; unexpected: string[] };
  localCodes: string[];
  ehrCodes: string[];
  ehrSnapshot?: any;
  ehrSystem?: string;
}) {
  const {
    privilege,
    clinician,
    status,
    failureReason,
    mismatchDetails,
    localCodes,
    ehrCodes,
    ehrSnapshot,
  } = params;
  const now = new Date();
  const payload: Prisma.EhrSynchronizationUpdateInput = {
    clinicianId: clinician?.id ?? 'unknown',
    clinicianDid: clinician?.user?.did ?? privilege.clinicianDid,
    orgId: privilege.orgId,
    privilegeSetId: privilege.privilegeSetId,
    privilegeCode: localCodes[0] ?? privilege.privilegeSet?.name ?? 'UNKNOWN',
    ehrSystem: params.ehrSystem ?? 'unknown',
    status,
    lastAttemptAt: now,
    lastSyncedAt: status === EhrSynchronizationStatus.SYNCED ? now : undefined,
    error: failureReason,
    mismatchDetails: serializeJson(mismatchDetails),
    ehrSnapshot: serializeJson(ehrSnapshot ?? { codes: ehrCodes }),
    vitalSnapshot: serializeJson({
      codes: localCodes,
      privilegeSetName: privilege.privilegeSet?.name ?? null,
    }),
  };

  const attemptUpdate =
    status === EhrSynchronizationStatus.FAILED
      ? { attemptCount: { increment: 1 } }
      : { attemptCount: { set: 0 } };

  await prisma.ehrSynchronization.upsert({
    where: {
      privilegeGrantedId: privilege.id,
    },
    create: {
      id: privilege.id,
      clinicianId: payload.clinicianId as string,
      clinicianDid: payload.clinicianDid as string,
      orgId: privilege.orgId,
      privilegeSetId: privilege.privilegeSetId,
      privilegeGrantedId: privilege.id,
      privilegeCode: payload.privilegeCode as string,
      ehrSystem: payload.ehrSystem as string,
      status,
      attemptCount: status === EhrSynchronizationStatus.FAILED ? 1 : 0,
      lastAttemptAt: now,
      lastSyncedAt: payload.lastSyncedAt as Date | undefined,
      error: failureReason,
      mismatchDetails: payload.mismatchDetails,
      ehrSnapshot: payload.ehrSnapshot,
      vitalSnapshot: payload.vitalSnapshot,
    },
    update: {
      ...payload,
      ...attemptUpdate,
    },
  });
}

function serializeJson(value: unknown) {
  if (value === undefined) {
    return undefined;
  }
  return JSON.parse(JSON.stringify(value));
}
