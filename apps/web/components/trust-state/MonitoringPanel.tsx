'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { MonitoringPanelData, DeltaLogEntry } from './types';
import { PANEL_TRANSITION } from './motion';

// ── Helpers ────────────────────────────────────────────────

function formatDateTime(iso: string): string {
  if (!iso) return '\u2014';
  try {
    return new Date(iso).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short',
    });
  } catch {
    return '\u2014';
  }
}

// ── Delta Diff Table ───────────────────────────────────────

function DeltaDiffTable({ entry }: { entry: DeltaLogEntry }) {
  const { changeSet } = entry;

  return (
    <div className="rounded-md border border-slate-200 overflow-hidden">
      <div className="bg-slate-50 border-b border-slate-200 px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Change Detected
          </span>
          {changeSet.materialChange && (
            <Badge className="text-[11px] border bg-amber-50 text-amber-800 border-amber-200 hover:bg-transparent">
              <span className="inline-block h-2 w-2 rounded-full bg-amber-500 mr-1.5" />
              Material
            </Badge>
          )}
        </div>
        <span className="text-xs text-slate-400 font-mono">
          {formatDateTime(entry.detectedAt)}
        </span>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-100">
            <th className="text-left px-4 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Field
            </th>
            <th className="text-left px-4 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Previous
            </th>
            <th className="text-left px-4 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Current
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {changeSet.changedFields.map((field) => (
            <tr key={field.field}>
              <td className="px-4 py-2 font-medium text-slate-700 text-xs">
                {field.field}
              </td>
              <td className="px-4 py-2 font-mono text-xs text-red-700 bg-red-50/30">
                {field.previousValue || '\u2014'}
              </td>
              <td className="px-4 py-2 font-mono text-xs text-green-700 bg-green-50/30">
                {field.newValue || '\u2014'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="bg-slate-50 border-t border-slate-200 px-4 py-1.5 text-xs text-slate-400 font-mono">
        hash: {changeSet.changeHash.substring(0, 16)}...
      </div>
    </div>
  );
}

// ── Component ──────────────────────────────────────────────

export function MonitoringPanel({ data }: { data: MonitoringPanelData }) {
  const hasDeltas = data.deltaLog.length > 0;

  return (
    <section aria-labelledby="monitoring-heading" className={PANEL_TRANSITION}>
      <Card>
        <CardHeader>
          <CardTitle id="monitoring-heading" className="text-lg text-slate-800">
            Monitoring
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Status summary */}
          <div className="rounded-md border border-slate-200 bg-slate-50/50 p-3">
            <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
              <div>
                <dt className="text-slate-400 font-semibold uppercase tracking-wider">
                  Monitoring Enabled
                </dt>
                <dd className="mt-0.5 flex items-center gap-2">
                  <span
                    className={`inline-block h-2 w-2 rounded-full ${data.enabled ? 'bg-green-600' : 'bg-slate-400'}`}
                    role="img"
                    aria-label={data.enabled ? 'Monitoring active' : 'Monitoring inactive'}
                  />
                  <span className="text-slate-700 font-medium">
                    {data.enabled ? 'Active' : 'Inactive'}
                  </span>
                </dd>
              </div>
              <div>
                <dt className="text-slate-400 font-semibold uppercase tracking-wider">
                  Last Checked
                </dt>
                <dd className="text-slate-700 mt-0.5 font-mono">
                  {formatDateTime(data.lastCheckedAt)}
                </dd>
              </div>
              <div>
                <dt className="text-slate-400 font-semibold uppercase tracking-wider">
                  Check Interval
                </dt>
                <dd className="text-slate-700 mt-0.5 font-mono">
                  {data.checkIntervalHours}h
                </dd>
              </div>
              <div>
                <dt className="text-slate-400 font-semibold uppercase tracking-wider">
                  Change Detected
                </dt>
                <dd className="mt-0.5 flex items-center gap-2">
                  <span
                    className={`inline-block h-2 w-2 rounded-full ${hasDeltas ? 'bg-amber-500' : 'bg-slate-300'}`}
                    role="img"
                    aria-label={hasDeltas ? 'Changes detected' : 'No changes'}
                  />
                  <span className={`font-medium ${hasDeltas ? 'text-amber-700' : 'text-slate-500'}`}>
                    {hasDeltas ? `${data.deltaLog.length} change${data.deltaLog.length !== 1 ? 's' : ''}` : 'None'}
                  </span>
                </dd>
              </div>
            </dl>
          </div>

          {/* Delta diff tables */}
          {hasDeltas && (
            <div className="space-y-3">
              {data.deltaLog.map((entry) => (
                <DeltaDiffTable key={entry.deltaId} entry={entry} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
