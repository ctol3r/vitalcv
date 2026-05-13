'use client';

/**
 * ReplayContractMap.tsx
 *
 * The replay contract in machine-readable visual form.
 * 6 invariants that govern every replay run.
 * Bloomberg terminal density. No decorative UI.
 */

export interface ReplayContractClause {
  clauseId: string;
  invariant: string;
  implementation: string;
  status: 'enforced' | 'partial' | 'planned';
  layer: 'database' | 'application' | 'api' | 'jwt';
}

export interface ReplayContractMapProps {
  clauses?: ReplayContractClause[];
}

// ─── Defaults ─────────────────────────────────────────────────────────────────

const DEFAULT_CLAUSES: ReplayContractClause[] = [
  {
    clauseId: 'RC-1',
    invariant: 'First write wins — dedupeKey enforced on all LearningEvents',
    implementation: 'Prisma upsert({ where: { dedupeKey }, update: {} })',
    status: 'enforced',
    layer: 'database',
  },
  {
    clauseId: 'RC-2',
    invariant: 'actor_id persists on every durable write',
    implementation: 'x-clerk-user-id required; embedded in metadata.actor_id',
    status: 'enforced',
    layer: 'application',
  },
  {
    clauseId: 'RC-3',
    invariant: 'Replay survives server restart',
    implementation: 'Postgres persistence; dedupeKey prevents ghost writes on replay',
    status: 'enforced',
    layer: 'database',
  },
  {
    clauseId: 'RC-4',
    invariant: 'Anonymous writes rejected at the edge',
    implementation: 'session.userId check → 401 before proxy forward',
    status: 'enforced',
    layer: 'api',
  },
  {
    clauseId: 'RC-5',
    invariant: 'Receipt JWT carries azp (actor) + vcv.actor_id',
    implementation: 'signIssuerReceipt() embeds actorId as azp per RFC 9068',
    status: 'enforced',
    layer: 'jwt',
  },
  {
    clauseId: 'RC-6',
    invariant: 'Origin allowlist enforced — no wildcard in production',
    implementation: 'buildCorsOriginCallback() with normalizeOrigin()',
    status: 'enforced',
    layer: 'api',
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function layerBg(layer: ReplayContractClause['layer']): string {
  switch (layer) {
    case 'database':    return 'bg-gray-50 border-gray-200';
    case 'application': return 'bg-blue-50 border-blue-100';
    case 'api':         return 'bg-purple-50 border-purple-100';
    case 'jwt':         return 'bg-green-50 border-green-100';
  }
}

function layerLabel(layer: ReplayContractClause['layer']): string {
  switch (layer) {
    case 'database':    return 'DB';
    case 'application': return 'APP';
    case 'api':         return 'API';
    case 'jwt':         return 'JWT';
  }
}

function statusDot(status: ReplayContractClause['status']): string {
  switch (status) {
    case 'enforced': return 'text-green-600';
    case 'partial':  return 'text-amber-500';
    case 'planned':  return 'text-gray-400';
  }
}

function statusLabel(status: ReplayContractClause['status']): string {
  return status.toUpperCase();
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ReplayContractMap({ clauses = DEFAULT_CLAUSES }: ReplayContractMapProps) {
  const enforced = clauses.filter(c => c.status === 'enforced').length;

  return (
    <div className="font-sans">
      {/* Header */}
      <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-gray-400 mb-2">
        Replay Contract Map
      </div>

      {/* Table */}
      <div className="border border-gray-200">
        {/* Column headers */}
        <div className="grid grid-cols-[48px_1fr_80px_100px] gap-0 border-b border-gray-200 bg-gray-50">
          <div className="px-2 py-1.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-gray-400">ID</div>
          <div className="px-2 py-1.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-gray-400">Invariant</div>
          <div className="px-2 py-1.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-gray-400">Layer</div>
          <div className="px-2 py-1.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-gray-400">Status</div>
        </div>

        {/* Rows */}
        {clauses.map((clause, i) => (
          <div
            key={clause.clauseId}
            className={`grid grid-cols-[48px_1fr_80px_100px] gap-0 min-h-[32px] items-start ${
              i < clauses.length - 1 ? 'border-b border-gray-100' : ''
            }`}
          >
            {/* Clause ID */}
            <div className="px-2 py-1.5 font-mono text-xs text-gray-500 w-[48px] self-center">
              {clause.clauseId}
            </div>

            {/* Invariant + implementation */}
            <div className="px-2 py-1.5 border-l border-gray-100">
              <div className="text-xs text-gray-700 leading-tight">{clause.invariant}</div>
              <div className="text-[9px] font-mono text-gray-400 mt-0.5 leading-tight">{clause.implementation}</div>
            </div>

            {/* Layer badge */}
            <div className="px-2 py-1.5 border-l border-gray-100 self-center">
              <span
                className={`inline-block text-[9px] font-mono uppercase border px-1.5 py-0.5 w-[60px] text-center ${layerBg(clause.layer)}`}
              >
                {layerLabel(clause.layer)}
              </span>
            </div>

            {/* Status */}
            <div className="px-2 py-1.5 border-l border-gray-100 self-center">
              <span className={`text-[10px] font-mono ${statusDot(clause.status)}`}>
                ● {statusLabel(clause.status)}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="mt-1 text-[10px] font-mono text-gray-400">
        {enforced} / {clauses.length} invariants enforced
      </div>
    </div>
  );
}
