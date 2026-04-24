/**
 * KnowledgeTrustGraphPanel — Wave LIVE-100B.
 *
 * A lightweight, product-visible explanation of how VitalCV's trust
 * chain is wired. Not a live graph, not a visualization of runtime
 * edges — a static 9-node diagram of the product's source → proof →
 * decision path, with honest copy next to each node.
 *
 * Mount next to the existing TrustStateCard / PassportWallet so
 * verifiers and clinicians see the same chain story.
 *
 * Copy rules (Wave LIVE-100B spec):
 *   - CRS is derived from evidence, not evidence itself.
 *   - The trust container does not upgrade proof tier.
 *   - Audit events prove action history, not clinical truth.
 *   - Partial proof stays partial.
 */

import * as React from 'react';
import {
  ArrowRight,
  BadgeCheck,
  FileText,
  FlaskConical,
  Landmark,
  Layers,
  ReceiptText,
  ScrollText,
  UserRound,
  Wallet,
} from 'lucide-react';

type NodeKey =
  | 'clinician'
  | 'npi'
  | 'claims'
  | 'sources'
  | 'receipts'
  | 'passport'
  | 'proofPack'
  | 'employerReview'
  | 'auditEvents';

interface NodeSpec {
  key: NodeKey;
  label: string;
  description: string;
  icon: React.ReactNode;
}

const NODES: NodeSpec[] = [
  {
    key: 'clinician',
    label: 'Clinician',
    description: 'The subject of the passport. Identity is asserted at NPI time, not assumed.',
    icon: <UserRound className="h-4 w-4" aria-hidden />,
  },
  {
    key: 'npi',
    label: 'NPI',
    description: 'Canonical identity anchor. NPPES confirms registry fields only.',
    icon: <BadgeCheck className="h-4 w-4" aria-hidden />,
  },
  {
    key: 'claims',
    label: 'Claims',
    description: 'Structured assertions (licensure, exclusion, enrollment). Each is either user-entered or source-backed.',
    icon: <ScrollText className="h-4 w-4" aria-hidden />,
  },
  {
    key: 'sources',
    label: 'Sources',
    description: 'NPPES, OIG LEIE (latest available release), PECOS public, configured state board lane.',
    icon: <Landmark className="h-4 w-4" aria-hidden />,
  },
  {
    key: 'receipts',
    label: 'Receipts',
    description: 'Per-check evidence artifacts: source URL, timestamp, checksum. Receipts back claims; claims do not back themselves.',
    icon: <ReceiptText className="h-4 w-4" aria-hidden />,
  },
  {
    key: 'passport',
    label: 'Passport',
    description: 'Source-coverage view the clinician and reviewer share. Readiness score is derived from evidence, not evidence itself.',
    icon: <Wallet className="h-4 w-4" aria-hidden />,
  },
  {
    key: 'proofPack',
    label: 'Proof pack',
    description: 'Deterministic JSON / ZIP / PDF export with audit hashes. The trust container records the envelope; it does not upgrade proof tier.',
    icon: <FileText className="h-4 w-4" aria-hidden />,
  },
  {
    key: 'employerReview',
    label: 'Employer review',
    description: 'Reviewer surface that keeps limitations visible. Partial proof stays partial — the reviewer still owns the committee call.',
    icon: <FlaskConical className="h-4 w-4" aria-hidden />,
  },
  {
    key: 'auditEvents',
    label: 'Audit events',
    description: 'ARTIFACT_EXPORTED and decision events. Proves action history, not clinical truth.',
    icon: <Layers className="h-4 w-4" aria-hidden />,
  },
];

export interface KnowledgeTrustGraphPanelProps {
  className?: string;
  /** When true, show the long-form copy inline. Default is compact grid. */
  expanded?: boolean;
}

export function KnowledgeTrustGraphPanel({
  className,
  expanded = false,
}: KnowledgeTrustGraphPanelProps): React.ReactElement {
  const root = className
    ? `rounded-2xl border border-border bg-card p-5 sm:p-6 ${className}`
    : 'rounded-2xl border border-border bg-card p-5 sm:p-6';
  return (
    <section
      data-testid="knowledge-trust-graph"
      className={root}
      aria-label="Knowledge trust graph"
    >
      <header className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70">
            Knowledge trust graph
          </p>
          <h3 className="text-base font-semibold text-foreground">
            How a claim becomes a decision
          </h3>
        </div>
        <p className="text-xs text-muted-foreground/80 max-w-sm">
          A readiness score is <em>derived from</em> evidence — the evidence still lives on
          the receipts and the sources. The trust container records the envelope; it does
          not upgrade the proof tier.
        </p>
      </header>

      <ol
        className="grid gap-2 sm:grid-cols-3 xl:grid-cols-9"
        data-testid="knowledge-trust-graph-chain"
      >
        {NODES.map((node, idx) => (
          <li key={node.key} className="relative">
            <div
              className="flex items-start gap-2 rounded-xl border border-border bg-background/60 px-3 py-2 h-full"
              data-testid={`ktg-node-${node.key}`}
            >
              <span className="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 flex-shrink-0">
                {node.icon}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground">
                  {idx + 1}. {node.label}
                </p>
                <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground line-clamp-3">
                  {node.description}
                </p>
              </div>
            </div>
            {idx < NODES.length - 1 ? (
              <span
                aria-hidden
                className="hidden xl:flex absolute -right-3 top-1/2 -translate-y-1/2 text-muted-foreground/40"
              >
                <ArrowRight className="h-3 w-3" />
              </span>
            ) : null}
          </li>
        ))}
      </ol>

      <ul
        className="mt-4 grid gap-2 text-[11px] text-muted-foreground/80 sm:grid-cols-2"
        data-testid="knowledge-trust-graph-rules"
      >
        <li>CRS is derived from evidence, not evidence itself.</li>
        <li>The trust container does not upgrade proof tier.</li>
        <li>Audit events prove action history, not clinical truth.</li>
        <li>Partial proof stays partial.</li>
      </ul>

      {expanded ? (
        <div className="mt-6 space-y-4" data-testid="knowledge-trust-graph-expanded">
          {NODES.map((node) => (
            <div key={node.key} className="rounded-lg border border-border bg-background/60 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-foreground">
                {node.label}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">{node.description}</p>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}

export default KnowledgeTrustGraphPanel;
