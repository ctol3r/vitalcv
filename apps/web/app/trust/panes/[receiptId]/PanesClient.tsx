'use client';

import * as React from 'react';
import { StackedPaneLayout } from '@/components/trust/StackedPaneLayout';
import {
  LineageBacklinks,
  type LineageBacklinkEntry,
} from '@/components/trust/LineageBacklinks';
import type { PaneRef } from '@/lib/trust/panes';
import type { ReplayInspection } from '@/lib/replay/getReplayInspection';

/**
 * Client wrapper for the Stacked Provenance Ledger.
 *
 * Defines pane renderers for `receipt`, `claim`, `audit`, `lineage`,
 * and `entity` kinds. Each deeper pane includes `LineageBacklinks`
 * resolved against the same `ReplayInspection` so the user sees
 * bi-directional bindings without an additional fetch.
 */
export function PanesClient({ inspection }: { inspection: ReplayInspection }) {
  const rootPane: PaneRef = { kind: 'receipt', id: paneId(inspection.receiptId) };

  return (
    <StackedPaneLayout
      rootPane={rootPane}
      renderRootPane={(ctx) => (
        <ReceiptPane
          inspection={inspection}
          pushPane={ctx.pushPane}
          isActive={ctx.isActive}
        />
      )}
      renderPane={(ref, ctx) => {
        switch (ref.kind) {
          case 'receipt':
            return (
              <ReceiptPane
                inspection={inspection}
                pushPane={ctx.pushPane}
                closeThisPane={ctx.closeThisPane}
                isActive={ctx.isActive}
              />
            );
          case 'claim':
            return (
              <ClaimPane
                claimId={ref.id}
                inspection={inspection}
                pushPane={ctx.pushPane}
                closeThisPane={ctx.closeThisPane}
              />
            );
          case 'audit':
            return (
              <AuditPane
                auditId={ref.id}
                inspection={inspection}
                pushPane={ctx.pushPane}
                closeThisPane={ctx.closeThisPane}
              />
            );
          case 'lineage':
            return (
              <LineagePane
                lineageId={ref.id}
                inspection={inspection}
                pushPane={ctx.pushPane}
                closeThisPane={ctx.closeThisPane}
              />
            );
          case 'entity':
            return (
              <EntityPane
                entityId={ref.id}
                inspection={inspection}
                pushPane={ctx.pushPane}
                closeThisPane={ctx.closeThisPane}
              />
            );
        }
      }}
    />
  );
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function paneId(raw: string): string {
  // Pane ids are constrained to [A-Za-z0-9_-]+; replace anything else.
  return raw.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 128);
}

function PaneShell({
  caption,
  title,
  onClose,
  children,
}: {
  caption: string;
  title: string;
  onClose?: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-full flex-col">
      <header className="flex items-baseline justify-between border-b border-slate-900 bg-slate-100 px-4 py-2 font-mono text-[10px] uppercase tracking-wider text-slate-700">
        <span>{caption}</span>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="text-slate-700 hover:text-slate-900"
          >
            ×
          </button>
        ) : null}
      </header>
      <div className="flex-1 overflow-y-auto bg-white">
        <h2 className="border-b border-slate-200 px-4 py-3 font-mono text-sm text-slate-900">
          {title}
        </h2>
        {children}
      </div>
    </div>
  );
}

function PushRow({
  label,
  caption,
  onPush,
}: {
  label: string;
  caption?: string;
  onPush: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onPush}
      className="flex w-full items-baseline justify-between gap-2 border-b border-slate-200 px-4 py-2 text-left hover:bg-slate-50"
    >
      <div className="min-w-0 flex-1">
        <div className="font-mono text-sm text-slate-900 break-all">{label}</div>
        {caption ? (
          <div className="mt-0.5 font-mono text-[10px] uppercase tracking-wider text-slate-500">
            {caption}
          </div>
        ) : null}
      </div>
      <span className="shrink-0 text-slate-500">→</span>
    </button>
  );
}

// ── Receipt pane (root) ─────────────────────────────────────────────────────

function ReceiptPane({
  inspection,
  pushPane,
  closeThisPane,
  isActive,
}: {
  inspection: ReplayInspection;
  pushPane: (next: PaneRef) => void;
  closeThisPane?: () => void;
  isActive: boolean;
}) {
  return (
    <PaneShell
      caption={`receipt · ${isActive ? 'active' : 'in stack'}`}
      title={inspection.receiptId}
      onClose={closeThisPane}
    >
      <dl className="grid grid-cols-2 gap-3 border-b border-slate-200 px-4 py-3 font-mono text-xs">
        <Cell label="Run id" value={inspection.runId} />
        <Cell label="Checked at" value={inspection.checkedAt} />
        <Cell label="Issuer DID" value={inspection.issuerDid} />
        <Cell
          label="Signing key"
          value={inspection.signingKeyId?.slice(0, 24) ?? '—'}
        />
      </dl>
      <section>
        <div className="border-b border-slate-200 bg-slate-50 px-4 py-2 font-mono text-[10px] uppercase tracking-wider text-slate-700">
          Runs · click to push pane
        </div>
        {inspection.runs.map((run) => (
          <PushRow
            key={run.runId}
            label={`${run.source} · ${run.checkedAt}`}
            caption={`${run.laneId} · ${run.status} · ${run.tier}`}
            onPush={() => pushPane({ kind: 'claim', id: paneId(run.runId) })}
          />
        ))}
      </section>
      <section>
        <div className="border-b border-t border-slate-200 bg-slate-50 px-4 py-2 font-mono text-[10px] uppercase tracking-wider text-slate-700">
          Lineage key · click to push pane
        </div>
        <PushRow
          label={inspection.lineageKey}
          caption="bi-directional binding"
          onPush={() =>
            pushPane({ kind: 'lineage', id: paneId(inspection.lineageKey) })
          }
        />
      </section>
      <section>
        <div className="border-b border-t border-slate-200 bg-slate-50 px-4 py-2 font-mono text-[10px] uppercase tracking-wider text-slate-700">
          Audit events · {inspection.gaps.length === 0 ? 'no gaps' : `${inspection.gaps.length} gaps`}
        </div>
        {inspection.gaps.length === 0 ? (
          <PushRow
            label="evt_no_adverse_findings"
            caption="this is success · 0 records"
            onPush={() =>
              pushPane({ kind: 'audit', id: paneId(`evt_${inspection.runId}_d`) })
            }
          />
        ) : (
          inspection.gaps.map((gap, i) => (
            <PushRow
              key={`gap-${i}`}
              label={gap.description}
              caption={`${gap.gapType} · ${gap.severity}`}
              onPush={() =>
                pushPane({
                  kind: 'audit',
                  id: paneId(`evt_${inspection.runId}_${i}`),
                })
              }
            />
          ))
        )}
      </section>
    </PaneShell>
  );
}

// ── Claim pane ──────────────────────────────────────────────────────────────

function ClaimPane({
  claimId,
  inspection,
  pushPane,
  closeThisPane,
}: {
  claimId: string;
  inspection: ReplayInspection;
  pushPane: (next: PaneRef) => void;
  closeThisPane: () => void;
}) {
  const run = inspection.runs.find((r) => paneId(r.runId) === claimId);
  const backlinks = resolveClaimBacklinks(inspection, claimId);
  return (
    <PaneShell
      caption="claim"
      title={run?.source ?? `claim · ${claimId}`}
      onClose={closeThisPane}
    >
      {run ? (
        <dl className="grid grid-cols-2 gap-3 px-4 py-3 font-mono text-xs">
          <Cell label="Lane" value={run.laneId} />
          <Cell label="Status" value={run.status} />
          <Cell label="Tier" value={run.tier} />
          <Cell label="Checked at" value={run.checkedAt} />
          {run.priorRunId ? (
            <Cell label="Prior run" value={run.priorRunId} />
          ) : null}
        </dl>
      ) : (
        <div className="px-4 py-3 font-mono text-xs text-slate-500">
          Claim {claimId} not found in this inspection.
        </div>
      )}
      <PushRow
        label="Open lineage key"
        caption={inspection.lineageKey}
        onPush={() =>
          pushPane({ kind: 'lineage', id: paneId(inspection.lineageKey) })
        }
      />
      <LineageBacklinks links={backlinks} />
    </PaneShell>
  );
}

function resolveClaimBacklinks(
  inspection: ReplayInspection,
  _claimId: string,
): readonly LineageBacklinkEntry[] {
  return [
    {
      ref: { kind: 'receipt', id: paneId(inspection.receiptId) },
      label: inspection.receiptId,
      rationale: 'signed this claim',
    },
    {
      ref: { kind: 'lineage', id: paneId(inspection.lineageKey) },
      label: inspection.lineageKey,
      rationale: 'lineage key that this claim feeds',
    },
  ];
}

// ── Audit pane ──────────────────────────────────────────────────────────────

function AuditPane({
  auditId,
  inspection,
  pushPane,
  closeThisPane,
}: {
  auditId: string;
  inspection: ReplayInspection;
  pushPane: (next: PaneRef) => void;
  closeThisPane: () => void;
}) {
  const backlinks = resolveAuditBacklinks(inspection, auditId);
  return (
    <PaneShell
      caption="audit event"
      title={auditId}
      onClose={closeThisPane}
    >
      <dl className="grid grid-cols-2 gap-3 border-b border-slate-200 px-4 py-3 font-mono text-xs">
        <Cell label="Bound receipt" value={inspection.receiptId} />
        <Cell label="Run id" value={inspection.runId} />
        <Cell
          label="Degradation"
          value={inspection.degradationOwnership}
        />
        <Cell
          label="σ verdict"
          value={
            inspection.degradationOwnership === 'no_adverse_findings'
              ? 'σ ok'
              : 'σ defer'
          }
        />
      </dl>
      <p className="border-b border-slate-200 px-4 py-3 text-xs text-slate-700">
        {inspection.degradationExplanation}
      </p>
      <PushRow
        label="Open bound receipt"
        caption={inspection.receiptId}
        onPush={() =>
          pushPane({ kind: 'receipt', id: paneId(inspection.receiptId) })
        }
      />
      <LineageBacklinks
        title="Bound to · cryptographic visibility"
        links={backlinks}
      />
    </PaneShell>
  );
}

function resolveAuditBacklinks(
  inspection: ReplayInspection,
  _auditId: string,
): readonly LineageBacklinkEntry[] {
  return [
    {
      ref: { kind: 'receipt', id: paneId(inspection.receiptId) },
      label: inspection.receiptId,
      rationale: 'audit row consumed this receipt',
    },
    {
      ref: { kind: 'lineage', id: paneId(inspection.lineageKey) },
      label: inspection.lineageKey,
      rationale: 'lineage key the audit asserts against',
    },
    {
      ref: {
        kind: 'entity',
        id: paneId(inspection.lineageKey.split(':')[1] ?? 'unknown'),
      },
      label: `entity · ${inspection.lineageKey.split(':')[1] ?? 'unknown'}`,
      rationale: 'passport / NPI the audit binds to',
    },
  ];
}

// ── Lineage pane ────────────────────────────────────────────────────────────

function LineagePane({
  lineageId,
  inspection,
  pushPane,
  closeThisPane,
}: {
  lineageId: string;
  inspection: ReplayInspection;
  pushPane: (next: PaneRef) => void;
  closeThisPane: () => void;
}) {
  return (
    <PaneShell caption="lineage key" title={lineageId} onClose={closeThisPane}>
      <dl className="grid grid-cols-2 gap-3 border-b border-slate-200 px-4 py-3 font-mono text-xs">
        <Cell
          label="Source"
          value={inspection.sourceContinuity.displayName}
        />
        <Cell label="Lifecycle" value={inspection.sourceContinuity.lifecycle} />
        <Cell
          label="Last checked"
          value={inspection.sourceContinuity.lastChecked ?? '—'}
        />
        <Cell label="Source id" value={inspection.sourceContinuity.sourceId} />
      </dl>
      <PushRow
        label="Open bound receipt"
        caption={inspection.receiptId}
        onPush={() =>
          pushPane({ kind: 'receipt', id: paneId(inspection.receiptId) })
        }
      />
      <LineageBacklinks
        title="Receipts that consumed this lineage"
        links={[
          {
            ref: { kind: 'receipt', id: paneId(inspection.receiptId) },
            label: inspection.receiptId,
            rationale: 'consumed at ' + inspection.checkedAt,
          },
        ]}
      />
    </PaneShell>
  );
}

// ── Entity pane ─────────────────────────────────────────────────────────────

function EntityPane({
  entityId,
  inspection,
  pushPane,
  closeThisPane,
}: {
  entityId: string;
  inspection: ReplayInspection;
  pushPane: (next: PaneRef) => void;
  closeThisPane: () => void;
}) {
  return (
    <PaneShell
      caption="entity · passport"
      title={`Entity · ${entityId}`}
      onClose={closeThisPane}
    >
      <dl className="grid grid-cols-2 gap-3 border-b border-slate-200 px-4 py-3 font-mono text-xs">
        <Cell label="Bound receipt" value={inspection.receiptId} />
        <Cell label="Lineage key" value={inspection.lineageKey} />
      </dl>
      <PushRow
        label="Open bound receipt"
        caption={inspection.receiptId}
        onPush={() =>
          pushPane({ kind: 'receipt', id: paneId(inspection.receiptId) })
        }
      />
      <LineageBacklinks
        title="Artifacts bound to this entity"
        links={[
          {
            ref: { kind: 'receipt', id: paneId(inspection.receiptId) },
            label: inspection.receiptId,
            rationale: 'signed receipt for entity',
          },
          {
            ref: { kind: 'lineage', id: paneId(inspection.lineageKey) },
            label: inspection.lineageKey,
            rationale: 'lineage key for entity',
          },
        ]}
      />
    </PaneShell>
  );
}

// ── Shared cell ─────────────────────────────────────────────────────────────

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
        {label}
      </dt>
      <dd className="mt-0.5 font-mono text-xs text-slate-900 break-all">
        {value}
      </dd>
    </div>
  );
}
