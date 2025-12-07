import { PrismaClient } from '@prisma/client';
import { resolveClinicianContext } from '../common/clinicianContext';
import type { Procedure } from '../privileging/models/PrivilegeSet';
import { normalizePrivilegeCode } from './types';

const prisma = new PrismaClient();

export interface BoardCertificationRecord {
  board: string;
  specialty: string;
  certifiedAt?: string;
  expiresAt?: string | null;
}

export interface LicenseRecord {
  state: string;
  status: 'ACTIVE' | 'RESTRICTED' | 'SUSPENDED' | 'PROBATION' | 'EXPIRED';
  expiresAt?: string | null;
}

export interface ProcedureVolumeRecord {
  procedureName: string;
  count: number;
  lookbackMonths: number;
}

export interface DeaRegistrationRecord {
  registrationNumber: string;
  schedules: string[];
  expiresAt?: string | null;
}

export interface PrivilegeGrantAssignment {
  privilegeGrantedId: string;
  status: string;
  orgId: string;
  privilegeCodes: string[];
  expiresAt: Date;
}

export interface PendingPrivilegeRequest {
  privilegeRequestId: string;
  status: string;
  orgId: string;
  privilegeCodes: string[];
  submittedAt: Date;
}

export interface ClinicianPrivilegeSnapshot {
  clinicianId: string;
  clinicianDid?: string;
  userId: string;
  specialty?: string;
  state?: string;
  boardCertifications: BoardCertificationRecord[];
  licenses: LicenseRecord[];
  deaRegistrations: DeaRegistrationRecord[];
  procedureVolumes: ProcedureVolumeRecord[];
  customAttributes: Record<string, string | number | boolean | string[] | number[]>;
  grantedPrivilegeCodes: Set<string>;
  grants: PrivilegeGrantAssignment[];
  pendingRequests: PendingPrivilegeRequest[];
}

function coerceString(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value === null || value === undefined) return '';
  return String(value);
}

function derivePrivilegeCodesFromSet(setRecord: { procedures?: unknown } | null): string[] {
  if (!setRecord || !Array.isArray(setRecord.procedures)) {
    return [];
  }
  const procedures = setRecord.procedures as Procedure[];
  return procedures
    .map((procedure) => (procedure?.code ? normalizePrivilegeCode(procedure.code) : ''))
    .filter(Boolean);
}

function derivePrivilegeCodesFromSetV2(
  privilegeSetV2?: {
    privileges: Array<{ privilegeCode: string }>;
  } | null
): string[] {
  if (!privilegeSetV2) return [];
  return privilegeSetV2.privileges
    .map((record) => normalizePrivilegeCode(record.privilegeCode))
    .filter(Boolean);
}

function mergeCustomAttributes(
  attributes: Record<string, unknown>,
  additions: Record<string, unknown>
): Record<string, string | number | boolean | string[] | number[]> {
  const merged: Record<string, string | number | boolean | string[] | number[]> = {};
  for (const [key, value] of Object.entries({ ...attributes, ...additions })) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) {
      merged[key] = value as string[] | number[];
    } else if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      merged[key] = value;
    } else {
      merged[key] = coerceString(value);
    }
  }
  return merged;
}

export async function buildClinicianPrivilegeSnapshot(
  clinicianId: string
): Promise<ClinicianPrivilegeSnapshot> {
  const context = await resolveClinicianContext({ clinicianId });
  if (!context) {
    throw new Error(`Clinician ${clinicianId} not found`);
  }

  const credentials = await prisma.credential.findMany({
    where: {
      userId: context.userId,
      status: { not: 'revoked' },
    },
  });

  const boardCertifications: BoardCertificationRecord[] = [];
  const licenses: LicenseRecord[] = [];
  const deaRegistrations: DeaRegistrationRecord[] = [];

  for (const credential of credentials) {
    const metadata = (credential.metadata ?? {}) as Record<string, unknown>;
    if (credential.type === 'BoardCertification') {
      boardCertifications.push({
        board: coerceString(metadata.boardName ?? credential.issuer),
        specialty: coerceString(metadata.specialty ?? context.specialty ?? ''),
        certifiedAt: credential.issuedAt.toISOString(),
        expiresAt: credential.expiresAt?.toISOString() ?? null,
      });
    } else if (credential.type === 'MedicalLicense') {
      licenses.push({
        state: coerceString(metadata.state ?? context.state ?? '').toUpperCase(),
        status: coerceString(metadata.status ?? 'ACTIVE').toUpperCase() as LicenseRecord['status'],
        expiresAt: credential.expiresAt?.toISOString() ?? null,
      });
    } else if (credential.type === 'DEARegistration') {
      const schedules = Array.isArray(metadata.schedules)
        ? (metadata.schedules as string[])
        : typeof metadata.schedule === 'string'
        ? [metadata.schedule]
        : [];
      deaRegistrations.push({
        registrationNumber: coerceString(metadata.registrationNumber ?? credential.name ?? credential.id),
        schedules: schedules.map((schedule) => schedule.toUpperCase()),
        expiresAt: credential.expiresAt?.toISOString() ?? null,
      });
    }
  }

  const grants = await prisma.privilegeGranted.findMany({
    where: context.clinicianDid
      ? { clinicianDid: context.clinicianDid }
      : {
          privilegeRequest: {
            clinicianDid: context.clinicianDid ?? undefined,
          },
        },
    include: {
      privilegeRequest: {
        include: {
          privilegeSet: true,
          privilegeSetV2: {
            include: { privileges: true },
          },
        },
      },
    },
  });

  const grantAssignments: PrivilegeGrantAssignment[] = [];
  const grantedPrivilegeCodes = new Set<string>();

  for (const grant of grants) {
    const codes =
      derivePrivilegeCodesFromSetV2(grant.privilegeRequest.privilegeSetV2) ??
      derivePrivilegeCodesFromSet(grant.privilegeRequest.privilegeSet);
    codes.forEach((code) => grantedPrivilegeCodes.add(code));

    grantAssignments.push({
      privilegeGrantedId: grant.id,
      status: grant.status,
      orgId: grant.orgId,
      privilegeCodes: codes,
      expiresAt: grant.expiresAt,
    });
  }

  const pendingRequests = await prisma.privilegeRequest.findMany({
    where: {
      clinicianDid: context.clinicianDid ?? undefined,
      status: { in: ['PENDING', 'UNDER_REVIEW'] },
    },
    include: {
      privilegeSet: true,
      privilegeSetV2: {
        include: { privileges: true },
      },
    },
  });

  const pending: PendingPrivilegeRequest[] = pendingRequests.map((request) => {
    const codes =
      derivePrivilegeCodesFromSetV2(request.privilegeSetV2) ?? derivePrivilegeCodesFromSet(request.privilegeSet);
    return {
      privilegeRequestId: request.id,
      status: request.status,
      orgId: request.orgId,
      privilegeCodes: codes,
      submittedAt: request.createdAt,
    };
  });

  const customAttributes = mergeCustomAttributes(
    {},
    {
      specialty: context.specialty,
      primaryState: context.state,
      npi: context.npi,
    }
  );

  return {
    clinicianId: context.clinicianId,
    clinicianDid: context.clinicianDid,
    userId: context.userId,
    specialty: context.specialty,
    state: context.state,
    boardCertifications,
    licenses,
    deaRegistrations,
    procedureVolumes: [],
    customAttributes,
    grantedPrivilegeCodes,
    grants: grantAssignments,
    pendingRequests: pending,
  };
}

