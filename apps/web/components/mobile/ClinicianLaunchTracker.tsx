'use client';

import { useEffect } from 'react';
import { useClinicianMobile } from '@/components/mobile/ClinicianMobileProvider';
import { trackClinicianEvent } from '@/lib/mobile/analytics';

const OPENED_BLOCKERS_STORAGE_KEY = 'vitalcv.mobile.opened-blockers';

interface StoredBlockerRecord {
  id: string;
  type?: string;
  label?: string;
}

function readOpenedBlockers(): StoredBlockerRecord[] {
  if (typeof window === 'undefined') {
    return [];
  }

  const raw = window.localStorage.getItem(OPENED_BLOCKERS_STORAGE_KEY);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter((entry): entry is StoredBlockerRecord => (
      typeof entry === 'object'
      && entry !== null
      && 'id' in entry
      && typeof (entry as { id?: unknown }).id === 'string'
    ));
  } catch {
    return [];
  }
}

function writeOpenedBlockers(records: readonly StoredBlockerRecord[]): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(OPENED_BLOCKERS_STORAGE_KEY, JSON.stringify(records));
}

export default function ClinicianLaunchTracker() {
  const { data } = useClinicianMobile();
  const npi = data.workspace?.personProfile?.npi ?? null;

  useEffect(() => {
    const openedBlockers = readOpenedBlockers();
    if (openedBlockers.length === 0) {
      return;
    }

    const activeIds = new Set(data.blockers.map((blocker) => blocker.id));
    const resolved = openedBlockers.filter((blocker) => !activeIds.has(blocker.id));
    if (resolved.length === 0) {
      return;
    }

    resolved.forEach((blocker) => {
      void trackClinicianEvent('clinician.blocker_resolved', {
        npi,
        blockerId: blocker.id,
        blockerType: blocker.type ?? null,
        blockerLabel: blocker.label ?? null,
      });
    });

    writeOpenedBlockers(openedBlockers.filter((blocker) => activeIds.has(blocker.id)));
  }, [data.blockers, npi]);

  return null;
}

export function rememberOpenedBlocker(input: {
  id: string;
  type?: string;
  label?: string;
}) {
  if (typeof window === 'undefined') {
    return;
  }

  const current = readOpenedBlockers();
  if (current.some((entry) => entry.id === input.id)) {
    return;
  }

  writeOpenedBlockers([...current, input]);
}
