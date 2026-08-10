'use client';

/**
 * CareerEvidenceGraph — the holder's own Career Evidence Graph (W220/W221).
 *
 * Projects the clinician's REAL professional-memory timeline (Wave 225
 * /api/timeline/[npi]: evidence checks, licensure, screening, recognition,
 * acceptances) into `CareerEvidenceTimeline`. Every recorded row traces to an
 * evidence-backed career event; the "headed" band renders open roles and
 * projections and is always labelled projected, never asserted.
 *
 * This was a constellation until CD-13 retired that mechanism. The projection
 * lost nothing in the move: a ruled layout needs strictly less than a polar one
 * (no angle, no ring, no orbital time), and the band split is the same split
 * the old `era` field encoded.
 *
 * Degrades honestly: while the timeline loads — or when no dated evidence
 * exists yet — no entries are passed, and the drawing states on its own face
 * that it is illustrative.
 */

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Sparkles, Waypoints } from 'lucide-react';
import {
  CareerEvidenceTimeline,
  type CareerEvidenceEntry,
} from '@/components/artifacts/CareerEvidenceTimeline';
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

/* `kindForEvent` lived here, mapping an event to one of the constellation's
   seven star colours. A ruled row has two states — recorded or projected — and
   both are carried by geometry, so the colour taxonomy has no counterpart and
   is not reintroduced. CREDENTIAL_TYPES survives: it still ranks which twelve
   events get picked. */

/**
 * Project dated career events onto the timeline's three bands.
 *
 * Was a projection onto a constellation's polar axis (t ∈ [0.08, 0.58] plus a
 * reserved future arc) until CD-13 retired that mechanism. A ruled layout needs
 * strictly less: no `t`, no ring, no kind — only which band an event belongs to
 * and whether it is recorded or projected. The band split is the same one the
 * era split encoded, so no information is lost in the move.
 */
function projectEntries(
  timeline: TimelineSlice,
  opts: { readinessScore: number | null; specialty?: string; openRoles: number },
): CareerEvidenceEntry[] | null {
  const dated = timeline.events.filter(
    (e) => e.occurredAt && Number.isFinite(Date.parse(e.occurredAt)),
  );
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

  const times = picked.map((e) => Date.parse(e.occurredAt!));
  const minT = Math.min(...times);
  const maxT = Math.max(Date.now(), ...times);
  const span = Math.max(1, maxT - minT);

  // Same split the polar `t` encoded: the earlier third of a career is where it
  // began, the rest is where it stands. Sorted oldest-first WITHIN a band —
  // `picked` is ordered by significance for selection, which is right for
  // choosing twelve out of many and wrong for reading left to right.
  const entries: CareerEvidenceEntry[] = picked
    .slice()
    .sort((a, b) => (a.occurredAt ?? '').localeCompare(b.occurredAt ?? ''))
    .map((event) => {
      const at = Date.parse(event.occurredAt!);
      const t = 0.08 + ((at - minT) / span) * 0.5;
      return {
        id: event.eventId,
        label: event.label,
        band: t < 0.35 ? ('began' as const) : ('now' as const),
      };
    });

  // "Now" anchors from live wallet state. These are recorded facts the wallet
  // already holds, so they are rows, not projections.
  if (opts.readinessScore != null) {
    entries.push({ id: 'readiness', label: `Readiness ${opts.readinessScore}`, band: 'now' });
  }
  if (opts.specialty) {
    entries.push({ id: 'specialty', label: opts.specialty, band: 'now' });
  }

  // Headed — projected, and marked as such on every entry. `projected` is set
  // per-row rather than inferred from the band so that moving a row between
  // bands can never quietly promote a projection into a fact.
  if (opts.openRoles > 0) {
    entries.push({
      id: 'open-roles',
      label: `${opts.openRoles} open role${opts.openRoles === 1 ? '' : 's'}`,
      band: 'headed',
      projected: true,
    });
  }
  // The word stays INSIDE the label, not delegated to the dashed outline or the
  // column heading. Geometry and headings are read by people looking at the
  // whole drawing; a label is what survives being read on its own.
  entries.push({ id: 'projected-role', label: 'Projected: next role', band: 'headed', projected: true });
  entries.push({
    id: 'projected-growth',
    label: 'Projected: what compounds next',
    band: 'headed',
    projected: true,
  });

  return entries;
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

  const entries = useMemo(() => {
    if (!timeline) return undefined;
    return projectEntries(timeline, { readinessScore, specialty, openRoles }) ?? undefined;
  }, [timeline, readinessScore, specialty, openRoles]);

  const live = state === 'live' && entries !== undefined && entries.length > 0;

  // Counts RECORDED events only — the two wallet anchors are state rather than
  // dated events, and projections are not evidence at all. Miscounting here
  // would put a number next to the word "evidence-backed" that includes rows
  // which are neither.
  const evidenceCount = live
    ? entries.filter((e) => !e.projected && e.band !== 'headed' && e.id !== 'readiness' && e.id !== 'specialty')
        .length
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
                ? 'Reading your evidence…'
                : 'Illustrative — your entries appear as checks complete'}
          </span>
        </div>

        {/* vt-artifact maps the drawing's --ask-* tokens from the global --vt-*
            set; without an ancestor carrying it every fill computes to invalid
            and falls back to SVG black. */}
        <div className="vt-artifact px-2 sm:px-4">
          {/* When the timeline is live these are the clinician's real events;
              otherwise no entries are passed and the drawing states that it is
              illustrative on its own face. */}
          <CareerEvidenceTimeline entries={live ? entries ?? undefined : undefined} />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--rule)] px-5 py-4">
          <p className="mz-small max-w-xl">
            Each recorded row traces to a career event in your profile — checks, licensure,
            recognition — and sits on its own line. What you are headed toward is projected,
            never asserted, and never gains that line.
          </p>
          <div className="flex shrink-0 items-center gap-2">
            <Link href="/holder/timeline" className="mz-btn mz-btn-ghost mz-btn-sm">
              Open timeline
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
            {FEATURES.MATCHA_V2 ? (
              <Link href="/holder/matcha" className="mz-btn mz-btn-sm">
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                Explore your matches
              </Link>
            ) : null}
          </div>
        </div>
      </section>
    </Reveal>
  );
}
