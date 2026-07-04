/**
 * Employer candidate pool — the hiring side of MATCHA.
 *
 * A pool entry is PHI-free by construction (NPI, specialty, locations, trust band, readiness
 * score, availability, passport URL — the exact fields the backend /api/marketplace/pool returns).
 * Trust-band descriptors describe *source coverage* honestly and never assert a bare "verified"
 * status. This module is pure and testable; the fetching hook + UI live in components/matcha/employer.
 */

export type TrustBand = 'L1' | 'L2' | 'L3';

export interface PoolCandidate {
  npi: string;
  specialty?: string;
  locations?: string[];
  trustBand?: TrustBand | string;
  readinessScore?: number;
  availableFrom?: string;
  urgency?: string;
  passportUrl?: string;
}

export interface PoolFilters {
  specialty?: string;
  state?: string;
  trustBand?: TrustBand;
  urgency?: string;
}

/** Honest, source-coverage descriptors for each trust band. No bare "verified" claims. */
export const BAND_DESCRIPTOR: Record<TrustBand, { label: string; blurb: string }> = {
  L1: { label: 'L1', blurb: 'Identity established' },
  L2: { label: 'L2', blurb: 'Multiple sources checked' },
  L3: { label: 'L3', blurb: 'Comprehensive source coverage' },
};

export function bandDescriptor(band: string | undefined): { label: string; blurb: string } {
  if (band === 'L1' || band === 'L2' || band === 'L3') return BAND_DESCRIPTOR[band];
  return { label: 'L0', blurb: 'Coverage in progress' };
}

/** Build the query string for the pool endpoint from filter selections. */
export function buildPoolQuery(filters: PoolFilters): string {
  const params = new URLSearchParams();
  if (filters.specialty?.trim()) params.set('specialty', filters.specialty.trim());
  if (filters.state?.trim()) params.set('state', filters.state.trim());
  if (filters.trustBand) params.set('trustBand', filters.trustBand);
  if (filters.urgency?.trim()) params.set('urgency', filters.urgency.trim());
  return params.toString();
}

/** Human-readable availability. Absent / past dates read as "Available now". */
export function formatAvailability(availableFrom: string | undefined, now: number): string {
  if (!availableFrom) return 'Available now';
  const t = Date.parse(availableFrom);
  if (!Number.isFinite(t)) return 'Available now';
  if (t <= now) return 'Available now';
  const d = new Date(t);
  return `Available ${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`;
}

/** A short, honest readiness phrase for a 0–100 score. */
export function readinessLabel(score: number | undefined): string {
  if (typeof score !== 'number' || !Number.isFinite(score)) return 'Readiness pending';
  return `Readiness ${Math.round(score)}/100`;
}
