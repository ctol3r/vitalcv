'use client';

/**
 * CareerEvidenceGraph — the holder's own Career Evidence Graph (W220/W221).
 *
 * Projects the clinician's REAL professional-memory timeline (Wave 225
 * /api/timeline/[npi]: evidence checks, licensure, screening, recognition,
 * acceptances) into the constellation sky, replacing the illustrative demo
 * stars used on marketing surfaces. Every lit star traces to an evidence-backed
 * career event; the "future" era renders open roles and projections and is
 * always labeled as projected, never asserted.
 *
 * Degrades honestly: while the timeline loads — or when no dated evidence
 * exists yet — the sky falls back to the illustrative layout and says so.
 */

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Sparkles, Waypoints } from 'lucide-react';
import {
  MatchaConstellation,
  type ConstellationStarDef,
  type Kind,
} from '@/components/matcha/MatchaConstellation';
import { useClinicianMobile } from '@/components/mobile/ClinicianMobileProvider';
import { Reveal } from '@/components/motion/Reveal';
import { FEATURES } from '@/lib/features';

const NPI_RE = /^\d{10}$/;

/** The slice of a Wave 225 CareerEvent this projection reads. */
interface TimelineEventSlice {
  eventId: string;
  occurredAt: string | null;
  type: string;
  label: string;
  recognitionImpact: 'recognition' | 'acceptance' | 'start' | 'none';
}

interface TimelineSlice {
  events: TimelineEventSlice[];
  firstAt: string | null;
  lastAt: string | null;
}

const CREDENTIAL_TYPES = new Set([
  'identity_verification',
  'licensure',
  'certification',
  'screening',
  'enrollment',
]);

function kindForEvent(event: TimelineEventSlice): Kind {
  if (event.recognitionImpact !== 'none') return 'recognition';
  if (CREDENTIAL_TYPES.has(event.type)) return 'credential';
  return 'origin';
}

/**
 * Project dated career events onto the constellation's temporal axis.
 * Real events span t ∈ [0.08, 0.58] (origin → now); the future era
 * (t > 0.62) is reserved for clearly-projected entries.
 */
function projectStars(
  timeline: TimelineSlice,
  opts: { readinessScore: number | null; specialty?: string; openRoles: number },
): ConstellationStarDef[] | null {
  const dated = timeline.events.filter((e) => e.occurredAt);
  if (dated.length === 0) return null;

  // Latest event per label wins — repeated checks of the same source stay one star.
  const byLabel = new Map<string, TimelineEventSlice>();
  for (const event of dated) {
    const existing = byLabel.get(event.label);
    if (!existing || (event.occurredAt ?? '') > (existing.occurredAt ?? '')) {
      byLabel.set(event.label, event);
    }
  }

  // Recognition outranks credentials outranks the rest; recent outranks old.
  const significance = (e: TimelineEventSlice) =>
    e.recognitionImpact !== 'none' ? 2 : CREDENTIAL_TYPES.has(e.type) ? 1 : 0;
  const picked = [...byLabel.values()]
    .sort((a, b) => significance(b) - significance(a) || (b.occurredAt ?? '').localeCompare(a.occurredAt ?? ''))
    .slice(0, 12);

  const times = picked.map((e) => Date.parse(e.occurredAt!)).filter(Number.isFinite);
  const minT = Math.min(...times);
  const maxT = Math.max(Date.now(), ...times);
  const span = Math.max(1, maxT - minT);

  const rings: Array<2 | 3> = [2, 3, 3, 2];
  const stars: ConstellationStarDef[] = picked.map((event, i) => {
    const at = Date.parse(event.occurredAt!);
    const t = 0.08 + ((Number.isFinite(at) ? at : maxT) - minT) / span * 0.5;
    return {
      id: event.eventId,
      label: event.label,
      kind: kindForEvent(event),
      era: t < 0.35 ? 'origin' : 'now',
      t,
      ring: rings[i % rings.length],
    };
  });

  // "Now" anchors from live wallet state.
  if (opts.readinessScore != null) {
    stars.push({ id: 'readiness', label: `Readiness ${opts.readinessScore}`, kind: 'readiness', era: 'now', t: 0.5, ring: 1 });
  }
  if (opts.specialty) {
    stars.push({ id: 'specialty', label: opts.specialty, kind: 'readiness', era: 'now', t: 0.54, ring: 3 });
  }

  // Future era — projected, and labeled as such.
  if (opts.openRoles > 0) {
    stars.push({
      id: 'open-roles',
      label: `${opts.openRoles} open role${opts.openRoles === 1 ? '' : 's'}`,
      kind: 'future',
      era: 'future',
      t: 0.74,
      ring: 2,
    });
  }
  stars.push({ id: 'projected-role', label: 'Projected: next role', kind: 'future', era: 'future', t: 0.84, ring: 3 });
  stars.push({ id: 'projected-growth', label: 'Projected: what compounds next', kind: 'future', era: 'future', t: 0.92, ring: 2 });

  return stars;
}

export function CareerEvidenceGraph() {
  const { data } = useClinicianMobile();
  const npi = data.workspace?.personProfile?.npi ?? null;
  const specialty = data.workspace?.personProfile?.specialty ?? undefined;
  const readinessScore = data.trustState?.readinessScore ?? null;
  const openRoles = data.availableOpportunities.length;

  const [timeline, setTimeline] = useState<TimelineSlice | null>(null);
  const [state, setState] = useState<'loading' | 'live' | 'illustrative'>('loading');

  useEffect(() => {
    if (!npi || !NPI_RE.test(npi)) {
      setState('illustrative');
      return;
    }
    const controller = new AbortController();
    (async () => {
      try {
        const res = await fetch(`/api/timeline/${npi}`, { cache: 'no-store', signal: controller.signal });
        if (!res.ok) throw new Error(`timeline ${res.status}`);
        const body = (await res.json()) as TimelineSlice;
        if (Array.isArray(body.events)) {
          setTimeline(body);
          setState('live');
        } else {
          setState('illustrative');
        }
      } catch {
        if (!controller.signal.aborted) setState('illustrative');
      }
    })();
    return () => controller.abort();
  }, [npi]);

  const starDefs = useMemo(() => {
    if (!timeline) return undefined;
    return projectStars(timeline, { readinessScore, specialty, openRoles }) ?? undefined;
  }, [timeline, readinessScore, specialty, openRoles]);

  const live = state === 'live' && starDefs && starDefs.length > 0;
  const evidenceCount = live
    ? starDefs.filter((s) => s.era !== 'future' && s.id !== 'readiness' && s.id !== 'specialty').length
    : 0;

  return (
    <Reveal>
      <section aria-label="Career evidence graph" className="mz-glass-strong overflow-hidden p-0">
        <div className="flex flex-wrap items-center justify-between gap-2 px-5 pt-5">
          <span className="mz-eyebrow">
            <Waypoints className="h-3 w-3" aria-hidden="true" />
            Career evidence graph
          </span>
          <span className="mz-mono text-[11px] uppercase tracking-[0.18em] opacity-60">
            {live
              ? `${evidenceCount} evidence-backed event${evidenceCount === 1 ? '' : 's'}`
              : state === 'loading'
                ? 'Projecting your evidence…'
                : 'Illustrative sky — evidence lights up as checks complete'}
          </span>
        </div>

        <div className="px-2 sm:px-4">
          <MatchaConstellation
            height={400}
            starDefs={live ? starDefs : undefined}
            profile={{ specialty, readinessScore, matchCount: openRoles }}
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--rule)] px-5 py-4">
          <p className="mz-small max-w-xl">
            Each lit star traces to a career event in your wallet — checks, licensure,
            recognition. The future era is projected, never asserted. Scrub time to travel it.
          </p>
          <div className="flex shrink-0 items-center gap-2">
            <Link href="/holder/timeline" className="mz-btn mz-btn-ghost mz-btn-sm">
              Open timeline
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
            {FEATURES.MATCHA_V2 ? (
              <Link href="/holder/matcha" className="mz-btn mz-btn-sm">
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                Explore in MATCHA
              </Link>
            ) : null}
          </div>
        </div>
      </section>
    </Reveal>
  );
}
