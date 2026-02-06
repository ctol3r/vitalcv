import type { AuditPacket, AuditTimelineEntry } from './AuditScrapbook';

export type EmployerScopeLink = Readonly<{
  employer_id: string;
  facility_id: string;
  role: string;
}>;

function normalizeString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function toEmployerScopeLink(entry: AuditTimelineEntry): EmployerScopeLink | null {
  const employer_id = normalizeString(entry.metadata.employer_id);
  const facility_id = normalizeString(entry.metadata.facility_id);
  const role = normalizeString(entry.metadata.role);

  if (!employer_id || !facility_id || !role) return null;

  return Object.freeze({
    employer_id,
    facility_id,
    role,
  });
}

function isEmployerLinkEvent(entry: AuditTimelineEntry): boolean {
  return entry.event_type === 'EMPLOYER_ACCEPTANCE' || entry.event_type === 'START';
}

export function listEmployersForClinician(
  clinician_id: string,
  auditPacket: AuditPacket,
): readonly EmployerScopeLink[] {
  const clinician = normalizeString(clinician_id);
  if (!clinician) {
    throw new Error('clinician_id is required');
  }

  const dedup = new Map<string, EmployerScopeLink>();

  for (const entry of auditPacket.timeline) {
    if (entry.clinician_id !== clinician) continue;
    if (!isEmployerLinkEvent(entry)) continue;

    const link = toEmployerScopeLink(entry);
    if (!link) continue;

    const key = `${link.employer_id}|${link.facility_id}|${link.role}`;
    if (!dedup.has(key)) {
      dedup.set(key, link);
    }
  }

  return Object.freeze(
    [...dedup.values()].sort((left, right) => {
      if (left.employer_id !== right.employer_id) {
        return left.employer_id.localeCompare(right.employer_id);
      }

      if (left.facility_id !== right.facility_id) {
        return left.facility_id.localeCompare(right.facility_id);
      }

      return left.role.localeCompare(right.role);
    }),
  );
}

function packetContainsEmployer(packet: AuditPacket, employer_id: string): boolean {
  return packet.timeline.some((entry) => {
    if (!isEmployerLinkEvent(entry)) return false;
    return normalizeString(entry.metadata.employer_id) === employer_id;
  });
}

export function listCliniciansForEmployer(
  employer_id: string,
  auditPackets: readonly AuditPacket[],
): readonly string[] {
  const employer = normalizeString(employer_id);
  if (!employer) {
    throw new Error('employer_id is required');
  }

  const dedup = new Set<string>();

  for (const packet of auditPackets) {
    const clinician = normalizeString(packet.clinician_id);
    if (!clinician) continue;

    if (packetContainsEmployer(packet, employer)) {
      dedup.add(clinician);
    }
  }

  return Object.freeze([...dedup].sort((left, right) => left.localeCompare(right)));
}
