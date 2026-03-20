'use client';

import type { ReactNode } from 'react';
import { AlertTriangle, ArrowRight, Building2, FileWarning, Network, RefreshCw, X } from 'lucide-react';
import {
  useFindingDetail,
  useProviderDetail,
  useStorylineDetail,
} from '@/hooks/useIntelligenceDetail';
import type { WorkspacePage, SpatialEntityType } from '@/lib/intelligence/spatial-workspace';
import {
  buildFindingBacklinks,
  buildProviderBacklinks,
  buildStorylineBacklinks,
  type BacklinkItem,
} from './page-node-model';

interface PageNodeProps {
  page: WorkspacePage;
  active: boolean;
  onClose: (key: string) => void;
  onFocus: (key: string) => void;
  onHover: (key: string | null) => void;
  onOpenBacklink: (type: SpatialEntityType, entityId: string, sourcePageKey: string, label: string) => void;
}

function PageChrome({
  page,
  title,
  eyebrow,
  icon,
  active,
  onClose,
  onFocus,
  children,
}: {
  page: WorkspacePage;
  title: string;
  eyebrow: string;
  icon: ReactNode;
  active: boolean;
  onClose: (key: string) => void;
  onFocus: (key: string) => void;
  children: ReactNode;
}) {
  return (
    <article
      className={`w-[23rem] shrink-0 rounded-2xl border bg-[var(--vt-surface)] shadow-sm transition ${
        active
          ? 'border-cyan-400/50 ring-1 ring-cyan-400/30'
          : 'border-[var(--vt-border)]'
      }`}
    >
      <header className="flex items-start justify-between gap-3 border-b border-[var(--vt-border)] px-4 py-4">
        <button
          type="button"
          data-spatial-interactive="true"
          onClick={() => onFocus(page.key)}
          className="min-w-0 text-left"
        >
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-[var(--vt-text-3)]">
            {icon}
            <span>{eyebrow}</span>
          </div>
          <h2 className="mt-2 line-clamp-2 text-base font-semibold text-[var(--vt-text-1)]">{title}</h2>
          <p className="mt-1 text-xs text-[var(--vt-text-3)]">{page.key}</p>
        </button>
        <button
          type="button"
          data-spatial-interactive="true"
          onClick={() => onClose(page.key)}
          className="rounded-full border border-[var(--vt-border)] p-1.5 text-[var(--vt-text-3)] transition hover:text-[var(--vt-text-1)]"
          aria-label={`Close ${title}`}
        >
          <X className="h-4 w-4" />
        </button>
      </header>
      <div className="space-y-4 px-4 py-4">
        {children}
      </div>
    </article>
  );
}

function MetricRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-[var(--vt-border)] bg-[var(--vt-surface-dim)] px-3 py-2">
      <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--vt-text-3)]">{label}</p>
      <p className="mt-1 text-sm font-semibold text-[var(--vt-text-1)]">{value}</p>
    </div>
  );
}

function BacklinksSection({
  items,
  pageKey,
  onOpenBacklink,
}: {
  items: readonly BacklinkItem[];
  pageKey: string;
  onOpenBacklink: (type: SpatialEntityType, entityId: string, sourcePageKey: string, label: string) => void;
}) {
  return (
    <section className="space-y-2">
      <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--vt-text-3)]">Backlinks</p>
      {items.length > 0 ? (
        items.slice(0, 5).map((item) => (
          <button
            key={item.key}
            type="button"
            data-spatial-interactive="true"
            onClick={() => onOpenBacklink(item.type, item.entityId, pageKey, item.label)}
            className="flex w-full items-center justify-between rounded-xl border border-[var(--vt-border)] bg-[var(--vt-surface-dim)] px-3 py-2 text-left transition hover:border-cyan-400/40 hover:text-[var(--vt-text-1)]"
          >
            <div>
              <p className="text-sm font-medium text-[var(--vt-text-1)]">{item.label}</p>
              <p className="mt-1 text-[10px] uppercase tracking-[0.14em] text-[var(--vt-text-3)]">{item.relationship}</p>
            </div>
            <ArrowRight className="h-4 w-4 text-[var(--vt-text-3)]" />
          </button>
        ))
      ) : (
        <p className="rounded-xl border border-dashed border-[var(--vt-border)] px-3 py-4 text-sm text-[var(--vt-text-3)]">
          No backlinks resolved for this page yet.
        </p>
      )}
    </section>
  );
}

function LoadingBlock() {
  return (
    <div className="space-y-3 animate-pulse">
      <div className="h-4 w-2/3 rounded bg-[var(--vt-surface-dim)]" />
      <div className="h-3 w-full rounded bg-[var(--vt-surface-dim)]" />
      <div className="h-3 w-5/6 rounded bg-[var(--vt-surface-dim)]" />
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="h-16 rounded-xl bg-[var(--vt-surface-dim)]" />
        <div className="h-16 rounded-xl bg-[var(--vt-surface-dim)]" />
      </div>
    </div>
  );
}

function ErrorBlock({
  error,
  onRetry,
}: {
  error: string;
  onRetry: () => void;
}) {
  return (
    <div className="space-y-3 rounded-xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm text-amber-100">
      <div className="flex items-center gap-2 font-medium">
        <AlertTriangle className="h-4 w-4" />
        Card unavailable
      </div>
      <p>{error}</p>
      <button
        type="button"
        data-spatial-interactive="true"
        onClick={onRetry}
        className="inline-flex items-center gap-2 rounded-full border border-amber-300/40 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em]"
      >
        <RefreshCw className="h-3.5 w-3.5" />
        Retry
      </button>
    </div>
  );
}

function ProviderPageNode(props: PageNodeProps) {
  const resource = useProviderDetail(props.page.entityId);
  const detail = resource.data;
  const title = props.page.label ?? detail?.provider.fullName ?? `Provider ${props.page.entityId}`;

  return (
    <PageChrome
      page={props.page}
      title={title}
      eyebrow="Provider"
      icon={<Building2 className="h-3.5 w-3.5" />}
      active={props.active}
      onClose={props.onClose}
      onFocus={props.onFocus}
    >
      {resource.loading && !detail ? <LoadingBlock /> : null}
      {resource.error && !detail ? <ErrorBlock error={resource.error} onRetry={resource.refresh} /> : null}
      {detail ? (
        <>
          <p className="text-sm leading-6 text-[var(--vt-text-2)]">
            {(detail.intelligence?.trustScore?.explanation.summary ?? detail.intelligence?.recentFeed[0]?.summary ?? `NPI ${detail.provider.npi} · ${detail.provider.specialties[0] ?? 'Provider profile'} · ${detail.provider.providerType ?? 'Trust profile'}`)}
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            <MetricRow label="Trust" value={String(detail.provider.trustScore)} />
            <MetricRow label="Findings" value={String(detail.provider.findingCount)} />
            <MetricRow label="Storylines" value={String(detail.provider.activeStorylineCount)} />
            <MetricRow label="Credentials" value={`${detail.provider.activeCredentialCount}/${detail.provider.totalCredentialCount}`} />
          </div>
          <section className="space-y-2">
            <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--vt-text-3)]">Content</p>
            <div className="rounded-xl border border-[var(--vt-border)] bg-[var(--vt-surface-dim)] px-3 py-3">
              <p className="text-sm font-medium text-[var(--vt-text-1)]">
                {detail.provider.specialties.slice(0, 3).join(' · ') || 'Specialty pending'}
              </p>
              <p className="mt-2 text-sm text-[var(--vt-text-2)]">
                {detail.findings.slice(0, 2).map((finding) => finding.title).join(' · ') || 'No provider findings loaded in this detail payload.'}
              </p>
            </div>
          </section>
          <BacklinksSection
            items={buildProviderBacklinks(detail)}
            pageKey={props.page.key}
            onOpenBacklink={props.onOpenBacklink}
          />
        </>
      ) : null}
    </PageChrome>
  );
}

function FindingPageNode(props: PageNodeProps) {
  const resource = useFindingDetail(props.page.entityId);
  const detail = resource.data;
  const title = props.page.label ?? detail?.finding.title ?? `Finding ${props.page.entityId}`;

  return (
    <PageChrome
      page={props.page}
      title={title}
      eyebrow="Finding"
      icon={<FileWarning className="h-3.5 w-3.5" />}
      active={props.active}
      onClose={props.onClose}
      onFocus={props.onFocus}
    >
      {resource.loading && !detail ? <LoadingBlock /> : null}
      {resource.error && !detail ? <ErrorBlock error={resource.error} onRetry={resource.refresh} /> : null}
      {detail ? (
        <>
          {/* ── SIGNAL ── what happened */}
          <section className="space-y-1.5">
            <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-[var(--vt-text-3)]">Signal</p>
            <p className="text-sm leading-6 text-[var(--vt-text-2)]">{detail.finding.summary || detail.finding.explanation}</p>
          </section>

          {/* ── IMPACT ── metrics */}
          <section className="space-y-1.5">
            <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-[var(--vt-text-3)]">Impact</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <MetricRow label="Severity" value={detail.finding.severity.toUpperCase()} />
              <MetricRow label="Status" value={detail.finding.status} />
              <MetricRow label="Confidence" value={`${Math.round(detail.finding.confidence * 100)}%`} />
              <MetricRow label="Occurrences" value={String(detail.finding.occurrenceCount)} />
            </div>
          </section>

          {/* ── EVIDENCE ── first-class panel */}
          <section className="space-y-1.5">
            <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-[var(--vt-text-3)]">Evidence</p>
            {(detail.finding.supportingEvidence ?? []).length > 0 ? (
              <div className="space-y-2">
                {(detail.finding.supportingEvidence ?? []).slice(0, 4).map((ev, i) => (
                  <div
                    key={`${ev.evidenceType}:${i}`}
                    className="rounded-xl border border-[var(--vt-border)] bg-[var(--vt-surface-dim)] px-3 py-2.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--vt-text-3)]">
                        {ev.sourceLabel ?? ev.evidenceType ?? 'Evidence'}
                      </p>
                      {ev.confidence != null && (
                        <span className="text-[10px] font-mono text-[var(--vt-text-3)]">
                          {Math.round(ev.confidence * 100)}%
                        </span>
                      )}
                    </div>
                    {ev.snippet && (
                      <p className="mt-1.5 line-clamp-3 text-sm leading-5 text-[var(--vt-text-2)]">{ev.snippet}</p>
                    )}
                    {ev.observedAt && (
                      <p className="mt-1 text-[10px] text-[var(--vt-text-3)]">{ev.observedAt}</p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="rounded-xl border border-dashed border-[var(--vt-border)] px-3 py-3 text-sm text-[var(--vt-text-3)]">
                Evidence not yet attached to this case.
              </p>
            )}
          </section>

          {/* ── NEXT STEP ── recommended action */}
          <section className="space-y-1.5">
            <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-[var(--vt-text-3)]">Next Step</p>
            <div className="rounded-xl border border-[var(--vt-border)] bg-[var(--vt-surface-dim)] px-3 py-2.5">
              <p className="text-sm leading-5 text-[var(--vt-text-2)]">
                {detail.relatedStoryline?.recommendedActions?.[0]
                  ?? detail.finding.explanation?.split('.').slice(-1)[0]?.trim()
                  ?? 'Next step pending review.'}
              </p>
              {detail.relatedStoryline?.title && (
                <p className="mt-1.5 text-[10px] text-[var(--vt-text-3)]">
                  Case: {detail.relatedStoryline.title}
                </p>
              )}
            </div>
          </section>

          {/* ── BACKLINKS ── */}
          <BacklinksSection
            items={buildFindingBacklinks(detail)}
            pageKey={props.page.key}
            onOpenBacklink={props.onOpenBacklink}
          />
        </>
      ) : null}
    </PageChrome>
  );
}

function StorylinePageNode(props: PageNodeProps) {
  const resource = useStorylineDetail(props.page.entityId);
  const detail = resource.data;
  const title = props.page.label ?? detail?.storyline.title ?? `Storyline ${props.page.entityId}`;

  return (
    <PageChrome
      page={props.page}
      title={title}
      eyebrow="Storyline"
      icon={<Network className="h-3.5 w-3.5" />}
      active={props.active}
      onClose={props.onClose}
      onFocus={props.onFocus}
    >
      {resource.loading && !detail ? <LoadingBlock /> : null}
      {resource.error && !detail ? <ErrorBlock error={resource.error} onRetry={resource.refresh} /> : null}
      {detail ? (
        <>
          {/* ── SIGNAL (what happened) */}
          <section className="space-y-1.5">
            <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-[var(--vt-text-3)]">Signal</p>
            <p className="text-sm leading-6 text-[var(--vt-text-2)]">{detail.storyline.summary}</p>
          </section>

          {/* ── IMPACT (why it matters) */}
          <section className="space-y-1.5">
            <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-[var(--vt-text-3)]">Impact</p>
            <p className="text-sm leading-6 text-[var(--vt-text-2)]">{detail.storyline.whyItMatters || 'Impact assessment pending.'}</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <MetricRow label="Severity" value={detail.storyline.severity.toUpperCase()} />
              <MetricRow label="Confidence" value={`${Math.round(detail.storyline.confidence * 100)}%`} />
              <MetricRow label="Signals" value={String(detail.storyline.findingIds.length)} />
              <MetricRow label="Status" value={detail.storyline.status} />
            </div>
          </section>

          {/* ── EVIDENCE */}
          <section className="space-y-1.5">
            <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-[var(--vt-text-3)]">Evidence</p>
            {detail.storyline.supportingEvidence.length > 0 ? (
              <div className="space-y-2">
                {detail.storyline.supportingEvidence.slice(0, 3).map((ev, i) => (
                  <div key={i} className="rounded-xl border border-[var(--vt-border)] bg-[var(--vt-surface-dim)] px-3 py-2.5">
                    <p className="text-sm leading-5 text-[var(--vt-text-2)]">{ev.bullet}</p>
                    {ev.sourceLabel && (
                      <p className="mt-1 text-[10px] text-[var(--vt-text-3)]">{ev.sourceLabel}</p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="rounded-xl border border-dashed border-[var(--vt-border)] px-3 py-3 text-sm text-[var(--vt-text-3)]">
                Evidence not yet attached to this case.
              </p>
            )}
          </section>

          {/* ── NEXT STEP */}
          <section className="space-y-1.5">
            <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-[var(--vt-text-3)]">Next Step</p>
            <div className="space-y-1.5">
              {(detail.storyline.recommendedActions ?? []).length > 0 ? (
                (detail.storyline.recommendedActions ?? []).slice(0, 2).map((action) => (
                  <div key={action} className="rounded-xl border border-[var(--vt-border)] bg-[var(--vt-surface-dim)] px-3 py-2.5">
                    <p className="text-sm leading-5 text-[var(--vt-text-2)]">{action}</p>
                  </div>
                ))
              ) : (
                <div className="rounded-xl border border-[var(--vt-border)] bg-[var(--vt-surface-dim)] px-3 py-2.5">
                  <p className="text-sm text-[var(--vt-text-3)]">Next step pending review.</p>
                </div>
              )}
            </div>
          </section>

          {/* ── BACKLINKS */}
          <BacklinksSection
            items={buildStorylineBacklinks(detail)}
            pageKey={props.page.key}
            onOpenBacklink={props.onOpenBacklink}
          />
        </>
      ) : null}
    </PageChrome>
  );
}

export function PageNode(props: PageNodeProps) {
  const sharedProps = {
    onClose: props.onClose,
    onFocus: props.onFocus,
    onHover: props.onHover,
    onOpenBacklink: props.onOpenBacklink,
    page: props.page,
    active: props.active,
  };

  switch (props.page.type) {
    case 'provider':
      return (
        <div onMouseEnter={() => props.onHover(props.page.key)} onMouseLeave={() => props.onHover(null)}>
          <ProviderPageNode {...sharedProps} />
        </div>
      );
    case 'finding':
      return (
        <div onMouseEnter={() => props.onHover(props.page.key)} onMouseLeave={() => props.onHover(null)}>
          <FindingPageNode {...sharedProps} />
        </div>
      );
    case 'storyline':
      return (
        <div onMouseEnter={() => props.onHover(props.page.key)} onMouseLeave={() => props.onHover(null)}>
          <StorylinePageNode {...sharedProps} />
        </div>
      );
    default:
      return null;
  }
}
