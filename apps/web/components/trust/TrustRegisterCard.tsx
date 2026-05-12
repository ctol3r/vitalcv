'use client';

import { IssuerContinuityPanel } from '@/components/verifier/IssuerContinuityPanel';
import { TrustRegisterRow, type TrustRegisterRowProps } from './TrustRegisterRow';

export interface TrustRegisterCardProps {
  state: 'anonymous' | 'owned' | 'signed';
  title: string;
  description: string;
  runId: string;
  checkedAt: string | null;
  issuerDid?: string;
  signingKeyId?: string;
  jwksUri?: string;
  rows: TrustRegisterRowProps[];
  replayAvailable: boolean;
  priorRunId?: string | null;
}

const STATE_CONFIG = {
  anonymous: {
    headerLabel: 'ANONYMOUS PREVIEW',
    wrapperClass: 'border border-dashed border-gray-200 bg-stone-50 overflow-hidden rounded',
    headerClass: 'px-4 py-2.5 border-b border-dashed border-gray-200 bg-stone-50',
    headerLabelClass:
      'text-[10px] font-semibold uppercase tracking-[0.08em] text-gray-400',
    titleClass: 'text-sm font-semibold text-gray-600 mt-0.5',
    descClass: 'text-xs text-gray-500 truncate',
    bodyClass: 'px-4 py-3 space-y-3',
  },
  owned: {
    headerLabel: 'OWNED SNAPSHOT',
    wrapperClass: 'border border-gray-200 bg-white overflow-hidden rounded',
    headerClass: 'px-4 py-2.5 border-b border-gray-200 bg-gray-50',
    headerLabelClass:
      'text-[10px] font-semibold uppercase tracking-[0.08em] text-gray-600',
    titleClass: 'text-sm font-semibold text-gray-800 mt-0.5',
    descClass: 'text-xs text-gray-500 truncate',
    bodyClass: 'px-4 py-3 space-y-3',
  },
  signed: {
    headerLabel: 'SIGNED INSTITUTIONAL ARTIFACT',
    wrapperClass: 'bg-gray-900 border border-gray-700 overflow-hidden rounded',
    headerClass: 'px-4 py-2.5 border-b border-gray-700 bg-gray-900',
    headerLabelClass:
      'text-[10px] font-semibold uppercase tracking-[0.08em] text-gray-300',
    titleClass: 'text-sm font-semibold text-gray-100 mt-0.5',
    descClass: 'text-xs text-gray-400 truncate',
    bodyClass: 'px-4 py-3 space-y-3',
  },
};

export function TrustRegisterCard({
  state,
  title,
  description,
  runId,
  checkedAt,
  issuerDid,
  signingKeyId,
  rows,
  replayAvailable,
  priorRunId,
}: TrustRegisterCardProps) {
  const cfg = STATE_CONFIG[state];

  return (
    <div className={cfg.wrapperClass}>
      {/* Header */}
      <div className={cfg.headerClass}>
        <div className={cfg.headerLabelClass}>{cfg.headerLabel}</div>
        <div className={cfg.titleClass}>{title}</div>
      </div>

      {/* Body */}
      <div className={cfg.bodyClass}>
        <p className={cfg.descClass}>{description}</p>

        {/* Rows */}
        <div className="space-y-2">
          {rows.map((row, i) => (
            <TrustRegisterRow key={i} {...row} />
          ))}
        </div>

        {/* Replay continuity indicator */}
        {replayAvailable && (
          <div
            className={`mt-2 rounded border px-3 py-2 text-xs ${
              state === 'signed'
                ? 'border-blue-700 bg-blue-900/40 text-blue-300'
                : 'border-blue-200 bg-blue-50 text-blue-700'
            }`}
          >
            <span className="font-semibold">REPLAY CONTINUITY</span>
            {priorRunId ? (
              <span className="font-mono ml-2">{priorRunId}</span>
            ) : (
              <span className="ml-2 opacity-60">first run — no prior lineage</span>
            )}
          </div>
        )}

        {/* Issuer continuity (signed only) */}
        {state === 'signed' && (
          <div className="mt-3">
            <IssuerContinuityPanel
              did={issuerDid}
              signingKeyId={signingKeyId ?? null}
            />
          </div>
        )}
      </div>
    </div>
  );
}
