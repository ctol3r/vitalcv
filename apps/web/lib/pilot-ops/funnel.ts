'use client';

import {
  trackPilotEvent,
  type PilotEntityContext,
} from '@/lib/pilot-ops/client';

export const PILOT_FUNNEL_STEP_TYPES = [
  'npi_submitted',
  'readiness_viewed',
  'passport_viewed',
  'review_opened',
  'employer_action_taken',
] as const;

export type PilotFunnelStepType = (typeof PILOT_FUNNEL_STEP_TYPES)[number];

function normalizeNpi(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? '';
  return /^\d{10}$/.test(trimmed) ? trimmed : null;
}

function digestToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('');
}

async function hashFunnelSubject(value: string): Promise<string | null> {
  if (
    typeof window === 'undefined'
    || typeof window.crypto === 'undefined'
    || typeof window.crypto.subtle === 'undefined'
  ) {
    return null;
  }

  try {
    const encoded = new TextEncoder().encode(`vitalcv.funnel:${value}`);
    const digest = await window.crypto.subtle.digest('SHA-256', encoded);
    return digestToHex(digest);
  } catch {
    return null;
  }
}

export async function trackPilotFunnelEvent(input: {
  eventType: PilotFunnelStepType;
  npi?: string | null;
  route?: string | null;
  role?: string | null;
  message?: string | null;
  entity?: PilotEntityContext | null;
  details?: Record<string, unknown> | null;
  dedupeKey?: string | null;
  oncePerSession?: boolean;
}): Promise<void> {
  const normalizedNpi = normalizeNpi(input.npi);
  const funnelSubjectHash = normalizedNpi
    ? await hashFunnelSubject(normalizedNpi)
    : null;

  await trackPilotEvent({
    eventType: input.eventType,
    route: input.route,
    role: input.role,
    message: input.message,
    entity: input.entity ?? null,
    details: {
      ...(input.details ?? {}),
      funnelStep: input.eventType,
      funnelSubjectHash,
      funnelVersion: 'v1',
    },
    dedupeKey: input.dedupeKey,
    oncePerSession: input.oncePerSession,
  });
}
