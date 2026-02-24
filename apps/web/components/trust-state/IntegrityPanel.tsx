'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { IntegrityPanelData } from './types';
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

function truncateHash(hash: string, length = 16): string {
  if (!hash) return '\u2014';
  if (hash.length <= length + 3) return hash;
  return `${hash.substring(0, length)}...`;
}

// ── Component ──────────────────────────────────────────────

export function IntegrityPanel({ data }: { data: IntegrityPanelData }) {
  return (
    <section aria-labelledby="integrity-heading" className={PANEL_TRANSITION}>
      <Card interactive>
        <CardHeader>
          <CardTitle id="integrity-heading" className="text-lg text-slate-800">
            Integrity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border border-slate-200 overflow-hidden">
            <table className="w-full text-sm" role="table">
              <tbody className="divide-y divide-slate-100">
                <tr>
                  <th
                    scope="row"
                    className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider bg-slate-50 w-48"
                  >
                    Raw Payload Hash
                  </th>
                  <td className="px-4 py-2.5 font-mono text-xs text-slate-700 break-all" title={data.rawPayloadHash}>
                    {truncateHash(data.rawPayloadHash, 32)}
                  </td>
                </tr>
                <tr>
                  <th
                    scope="row"
                    className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider bg-slate-50"
                  >
                    Artifact Hash
                  </th>
                  <td className="px-4 py-2.5 font-mono text-xs text-slate-700 break-all" title={data.artifactHash}>
                    {truncateHash(data.artifactHash, 32)}
                  </td>
                </tr>
                <tr>
                  <th
                    scope="row"
                    className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider bg-slate-50"
                  >
                    Signature Algorithm
                  </th>
                  <td className="px-4 py-2.5 font-mono text-xs text-slate-700">
                    {data.signatureAlgorithm}
                  </td>
                </tr>
                <tr>
                  <th
                    scope="row"
                    className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider bg-slate-50"
                  >
                    Public Key ID
                  </th>
                  <td className="px-4 py-2.5 font-mono text-xs text-slate-700 break-all" title={data.publicKeyId}>
                    {truncateHash(data.publicKeyId, 24)}
                  </td>
                </tr>
                <tr>
                  <th
                    scope="row"
                    className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider bg-slate-50"
                  >
                    Signature Issued At
                  </th>
                  <td className="px-4 py-2.5 font-mono text-xs text-slate-700">
                    {formatDateTime(data.signedAt)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
