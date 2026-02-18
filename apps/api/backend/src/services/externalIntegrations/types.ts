/**
 * External Integration Types — Wave X
 *
 * Provider interfaces for Nursys and PECOS integrations.
 * Abstracts real API calls behind strategy interfaces so the system
 * can run deterministic mocks in dev and live providers in production.
 */

// ── Nursys ──────────────────────────────────────────────────

export type NursysEvent = {
  npi: string;
  licenseNumber: string;
  state: string;
  eventType: string;
  rawPayload: Record<string, unknown>;
  receivedAt: Date;
};

export interface NursysProvider {
  fetchLicenseStatus(npi: string): Promise<NursysEvent[]>;
}

// ── PECOS ───────────────────────────────────────────────────

export type PecosCheck = {
  npi: string;
  enrolled: boolean;
  enrollmentType: string | null;
  checkedAt: Date;
  rawPayload: Record<string, unknown>;
};

export interface PecosProvider {
  fetchEnrollmentStatus(npi: string): Promise<PecosCheck>;
}

// ── Integration Health ──────────────────────────────────────

export type IntegrationMode = 'mock' | 'live';

export type IntegrationHealthStatus = {
  nursysMode: IntegrationMode;
  pecosMode: IntegrationMode;
  lastNursysFetch: string | null;
  lastPecosCheck: string | null;
  healthy: boolean;
};
