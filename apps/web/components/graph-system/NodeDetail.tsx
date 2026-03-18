'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  BadgeCheck,
  Box,
  Building2,
  BriefcaseBusiness,
  ChevronRight,
  Clock3,
  FileText,
  Fingerprint,
  GitBranch,
  Link2,
  ReceiptText,
  Network,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Siren,
  User,
  Waypoints,
  X,
} from 'lucide-react';
import { buildIntelligenceHref } from '@/lib/intelligence/routes';
import { cn } from '@/lib/utils';
import type { GraphEdge, GraphNode } from './types';
import {
  buildNodeDetailModel,
  type ArtifactDetail,
  type ClaimDetail,
  type NodeNeighborSummary,
  type ReceiptDetail,
  type RelationshipDetail,
} from './nodeDetailModel';

interface Props {
  node: GraphNode;
  edges: GraphEdge[];
  neighbors: NodeNeighborSummary[];
  onClose: () => void;
  onFocusNode: (id: string) => void;
  onAcceptSuggestion: (id: string) => void;
  onRejectSuggestion: (id: string) => void;
}

const NODE_TYPE_ICONS: Record<string, LucideIcon> = {
  clinician: User,
  provider: User,
  organization: Building2,
  company: BriefcaseBusiness,
  institution: Building2,
  specialty: BadgeCheck,
  program: Shield,
  publication: FileText,
  trial: ShieldAlert,
  claim: Fingerprint,
  payment: ReceiptText,
  artifact: Box,
  evidence: Box,
  receipt: FileText,
  source: Link2,
  credential: ShieldCheck,
  license: BadgeCheck,
  decision: GitBranch,
  exclusion: ShieldAlert,
  enrollment: Waypoints,
  regulatory: Siren,
  note: FileText,
  document: FileText,
  tag: Link2,
  attachment: Box,
  group: Network,
};

const EVIDENCE_KIND_ICON: Record<'claim' | 'receipt' | 'artifact', LucideIcon> = {
  claim: Fingerprint,
  receipt: FileText,
  artifact: Box,
};

function humanize(value: string): string {
  return value
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return 'Not recorded';
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return value;
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(parsed));
}

function formatPercent(value: number | undefined): string {
  if (typeof value !== 'number' || Number.isNaN(value)) return 'n/a';
  return `${Math.round(value * 100)}%`;
}

function statusTone(status: string): string {
  const normalized = status.toLowerCase();
  if (normalized.includes('verified') || normalized.includes('active') || normalized.includes('accepted')) {
    return 'border-white/20 bg-white/10 text-white';
  }
  if (normalized.includes('pending') || normalized.includes('observed') || normalized.includes('derived')) {
    return 'border-white/12 bg-white/[0.04] text-white/70';
  }
  if (normalized.includes('rejected') || normalized.includes('revoked')) {
    return 'border-white/18 bg-white/[0.06] text-white/85';
  }
  return 'border-white/10 bg-white/[0.03] text-white/70';
}

function extractString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function extractStringList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => extractString(entry))
    .filter((entry): entry is string => Boolean(entry));
}

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

function maybeNpi(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const match = value.match(/\b\d{10}\b/);
  return match ? match[0] : null;
}

function deriveNodeEntityContext(node: GraphNode) {
  const metadata = node.metadata ?? {};
  const providerNpi = uniqueStrings([
    maybeNpi(node.type === 'provider' ? node.id : null),
    maybeNpi(extractString(metadata.npi)),
    maybeNpi(extractString(metadata.providerNpi)),
    maybeNpi(extractString(metadata.providerId)),
    maybeNpi(extractString(metadata.entityId)),
    maybeNpi(extractString(metadata.entityKey)),
    maybeNpi(extractString(metadata.subjectNpi)),
  ])[0] ?? null;
  const providerLabel = extractString(metadata.providerName)
    ?? extractString(metadata.fullName)
    ?? extractString(metadata.subjectName)
    ?? extractString(metadata.entityLabel)
    ?? extractString(metadata.name)
    ?? (providerNpi ? node.label : null);
  const findingIds = uniqueStrings([
    ...(node.findingIds ?? []),
    ...extractStringList(metadata.findingIds),
    extractString(metadata.findingId),
    extractString(metadata.relatedFindingId),
  ]);
  const storylineIds = uniqueStrings([
    ...(node.storylineIds ?? []),
    ...extractStringList(metadata.storylineIds),
    extractString(metadata.storylineId),
    extractString(metadata.relatedStorylineId),
  ]);

  return {
    providerNpi,
    providerLabel,
    findingIds,
    storylineIds,
  };
}

function Section({
  title,
  eyebrow,
  children,
}: {
  title: string;
  eyebrow: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3 rounded-3xl border border-white/10 bg-white/[0.025] p-4">
      <div className="space-y-1">
        <p className="text-[11px] uppercase tracking-[0.24em] text-white/35">{eyebrow}</p>
        <h2 className="text-sm font-medium tracking-[0.04em] text-white">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function ContextLink({
  href,
  label,
}: {
  href: string;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="inline-flex items-center rounded-full border border-white/12 bg-white/[0.04] px-3 py-1.5 text-xs text-white/72 transition-colors hover:border-white/20 hover:bg-white/[0.08] hover:text-white"
    >
      {label}
    </Link>
  );
}

function SummaryCell({
  label,
  value,
  emphasis = false,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-3 py-3">
      <p className="text-[10px] uppercase tracking-[0.22em] text-white/35">{label}</p>
      <p className={cn('mt-2 text-sm text-white/72', emphasis && 'text-base text-white')}>
        {value}
      </p>
    </div>
  );
}

function EvidenceButton({
  kind,
  title,
  summary,
  stamp,
  status,
  active,
  onClick,
}: {
  kind: 'claim' | 'receipt' | 'artifact';
  title: string;
  summary: string;
  stamp: string | null;
  status: string;
  active: boolean;
  onClick: () => void;
}) {
  const Icon = EVIDENCE_KIND_ICON[kind];
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full rounded-2xl border px-3 py-3 text-left transition-colors',
        active
          ? 'border-white/28 bg-white/[0.09]'
          : 'border-white/8 bg-white/[0.02] hover:border-white/16 hover:bg-white/[0.04]',
      )}
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 rounded-xl border border-white/10 bg-black/70 p-2">
          <Icon className="h-3.5 w-3.5 text-white/70" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm text-white">{title}</p>
            <span className={cn('rounded-full border px-2 py-0.5 text-[9px] uppercase tracking-[0.18em]', statusTone(status))}>
              {status}
            </span>
          </div>
          <p className="mt-1 text-xs leading-5 text-white/48">{summary}</p>
          {stamp ? (
            <p className="mt-2 text-[11px] text-white/34">{formatDateTime(stamp)}</p>
          ) : null}
        </div>
      </div>
    </button>
  );
}

function ClaimPreview({ claim }: { claim: ClaimDetail | null }) {
  if (!claim) {
    return (
      <div className="rounded-2xl border border-dashed border-white/10 px-4 py-5 text-sm text-white/45">
        No claim selected.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/8 bg-black/35 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-white/35">Selected claim</p>
          <h3 className="mt-2 text-base text-white">{claim.label}</h3>
        </div>
        <span className={cn('rounded-full border px-2 py-1 text-[9px] uppercase tracking-[0.18em]', statusTone(claim.status))}>
          {claim.status}
        </span>
      </div>
      <p className="mt-3 text-xl text-white">{claim.value}</p>
      <p className="mt-3 text-sm leading-6 text-white/54">{claim.summary}</p>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <SummaryCell label="Receipts" value={String(claim.supportingReceiptCount)} />
        <SummaryCell label="Artifacts" value={String(claim.supportingArtifactCount)} />
      </div>
    </div>
  );
}

function ArtifactPreview({ artifact }: { artifact: ArtifactDetail | null }) {
  if (!artifact) {
    return (
      <div className="rounded-2xl border border-dashed border-white/10 px-4 py-5 text-sm text-white/45">
        No source artifact selected.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/8 bg-black/35 p-4">
      <p className="text-[11px] uppercase tracking-[0.2em] text-white/35">Source artifact</p>
      <div className="mt-2 flex items-center justify-between gap-3">
        <h3 className="text-base text-white">{artifact.title}</h3>
        <span className="rounded-full border border-white/12 px-2 py-1 text-[9px] uppercase tracking-[0.18em] text-white/60">
          {artifact.kind}
        </span>
      </div>
      <p className="mt-3 text-sm leading-6 text-white/54">{artifact.summary}</p>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <SummaryCell label="Location" value={artifact.location} />
        <SummaryCell label="Value" value={artifact.value} />
      </div>
    </div>
  );
}

function ReceiptViewer({ receipt }: { receipt: ReceiptDetail | null }) {
  if (!receipt) {
    return (
      <div className="rounded-2xl border border-dashed border-white/10 px-4 py-5 text-sm text-white/45">
        No receipt available for this node.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-white/8 bg-black/35 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-white/35">Receipt header</p>
            <h3 className="mt-2 text-base text-white">{receipt.title}</h3>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn('rounded-full border px-2 py-1 text-[9px] uppercase tracking-[0.18em]', statusTone(receipt.status))}>
              {receipt.status}
            </span>
            <span className="rounded-full border border-white/12 px-2 py-1 text-[9px] uppercase tracking-[0.18em] text-white/60">
              {receipt.direction}
            </span>
          </div>
        </div>
        <p className="mt-3 text-sm leading-6 text-white/54">{receipt.summary}</p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <SummaryCell label="Counterparty" value={receipt.counterparty} emphasis />
          <SummaryCell label="Confidence" value={formatPercent(receipt.confidence)} emphasis />
          <SummaryCell label="Observed" value={formatDateTime(receipt.at)} />
          <SummaryCell label="Receipt type" value={humanize(receipt.edgeType)} />
        </div>
      </div>

      <div className="rounded-2xl border border-white/8 bg-black/35 p-4">
        <p className="text-[11px] uppercase tracking-[0.2em] text-white/35">Raw receipt payload</p>
        <pre className="mt-3 overflow-x-auto rounded-2xl border border-white/8 bg-black px-3 py-3 text-[11px] leading-6 text-white/56">
          {JSON.stringify(receipt.payload, null, 2)}
        </pre>
      </div>
    </div>
  );
}

function ClaimExplanation({
  claim,
  receipt,
  node,
  relationship,
}: {
  claim: ClaimDetail | null;
  receipt: ReceiptDetail | null;
  node: GraphNode;
  relationship: RelationshipDetail | null;
}) {
  const steps = [
    {
      label: 'Assertion',
      value: claim ? `${claim.label}: ${claim.value}` : node.label,
    },
    {
      label: 'Evidence basis',
      value: claim
        ? `${claim.supportingReceiptCount} receipt(s) and ${claim.supportingArtifactCount} artifact(s) back this node view.`
        : 'No claim selected.',
    },
    {
      label: 'Verification receipt',
      value: receipt
        ? `${receipt.counterparty} issued a ${humanize(receipt.edgeType)} record at ${formatDateTime(receipt.at)}.`
        : 'No direct receipt available in the active graph slice.',
    },
    {
      label: 'Relationship effect',
      value: relationship
        ? `${relationship.label} keeps this node connected through ${relationship.edgeTypes.map((edgeType) => humanize(edgeType)).join(', ')}.`
        : `This node currently has ${node.degree} visible relationship${node.degree === 1 ? '' : 's'}.`,
    },
  ];

  return (
    <div className="space-y-2">
      {steps.map((step, index) => (
        <div key={step.label} className="flex gap-3 rounded-2xl border border-white/8 bg-black/35 px-4 py-4">
          <div className="shrink-0 text-[11px] uppercase tracking-[0.2em] text-white/28">
            {String(index + 1).padStart(2, '0')}
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-white/35">{step.label}</p>
            <p className="mt-2 text-sm leading-6 text-white/68">{step.value}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function RelationshipOrbit({
  node,
  relationships,
}: {
  node: GraphNode;
  relationships: RelationshipDetail[];
}) {
  const plotted = relationships.slice(0, 6);
  const positions = [
    { x: 72, y: 42 },
    { x: 54, y: 112 },
    { x: 76, y: 182 },
    { x: 264, y: 42 },
    { x: 282, y: 112 },
    { x: 260, y: 182 },
  ];

  return (
    <svg
      viewBox="0 0 336 224"
      className="w-full rounded-2xl border border-white/8 bg-black/35"
      role="img"
      aria-label="Relationship visualization"
    >
      <rect x="0" y="0" width="336" height="224" fill="transparent" />
      <circle cx="168" cy="112" r="46" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.12)" />
      <text x="168" y="102" textAnchor="middle" fill="rgba(255,255,255,0.42)" fontSize="9" letterSpacing="2.4">
        FOCAL NODE
      </text>
      <text x="168" y="122" textAnchor="middle" fill="white" fontSize="13">
        {node.label.length > 16 ? `${node.label.slice(0, 16)}…` : node.label}
      </text>
      {plotted.map((relationship, index) => {
        const position = positions[index]!;
        const lineWidth = 1 + (relationship.confidence * 2);
        return (
          <g key={relationship.id}>
            <line
              x1="168"
              y1="112"
              x2={position.x}
              y2={position.y}
              stroke="rgba(255,255,255,0.22)"
              strokeWidth={lineWidth}
            />
            <circle
              cx={position.x}
              cy={position.y}
              r="24"
              fill="rgba(255,255,255,0.03)"
              stroke="rgba(255,255,255,0.14)"
            />
            <text
              x={position.x}
              y={position.y - 4}
              textAnchor="middle"
              fill="rgba(255,255,255,0.9)"
              fontSize="10"
            >
              {relationship.label.length > 10 ? `${relationship.label.slice(0, 10)}…` : relationship.label}
            </text>
            <text
              x={position.x}
              y={position.y + 11}
              textAnchor="middle"
              fill="rgba(255,255,255,0.38)"
              fontSize="8"
              letterSpacing="1.4"
            >
              {relationship.direction.toUpperCase()}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export default function NodeDetail({
  node,
  edges,
  neighbors,
  onClose,
  onFocusNode,
  onAcceptSuggestion,
  onRejectSuggestion,
}: Props) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const model = useMemo(() => buildNodeDetailModel(node, edges, neighbors), [node, edges, neighbors]);
  const [selectedEvidenceId, setSelectedEvidenceId] = useState<string | null>(model.defaultEvidenceId);

  useEffect(() => {
    setSelectedEvidenceId(model.defaultEvidenceId);
  }, [model.defaultEvidenceId, node.id]);

  const selectedEvidence = model.evidenceStack.find((entry) => entry.id === selectedEvidenceId) ?? null;
  const selectedClaim = (
    (selectedEvidence?.kind === 'claim'
      ? model.claims.find((claim) => claim.id === selectedEvidence.id)
      : undefined)
    ?? model.claims[0]
    ?? null
  );
  const selectedArtifact = (
    (selectedEvidence?.kind === 'artifact'
      ? model.artifacts.find((artifact) => artifact.id === selectedEvidence.id)
      : undefined)
    ?? model.artifacts[0]
    ?? null
  );
  const selectedReceipt = (
    (selectedEvidence?.kind === 'receipt'
      ? model.receipts.find((receipt) => receipt.id === selectedEvidence.id)
      : undefined)
    ?? model.receipts[0]
    ?? null
  );
  const primaryRelationship = model.relationships[0] ?? null;
  const NodeIcon = NODE_TYPE_ICONS[node.type] ?? Network;
  const currentHref = useMemo(() => {
    const query = searchParams.toString();
    return `${pathname}${query ? `?${query}` : ''}`;
  }, [pathname, searchParams]);
  const entityContext = useMemo(() => deriveNodeEntityContext(node), [node]);
  const investigationHref = useMemo(() => {
    if (!entityContext.providerNpi && !entityContext.findingIds[0] && !entityContext.storylineIds[0]) {
      return null;
    }

    return buildIntelligenceHref('investigations', {
      npi: entityContext.providerNpi,
      findingId: entityContext.findingIds[0],
      storylineId: entityContext.storylineIds[0],
    });
  }, [entityContext.findingIds, entityContext.providerNpi, entityContext.storylineIds]);

  return (
    <aside className="fixed inset-y-4 right-4 z-50 w-[min(38rem,calc(100vw-1rem))] overflow-hidden rounded-[30px] border border-white/12 bg-black/95 text-white shadow-[0_30px_80px_rgba(0,0,0,0.55)] backdrop-blur-md">
      <div className="flex h-full flex-col">
        <header className="border-b border-white/10 px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-start gap-3">
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                <NodeIcon className="h-5 w-5 text-white/72" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] uppercase tracking-[0.28em] text-white/38">{humanize(node.type)}</p>
                <h1 className="mt-2 truncate text-xl tracking-[0.02em] text-white">{node.label}</h1>
                <p className="mt-2 text-sm leading-6 text-white/48">
                  Evidence-grade node detail surface for claims, receipts, source artifacts, and relationship context.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-2 text-white/45 transition-colors hover:border-white/18 hover:text-white"
              aria-label="Close node detail"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <span className="rounded-full border border-white/12 px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-white/58">
              {node.layer}
            </span>
            <span className="rounded-full border border-white/12 px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-white/58">
              {node.degree} links
            </span>
            {node.trustBand ? (
              <span className="rounded-full border border-white/16 px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-white">
                {node.trustBand}
              </span>
            ) : null}
            {node.trustTier ? (
              <span className="rounded-full border border-white/12 px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-white/58">
                {node.trustTier}
              </span>
            ) : null}
          </div>
        </header>

        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
          <Section title="Entity Context" eyebrow="00">
            <div className="space-y-3">
              {(entityContext.providerNpi || entityContext.findingIds.length > 0 || entityContext.storylineIds.length > 0) ? (
                <>
                  <p className="text-sm leading-6 text-white/54">
                    Pivot out of the graph without losing the current investigation scope.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {entityContext.providerNpi ? (
                      <>
                        <ContextLink
                          href={`/providers/${entityContext.providerNpi}?from=${encodeURIComponent(currentHref)}`}
                          label={entityContext.providerLabel ?? `Provider ${entityContext.providerNpi}`}
                        />
                        <ContextLink
                          href={buildIntelligenceHref('findings', { provider: entityContext.providerNpi })}
                          label="Provider findings"
                        />
                        <ContextLink
                          href={buildIntelligenceHref('storylines', { provider: entityContext.providerNpi })}
                          label="Provider storylines"
                        />
                      </>
                    ) : null}
                    {investigationHref ? <ContextLink href={investigationHref} label="Open investigation" /> : null}
                  </div>

                  {entityContext.findingIds.length > 0 ? (
                    <div className="space-y-2">
                      <p className="text-[11px] uppercase tracking-[0.2em] text-white/35">Linked findings</p>
                      <div className="flex flex-wrap gap-2">
                        {entityContext.findingIds.slice(0, 4).map((findingId) => (
                          <ContextLink
                            key={findingId}
                            href={`/findings/${findingId}?from=${encodeURIComponent(currentHref)}`}
                            label={`Finding ${findingId}`}
                          />
                        ))}
                        {entityContext.findingIds.length > 4 ? (
                          <span className="inline-flex items-center rounded-full border border-white/10 px-3 py-1.5 text-xs text-white/42">
                            +{entityContext.findingIds.length - 4} more
                          </span>
                        ) : null}
                      </div>
                    </div>
                  ) : null}

                  {entityContext.storylineIds.length > 0 ? (
                    <div className="space-y-2">
                      <p className="text-[11px] uppercase tracking-[0.2em] text-white/35">Linked storylines</p>
                      <div className="flex flex-wrap gap-2">
                        {entityContext.storylineIds.slice(0, 4).map((storylineId) => (
                          <ContextLink
                            key={storylineId}
                            href={`/storylines/${storylineId}?from=${encodeURIComponent(currentHref)}`}
                            label={`Storyline ${storylineId}`}
                          />
                        ))}
                        {entityContext.storylineIds.length > 4 ? (
                          <span className="inline-flex items-center rounded-full border border-white/10 px-3 py-1.5 text-xs text-white/42">
                            +{entityContext.storylineIds.length - 4} more
                          </span>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                </>
              ) : (
                <p className="text-sm leading-6 text-white/45">
                  This node does not currently resolve to a provider, finding, or storyline in the graph payload.
                </p>
              )}
            </div>
          </Section>

          <Section title="Claim Details" eyebrow="01">
            <div className="grid gap-2 sm:grid-cols-2">
              <SummaryCell label="Confidence" value={formatPercent(node.confidence)} emphasis />
              <SummaryCell label="Source refs" value={String(node.sourceRefs.length)} emphasis />
              <SummaryCell label="Created" value={formatDateTime(node.createdAt)} />
              <SummaryCell label="Updated" value={formatDateTime(node.updatedAt)} />
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {model.claims.slice(0, 4).map((claim) => (
                <div key={claim.id} className="rounded-2xl border border-white/8 bg-black/35 px-3 py-3">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-white/34">{claim.label}</p>
                  <p className="mt-2 text-sm text-white">{claim.value}</p>
                  <p className="mt-2 text-xs leading-5 text-white/46">{claim.summary}</p>
                </div>
              ))}
            </div>
          </Section>

          <Section title="Evidence Stack" eyebrow="02">
            <div className="flex flex-wrap gap-2 text-[10px] uppercase tracking-[0.18em] text-white/38">
              <span className="rounded-full border border-white/10 px-2 py-1">{model.claims.length} claims</span>
              <span className="rounded-full border border-white/10 px-2 py-1">{model.receipts.length} receipts</span>
              <span className="rounded-full border border-white/10 px-2 py-1">{model.artifacts.length} artifacts</span>
            </div>
            <div className="space-y-2">
              {model.evidenceStack.map((entry) => (
                <EvidenceButton
                  key={entry.id}
                  kind={entry.kind}
                  title={entry.title}
                  summary={entry.summary}
                  stamp={entry.stamp}
                  status={entry.status}
                  active={entry.id === selectedEvidenceId}
                  onClick={() => setSelectedEvidenceId(entry.id)}
                />
              ))}
            </div>
            <div className="grid gap-3 xl:grid-cols-2">
              <ClaimPreview claim={selectedClaim} />
              <ArtifactPreview artifact={selectedArtifact} />
            </div>
          </Section>

          <Section title="Receipt Viewer" eyebrow="03">
            <ReceiptViewer receipt={selectedReceipt} />
          </Section>

          <Section title="Claim Explanation" eyebrow="04">
            <ClaimExplanation
              claim={selectedClaim}
              receipt={selectedReceipt}
              node={node}
              relationship={primaryRelationship}
            />
          </Section>

          <Section title="Relationship Visualization" eyebrow="05">
            <RelationshipOrbit node={node} relationships={model.relationships} />
            <div className="space-y-2">
              {model.relationships.slice(0, 6).map((relationship) => (
                <button
                  key={relationship.id}
                  type="button"
                  onClick={() => onFocusNode(relationship.neighborId)}
                  className="flex w-full items-start justify-between gap-3 rounded-2xl border border-white/8 bg-black/35 px-4 py-3 text-left transition-colors hover:border-white/16 hover:bg-white/[0.04]"
                >
                  <div className="min-w-0">
                    <p className="text-sm text-white">{relationship.label}</p>
                    <p className="mt-1 text-xs leading-5 text-white/46">{relationship.explanation}</p>
                    <p className="mt-2 text-[11px] uppercase tracking-[0.18em] text-white/32">
                      {relationship.edgeTypes.map((edgeType) => humanize(edgeType)).join(' · ')}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm text-white">{formatPercent(relationship.confidence)}</p>
                    <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-white/34">{relationship.direction}</p>
                    <ChevronRight className="ml-auto mt-2 h-3.5 w-3.5 text-white/38" />
                  </div>
                </button>
              ))}
            </div>
          </Section>

          <Section title="Change Timeline" eyebrow="06">
            <div className="space-y-3">
              {model.timeline.map((event) => (
                <div key={event.id} className="flex gap-3">
                  <div className="flex w-10 shrink-0 flex-col items-center">
                    <div className="rounded-full border border-white/12 bg-black/70 p-1.5">
                      <Clock3 className="h-3 w-3 text-white/56" />
                    </div>
                    <div className="mt-2 h-full w-px bg-white/10" />
                  </div>
                  <div className="min-w-0 rounded-2xl border border-white/8 bg-black/35 px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm text-white">{event.title}</p>
                      <span className="rounded-full border border-white/10 px-2 py-0.5 text-[9px] uppercase tracking-[0.18em] text-white/34">
                        {event.tone}
                      </span>
                    </div>
                    <p className="mt-1 text-xs leading-5 text-white/46">{event.detail}</p>
                    <p className="mt-2 text-[11px] text-white/32">{formatDateTime(event.at)}</p>
                  </div>
                </div>
              ))}
            </div>
          </Section>

          {model.pendingSuggestions.length > 0 ? (
            <Section title="Pending Suggested Links" eyebrow="07">
              <div className="space-y-2">
                {model.pendingSuggestions.map((suggestion) => (
                  <div key={suggestion.id} className="rounded-2xl border border-white/8 bg-black/35 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm text-white">{suggestion.targetLabel}</p>
                        <p className="mt-1 text-xs leading-5 text-white/46">{suggestion.explanation}</p>
                      </div>
                      <span className="rounded-full border border-white/12 px-2 py-1 text-[9px] uppercase tracking-[0.18em] text-white/58">
                        {formatPercent(suggestion.confidence)}
                      </span>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        onClick={() => onAcceptSuggestion(suggestion.id)}
                        className="flex-1 rounded-xl border border-white/14 bg-white/[0.06] px-3 py-2 text-xs text-white transition-colors hover:bg-white/[0.12]"
                      >
                        Accept
                      </button>
                      <button
                        type="button"
                        onClick={() => onRejectSuggestion(suggestion.id)}
                        className="flex-1 rounded-xl border border-white/10 bg-black px-3 py-2 text-xs text-white/64 transition-colors hover:border-white/16 hover:text-white"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          ) : null}
        </div>
      </div>
    </aside>
  );
}
