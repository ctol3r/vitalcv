'use client';

import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeftRight,
  Building2,
  ChevronRight,
  Eye,
  FileCheck,
  Network,
  RefreshCw,
  Scale,
  Shield,
  Stethoscope,
  X,
} from 'lucide-react';
import { useCallback, useState } from 'react';
import { useKnowledgeGraph } from '@/hooks/useKnowledgeGraph';

/* ── Types ────────────────────────────────────────────────── */

type EntityType = 'clinician' | 'credential' | 'issuer' | 'verifier' | 'decision';

interface KnowledgeEntity {
  id: string;
  type: EntityType;
  label: string;
  trustScore: number;
  centrality: number;
  metadata: Record<string, unknown>;
}

interface KnowledgeRelationship {
  id: string;
  type: string;
  sourceId: string;
  targetId: string;
  weight: number;
  confidence: number;
}

/* ── Config ───────────────────────────────────────────────── */

const TYPE_ICONS: Record<EntityType, typeof Shield> = {
  clinician: Stethoscope,
  issuer: Building2,
  credential: FileCheck,
  verifier: Eye,
  decision: Scale,
};

const TYPE_COLORS: Record<EntityType, { bg: string; text: string; border: string }> = {
  clinician: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  issuer: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  credential: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  verifier: { bg: 'bg-cyan-50', text: 'text-cyan-700', border: 'border-cyan-200' },
  decision: { bg: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-200' },
};

const RELATIONSHIP_LABELS: Record<string, string> = {
  ISSUED_BY: 'Issued By',
  VERIFIED_BY: 'Verified By',
  CONTEXT_FOR: 'Context For',
  DEPENDS_ON: 'Depends On',
  AUTHORIZED_BY: 'Authorized By',
  MONITORED_BY: 'Monitored By',
};

/* ── Demo Data ────────────────────────────────────────────── */

// Synthetic placeholders only. A demo subject must never carry a real
// clinician's NPI: `0000000000` fails the NPI check digit, so it cannot
// collide with a registrant. Do not substitute a real NPI here.
const DEMO_ENTITIES: KnowledgeEntity[] = [
  { id: 'clinician-example', type: 'clinician', label: 'Example Clinician A', trustScore: 0.92, centrality: 1.0, metadata: { npi: '0000000000' } },
  { id: 'issuer-ca-medical-board', type: 'issuer', label: 'CA Medical Board', trustScore: 0.95, centrality: 0.6, metadata: {} },
  { id: 'issuer-training-source', type: 'issuer', label: 'Training source', trustScore: 0.58, centrality: 0.4, metadata: { proofTier: 'contextual' } },
  { id: 'credential-license', type: 'credential', label: 'Medical License', trustScore: 0.9, centrality: 0.7, metadata: { status: 'ACTIVE', exp: '2027-03-15' } },
  { id: 'credential-training', type: 'credential', label: 'Training assertion', trustScore: 0.5, centrality: 0.5, metadata: { status: 'SUPPLEMENTAL', proofTier: 'contextual' } },
  { id: 'verifier-psv', type: 'verifier', label: 'PSV Engine', trustScore: 1.0, centrality: 0.3, metadata: {} },
  { id: 'decision-review', type: 'decision', label: 'Review context', trustScore: 0.58, centrality: 0.5, metadata: { proofTier: 'partial' } },
];

const DEMO_RELATIONSHIPS: KnowledgeRelationship[] = [
  { id: 'r1', type: 'ISSUED_BY', sourceId: 'credential-license', targetId: 'issuer-ca-medical-board', weight: 1.0, confidence: 0.95 },
  { id: 'r2', type: 'CONTEXT_FOR', sourceId: 'credential-training', targetId: 'issuer-training-source', weight: 0.5, confidence: 0.5 },
  { id: 'r3', type: 'VERIFIED_BY', sourceId: 'clinician-example', targetId: 'credential-license', weight: 1.0, confidence: 0.9 },
  { id: 'r4', type: 'CONTEXT_FOR', sourceId: 'clinician-example', targetId: 'credential-training', weight: 0.5, confidence: 0.5 },
  { id: 'r5', type: 'VERIFIED_BY', sourceId: 'credential-license', targetId: 'verifier-psv', weight: 1.0, confidence: 1.0 },
  { id: 'r6', type: 'DEPENDS_ON', sourceId: 'decision-review', targetId: 'credential-license', weight: 1.0, confidence: 0.92 },
  { id: 'r7', type: 'CONTEXT_FOR', sourceId: 'decision-review', targetId: 'credential-training', weight: 0.5, confidence: 0.5 },
  { id: 'r8', type: 'AUTHORIZED_BY', sourceId: 'decision-review', targetId: 'issuer-ca-medical-board', weight: 1.0, confidence: 0.92 },
  { id: 'r9', type: 'MONITORED_BY', sourceId: 'credential-license', targetId: 'verifier-psv', weight: 0.8, confidence: 1.0 },
];

/* ── Component ────────────────────────────────────────────── */

interface KnowledgeExplorerProps {
  /** NPI to load live data for. When omitted, shows demo data. */
  npi?: string | null;
  /** Override entities (ignored if npi is set) */
  entities?: KnowledgeEntity[];
  /** Override relationships (ignored if npi is set) */
  relationships?: KnowledgeRelationship[];
  /** Polling interval in ms. Default 60s. */
  pollIntervalMs?: number;
  className?: string;
}

export function KnowledgeExplorer({
  npi = null,
  entities: propsEntities = DEMO_ENTITIES,
  relationships: propsRelationships = DEMO_RELATIONSHIPS,
  pollIntervalMs = 60_000,
  className = '',
}: KnowledgeExplorerProps) {
  const [selectedEntity, setSelectedEntity] = useState<KnowledgeEntity | null>(null);
  const [filterType, setFilterType] = useState<EntityType | 'all'>('all');

  // Live data when npi is provided
  const {
    entities: liveEntities,
    relationships: liveRelationships,
    loading: liveLoading,
    error: liveError,
    refresh,
    lastUpdated,
  } = useKnowledgeGraph(npi, pollIntervalMs);

  // Prefer live data; fall back to props/demo
  const entities: KnowledgeEntity[] = (liveEntities as KnowledgeEntity[] | null) ?? propsEntities;
  const relationships: KnowledgeRelationship[] = liveRelationships.length > 0
    ? liveRelationships
    : propsRelationships;

  const filteredEntities = filterType === 'all'
    ? entities
    : entities.filter((e) => e.type === filterType);

  const getRelatedEntities = useCallback(
    (entityId: string) => {
      const related = relationships
        .filter((r) => r.sourceId === entityId || r.targetId === entityId)
        .map((r) => {
          const otherId = r.sourceId === entityId ? r.targetId : r.sourceId;
          const direction = r.sourceId === entityId ? 'outbound' : 'inbound';
          const otherEntity = entities.find((e) => e.id === otherId);
          return { relationship: r, entity: otherEntity, direction };
        })
        .filter((r) => r.entity != null);
      return related as { relationship: KnowledgeRelationship; entity: KnowledgeEntity; direction: 'inbound' | 'outbound' }[];
    },
    [entities, relationships],
  );

  const entityTypes: EntityType[] = ['clinician', 'credential', 'issuer', 'verifier', 'decision'];

  return (
    <div className={`rounded-2xl border border-infra-border bg-card backdrop-blur-sm shadow-sm overflow-hidden ${className}`}>
      {/* Header */}
      <div className="px-5 py-4 border-b border-infra-border/50 bg-muted backdrop-blur-md">
        <div className="flex items-center gap-2.5">
          <div className="rounded-xl p-2 bg-violet-50 text-violet-600">
            <Network className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-bold text-foreground">Knowledge Explorer</h2>
            <p className="text-[11px] text-muted-foreground">
              {liveLoading && !liveEntities ? (
                'Loading…'
              ) : liveError ? (
                <span className="text-red-500">Error: {liveError}</span>
              ) : (
                <>
                  {entities.length} entities &middot; {relationships.length} relationships
                  {lastUpdated && (
                    <span className="ml-1.5 text-muted-foreground/50">
                      &middot; {lastUpdated.toLocaleTimeString()}
                    </span>
                  )}
                </>
              )}
            </p>
          </div>
          {npi && (
            <button
              onClick={refresh}
              disabled={liveLoading}
              className="rounded-lg p-1.5 hover:bg-secondary/50 transition-colors disabled:opacity-40"
              title="Refresh"
            >
              <RefreshCw className={`h-3.5 w-3.5 text-muted-foreground ${liveLoading ? 'animate-spin' : ''}`} />
            </button>
          )}
        </div>

        {/* Type filters */}
        <div className="flex gap-1.5 mt-3 flex-wrap">
          <button
            onClick={() => setFilterType('all')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors ${
              filterType === 'all'
                ? 'bg-foreground text-background'
                : 'bg-secondary text-muted-foreground hover:bg-secondary/80'
            }`}
          >
            All
          </button>
          {entityTypes.map((type) => {
            const colors = TYPE_COLORS[type];
            const Icon = TYPE_ICONS[type];
            const count = entities.filter((e) => e.type === type).length;
            return (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors ${
                  filterType === type
                    ? `${colors.bg} ${colors.text}`
                    : 'bg-secondary text-muted-foreground hover:bg-secondary/80'
                }`}
              >
                <Icon className="h-3 w-3" />
                {type} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Loading skeleton */}
      {liveLoading && !liveEntities && (
        <div className="p-4 space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-12 rounded-xl bg-secondary/40 animate-pulse" />
          ))}
        </div>
      )}

      {/* Entity List */}
      <div className="divide-y divide-infra-border/30 max-h-[400px] overflow-y-auto">
        {filteredEntities.map((entity) => {
          const colors = TYPE_COLORS[entity.type];
          const Icon = TYPE_ICONS[entity.type];
          const isSelected = selectedEntity?.id === entity.id;
          const relCount = relationships.filter(
            (r) => r.sourceId === entity.id || r.targetId === entity.id,
          ).length;

          return (
            <button
              key={entity.id}
              onClick={() => setSelectedEntity(isSelected ? null : entity)}
              className={`w-full text-left px-5 py-3 flex items-center gap-3 transition-colors ${
                isSelected ? 'bg-violet-50/50' : 'hover:bg-secondary/30'
              }`}
            >
              <div className={`rounded-lg p-1.5 ${colors.bg} ${colors.text}`}>
                <Icon className="h-3.5 w-3.5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{entity.label}</p>
                <p className="text-[10px] text-muted-foreground">
                  Trust: {(entity.trustScore * 100).toFixed(0)}% &middot; Centrality: {(entity.centrality * 100).toFixed(0)}% &middot; {relCount} links
                </p>
              </div>
              <ChevronRight className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${isSelected ? 'rotate-90' : ''}`} />
            </button>
          );
        })}
      </div>

      {/* Detail Panel (inline) */}
      <AnimatePresence>
        {selectedEntity && (
          <motion.div
            key={selectedEntity.id}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-t border-infra-border/50"
          >
            <div className="px-5 py-4 bg-card backdrop-blur-sm space-y-4">
              {/* Entity header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className={`rounded-xl p-2 ${TYPE_COLORS[selectedEntity.type].bg} ${TYPE_COLORS[selectedEntity.type].text}`}>
                    {(() => { const Icon = TYPE_ICONS[selectedEntity.type]; return <Icon className="h-4 w-4" />; })()}
                  </div>
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{selectedEntity.type}</p>
                    <h3 className="text-sm font-bold text-foreground">{selectedEntity.label}</h3>
                  </div>
                </div>
                <button onClick={() => setSelectedEntity(null)} className="rounded-lg p-1 hover:bg-secondary transition-colors">
                  <X className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              </div>

              {/* Scores */}
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl border border-infra-border bg-infra-surface p-2.5">
                  <p className="text-[10px] text-muted-foreground font-medium">Trust Score</p>
                  <p className="text-lg font-bold text-foreground">{(selectedEntity.trustScore * 100).toFixed(0)}%</p>
                </div>
                <div className="rounded-xl border border-infra-border bg-infra-surface p-2.5">
                  <p className="text-[10px] text-muted-foreground font-medium">Centrality</p>
                  <p className="text-lg font-bold text-foreground">{(selectedEntity.centrality * 100).toFixed(0)}%</p>
                </div>
              </div>

              {/* Metadata */}
              {Object.keys(selectedEntity.metadata).length > 0 && (
                <div className="space-y-1.5">
                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Properties</h4>
                  <div className="rounded-xl border border-infra-border bg-infra-surface p-2.5 space-y-1">
                    {Object.entries(selectedEntity.metadata).map(([key, value]) => (
                      <div key={key} className="flex justify-between items-center">
                        <span className="text-[10px] text-muted-foreground font-mono">{key}</span>
                        <span className="text-xs font-semibold font-mono">{String(value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Relationships (bidirectional linking) */}
              <div className="space-y-1.5">
                <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                  <ArrowLeftRight className="h-3 w-3" />
                  Relationships
                </h4>
                <div className="space-y-1">
                  {getRelatedEntities(selectedEntity.id).map(({ relationship, entity, direction }) => {
                    const colors = TYPE_COLORS[entity.type];
                    const Icon = TYPE_ICONS[entity.type];
                    return (
                      <button
                        key={relationship.id}
                        onClick={() => setSelectedEntity(entity)}
                        className={`w-full flex items-center gap-2 rounded-xl border ${colors.border} bg-card px-3 py-2 text-left transition-colors hover:bg-card dark:bg-black/20 dark:hover:bg-black/40`}
                      >
                        <div className={`rounded-lg p-1 ${colors.bg} ${colors.text}`}>
                          <Icon className="h-3 w-3" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate">{entity.label}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {direction === 'outbound' ? '→' : '←'} {RELATIONSHIP_LABELS[relationship.type] ?? relationship.type}
                            {' '}&middot; w:{relationship.weight.toFixed(1)} c:{relationship.confidence.toFixed(2)}
                          </p>
                        </div>
                        <ChevronRight className="h-3 w-3 text-muted-foreground" />
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
