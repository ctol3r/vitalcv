import { randomUUID } from 'crypto';
import { logFhirActivity } from '../activity-log';
import type { CDSHookCard, PractitionerRoleResource, EncounterResource } from './credential-check';

export interface PrivilegeCheckInput {
  context: {
    practitionerRole?: PractitionerRoleResource;
    encounter?: EncounterResource;
    orders?: Array<{
      code: string;
      display?: string;
      site?: string;
    }>;
  };
}

export interface PrivilegeCheckResponse {
  card: CDSHookCard;
  missingPrivileges: string[];
}

const PRIVILEGE_SOURCE = {
  label: 'VitalCV Privileging',
  url: process.env.PUBLIC_WEB_URL ?? 'https://app.vitalcv.health/admin/privileges',
};

export async function evaluatePrivilegeCheck(
  input: PrivilegeCheckInput,
): Promise<PrivilegeCheckResponse> {
  const practitionerRole = input.context.practitionerRole;
  const encounter = input.context.encounter;
  const orders = input.context.orders ?? [];

  const requiredPrivileges = orders.length ? orders.map((order) => normalizePrivilege(order.code)) : inferPrivileges(encounter);
  const grantedPrivileges = buildGrantedPrivilegeSet(practitionerRole);

  const missingPrivileges = requiredPrivileges.filter((privilege) => !grantedPrivileges.has(privilege));

  const card: CDSHookCard = {
    uuid: randomUUID(),
    summary: missingPrivileges.length ? 'Privilege Gap Detected' : 'Privileges Verified',
    detail: buildPrivilegeDetail(missingPrivileges, orders),
    indicator: missingPrivileges.length === 0 ? 'success' : missingPrivileges.length > 2 ? 'critical' : 'warning',
    source: PRIVILEGE_SOURCE,
    links: [
      {
        label: 'Open privileging dashboard',
        url: PRIVILEGE_SOURCE.url,
        type: 'absolute',
      },
    ],
  };

  await logFhirActivity({
    kind: 'cds:privilege-check',
    severity: missingPrivileges.length ? (missingPrivileges.length > 2 ? 'error' : 'warning') : 'info',
    context: {
      practitionerRoleId: practitionerRole?.id,
      encounterId: encounter?.id,
      missingPrivileges,
    },
  });

  return {
    card,
    missingPrivileges,
  };
}

function inferPrivileges(encounter?: EncounterResource | null): string[] {
  if (!encounter) {
    return [];
  }
  const classCode = encounter.class?.code ?? '';
  if (classCode.toLowerCase().includes('er')) {
    return ['EMERGENCY_MEDICINE'];
  }
  if (classCode.toLowerCase().includes('inpatient')) {
    return ['INPATIENT_ADMIT', 'INPATIENT_ORDERS'];
  }
  return [];
}

function buildGrantedPrivilegeSet(role?: PractitionerRoleResource | null): Set<string> {
  const privileges = new Set<string>();
  if (!role) {
    return privileges;
  }
  const codes = [...(role.code ?? []), ...(role.specialty ?? [])];
  codes.forEach((coding) => {
    if (coding?.text) {
      privileges.add(normalizePrivilege(coding.text));
    }
  });
  return privileges;
}

function normalizePrivilege(code?: string): string {
  if (!code) {
    return '';
  }
  return code
    .replace(/[^a-zA-Z0-9]/g, '_')
    .replace(/_+/g, '_')
    .toUpperCase();
}

function buildPrivilegeDetail(missing: string[], orders: PrivilegeCheckInput['context']['orders']): string {
  if (missing.length === 0) {
    return 'All site privileges satisfied for this order.';
  }
  if (!orders?.length) {
    return `Missing privileges: ${missing.join(', ')}`;
  }
  const referencedOrders = orders.map((order) => order.display ?? order.code).join(', ');
  return `Missing privileges (${missing.join(', ')}). Orders blocked: ${referencedOrders}`;
}











