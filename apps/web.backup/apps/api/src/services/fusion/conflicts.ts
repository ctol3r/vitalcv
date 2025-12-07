import { randomUUID } from 'crypto';
import type { Prisma } from '@prisma/client';
import type {
  FusionConflict,
  FusionSourceSnapshot,
} from './types';

export interface ConflictDetectionContext {
  clinicianName?: string | null;
  clinicianSpecialty?: string | null;
  now: Date;
}

export function detectFusionConflicts(
  sources: FusionSourceSnapshot,
  context: ConflictDetectionContext,
): FusionConflict[] {
  return [
    ...detectDateMismatches(sources),
    ...detectNameDrift(sources, context),
    ...detectSpecialtyInconsistencies(sources, context),
  ];
}

function detectDateMismatches(sources: FusionSourceSnapshot): FusionConflict[] {
  const conflicts: FusionConflict[] = [];
  const groups = new Map<string, Set<string>>();

  sources.usLicenses.forEach((license) => {
    const key = `${license.state ?? 'UNK'}:${license.licenseNumber ?? 'UNKNOWN'}`;
    const expires = license.expiryDate ? license.expiryDate.toISOString() : 'unknown';
    const group = groups.get(key) ?? new Set<string>();
    group.add(expires);
    groups.set(key, group);
  });

  sources.globalLicenses.forEach((record) => {
    const key = `${record.country ?? 'INTL'}:${record.licenseNumber ?? record.id}`;
    const expires = record.expiresAt ? record.expiresAt.toISOString() : 'unknown';
    const group = groups.get(key) ?? new Set<string>();
    group.add(expires);
    groups.set(key, group);
  });

  Array.from(groups.entries()).forEach(([key, expires]) => {
    if (expires.size <= 1) {
      return;
    }
    conflicts.push({
      id: randomUUID(),
      type: 'date_mismatch',
      severity: 'medium',
      message: `Conflicting expiration dates detected for ${key}`,
      affectedComponentIds: [`us_license:${key}`, `global_license:${key}`],
      evidence: {
        expirations: Array.from(expires),
      },
    });
  });

  return conflicts;
}

function detectNameDrift(
  sources: FusionSourceSnapshot,
  context: ConflictDetectionContext,
): FusionConflict[] {
  const canonical = normalizeName(context.clinicianName);
  if (!canonical) {
    return [];
  }

  const conflicts: FusionConflict[] = [];
  const observed = new Map<string, string>();

  sources.employment.forEach((credential) => {
    const derived =
      normalizeName(extractNameFromCredential(credential)) ??
      normalizeName(extractNameFromMetadata(credential.metadata));
    if (!derived || derived === canonical) {
      return;
    }
    if (observed.has(derived)) {
      return;
    }
    observed.set(derived, credential.id);
    conflicts.push({
      id: randomUUID(),
      type: 'name_drift',
      severity: 'low',
      message: `Employment credential subject "${derived}" does not match clinician of record`,
      affectedComponentIds: [`employment:${credential.id}`],
      evidence: {
        canonicalName: canonical,
        credentialName: derived,
      },
    });
  });

  return conflicts;
}

function detectSpecialtyInconsistencies(
  sources: FusionSourceSnapshot,
  context: ConflictDetectionContext,
): FusionConflict[] {
  const clinicianSpecialty = normalizeSpecialty(context.clinicianSpecialty);
  if (!clinicianSpecialty) {
    return [];
  }

  const conflicts: FusionConflict[] = [];
  const seen = new Set<string>();

  const licenseSpecialties = sources.usLicenses
    .map((license) => normalizeSpecialty((license as any).specialty ?? extractFromMetadata(license.metadata, 'specialty')))
    .filter(Boolean) as string[];
  const employmentSpecialties = sources.employment
    .map((credential) =>
      normalizeSpecialty(
        (credential as any).specialty ??
          extractFromMetadata(credential.metadata, 'specialty') ??
          extractFromCredentialSubject(credential.credentialSubject, 'specialty'),
      ),
    )
    .filter(Boolean) as string[];

  [...licenseSpecialties, ...employmentSpecialties].forEach((specialty) => {
    if (!specialty || specialty === clinicianSpecialty || seen.has(specialty)) {
      return;
    }
    seen.add(specialty);
    conflicts.push({
      id: randomUUID(),
      type: 'specialty_inconsistent',
      severity: 'medium',
      message: `Observed specialty "${specialty}" diverges from profile specialty "${clinicianSpecialty}"`,
      affectedComponentIds: [],
      evidence: {
        clinicianSpecialty,
        observedSpecialty: specialty,
      },
    });
  });

  return conflicts;
}

function extractNameFromCredential(credential: Prisma.CredentialGetPayload<{}>): string | undefined {
  const subject = credential.credentialSubject as Record<string, unknown> | undefined;
  if (subject && typeof subject.name === 'string') {
    return subject.name;
  }
  return undefined;
}

function extractNameFromMetadata(metadata: Prisma.JsonValue | null | undefined): string | undefined {
  if (!metadata || typeof metadata !== 'object') return undefined;
  const cast = metadata as Record<string, unknown>;
  if (typeof cast.subjectName === 'string') {
    return cast.subjectName;
  }
  if (typeof cast.employeeName === 'string') {
    return cast.employeeName;
  }
  return undefined;
}

function extractFromMetadata(
  metadata: Prisma.JsonValue | null | undefined,
  field: string,
): string | undefined {
  if (!metadata || typeof metadata !== 'object') {
    return undefined;
  }
  const cast = metadata as Record<string, unknown>;
  const value = cast[field];
  return typeof value === 'string' ? value : undefined;
}

function extractFromCredentialSubject(
  subject: Prisma.JsonValue | null | undefined,
  field: string,
): string | undefined {
  if (!subject || typeof subject !== 'object') {
    return undefined;
  }
  const cast = subject as Record<string, unknown>;
  const value = cast[field];
  return typeof value === 'string' ? value : undefined;
}

function normalizeName(name?: string | null): string | undefined {
  if (!name) return undefined;
  const trimmed = name.trim();
  if (!trimmed) return undefined;
  return trimmed.replace(/\s+/g, ' ').toLowerCase();
}

function normalizeSpecialty(value?: string | null): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.toLowerCase();
}









