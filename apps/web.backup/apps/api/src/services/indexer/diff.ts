import type { MasterCredentialIndex } from '@prisma/client';
import { createHash } from 'crypto';
import { createAnchor } from '../verify/anchor';
import type { IndexCredentialType, IndexStatus, MasterIndexRow } from './types';

export interface IndexDiffChange {
  field: 'status' | 'issuerDid' | 'lastUpdated' | 'presence';
  previous: string | null;
  next: string | null;
}

export interface IndexDiffEntry {
  credentialType: IndexCredentialType;
  credentialId: string;
  changes: IndexDiffChange[];
}

export interface IndexDiffResult {
  clinicianId: string;
  diffHash: string;
  anchor: ReturnType<typeof createAnchor>;
  diffs: IndexDiffEntry[];
}

type PersistedRow = Pick<
  MasterCredentialIndex,
  'credentialId' | 'credentialType' | 'status' | 'issuerDid' | 'lastUpdated'
>;

export function diffIndexSnapshots(
  clinicianId: string,
  previous: PersistedRow[],
  next: MasterIndexRow[],
): IndexDiffResult {
  const previousMap = new Map<string, PersistedRow>(
    previous.map((row) => [indexKey(row.credentialType as IndexCredentialType, row.credentialId), row]),
  );
  const nextMap = new Map<string, MasterIndexRow>(
    next.map((row) => [indexKey(row.credentialType, row.credentialId), row]),
  );

  const keys = new Set<string>([...previousMap.keys(), ...nextMap.keys()]);
  const diffs: IndexDiffEntry[] = [];

  for (const key of keys) {
    const prev = previousMap.get(key);
    const curr = nextMap.get(key);

    if (!prev && curr) {
      diffs.push({
        credentialType: curr.credentialType,
        credentialId: curr.credentialId,
        changes: [
          {
            field: 'presence',
            previous: 'absent',
            next: 'present',
          },
          {
            field: 'status',
            previous: null,
            next: curr.status,
          },
        ],
      });
      continue;
    }

    if (prev && !curr) {
      diffs.push({
        credentialType: prev.credentialType as IndexCredentialType,
        credentialId: prev.credentialId,
        changes: [
          {
            field: 'presence',
            previous: 'present',
            next: 'absent',
          },
          {
            field: 'status',
            previous: prev.status as IndexStatus,
            next: null,
          },
        ],
      });
      continue;
    }

    if (!prev || !curr) continue;

    const changes: IndexDiffChange[] = [];
    if (normalize(prev.status) !== normalize(curr.status)) {
      changes.push({
        field: 'status',
        previous: prev.status,
        next: curr.status,
      });
    }
    if ((prev.issuerDid ?? '').trim() !== (curr.issuerDid ?? '').trim()) {
      changes.push({
        field: 'issuerDid',
        previous: prev.issuerDid,
        next: curr.issuerDid,
      });
    }
    const prevUpdated = toIsoString(prev.lastUpdated);
    if (prevUpdated !== curr.lastUpdated) {
      changes.push({
        field: 'lastUpdated',
        previous: prevUpdated,
        next: curr.lastUpdated,
      });
    }

    if (changes.length) {
      diffs.push({
        credentialType: curr.credentialType,
        credentialId: curr.credentialId,
        changes,
      });
    }
  }

  const diffHash = createHash('sha256')
    .update(
      JSON.stringify(
        diffs.map((entry) => ({
          key: indexKey(entry.credentialType, entry.credentialId),
          changes: entry.changes,
        })),
      ),
    )
    .digest('hex');

  const anchor = createAnchor([clinicianId, diffHash, Date.now()], 'index-diff');

  return {
    clinicianId,
    diffHash,
    anchor,
    diffs,
  };
}

function indexKey(type: IndexCredentialType, id: string) {
  return `${type}:${id}`;
}

function normalize(status: string | null | undefined) {
  return (status ?? '').toLowerCase();
}

function toIsoString(value: Date | string | null): string | null {
  if (!value) return null;
  if (typeof value === 'string') return value;
  return value.toISOString();
}



