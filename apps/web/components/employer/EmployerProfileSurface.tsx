'use client';

/**
 * EmployerProfileSurface — the LinkedIn/Doximity-style company profile, the
 * employer mirror of the clinician ProfileHeader + profile sections.
 *
 * The clinician creates a personal career profile; an organization creates a
 * company profile the same way. Company IDENTITY (legal name + Type-2 NPI) is
 * confirmed against NPPES when the org is claimed, so it carries a
 * "Source-confirmed" badge. Everything else — about, specialties, locations,
 * hiring details — is self-reported by the organization and is NOT independently
 * verified, so it carries a "User-entered" badge and honest language, exactly
 * like the clinician profile's truth contract.
 *
 * Client component: identity gating (Clerk) + the org read (/api/employer/
 * profile) + open roles (/api/employer/opportunities) happen here, so the page
 * can stay a sync server component and degrade to a calm signed-out state.
 */

import * as React from 'react';
import Link from 'next/link';
import { useUser } from '@clerk/nextjs';
import { Building2, MapPin, Briefcase, Globe, Stethoscope, PencilLine, ArrowRight } from 'lucide-react';
import { PROVENANCE_META, type ProfileProvenance } from '@/lib/profile/provenance';

interface OrgProfile {
  name?: string | null;
  npi?: string | null;
  facilityType?: string | null;
  specialties?: string[] | null;
  statesCovered?: string[] | null;
  tagline?: string | null;
  description?: string | null;
  website?: string | null;
  hiringTypes?: string[] | null;
  hiringStatus?: string | null;
}

interface OpenRole {
  id: string;
  title?: string | null;
  specialty?: string | null;
  state?: string | null;
  hiringType?: string | null;
  payRange?: string | null;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'CO';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function titleCase(s: string): string {
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function ProvenanceBadge({ provenance }: { provenance: ProfileProvenance }) {
  const meta = PROVENANCE_META[provenance];
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${meta.badgeClass}`}
      title={meta.description}
    >
      {meta.label}
    </span>
  );
}

function Section({
  title,
  provenance,
  children,
}: {
  title: string;
  provenance: ProfileProvenance;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-[var(--vt-border,rgba(0,0,0,0.08))] bg-[var(--vt-surface,white)] p-4 sm:p-5">
      <div className="mb-3 flex items-center gap-2">
        <h2 className="text-base font-semibold text-[var(--vt-text-primary)] sm:text-lg">{title}</h2>
        <ProvenanceBadge provenance={provenance} />
      </div>
      {children}
    </section>
  );
}

function ChipRow({ items, empty }: { items: string[]; empty: string }) {
  if (items.length === 0) {
    return <p className="text-sm text-[var(--vt-text-muted,#777)]">{empty}</p>;
  }
  return (
    <ul className="flex flex-wrap gap-2">
      {items.map((it) => (
        <li
          key={it}
          className="inline-flex items-center rounded-full border border-[var(--vt-border,rgba(0,0,0,0.1))] bg-[var(--vt-surface-subtle,#f5f5f4)] px-3 py-1 text-[13px] text-[var(--vt-text-secondary)]"
        >
          {it}
        </li>
      ))}
    </ul>
  );
}

export function EmployerProfileSurface() {
  const { isLoaded, isSignedIn } = useUser();
  const [org, setOrg] = React.useState<OrgProfile | null>(null);
  const [roles, setRoles] = React.useState<OpenRole[]>([]);
  const [loaded, setLoaded] = React.useState(false);

  React.useEffect(() => {
    if (!isSignedIn) return;
    let alive = true;
    (async () => {
      try {
        const [pRes, oRes] = await Promise.all([
          fetch('/api/employer/profile', { cache: 'no-store' }),
          fetch('/api/employer/opportunities', { cache: 'no-store' }).catch(() => null),
        ]);
        if (alive && pRes.ok) {
          const data = await pRes.json();
          setOrg((data?.profile ?? data?.organization ?? data) as OrgProfile);
        }
        if (alive && oRes && oRes.ok) {
          const data = await oRes.json();
          const list = (data?.opportunities ?? data?.roles ?? data ?? []) as OpenRole[];
          if (Array.isArray(list)) setRoles(list.filter((r) => r && r.id));
        }
      } catch {
        /* best-effort — the honest empty state renders below */
      } finally {
        if (alive) setLoaded(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, [isSignedIn]);

  // Signed-out / no organization access yet: a calm invitation, not a broken page.
  if (isLoaded && !isSignedIn) {
    return (
      <section className="rounded-2xl border border-[var(--vt-border,rgba(0,0,0,0.08))] bg-[var(--vt-surface,white)] p-6 text-center sm:p-8">
        <div className="mx-auto mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-[var(--vt-surface-subtle,#f0f4f0)] text-[var(--vt-text-secondary)]">
          <Building2 size={22} aria-hidden="true" />
        </div>
        <h2 className="text-lg font-semibold text-[var(--vt-text-primary)]">Build your company profile</h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-[var(--vt-text-secondary)]">
          Find your organization by its Type&nbsp;2 NPI and request access, then present a
          source-backed company profile clinicians can review — the same way clinicians present
          their career evidence.
        </p>
        <Link
          href="/employers"
          // Inline background (unlayered → always wins) + text-white: the
          // `bg-[var(--vt-text-primary)]` utility is beaten by an <a> reset
          // outside the .mz context, which left the CTA transparent with light
          // text (invisible). This mirrors the navbar's proven inline pattern.
          style={{ backgroundColor: 'var(--vt-text-primary)' }}
          className="mt-5 inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-[13px] font-semibold text-white transition-opacity hover:opacity-90"
        >
          Request organization access <ArrowRight size={14} aria-hidden="true" />
        </Link>
      </section>
    );
  }

  const name = (org?.name ?? '').trim() || 'Your organization';
  const npi = org?.npi?.trim() || null;
  const facility = org?.facilityType?.trim() || null;
  const website = org?.website?.trim() || null;
  const hiringStatus = org?.hiringStatus?.trim() || null;
  const specialties = (org?.specialties ?? []).filter(Boolean);
  const states = (org?.statesCovered ?? []).filter(Boolean);
  const hiringTypes = (org?.hiringTypes ?? []).filter(Boolean);
  const tagline = org?.tagline?.trim() || null;
  const description = org?.description?.trim() || null;

  return (
    <div className="space-y-5">
      {/* ── Identity header (mirror of the clinician ProfileHeader) ── */}
      <section
        aria-label="Company profile header"
        className="overflow-hidden rounded-2xl border border-[var(--vt-border,rgba(0,0,0,0.08))] bg-[var(--vt-surface,white)]"
      >
        <div
          className="h-24 w-full sm:h-28"
          style={{
            background:
              'linear-gradient(120deg, color-mix(in oklab, var(--vt-accent-editorial, #4338CA) 18%, transparent), color-mix(in oklab, var(--vt-accent-editorial, #4338CA) 6%, transparent))',
          }}
          aria-hidden="true"
        />
        <div className="px-4 pb-5 sm:px-6">
          <div className="-mt-10 flex flex-col gap-4 sm:-mt-12 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-end">
              <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl ring-4 ring-[var(--vt-surface,white)] sm:h-24 sm:w-24 bg-[var(--vt-surface-subtle,#eef1ee)] text-2xl font-semibold text-[var(--vt-text-secondary,#555)]">
                {initials(name)}
              </div>
              <div className="pb-1">
                <h1 className="text-xl font-semibold leading-tight text-[var(--vt-text-primary)] sm:text-2xl">{name}</h1>
                <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-[var(--vt-text-secondary)]">
                  <span className="inline-flex items-center gap-1.5">
                    <Building2 size={14} aria-hidden="true" />
                    {facility ? titleCase(facility) : 'Organization'}
                  </span>
                  {npi ? (
                    <span className="inline-flex items-center gap-1.5 font-mono text-xs text-[var(--vt-text-muted,#777)]">
                      NPI {npi}
                      <ProvenanceBadge provenance="VERIFIED" />
                    </span>
                  ) : null}
                  {website ? (
                    <span className="inline-flex items-center gap-1.5">
                      <Globe size={14} aria-hidden="true" />
                      {website.replace(/^https?:\/\//, '')}
                    </span>
                  ) : null}
                </p>
              </div>
            </div>
            <Link
              href="/employer/post"
              className="inline-flex items-center gap-1.5 self-start rounded-full border border-[var(--vt-border,rgba(0,0,0,0.12))] px-3 py-1.5 text-xs font-medium text-[var(--vt-text-secondary)] transition hover:text-[var(--vt-text-primary)] sm:self-auto"
            >
              <PencilLine size={13} aria-hidden="true" />
              Manage company
            </Link>
          </div>

          {hiringStatus ? (
            <span className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-[color-mix(in_oklab,var(--vt-accent-editorial,#4338CA)_30%,transparent)] bg-[color-mix(in_oklab,var(--vt-accent-editorial,#4338CA)_10%,transparent)] px-3 py-1 text-[12px] font-medium text-[var(--vt-accent-editorial,#4338CA)]">
              <Briefcase size={12} aria-hidden="true" />
              {titleCase(hiringStatus)}
            </span>
          ) : null}

          <p className="mt-4 text-[11px] leading-relaxed text-[var(--vt-text-muted,#777)]">
            Your organization&rsquo;s legal name and Type&nbsp;2 NPI are confirmed against NPPES.
            Everything below is <strong>self-reported by your organization and is not independently
            verified.</strong>
          </p>
        </div>
      </section>

      {/* ── About ── */}
      <Section title="About" provenance="USER_ENTERED">
        {tagline ? (
          <p className="text-sm font-medium text-[var(--vt-text-primary)]">{tagline}</p>
        ) : null}
        {description ? (
          <p className="mt-2 text-sm leading-relaxed text-[var(--vt-text-secondary)]">{description}</p>
        ) : (
          <p className="text-sm text-[var(--vt-text-muted,#777)]">
            Add a description of your organization so clinicians know who they&rsquo;d be joining.{' '}
            <Link href="/employer/post" className="underline underline-offset-2 hover:text-[var(--vt-text-primary)]">
              Edit company details
            </Link>
          </p>
        )}
      </Section>

      {/* ── Specialties ── */}
      <Section title="Specialties &amp; services" provenance="USER_ENTERED">
        <ChipRow items={specialties} empty="No specialties listed yet." />
      </Section>

      {/* ── Locations ── */}
      <Section title="Locations" provenance="USER_ENTERED">
        <div className="flex items-start gap-2">
          <MapPin size={16} className="mt-0.5 shrink-0 text-[var(--vt-text-muted,#777)]" aria-hidden="true" />
          <ChipRow items={states} empty="No coverage states listed yet." />
        </div>
      </Section>

      {/* ── Hiring ── */}
      <Section title="Hiring" provenance="USER_ENTERED">
        <ChipRow
          items={hiringTypes.map(titleCase)}
          empty="No hiring types listed yet."
        />
      </Section>

      {/* ── Open roles (real postings) ── */}
      <section className="rounded-2xl border border-[var(--vt-border,rgba(0,0,0,0.08))] bg-[var(--vt-surface,white)] p-4 sm:p-5">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-[var(--vt-text-primary)] sm:text-lg">
            Open roles {roles.length ? `(${roles.length})` : ''}
          </h2>
          <Link
            href="/employer/post"
            className="inline-flex items-center gap-1 text-[13px] font-semibold text-[var(--vt-text-primary)] underline-offset-4 hover:underline"
          >
            Post a role <ArrowRight size={13} aria-hidden="true" />
          </Link>
        </div>
        {roles.length === 0 ? (
          <p className="text-sm text-[var(--vt-text-muted,#777)]">
            {loaded ? 'No open roles yet — post your first opening.' : 'Loading your open roles…'}
          </p>
        ) : (
          <ul className="space-y-2.5">
            {roles.map((r) => (
              <li
                key={r.id}
                className="flex flex-col gap-1 rounded-xl border border-[var(--vt-border-subtle,rgba(0,0,0,0.06))] bg-[var(--vt-bg,white)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[var(--vt-text-primary)]">
                    {r.title || 'Untitled role'}
                  </p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px] text-[var(--vt-text-secondary)]">
                    {r.specialty ? (
                      <span className="inline-flex items-center gap-1">
                        <Stethoscope size={12} aria-hidden="true" />
                        {r.specialty}
                      </span>
                    ) : null}
                    {r.state ? <span>· {r.state}</span> : null}
                    {r.hiringType ? <span>· {titleCase(r.hiringType)}</span> : null}
                  </p>
                </div>
                {r.payRange ? (
                  <span className="shrink-0 font-mono text-[12px] text-[var(--vt-text-muted,#777)]">{r.payRange}</span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="px-1 pt-1 text-xs leading-relaxed text-[var(--vt-text-muted,#777)]">
        This is your organization&rsquo;s company profile. A public, shareable version for clinicians
        is a follow-up. Source-confirmed items are checked against a primary source; everything else is
        self-reported and clearly labeled.
      </p>
    </div>
  );
}
