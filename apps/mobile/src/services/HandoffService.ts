/**
 * Handoff Service — wave-122: Mobile → Web Continuity
 *
 * Calls the handoff API to get a web continuation URL.
 * Clinician taps "Continue on Web" → opens passport without re-entry.
 */

import { ReadinessResult } from './ReadinessService';

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? 'https://api.vitalcv.com';

export interface HandoffResult {
  sessionId: string;
  webUrl: string;
  expiresAt: number;
}

/**
 * Creates a handoff session and returns the web URL.
 * Call after readiness is fetched — passes the snapshot so web
 * doesn't need to re-fetch identity.
 */
export async function createHandoff(result: ReadinessResult): Promise<HandoffResult> {
  const res = await fetch(`${API_BASE}/api/handoff`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      npi: result.npi,
      readinessSnapshot: {
        posture: result.posture,
        score: result.score,
        lanes: result.lanes.map(l => ({
          laneId: l.laneId,
          status: l.status,
          checkedAt: l.checkedAt,
        })),
        nextStep: result.nextStep,
        providerName: result.name,
      },
    }),
  });

  if (!res.ok) {
    throw new Error('Could not create handoff session. Try again.');
  }

  const data = await res.json();
  return {
    sessionId: data.sessionId,
    webUrl: data.webUrl,
    expiresAt: data.expiresAt,
  };
}
