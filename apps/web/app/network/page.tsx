'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Globe,
  Shield,
  Activity,
  FileCheck2,
  Building2,
  User,
  Briefcase,
  Scale,
  Zap,
} from 'lucide-react';

import { RevealOnScroll } from '@/components/interaction/RevealOnScroll';
import { Block } from '@/components/ui/Block';
import { KnowledgePanel } from '@/components/knowledge/KnowledgePanel';
import { ExpandableCard } from '@/components/knowledge/ExpandableCard';

/* ── Graph node data ─────────────────────────────────────── */
interface GraphNode {
  id: string;
  label: string;
  type: 'credential' | 'issuer' | 'clinician' | 'employer' | 'decision';
  x: number;
  y: number;
  color: string;
}

interface GraphEdge {
  from: string;
  to: string;
}

const GRAPH_NODES: GraphNode[] = [
  { id: 'clinician-001', label: 'Dr. Sarah Chen', type: 'clinician', x: 50, y: 30, color: '#8B5CF6' },
  { id: 'cred-ca-license', label: 'CA License', type: 'credential', x: 25, y: 55, color: '#10B981' },
  { id: 'cred-board-im', label: 'Board Cert', type: 'credential', x: 75, y: 55, color: '#10B981' },
  { id: 'issuer-ca-tmb', label: 'CA-TMB', type: 'issuer', x: 15, y: 80, color: '#3B82F6' },
  { id: 'employer-mercy', label: 'Mercy Health', type: 'employer', x: 85, y: 80, color: '#F59E0B' },
  { id: 'decision-start-001', label: 'Start Attestation', type: 'decision', x: 50, y: 85, color: '#14B8A6' },
];

const GRAPH_EDGES: GraphEdge[] = [
  { from: 'clinician-001', to: 'cred-ca-license' },
  { from: 'clinician-001', to: 'cred-board-im' },
  { from: 'cred-ca-license', to: 'issuer-ca-tmb' },
  { from: 'clinician-001', to: 'employer-mercy' },
  { from: 'employer-mercy', to: 'decision-start-001' },
  { from: 'decision-start-001', to: 'cred-ca-license' },
];

/* ── Interactive graph visualization ─────────────────────── */
function TrustGraph({
  onNodeClick,
  selectedId,
}: {
  onNodeClick: (id: string) => void;
  selectedId: string | null;
}) {
  const getNodePos = (id: string) => {
    const node = GRAPH_NODES.find((n) => n.id === id);
    return node ? { x: node.x, y: node.y } : { x: 0, y: 0 };
  };

  return (
    <div className="relative aspect-[16/9] w-full overflow-hidden rounded-2xl bg-[var(--ag-bg-alt)]/50">
      {/* SVG edges */}
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
        {GRAPH_EDGES.map((edge) => {
          const from = getNodePos(edge.from);
          const to = getNodePos(edge.to);
          const isActive = selectedId === edge.from || selectedId === edge.to;
          return (
            <motion.line
              key={`${edge.from}-${edge.to}`}
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
              stroke={isActive ? 'var(--ag-primary)' : 'var(--ag-border)'}
              strokeWidth={isActive ? 0.4 : 0.2}
              strokeDasharray={isActive ? undefined : '1 1'}
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 1, delay: 0.3 }}
            />
          );
        })}
      </svg>

      {/* Nodes */}
      {GRAPH_NODES.map((node, i) => (
        <motion.button
          key={node.id}
          className="group absolute flex flex-col items-center gap-1"
          style={{ left: `${node.x}%`, top: `${node.y}%`, transform: 'translate(-50%, -50%)' }}
          onClick={() => onNodeClick(node.id)}
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: i * 0.1, type: 'spring', stiffness: 120, damping: 15 }}
          whileHover={{ scale: 1.15 }}
          whileTap={{ scale: 0.95 }}
        >
          <div
            className="flex h-8 w-8 items-center justify-center rounded-full border-2 shadow-md transition-all duration-200 sm:h-12 sm:w-12"
            style={{
              backgroundColor: `${node.color}20`,
              borderColor: selectedId === node.id ? node.color : `${node.color}40`,
              boxShadow: selectedId === node.id ? `0 0 20px ${node.color}30` : undefined,
            }}
          >
            <div className="h-2.5 w-2.5 rounded-full sm:h-3.5 sm:w-3.5" style={{ backgroundColor: node.color }} />
          </div>
          <span className="max-w-[80px] truncate text-[9px] font-medium text-[var(--ag-text-muted)] sm:max-w-[120px] sm:text-xs">
            {node.label}
          </span>
        </motion.button>
      ))}
    </div>
  );
}

/* ── Network page ────────────────────────────────────────── */
export default function NetworkPage() {
  const [selectedEntity, setSelectedEntity] = useState<string | null>(null);

  const handleNodeClick = useCallback((id: string) => {
    setSelectedEntity((prev) => (prev === id ? null : id));
  }, []);

  return (
    <main className="min-h-screen bg-[var(--ag-bg)] text-[var(--ag-text)]">
      {/* Header */}
      <section className="px-6 pt-28 pb-12">
        <div className="mx-auto max-w-6xl">
          <RevealOnScroll>
            <div className="text-center">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[var(--ag-primary)]/15 bg-[var(--ag-primary)]/5 px-4 py-1.5">
                <Globe className="h-3.5 w-3.5 text-[var(--ag-primary)]" />
                <span className="text-[11px] font-bold uppercase tracking-[0.25em] text-[var(--ag-primary)]">
                  Trust Network
                </span>
              </div>
              <h1
                className="font-heading font-bold tracking-tight text-[var(--ag-text)]"
                style={{ fontSize: 'var(--ag-text-hero)' }}
              >
                Trust Graph Explorer
              </h1>
              <p className="mx-auto mt-4 max-w-2xl text-lg text-[var(--ag-text-muted)]">
                Explore the interconnected web of credentials, issuers, and
                decision capsules that form VitalCV&apos;s trust fabric.
              </p>
            </div>
          </RevealOnScroll>
        </div>
      </section>

      {/* Graph + Knowledge Panel */}
      <section className="px-6 pb-16">
        <div className="mx-auto max-w-6xl">
          <RevealOnScroll>
            <div className="flex flex-col gap-6 lg:flex-row">
              {/* Graph */}
              <div className="flex-1">
                <Block title="Authority Graph" icon={<Activity className="h-5 w-5" />}>
                  <p className="mb-4 text-sm text-[var(--ag-text-muted)]">
                    Click a node to view its relationships and linked entities.
                  </p>
                  <TrustGraph onNodeClick={handleNodeClick} selectedId={selectedEntity} />
                </Block>
              </div>

              {/* Knowledge Panel */}
              <AnimatePresence>
                {selectedEntity && (
                  <KnowledgePanel
                    entityId={selectedEntity}
                    onClose={() => setSelectedEntity(null)}
                  />
                )}
              </AnimatePresence>
            </div>
          </RevealOnScroll>
        </div>
      </section>

      {/* Guidance blocks */}
      <section className="px-6 pb-24">
        <div className="mx-auto max-w-6xl">
          <RevealOnScroll>
            <div className="mb-8 text-center">
              <p className="mb-3 text-xs font-bold uppercase tracking-[0.3em] text-[var(--ag-accent)]">
                Network Intelligence
              </p>
              <h2
                className="font-heading font-bold tracking-tight text-[var(--ag-text)]"
                style={{ fontSize: 'var(--ag-text-section)' }}
              >
                Understanding the Trust Fabric
              </h2>
            </div>
          </RevealOnScroll>

          <div className="grid gap-4 sm:grid-cols-2">
            <RevealOnScroll delay={0}>
              <ExpandableCard
                title="Credential Verification"
                icon={<FileCheck2 className="h-5 w-5" />}
                summary="How credentials are verified and linked"
              >
                <div className="space-y-3 text-sm text-[var(--ag-text-muted)]">
                  <p>
                    Each credential is verified against its primary source — state medical boards,
                    NPDB, OIG/LEIE, and DEA — creating a cryptographically anchored verification artifact.
                  </p>
                  <p>
                    These artifacts are bidirectionally linked to the issuing authority,
                    the clinician who holds them, and any decision capsules that depend on them.
                  </p>
                </div>
              </ExpandableCard>
            </RevealOnScroll>

            <RevealOnScroll delay={0.1}>
              <ExpandableCard
                title="Decision Capsules"
                icon={<Scale className="h-5 w-5" />}
                summary="How hiring decisions are composed"
              >
                <div className="space-y-3 text-sm text-[var(--ag-text-muted)]">
                  <p>
                    A decision capsule aggregates multiple verification artifacts into a
                    single attestation — &quot;this clinician is ready to start.&quot;
                  </p>
                  <p>
                    If any underlying credential changes status, the capsule automatically
                    triggers a revocation cascade with blast-radius analysis.
                  </p>
                </div>
              </ExpandableCard>
            </RevealOnScroll>

            <RevealOnScroll delay={0.2}>
              <ExpandableCard
                title="Continuous Monitoring"
                icon={<Activity className="h-5 w-5" />}
                summary="Real-time trust signal processing"
              >
                <div className="space-y-3 text-sm text-[var(--ag-text-muted)]">
                  <p>
                    The trust daemon continuously monitors all linked entities — watching for
                    license expirations, adverse actions, exclusion list additions, and
                    board certification changes.
                  </p>
                  <p>
                    Changes propagate through the graph in real-time, updating trust scores
                    and triggering alerts within seconds.
                  </p>
                </div>
              </ExpandableCard>
            </RevealOnScroll>

            <RevealOnScroll delay={0.3}>
              <ExpandableCard
                title="Graph Topology"
                icon={<Globe className="h-5 w-5" />}
                summary="How entities connect"
              >
                <div className="space-y-3 text-sm text-[var(--ag-text-muted)]">
                  <p>
                    Every entity in the VitalCV network has bidirectional links.
                    A credential points to its issuer; the issuer points back.
                    An employer points to decisions; decisions point to credentials.
                  </p>
                  <p>
                    This bidirectional topology enables powerful queries: &quot;Show me
                    everything affected if this license is revoked.&quot;
                  </p>
                </div>
              </ExpandableCard>
            </RevealOnScroll>
          </div>
        </div>
      </section>
    </main>
  );
}
