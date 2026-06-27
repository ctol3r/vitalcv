/**
 * Solution analytics (Wave 700, C5) — a typed event model + thin tracker for the
 * solutions funnel: landing engagement, role selection, demo requests, pilot
 * requests.
 *
 * Scope: this is the typed event contract + an ingestion endpoint. The downstream
 * analytics PROVIDER (warehouse / product analytics) is external — `track` posts
 * the validated event to /api/solution-analytics, which accepts it (no PII, no
 * persistence here). Pure event construction; the emit is injectable for testing.
 */

import type { SolutionRole } from './solutions';

export type SolutionEventType = 'landing_view' | 'role_selected' | 'demo_requested' | 'pilot_requested';

export interface SolutionEvent {
  schema: 'vitalcv.solution-event.v1';
  type: SolutionEventType;
  role: SolutionRole | null;
  /** ISO timestamp; injected (never read from a clock here) for determinism/testability. */
  occurredAt: string | null;
}

const EVENT_TYPES: SolutionEventType[] = ['landing_view', 'role_selected', 'demo_requested', 'pilot_requested'];
const VALID_ROLES: SolutionRole[] = ['clinician', 'recruiter', 'organization', 'enterprise'];
const ALLOWED_KEYS = ['schema', 'type', 'role', 'occurredAt'];

export function buildSolutionEvent(type: SolutionEventType, role: SolutionRole | null = null, occurredAt: string | null = null): SolutionEvent {
  return { schema: 'vitalcv.solution-event.v1', type, role, occurredAt };
}

/** Validate an inbound event (ingestion boundary — STRICT / fail-closed). Rejects
 * unknown event types, invalid roles, and ANY extra fields (so a PII-bearing body
 * can never be accepted). */
export function isSolutionEvent(value: unknown): value is SolutionEvent {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const e = value as Record<string, unknown>;
  if (Object.keys(e).some((k) => !ALLOWED_KEYS.includes(k))) return false; // no extra (PII) fields
  return e.schema === 'vitalcv.solution-event.v1'
    && typeof e.type === 'string'
    && EVENT_TYPES.includes(e.type as SolutionEventType)
    && (e.role === null || (typeof e.role === 'string' && VALID_ROLES.includes(e.role as SolutionRole)))
    && (e.occurredAt === null || typeof e.occurredAt === 'string');
}

export type EventEmit = (event: SolutionEvent) => void;

/** Fire-and-forget tracker. emit defaults to a beacon/fetch to the ingestion route. */
export function trackSolutionEvent(type: SolutionEventType, role: SolutionRole | null = null, emit?: EventEmit): void {
  const event = buildSolutionEvent(type, role, new Date().toISOString());
  if (emit) { emit(event); return; }
  try {
    const body = JSON.stringify(event);
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      navigator.sendBeacon('/api/solution-analytics', body);
    } else if (typeof fetch === 'function') {
      void fetch('/api/solution-analytics', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true });
    }
  } catch {
    // analytics is best-effort; never block the experience
  }
}
