import { z } from 'zod';
import { CompactTypeEnum, normalizeStateCode } from './CompactParticipation.js';

export const ClinicianCompactWalletSchema = z.object({
  clinicianId: z.string().min(1, 'clinicianId is required'),
  compactType: CompactTypeEnum,
  homeState: z.string().length(2).transform(normalizeStateCode),
  privileges: z.array(z.string().length(2).transform(normalizeStateCode)).default([]),
  issuedAt: z.string().datetime().or(z.date()).default(() => new Date()),
  expiresAt: z.string().datetime().or(z.date()).optional(),
  metadata: z.record(z.any()).optional(),
});

export type ClinicianCompactWalletEntry = z.infer<typeof ClinicianCompactWalletSchema>;

export function hasPrivilege(entry: ClinicianCompactWalletEntry, state: string): boolean {
  const normalized = normalizeStateCode(state);
  return entry.privileges.includes(normalized) || entry.homeState === normalized;
}

export function grantPrivilege(entry: ClinicianCompactWalletEntry, state: string): ClinicianCompactWalletEntry {
  const normalized = normalizeStateCode(state);
  if (entry.privileges.includes(normalized)) {
    return entry;
  }
  return {
    ...entry,
    privileges: [...entry.privileges, normalized].sort(),
  };
}

export function revokePrivilege(entry: ClinicianCompactWalletEntry, state: string): ClinicianCompactWalletEntry {
  const normalized = normalizeStateCode(state);
  return {
    ...entry,
    privileges: entry.privileges.filter((code) => code !== normalized),
  };
}

export function mergeWalletEntries(
  entries: ClinicianCompactWalletEntry[],
): ClinicianCompactWalletEntry[] {
  const byCompact = new Map<string, ClinicianCompactWalletEntry>();
  for (const entry of entries) {
    const existing = byCompact.get(entry.compactType);
    if (!existing) {
      byCompact.set(entry.compactType, { ...entry, privileges: [...new Set(entry.privileges)].sort() });
      continue;
    }
    const merged = new Set([...existing.privileges, ...entry.privileges]);
    byCompact.set(entry.compactType, {
      ...existing,
      privileges: [...merged].sort(),
      issuedAt: new Date(
        Math.min(toMillis(existing.issuedAt), toMillis(entry.issuedAt)),
      ),
      expiresAt: resolveExpiration(existing.expiresAt, entry.expiresAt),
    });
  }
  return Array.from(byCompact.values());
}

function resolveExpiration(a?: string | Date, b?: string | Date) {
  if (!a) return b;
  if (!b) return a;
  const aTime = toMillis(a);
  const bTime = toMillis(b);
  return new Date(Math.max(aTime, bTime));
}

function toMillis(value: string | Date): number {
  return value instanceof Date ? value.getTime() : Date.parse(value);
}

