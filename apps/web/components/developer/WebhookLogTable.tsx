'use client';

/**
 * WebhookLogTable — Read-only delivery log for employer integrations.
 *
 * Doctrine
 * --------
 *   - Timestamps, endpoints, event names, status codes, and latencies all
 *     render in JetBrains Mono so columns align across hundreds of rows
 *   - HTTP class drives the semantic color (2xx success, 3xx info,
 *     4xx warning, 5xx danger) — never decorative tone
 *   - Delivery state is a narrow literal union; absent data renders as '—'
 *     rather than a cheerful placeholder
 *   - The log is read-only at this tier; row-level forensics belong in a
 *     detail drawer (out of scope here)
 */

import React from 'react';
import { cn } from '@/lib/utils';

void React;

export type WebhookDeliveryState =
  | 'delivered'
  | 'failed'
  | 'retrying'
  | 'pending';

export interface WebhookDelivery {
  id: string;
  timestamp: string;
  endpoint: string;
  event: string;
  httpStatus: number | null;
  latencyMs: number | null;
  state: WebhookDeliveryState;
  attempt: number;
}

interface WebhookLogTableProps {
  deliveries: WebhookDelivery[];
  className?: string;
  title?: string;
  description?: string;
}

interface StateStyle {
  label: string;
  containerClass: string;
}

const STATE_STYLES: Record<WebhookDeliveryState, StateStyle> = {
  delivered: {
    label: 'Delivered',
    containerClass:
      'border-[color:color-mix(in_oklch,var(--vt-success)_40%,transparent)] text-[var(--vt-success)]',
  },
  failed: {
    label: 'Failed',
    containerClass:
      'border-[color:color-mix(in_oklch,var(--vt-danger)_45%,transparent)] text-[var(--vt-danger)]',
  },
  retrying: {
    label: 'Retrying',
    containerClass:
      'border-[color:color-mix(in_oklch,var(--vt-warning)_40%,transparent)] text-[var(--vt-warning)]',
  },
  pending: {
    label: 'Pending',
    containerClass:
      'border-[color:color-mix(in_oklch,var(--vt-info)_40%,transparent)] text-[var(--vt-info)]',
  },
};

function httpStatusClass(status: number | null): string {
  if (status === null) return 'text-muted-foreground/50';
  if (status >= 500) return 'text-[var(--vt-danger)]';
  if (status >= 400) return 'text-[var(--vt-warning)]';
  if (status >= 300) return 'text-[var(--vt-info)]';
  if (status >= 200) return 'text-[var(--vt-success)]';
  return 'text-muted-foreground/70';
}

function formatTimestamp(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    const date = d.toISOString().slice(0, 10);
    const time = d.toISOString().slice(11, 19);
    return `${date}T${time}Z`;
  } catch {
    return iso;
  }
}

function formatLatency(ms: number | null): string {
  if (ms === null) return '—';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

export function WebhookLogTable({
  deliveries,
  className,
  title = 'Webhook deliveries',
  description = 'Read-only log of recent outbound webhook attempts.',
}: WebhookLogTableProps) {
  const deliveredCount = deliveries.filter((d) => d.state === 'delivered').length;
  const failedCount = deliveries.filter((d) => d.state === 'failed').length;

  return (
    <section
      data-slot="webhook-log-table"
      className={cn(
        'rounded-2xl border border-[var(--vt-border)] bg-card px-5 py-4',
        className,
      )}
      aria-label={title}
    >
      <header className="flex flex-col gap-2 border-b border-white/6 pb-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground/60">
            {title}
          </p>
          {description && (
            <p className="mt-1 text-xs text-foreground/60 leading-relaxed">
              {description}
            </p>
          )}
        </div>
        <div className="flex items-center gap-4 font-mono text-[11px] tabular-nums text-muted-foreground/70">
          <span>
            <span className="text-foreground/80">{deliveredCount}</span>
            <span className="text-muted-foreground/50"> ok</span>
          </span>
          <span aria-hidden="true" className="text-muted-foreground/30">·</span>
          <span>
            <span className="text-foreground/80">{failedCount}</span>
            <span className="text-muted-foreground/50"> failed</span>
          </span>
        </div>
      </header>

      {deliveries.length === 0 ? (
        <p className="py-6 text-center text-xs text-muted-foreground/50">
          No webhook attempts in the current window.
        </p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[760px] text-left">
            <thead>
              <tr className="border-b border-white/6 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/40">
                <th scope="col" className="py-2 pr-3 font-semibold">Timestamp</th>
                <th scope="col" className="py-2 pr-3 font-semibold">Event</th>
                <th scope="col" className="py-2 pr-3 font-semibold">Endpoint</th>
                <th scope="col" className="py-2 pr-3 font-semibold text-right">Attempt</th>
                <th scope="col" className="py-2 pr-3 font-semibold text-right">HTTP</th>
                <th scope="col" className="py-2 pr-3 font-semibold text-right">Latency</th>
                <th scope="col" className="py-2 font-semibold">State</th>
              </tr>
            </thead>
            <tbody>
              {deliveries.map((d) => {
                const state = STATE_STYLES[d.state];
                return (
                  <tr
                    key={d.id}
                    className="border-b border-white/4 align-top last:border-0"
                    data-delivery-id={d.id}
                    data-delivery-state={d.state}
                  >
                    <td className="py-3 pr-3">
                      <time
                        dateTime={d.timestamp}
                        className="font-mono text-[11px] tabular-nums text-muted-foreground/70"
                      >
                        {formatTimestamp(d.timestamp)}
                      </time>
                    </td>
                    <td className="py-3 pr-3">
                      <code className="font-mono text-[11px] text-foreground/85">
                        {d.event}
                      </code>
                    </td>
                    <td className="py-3 pr-3">
                      <code className="font-mono text-[11px] text-foreground/70">
                        {d.endpoint}
                      </code>
                    </td>
                    <td className="py-3 pr-3 text-right">
                      <span className="font-mono text-[11px] tabular-nums text-muted-foreground/70">
                        {d.attempt}
                      </span>
                    </td>
                    <td className="py-3 pr-3 text-right">
                      <span
                        className={cn(
                          'font-mono text-[11px] tabular-nums',
                          httpStatusClass(d.httpStatus),
                        )}
                      >
                        {d.httpStatus ?? '—'}
                      </span>
                    </td>
                    <td className="py-3 pr-3 text-right">
                      <span className="font-mono text-[11px] tabular-nums text-muted-foreground/70">
                        {formatLatency(d.latencyMs)}
                      </span>
                    </td>
                    <td className="py-3">
                      <span
                        className={cn(
                          'inline-flex items-center rounded-md border bg-transparent px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest',
                          state.containerClass,
                        )}
                      >
                        {state.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default WebhookLogTable;
