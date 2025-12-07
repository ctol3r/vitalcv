import { Prisma, PrismaClient, CredentialTimelineEventType, TimelineEventSeverity } from '@prisma/client';
import { getServiceLogger } from '../../logging/serviceLogger.js';
import { resolveClinicianContext } from '../../common/clinicianContext.js';
import { logCredentialTimelineEvent } from '../../timeline/logCredentialTimelineEvent.js';
import { mergeCredentialRisk } from '../../credentialRisk/riskService.js';
import { CredentialRiskFactors } from '../../credentialRisk/enums.js';

const prisma = new PrismaClient();
const log = getServiceLogger('directory/processors/directoryUpdate');

export interface PractitionerTelecom {
  system?: string;
  value?: string;
  use?: string;
}

export interface PractitionerAddress {
  line?: string[];
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  type?: string;
}

export interface PractitionerUpdatePayload {
  practitionerId: string;
  npi: string;
  clinicianId?: string;
  clinicianDid?: string;
  sourceSystem?: string;
  names?: Array<{
    text?: string;
    family?: string;
    given?: string[];
    suffix?: string;
  }>;
  displayName?: string;
  taxonomy?: Array<{
    code: string;
    description?: string;
    primary?: boolean;
  }>;
  addresses?: PractitionerAddress[];
  telecom?: PractitionerTelecom[];
  lastUpdated?: string | Date;
  raw?: Record<string, unknown>;
}

export interface DirectoryUpdateResult {
  normalizedId: string;
  changes: {
    nameChanged: boolean;
    taxonomyChanged: boolean;
    addressChanged: boolean;
  };
}

function toJson(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined) {
    return undefined;
  }
  return value as Prisma.InputJsonValue;
}

function normalizeString(value?: string | null): string | undefined {
  if (!value) {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
}

function normalizeAddress(address: PractitionerAddress): Record<string, string> {
  return {
    line1: normalizeString(address.line?.[0]) ?? '',
    line2: normalizeString(address.line?.[1]) ?? '',
    city: normalizeString(address.city) ?? '',
    state: normalizeString(address.state)?.toUpperCase() ?? '',
    postalCode: normalizeString(address.postalCode) ?? '',
    country: normalizeString(address.country)?.toUpperCase() ?? '',
    type: normalizeString(address.type) ?? 'practice',
  };
}

function normalizeTelecom(entry: PractitionerTelecom): Record<string, string> {
  return {
    system: normalizeString(entry.system)?.toLowerCase() ?? 'other',
    value: normalizeString(entry.value) ?? '',
    use: normalizeString(entry.use)?.toLowerCase() ?? 'work',
  };
}

function summarizeNames(payload: PractitionerUpdatePayload) {
  const primary = payload.names?.[0];
  const displayName =
    payload.displayName ||
    primary?.text ||
    [primary?.given?.join(' '), primary?.family].filter(Boolean).join(' ').trim();

  return {
    displayName: displayName?.trim() || 'Unknown Provider',
    givenName: primary?.given?.[0],
    familyName: primary?.family,
    suffix: primary?.suffix,
    metadata: primary
      ? {
          altGiven: primary.given,
          family: primary.family,
        }
      : undefined,
  };
}

function detectChanges(
  existing: { displayName: string; taxonomyCodes: string[]; primaryTaxonomy: string | null; addresses: Prisma.JsonValue | null } | null,
  next: { displayName: string; taxonomyCodes: string[]; primaryTaxonomy?: string | null; addresses?: Record<string, string>[] }
) {
  if (!existing) {
    return { changed: true, nameChanged: true, taxonomyChanged: true, addressChanged: true };
  }

  const nameChanged = existing.displayName !== next.displayName;
  const taxonomyChanged =
    existing.primaryTaxonomy !== (next.primaryTaxonomy ?? null) ||
    existing.taxonomyCodes.join('|') !== next.taxonomyCodes.join('|');
  const previousAddresses = JSON.stringify(existing.addresses ?? []);
  const nextAddresses = JSON.stringify(next.addresses ?? []);
  const addressChanged = previousAddresses !== nextAddresses;

  return {
    changed: nameChanged || taxonomyChanged || addressChanged,
    nameChanged,
    taxonomyChanged,
    addressChanged,
  };
}

export async function processDirectoryUpdate(payload: PractitionerUpdatePayload): Promise<DirectoryUpdateResult> {
  if (!payload.practitionerId) {
    throw new Error('practitionerId is required');
  }
  if (!payload.npi) {
    throw new Error('npi is required');
  }

  const npi = payload.npi.trim();
  const names = summarizeNames(payload);
  const taxonomy = (payload.taxonomy ?? []).map((entry) => entry.code.trim().toUpperCase());
  const primaryTaxonomy =
    payload.taxonomy?.find((entry) => entry.primary)?.code?.trim().toUpperCase() ?? taxonomy[0] ?? null;
  const normalizedAddresses = (payload.addresses ?? []).map(normalizeAddress);
  const normalizedTelecom = (payload.telecom ?? []).map(normalizeTelecom);
  const lastSyncedAt = payload.lastUpdated ? new Date(payload.lastUpdated) : new Date();

  const [context, existing] = await Promise.all([
    resolveClinicianContext({
      clinicianId: payload.clinicianId,
      clinicianDid: payload.clinicianDid,
      npi,
    }),
    prisma.providerNormalized.findUnique({ where: { npi } }),
  ]);

  const nextRecord = {
    clinicianId: context?.clinicianId ?? payload.clinicianId ?? existing?.clinicianId ?? null,
    practitionerId: payload.practitionerId,
    npi,
    source: payload.sourceSystem ?? 'NPPES',
    displayName: names.displayName,
    givenName: names.givenName,
    familyName: names.familyName,
    suffix: names.suffix,
    primaryTaxonomy,
    taxonomyCodes: taxonomy,
    addresses: toJson(normalizedAddresses),
    telecom: toJson(normalizedTelecom),
    nameMetadata: toJson(names.metadata),
    lastSyncedAt,
    rawPayload: toJson(payload.raw ?? payload),
  };

  const changes = detectChanges(existing, {
    displayName: names.displayName,
    taxonomyCodes: taxonomy,
    primaryTaxonomy,
    addresses: normalizedAddresses,
  });

  const record = await prisma.providerNormalized.upsert({
    where: { npi },
    create: nextRecord,
    update: {
      ...nextRecord,
      updatedAt: new Date(),
    },
  });

  if (context?.clinicianId && changes.changed) {
    const severity = changes.taxonomyChanged || changes.addressChanged ? TimelineEventSeverity.WARNING : TimelineEventSeverity.NOTICE;
    await logCredentialTimelineEvent({
      clinicianId: context.clinicianId,
      eventType: CredentialTimelineEventType.DIRECTORY_NORMALIZED,
      severity,
      metadata: {
        npi,
        practitionerId: payload.practitionerId,
        taxonomyCodes: taxonomy,
        addressChanged: changes.addressChanged,
        taxonomyChanged: changes.taxonomyChanged,
      },
    });

    if (changes.taxonomyChanged || changes.addressChanged) {
      await mergeCredentialRisk(context.clinicianId, {
        add: [CredentialRiskFactors.DIRECTORY_DRIFT],
      });
    } else {
      await mergeCredentialRisk(context.clinicianId, {
        remove: [CredentialRiskFactors.DIRECTORY_DRIFT],
      });
    }
  }
  } else if (context?.clinicianId) {
    await mergeCredentialRisk(context.clinicianId, {
      remove: [CredentialRiskFactors.DIRECTORY_DRIFT],
    });
  }

  return {
    normalizedId: record.id,
    changes: {
      nameChanged: changes.nameChanged,
      taxonomyChanged: changes.taxonomyChanged,
      addressChanged: changes.addressChanged,
    },
  };
}
