export const ATS_EVENT_TYPES = [
  'readinessUpdate',
  'credentialIssued',
  'sanctionFlag',
  'expirationWarning',
] as const;

export type AtsEventType = (typeof ATS_EVENT_TYPES)[number];

const EVENT_SET = new Set<string>(ATS_EVENT_TYPES);

export function normalizeAtsEvents(input: unknown): AtsEventType[] {
  if (!input) {
    return [...ATS_EVENT_TYPES];
  }

  const list = Array.isArray(input) ? input : [input];
  const normalized = list
    .map((value) => (typeof value === 'string' ? value.trim() : ''))
    .filter((value) => value.length > 0 && EVENT_SET.has(value));

  if (normalized.length === 0) {
    return [...ATS_EVENT_TYPES];
  }

  return Array.from(new Set(normalized)) as AtsEventType[];
}

export function normalizeClinicianFilters(input: unknown): string[] {
  if (!input) {
    return [];
  }

  const values = Array.isArray(input) ? input : [input];
  return Array.from(
    new Set(
      values
        .map((value) => (typeof value === 'string' ? value.trim() : ''))
        .filter((value) => value.length > 0),
    ),
  );
}

export function matchesEventPreference(
  configuredEvents: string[] | null | undefined,
  event: AtsEventType,
): boolean {
  if (!configuredEvents || configuredEvents.length === 0) {
    return true;
  }
  return configuredEvents.includes(event);
}

export function matchesClinicianFilter(
  clinicianFilters: string[] | null | undefined,
  clinicianId: string,
): boolean {
  if (!clinicianFilters || clinicianFilters.length === 0) {
    return true;
  }
  return clinicianFilters.includes(clinicianId);
}











