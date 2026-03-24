'use client';

import { Building2, Layers2, Sparkles, Users } from 'lucide-react';
import { Drawer } from '@/components/ui/Drawer';
import type { GeoRegionDetailPayload } from '@/lib/intelligence/map-contracts';

function toneClass(tone: GeoRegionDetailPayload['momentumState'] | GeoRegionDetailPayload['shortageSeverity']) {
  switch (tone) {
    case 'rising':
      return 'vital-map-badge vital-map-badge--rising';
    case 'cooling':
      return 'vital-map-badge vital-map-badge--cooling';
    case 'declining':
    case 'critical':
      return 'vital-map-badge vital-map-badge--critical';
    case 'high':
      return 'vital-map-badge vital-map-badge--high';
    case 'moderate':
      return 'vital-map-badge vital-map-badge--moderate';
    case 'low':
      return 'vital-map-badge vital-map-badge--low';
    case 'none':
    case 'unknown':
    case 'stable':
    default:
      return 'vital-map-badge vital-map-badge--neutral';
  }
}

function DrawerSection({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3 rounded-2xl border border-[var(--vital-map-border)] bg-[var(--vital-map-panel-raised)] px-4 py-4">
      <div>
        <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--vital-map-text-muted)]">{eyebrow}</p>
        <h3 className="mt-1 text-sm font-semibold text-[var(--vital-map-text-strong)]">{title}</h3>
      </div>
      {children}
    </section>
  );
}

export function RegionDetailDrawer({
  detail,
  onClose,
  open,
  width,
}: {
  detail: GeoRegionDetailPayload | null;
  onClose: () => void;
  open: boolean;
  width: 'detail' | 'full';
}) {
  return (
    <Drawer
      open={open && Boolean(detail)}
      onClose={onClose}
      overlay={false}
      width={width}
      title={(
        <div className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-[0.2em] text-[var(--vital-map-text-muted)]">Region detail</span>
          <span className="text-sm font-semibold text-[var(--vital-map-text-strong)]">{detail?.regionLabel}</span>
        </div>
      )}
    >
      {detail ? (
        <div className="space-y-4 px-4 py-4 text-[var(--vital-map-text)]">
          <section className="rounded-2xl border border-[var(--vital-map-border)] bg-[var(--vital-map-panel-raised)] px-4 py-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className={toneClass(detail.momentumState)}>Momentum · {detail.momentumState}</span>
              <span className={toneClass(detail.shortageSeverity)}>Shortage · {detail.shortageSeverity}</span>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-[var(--vital-map-border)] bg-[var(--vital-map-panel)] px-3 py-3">
                <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--vital-map-text-muted)]">Providers</p>
                <p className="mt-2 font-mono text-xl font-semibold text-[var(--vital-map-text-strong)]">{detail.providerCount.toLocaleString()}</p>
              </div>
              <div className="rounded-xl border border-[var(--vital-map-border)] bg-[var(--vital-map-panel)] px-3 py-3">
                <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--vital-map-text-muted)]">Systems</p>
                <p className="mt-2 font-mono text-xl font-semibold text-[var(--vital-map-text-strong)]">{detail.systemCount.toLocaleString()}</p>
              </div>
            </div>
            <p className="mt-3 text-sm text-[var(--vital-map-text)]">{detail.momentumSummary}</p>
            <p className="mt-2 text-sm text-[var(--vital-map-text-muted)]">{detail.shortageSummary}</p>
          </section>

          <DrawerSection eyebrow="Top institutions" title="Institutions in region">
            <div className="space-y-2">
              {detail.institutions.map((institution) => (
                <article
                  key={institution.id}
                  className="flex items-start justify-between gap-3 rounded-xl border border-[var(--vital-map-border)] bg-[var(--vital-map-panel)] px-3 py-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-3.5 w-3.5 text-[var(--vital-map-node-institution)]" />
                      <p className="truncate text-sm font-semibold text-[var(--vital-map-text-strong)]">{institution.name}</p>
                    </div>
                    <p className="mt-1 text-[11px] text-[var(--vital-map-text-muted)]">{institution.city}, {institution.state}</p>
                    <p className="mt-1 text-[11px] text-[var(--vital-map-text)]">
                      {institution.providerCount.toLocaleString()} providers · {institution.topSpecialty}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-mono text-sm font-semibold text-[var(--vital-map-text-strong)]">
                      {institution.avgTrustScore !== null ? institution.avgTrustScore : 'NA'}
                    </p>
                    <span className={toneClass(institution.momentumState)}>{institution.momentumState}</span>
                  </div>
                </article>
              ))}
            </div>
          </DrawerSection>

          <DrawerSection eyebrow="Provider cohorts" title="Providers in region">
            <div className="space-y-2">
              {detail.providerCohorts.length > 0 ? detail.providerCohorts.map((cohort) => (
                <article
                  key={cohort.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-[var(--vital-map-border)] bg-[var(--vital-map-panel)] px-3 py-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Users className="h-3.5 w-3.5 text-[var(--vital-map-node-cluster)]" />
                      <p className="truncate text-sm font-semibold text-[var(--vital-map-text-strong)]">{cohort.label}</p>
                    </div>
                    <p className="mt-1 text-[11px] text-[var(--vital-map-text-muted)]">{cohort.specialty}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-mono text-sm font-semibold text-[var(--vital-map-text-strong)]">{cohort.providerCount.toLocaleString()}</p>
                    <span className={toneClass(cohort.momentumState)}>{cohort.momentumState}</span>
                  </div>
                </article>
              )) : (
                <p className="text-sm text-[var(--vital-map-text-muted)]">No provider cohorts are currently mapped for this region.</p>
              )}
            </div>
          </DrawerSection>

          <DrawerSection eyebrow="Top specialties" title="Specialty mix">
            <div className="grid gap-2">
              {detail.topSpecialties.map((specialty) => (
                <div
                  key={specialty.specialty}
                  className="flex items-center justify-between rounded-xl border border-[var(--vital-map-border)] bg-[var(--vital-map-panel)] px-3 py-3"
                >
                  <div className="flex items-center gap-2">
                    <Layers2 className="h-3.5 w-3.5 text-[var(--vital-map-node-investigator)]" />
                    <span className="text-sm text-[var(--vital-map-text-strong)]">{specialty.specialty}</span>
                  </div>
                  <span className="font-mono text-sm text-[var(--vital-map-text)]">{specialty.providerCount.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </DrawerSection>

          <DrawerSection eyebrow="Momentum / shortage metrics" title="Operator summary">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-[var(--vital-map-border)] bg-[var(--vital-map-panel)] px-3 py-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-3.5 w-3.5 text-[var(--vital-map-ring-rising)]" />
                  <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--vital-map-text-muted)]">Momentum</p>
                </div>
                <p className="mt-2 text-sm text-[var(--vital-map-text-strong)]">{detail.momentumSummary}</p>
              </div>
              <div className="rounded-xl border border-[var(--vital-map-border)] bg-[var(--vital-map-panel)] px-3 py-3">
                <div className="flex items-center gap-2">
                  <Layers2 className="h-3.5 w-3.5 text-[var(--vital-map-heat-core)]" />
                  <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--vital-map-text-muted)]">Shortage</p>
                </div>
                <p className="mt-2 text-sm text-[var(--vital-map-text-strong)]">{detail.shortageSummary}</p>
              </div>
            </div>
          </DrawerSection>
        </div>
      ) : null}
    </Drawer>
  );
}
