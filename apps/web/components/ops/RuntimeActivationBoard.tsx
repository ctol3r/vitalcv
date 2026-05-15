/**
 * RuntimeActivationBoard.tsx — Operational runtime layer status grid.
 *
 * Server or client component (no hooks, no side effects).
 * Feed state from /api/runtime/activation.
 */

import * as React from 'react';
import type { RuntimeActivationState } from '@/lib/runtime/getRuntimeActivationState';

export interface RuntimeActivationBoardProps {
  state: RuntimeActivationState;
}

type LayerStatus = 'configured' | 'not_set' | 'missing';

interface LayerRow {
  id: string;
  label: string;
  status: LayerStatus;
  detail: string;
}

function statusLabel(status: LayerStatus): string {
  switch (status) {
    case 'configured': return '● CONFIGURED';
    case 'not_set':    return '⚠ NOT SET';
    case 'missing':    return '✗ MISSING';
  }
}

function statusClass(status: LayerStatus): string {
  switch (status) {
    case 'configured': return 'text-green-600 font-mono text-[10px]';
    case 'not_set':    return 'text-amber-600 font-mono text-[10px]';
    case 'missing':    return 'text-red-600 font-mono text-[10px]';
  }
}

function buildLayers(state: RuntimeActivationState): LayerRow[] {
  const degraded = new Set(state.degradedLayers);

  return [
    {
      id: 'clerk',
      label: 'Clerk Auth',
      status: state.clerkConfigured
        ? 'configured'
        : degraded.has('clerk_publishable_key') || degraded.has('clerk_secret_key')
          ? 'missing'
          : 'not_set',
      detail: state.clerkConfigured
        ? 'Publishable key + secret present'
        : [
            !state.clerkPublishableKeyPresent && 'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY absent',
            !state.clerkSecretKeyPresent && 'CLERK_SECRET_KEY absent',
          ]
            .filter(Boolean)
            .join('; ') || 'Clerk not configured',
    },
    {
      id: 'api_base',
      label: 'API Base',
      status: state.apiBaseConfigured ? 'configured' : 'not_set',
      detail: state.apiBaseConfigured
        ? state.apiBaseValue ?? state.backendBase
        : 'BACKEND_URL / NEXT_PUBLIC_API_BASE not set',
    },
    {
      id: 'database',
      label: 'Database',
      status: state.databaseUrlConfigured ? 'configured' : 'missing',
      detail: state.databaseUrlConfigured ? 'DATABASE_URL set' : 'DATABASE_URL absent',
    },
    {
      id: 'signing',
      label: 'Receipt Signing',
      status: state.receiptKeyConfigured ? 'configured' : 'not_set',
      detail: state.receiptKeyConfigured
        ? 'RECEIPT_PRIVATE_KEY_JWK present'
        : 'RECEIPT_PRIVATE_KEY_JWK absent (dev mode)',
    },
  ];
}

export function RuntimeActivationBoard({ state }: RuntimeActivationBoardProps) {
  const layers = buildLayers(state);
  const { summary } = state;

  const overallStatus: LayerStatus = state.fullyActivated
    ? 'configured'
    : state.degradedLayers.some((l) => l === 'database_url' || l === 'clerk_auth')
      ? 'missing'
      : 'not_set';

  const overallLabel = state.fullyActivated
    ? '● ACTIVATED'
    : state.degradedLayers.length > 0
      ? '⚠ PARTIALLY ACTIVATED'
      : '✗ NOT ACTIVATED';

  const overallClass = state.fullyActivated
    ? 'text-green-600 font-mono text-[10px] font-semibold'
    : state.degradedLayers.length > 0
      ? 'text-amber-600 font-mono text-[10px] font-semibold'
      : 'text-red-600 font-mono text-[10px] font-semibold';

  return (
    <div className="border border-gray-200 bg-white">
      {/* Header */}
      <div className="border-b border-gray-200 px-4 py-2">
        <span className="font-mono text-[10px] font-semibold uppercase tracking-widest text-gray-500">
          RUNTIME ACTIVATION
        </span>
      </div>

      <div className="border-b border-gray-100 px-4 py-3">
        <div className="space-y-1">
          <p className="font-mono text-[10px] font-semibold uppercase tracking-widest text-gray-500">
            {summary.headline}
          </p>
          <p className="font-mono text-[10px] text-gray-600">{summary.detail}</p>
          <div className="flex flex-wrap gap-2">
            <span className="font-mono text-[9px] uppercase tracking-widest text-gray-400">{summary.identity.label}</span>
            <span className="font-mono text-[9px] uppercase tracking-widest text-gray-400">{summary.readiness.label}</span>
            <span className="font-mono text-[9px] uppercase tracking-widest text-gray-400">{summary.trust.label}</span>
          </div>
          <p className="font-mono text-[10px] text-gray-700">{summary.nextAction}</p>
        </div>
      </div>

      {/* Column headers */}
      <div className="grid grid-cols-[1fr_auto_1fr] gap-4 border-b border-gray-100 px-4 py-1.5">
        <span className="font-mono text-[9px] uppercase tracking-widest text-gray-400">LAYER</span>
        <span className="font-mono text-[9px] uppercase tracking-widest text-gray-400 text-center">STATUS</span>
        <span className="font-mono text-[9px] uppercase tracking-widest text-gray-400">DETAIL</span>
      </div>

      {/* Layer rows */}
      <div className="divide-y divide-gray-50">
        {layers.map((layer) => (
          <div key={layer.id} className="grid grid-cols-[1fr_auto_1fr] gap-4 px-4 py-2 items-center">
            <span className="font-mono text-[10px] text-gray-700">{layer.label}</span>
            <span className={statusClass(layer.status)}>{statusLabel(layer.status)}</span>
            <span className="font-mono text-[10px] text-gray-500">{layer.detail}</span>
          </div>
        ))}
      </div>

      {/* Overall status */}
      <div className="border-t border-gray-200 px-4 py-2 flex items-center gap-3">
        <span className="font-mono text-[9px] uppercase tracking-widest text-gray-400">OVERALL:</span>
        <span className={overallClass}>{overallLabel}</span>
        {state.degradedLayers.length > 0 && (
          <span className="font-mono text-[9px] text-gray-400">
            ({state.degradedLayers.join(', ')})
          </span>
        )}
      </div>

      {/* Timestamp */}
      <div className="border-t border-gray-100 px-4 py-1">
        <span className="font-mono text-[9px] text-gray-300">{state.timestamp}</span>
      </div>
    </div>
  );
}
