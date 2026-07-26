'use client';

/**
 * useAiEnabled — one cached probe of /api/ai/status so AI affordances render only
 * when a model key is configured (no dead AI buttons in prod when AI is off).
 * The result is module-cached, so N components share a single request.
 */

import { useEffect, useState } from 'react';

let cached: boolean | null = null;
let inFlight: Promise<boolean> | null = null;

async function probe(): Promise<boolean> {
  if (cached !== null) return cached;
  if (!inFlight) {
    inFlight = fetch('/api/ai/status', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { enabled: false }))
      .then((d: { enabled?: boolean }) => {
        cached = Boolean(d.enabled);
        return cached;
      })
      .catch(() => {
        cached = false;
        return false;
      });
  }
  return inFlight;
}

/** undefined while probing; true/false once known. */
export function useAiEnabled(): boolean | undefined {
  const [enabled, setEnabled] = useState<boolean | undefined>(cached ?? undefined);
  useEffect(() => {
    let active = true;
    void probe().then((v) => {
      if (active) setEnabled(v);
    });
    return () => {
      active = false;
    };
  }, []);
  return enabled;
}
