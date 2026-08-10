'use client';

/**
 * useCareerLoop — the state machine of the one real loop.
 *
 * Stage 1 mirrors the production homepage exactly: `checkNpi` gates format,
 * then `/api/identity/bootstrap/[npi]` and `/api/trust-state/[npi]` are
 * fetched in parallel (trust-state failure is non-fatal, as on `/`). The
 * result is the ONE `ClinicianCareerProfile` every later scene renders.
 *
 * Stage 2 calls the real anonymous MATCHA feed,
 * `GET /api/matcha/opportunities/[npi]`, and keeps its deterministic
 * explanations. An empty feed is an honest state, never substituted.
 *
 * Truth boundaries carried, not fixed: the bootstrap contract collapses
 * no-result / outage / rate-limit into `identitySource: 'UNAVAILABLE'` at
 * HTTP 200, so this hook exposes ONE `unavailable` outcome and never guesses
 * which occurred. TYPE_2 organizations get their own state from real
 * `npiType`.
 *
 * The demo fixture is loaded ONLY by an explicit call to `loadDemo()` — a
 * real NPI can never reach fixture data, and fixture state is flagged on
 * every render via `isDemo`.
 */

import { useCallback, useRef, useState } from 'react';

import { FUNNEL_EVENTS, trackFunnelEvent } from '@/lib/analytics/funnel';
import { checkNpi } from '@/lib/vital/npi';
import {
  buildEvidenceCapsule,
  type Bootstrap,
  type EvidenceCapsuleModel,
} from '@/components/home/evidence/evidenceCapsuleModel';
import type { TrustState } from '@/components/readiness/sourceCheckNarration';
import {
  buildCareerProfile,
  isOrganization,
  type ClinicianCareerProfile,
} from '@/lib/career-loop/profile';
import { DEMO_FIXTURE } from '@/lib/career-loop/demoFixture';

/** One MATCHA match as the anonymous feed returns it (subset we render). */
export interface LoopMatch {
  opportunityId: string;
  title: string;
  /** Canonical recipient id; absent means this listing cannot receive a share. */
  organizationId?: string;
  /** The API's own statement, never inferred from a display name. */
  applyAvailable: boolean;
  organizationName?: string;
  location?: string;
  hiringType?: string;
  matchBand?: string;
  fitReasons: Array<{ label: string; dimension?: string }>;
  blockers: Array<{ label?: string; reason?: string }>;
}

export type ResolveOutcome =
  | 'individual'      // registry named a person — the loop continues
  | 'organization'    // real TYPE_2 — honest dead end for a clinician profile
  | 'unavailable';    // registry could not answer (no-result/outage/rate-limit collapsed upstream)

export type LoopPhase =
  | 'idle' | 'typing' | 'invalid' | 'resolving'
  | 'resolved' | 'error';

export type MatchPhase = 'idle' | 'loading' | 'loaded' | 'empty' | 'error';

export interface CareerLoopState {
  phase: LoopPhase;
  outcome: ResolveOutcome | null;
  profile: ClinicianCareerProfile | null;
  /**
   * The full evidence rows behind `profile.readinessSummary` — the same
   * `buildEvidenceCapsule` output the counts were always derived from, now
   * exposed so the recognition view can render the rows themselves (UX-05)
   * instead of collapsing them to two numbers. Null except when an
   * individual resolves from the real pairing; the demo path leaves it null.
   */
  capsule: EvidenceCapsuleModel | null;
  invalidReason: string | null;
  /** True only when the explicit demo control loaded fixture data. */
  isDemo: boolean;
  matchPhase: MatchPhase;
  matches: LoopMatch[];
  selected: LoopMatch | null;
}

function normalizeMatches(payload: unknown): LoopMatch[] {
  const list = (payload as { matches?: unknown[] })?.matches;
  if (!Array.isArray(list)) return [];
  return list.slice(0, 6).map((m) => {
    const match = m as Record<string, unknown>;
    const opp = (match.opportunity ?? match) as Record<string, unknown>;
    const explanation = (match.explanation ?? match) as Record<string, unknown>;
    const fit = (explanation.fitReasons ?? match.fitReasons) as unknown[] | undefined;
    const blockers = (explanation.blockers ?? match.blockers) as unknown[] | undefined;
    const organizationId = (opp.organizationId ?? opp.organization_id ?? match.organizationId) as string | undefined;
    return {
      opportunityId: String(opp.id ?? opp.opportunityId ?? match.opportunityId ?? ''),
      title: String(opp.title ?? opp.role ?? 'Opportunity'),
      organizationId,
      // The public-safe response states this outright; fall back to the
      // presence of a real org id. An id is NEVER derived from a name.
      applyAvailable: typeof match.applyAvailable === 'boolean'
        ? match.applyAvailable
        : Boolean(organizationId),
      organizationName: (opp.organizationName ?? opp.employerName ?? opp.organization) as string | undefined,
      location: (opp.state ?? opp.location) as string | undefined,
      hiringType: (opp.hiringType ?? opp.employmentType) as string | undefined,
      matchBand: (explanation.matchBand ?? match.matchBand) as string | undefined,
      fitReasons: (fit ?? []).slice(0, 4).map((r) => {
        const reason = r as Record<string, unknown>;
        return { label: String(reason.label ?? reason.reason ?? reason.detail ?? ''), dimension: reason.dimension as string | undefined };
      }).filter((r) => r.label),
      blockers: (blockers ?? []).slice(0, 3).map((b) => {
        const blocker = b as Record<string, unknown>;
        return { label: String(blocker.label ?? blocker.reason ?? '') };
      }).filter((b) => b.label),
    };
  }).filter((m) => m.opportunityId || m.title !== 'Opportunity');
}

export function useCareerLoop() {
  const [state, setState] = useState<CareerLoopState>({
    phase: 'idle', outcome: null, profile: null, capsule: null, invalidReason: null,
    isDemo: false, matchPhase: 'idle', matches: [], selected: null,
  });
  const startedTyping = useRef(false);
  const requestSeq = useRef(0);

  const onInput = useCallback((raw: string) => {
    if (!startedTyping.current && raw.replace(/\D/g, '').length > 0) {
      startedTyping.current = true;
      trackFunnelEvent(FUNNEL_EVENTS.NPI_INPUT_STARTED);
    }
    setState((s) => ({
      ...s,
      phase: raw.replace(/\D/g, '').length > 0 ? 'typing' : 'idle',
      invalidReason: null,
      // a new number clears a previous journey — including any demo
      outcome: null, profile: null, capsule: null, isDemo: false,
      matchPhase: 'idle', matches: [], selected: null,
    }));
  }, []);

  const loadMatches = useCallback(async (npi: string, seq: number) => {
    setState((s) => (requestSeq.current === seq ? { ...s, matchPhase: 'loading' } : s));
    try {
      const res = await fetch(`/api/matcha/opportunities/${npi}`, { cache: 'no-store' });
      if (requestSeq.current !== seq) return;
      if (!res.ok) { setState((s) => ({ ...s, matchPhase: 'error' })); return; }
      const matches = normalizeMatches(await res.json());
      trackFunnelEvent(FUNNEL_EVENTS.MATCH_FEED_VIEWED, { count: matches.length });
      setState((s) => ({
        ...s,
        matchPhase: matches.length ? 'loaded' : 'empty',
        matches,
        selected: matches[0] ?? null,
      }));
      // Defaulting to the first match is the system's choice, not the
      // clinician's — recorded as its own event so selection rate stays honest.
      if (matches[0]) trackFunnelEvent(FUNNEL_EVENTS.MATCH_DEFAULTED);
    } catch {
      if (requestSeq.current === seq) setState((s) => ({ ...s, matchPhase: 'error' }));
    }
  }, []);

  const submit = useCallback(async (raw: string) => {
    const check = checkNpi(raw);
    if (check.validity !== 'valid' || !check.npi) {
      setState((s) => ({ ...s, phase: 'invalid', invalidReason: check.reason ?? 'Enter a 10-digit NPI.' }));
      return;
    }
    const npi = check.npi;
    const seq = ++requestSeq.current;
    trackFunnelEvent(FUNNEL_EVENTS.NPI_SUBMITTED);
    setState((s) => ({ ...s, phase: 'resolving', isDemo: false }));

    try {
      // The production pairing: identity is load-bearing, lanes are best-effort.
      const [bootRes, trust] = await Promise.all([
        fetch(`/api/identity/bootstrap/${npi}`, { cache: 'no-store' }),
        fetch(`/api/trust-state/${npi}`, { cache: 'no-store' })
          .then((r) => (r.ok ? (r.json() as Promise<TrustState>) : null))
          .catch(() => null),
      ]);
      if (requestSeq.current !== seq) return;
      if (!bootRes.ok) {
        trackFunnelEvent(FUNNEL_EVENTS.NPI_RESOLUTION_FAILED, { kind: 'proxy_error' });
        setState((s) => ({ ...s, phase: 'error' }));
        return;
      }
      const boot = (await bootRes.json()) as Bootstrap & { npi?: string };
      const profile = buildCareerProfile(npi, boot, trust);
      if (profile) {
        // The same pure transform the counts come from — no second source of truth.
        const capsule = buildEvidenceCapsule(npi, boot, trust);
        trackFunnelEvent(FUNNEL_EVENTS.NPI_RESOLVED, { outcome: 'individual' });
        setState((s) => ({ ...s, phase: 'resolved', outcome: 'individual', profile, capsule }));
        void loadMatches(npi, seq);
      } else if (isOrganization(boot)) {
        trackFunnelEvent(FUNNEL_EVENTS.NPI_RESOLVED, { outcome: 'organization' });
        setState((s) => ({ ...s, phase: 'resolved', outcome: 'organization', profile: null }));
      } else {
        // The upstream contract collapses no-result / outage / rate-limit.
        trackFunnelEvent(FUNNEL_EVENTS.NPI_RESOLUTION_FAILED, { kind: 'registry_unavailable' });
        setState((s) => ({ ...s, phase: 'resolved', outcome: 'unavailable', profile: null }));
      }
    } catch {
      if (requestSeq.current !== seq) return;
      trackFunnelEvent(FUNNEL_EVENTS.NPI_RESOLUTION_FAILED, { kind: 'network' });
      setState((s) => ({ ...s, phase: 'error' }));
    }
  }, [loadMatches]);

  const select = useCallback((m: LoopMatch) => {
    trackFunnelEvent(FUNNEL_EVENTS.OPPORTUNITY_SELECTED);
    setState((s) => ({ ...s, selected: m }));
  }, []);

  /** The explicit demo control — never reachable from a real NPI. */
  const loadDemo = useCallback(() => {
    const seq = ++requestSeq.current;
    void seq;
    setState({
      phase: 'resolved', outcome: 'individual',
      profile: DEMO_FIXTURE.profile, capsule: null, invalidReason: null,
      isDemo: true,
      matchPhase: DEMO_FIXTURE.matches.length ? 'loaded' : 'empty',
      matches: DEMO_FIXTURE.matches,
      selected: DEMO_FIXTURE.matches[0] ?? null,
    });
  }, []);

  const reset = useCallback(() => {
    ++requestSeq.current;
    setState({
      phase: 'idle', outcome: null, profile: null, capsule: null, invalidReason: null,
      isDemo: false, matchPhase: 'idle', matches: [], selected: null,
    });
  }, []);

  return { state, onInput, submit, select, loadDemo, reset };
}
