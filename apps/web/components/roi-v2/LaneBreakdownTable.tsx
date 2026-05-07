import * as React from 'react';
import { Network } from 'lucide-react';
import type { RoiV2LaneRow, RoiV2Pilot } from '@/lib/roi-v2/types';

export interface LaneBreakdownTableProps {
  lanes: RoiV2LaneRow[];
  pilot: RoiV2Pilot;
}

/**
 * Per-lane decision breakdown table. Counts come from receipts.
 *
 * Column header is "Confirmed" — the bare word "Verified" is reserved for
 * the field-level confidence tier (Wave 41 doctrine), not pipeline state.
 */
export function LaneBreakdownTable({
  lanes,
  pilot,
}: LaneBreakdownTableProps) {
  const wage = pilot.defaultWageUsd;
  const totals = lanes.reduce(
    (acc, l) => ({
      decided: acc.decided + l.decided,
      confirmed: acc.confirmed + l.confirmed,
      refreshed: acc.refreshed + l.refreshed,
      contradicted: acc.contradicted + l.contradicted,
      hoursSaved: acc.hoursSaved + l.hoursSaved,
      dollars: acc.dollars + (wage != null ? Math.round(l.hoursSaved * wage) : 0),
    }),
    { decided: 0, confirmed: 0, refreshed: 0, contradicted: 0, hoursSaved: 0, dollars: 0 },
  );

  return (
    <div className="border border-slate-200 rounded-[3px] bg-white overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Network className="h-3.5 w-3.5 text-slate-700" aria-hidden="true" />
          <span className="text-[13px] font-semibold text-slate-900">
            Where value is coming from
          </span>
        </div>
        <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-slate-500">
          per-lane · receipt-derived
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[12.5px]">
          <thead>
            <tr className="bg-slate-50/60 text-slate-500 font-mono text-[10.5px] uppercase tracking-[0.12em]">
              <th scope="col" className="text-left px-5 py-2 font-medium">Lane</th>
              <th scope="col" className="text-right px-3 py-2 font-medium">Decided</th>
              <th scope="col" className="text-right px-3 py-2 font-medium">Confirmed</th>
              <th scope="col" className="text-right px-3 py-2 font-medium">Refreshed</th>
              <th scope="col" className="text-right px-3 py-2 font-medium">Contradicted</th>
              <th scope="col" className="text-right px-3 py-2 font-medium">Hours saved</th>
              {wage != null && (
                <th scope="col" className="text-right px-5 py-2 font-medium">$ at wage</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {lanes.map((l) => {
              const dollars = wage != null ? Math.round(l.hoursSaved * wage) : null;
              return (
                <tr key={l.laneId} className="text-slate-800">
                  <td className="px-5 py-2.5">
                    <div className="font-medium text-slate-900">{l.laneName}</div>
                    <div className="font-mono text-[10.5px] text-slate-500">
                      {Math.round(l.pctOfTotal * 100)}% of pilot value
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{l.decided}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-emerald-700">{l.confirmed}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-amber-700">{l.refreshed}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{l.contradicted}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{l.hoursSaved.toFixed(1)}h</td>
                  {wage != null && dollars != null && (
                    <td className="px-5 py-2.5 text-right tabular-nums">${dollars.toLocaleString()}</td>
                  )}
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-slate-50/40 text-slate-700 font-mono text-[11px]">
              <td className="px-5 py-2 uppercase tracking-[0.12em] text-slate-500">Total</td>
              <td className="px-3 py-2 text-right tabular-nums">{totals.decided}</td>
              <td className="px-3 py-2 text-right tabular-nums">{totals.confirmed}</td>
              <td className="px-3 py-2 text-right tabular-nums">{totals.refreshed}</td>
              <td className="px-3 py-2 text-right tabular-nums">{totals.contradicted}</td>
              <td className="px-3 py-2 text-right tabular-nums">{totals.hoursSaved.toFixed(1)}h</td>
              {wage != null && (
                <td className="px-5 py-2 text-right tabular-nums">
                  ${totals.dollars.toLocaleString()}
                </td>
              )}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
