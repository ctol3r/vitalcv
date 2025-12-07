import type { EhrPrivilegeSignal } from './engine-v5';

interface EhrSignalInput {
  requiredRoles?: string[];
  clinicianRoles?: string[];
  vendor?: string;
}

export function buildEhrSignal(input: EhrSignalInput = {}): EhrPrivilegeSignal {
  const requiredRoles = dedupeStrings(input.requiredRoles);
  const clinicianRoles = dedupeStrings(input.clinicianRoles);
  const satisfiedRoles = requiredRoles.filter((role) => clinicianRoles.includes(role));
  const complianceRatio =
    requiredRoles.length === 0 ? 1 : satisfiedRoles.length / requiredRoles.length;

  const blockers = requiredRoles
    .filter((role) => !satisfiedRoles.includes(role))
    .map((role) => (input.vendor ? `${role} (${input.vendor})` : role));

  return {
    requiredRoles,
    satisfiedRoles,
    complianceRatio,
    blockers,
  };
}

function dedupeStrings(values?: string[]): string[] {
  if (!Array.isArray(values)) {
    return [];
  }
  return Array.from(
    new Set(
      values
        .map((value) => value?.trim())
        .filter((value): value is string => Boolean(value)),
    ),
  );
}


