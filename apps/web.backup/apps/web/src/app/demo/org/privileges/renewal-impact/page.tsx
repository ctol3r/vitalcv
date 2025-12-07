'use client';

import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PrivilegeGraph } from '@/components/privileges/PrivilegeGraph';
import {
  PRIVILEGE_NODE_MAP,
  PRIVILEGE_NODES,
  PRIVILEGE_RENEWALS,
  getAllPrerequisites,
  getDownstreamPrivileges,
} from '@/data/privileges';

export default function PrivilegeRenewalImpactPage() {
  const [activeRenewalId, setActiveRenewalId] = useState(PRIVILEGE_RENEWALS[0].id);
  const [timelineIndex, setTimelineIndex] = useState(0);

  const renewal = useMemo(
    () => PRIVILEGE_RENEWALS.find((entry) => entry.id === activeRenewalId) ?? PRIVILEGE_RENEWALS[0],
    [activeRenewalId],
  );

  const activeNode = PRIVILEGE_NODE_MAP.get(renewal.privilegeCode);
  const timelineEntry = renewal.timeline[timelineIndex] ?? renewal.timeline[0];

  const highlightSet = useMemo(() => {
    const set = new Set<string>([renewal.privilegeCode]);
    if (activeNode) {
      getDownstreamPrivileges(activeNode.code).forEach((code) => set.add(code));
      renewal.impactedCodes.forEach((code) => set.add(code));
      getAllPrerequisites(activeNode.code).forEach((code) => set.add(code));
    }
    return set;
  }, [renewal, activeNode]);

  const impactedDetails = renewal.impactedCodes.map((code) => ({
    code,
    name: PRIVILEGE_NODE_MAP.get(code)?.name ?? 'Unknown privilege',
  }));

  return (
    <div className="container mx-auto space-y-6 p-6">
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">Demo &raquo; Org &raquo; Privileges</p>
        <h1 className="text-3xl font-bold">Renewal Impact Overlay</h1>
        <p className="text-muted-foreground max-w-3xl">
          Visualize which downstream privileges stall when prerequisites expire. Click timeline milestones to sync
          overlays with committee planning and downstream service line notifications.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader className="space-y-3">
            <div>
              <CardTitle>Expiring prerequisites</CardTitle>
              <CardDescription>Select a renewal event to overlay downstream impact.</CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              {PRIVILEGE_RENEWALS.map((entry) => (
                <Button
                  key={entry.id}
                  variant={entry.id === renewal.id ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => {
                    setActiveRenewalId(entry.id);
                    setTimelineIndex(0);
                  }}
                >
                  {entry.privilegeCode}
                </Button>
              ))}
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <PrivilegeGraph
              nodes={PRIVILEGE_NODES}
              selectedCode={renewal.privilegeCode}
              highlightedNodes={highlightSet}
              dimUnselected
            />

            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <Badge variant="secondary">{renewal.privilegeCode}</Badge>
                <span className="text-sm font-semibold">Expires {renewal.expiresOn}</span>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${riskBadge(renewal.risk)}`}>
                  {renewal.risk.toUpperCase()} RISK · {renewal.status.toUpperCase()}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">{renewal.summary}</p>
            </div>

            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Timeline</h3>
                <span className="text-xs text-muted-foreground">Click a milestone to sync overlay notes</span>
              </div>
              <div className="flex flex-col gap-2 md:flex-row md:items-stretch">
                {renewal.timeline.map((entry, index) => (
                  <button
                    type="button"
                    key={`${entry.date}-${entry.label}`}
                    onClick={() => setTimelineIndex(index)}
                    className={`flex-1 rounded-md border px-3 py-2 text-left text-sm transition ${
                      timelineIndex === index
                        ? 'border-indigo-500 bg-indigo-50 text-indigo-900'
                        : 'border-muted bg-background'
                    }`}
                  >
                    <p className="font-semibold">{entry.label}</p>
                    <p className="text-xs text-muted-foreground">{entry.date}</p>
                  </button>
                ))}
              </div>
              {timelineEntry && (
                <div className="rounded-md border border-dashed p-4 text-sm">
                  <p className="font-semibold">{timelineEntry.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {timelineEntry.date} · {timelineEntry.type.toUpperCase()}
                  </p>
                  <p className="mt-2 text-muted-foreground">{renewal.overlayNotes}</p>
                </div>
              )}
            </section>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Impacted privileges</CardTitle>
            <CardDescription>Downstream nodes paused if renewal lapses.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {impactedDetails.length === 0 ? (
              <p className="text-sm text-muted-foreground">No downstream dependencies recorded.</p>
            ) : (
              impactedDetails.map((item) => (
                <div key={item.code} className="rounded-md border p-3 text-sm shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold">{item.code}</p>
                      <p className="text-xs text-muted-foreground">{item.name}</p>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${impactBadge(renewal.risk)}`}>
                      {renewal.risk === 'high' ? 'At risk' : 'Monitor'}
                    </span>
                  </div>
                </div>
              ))
            )}
            <Button
              variant="outline"
              className="w-full"
              onClick={() => navigator.clipboard.writeText(JSON.stringify(renewal, null, 2))}
            >
              Copy renewal payload
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function riskBadge(risk: 'low' | 'moderate' | 'high') {
  if (risk === 'high') return 'bg-red-100 text-red-900';
  if (risk === 'moderate') return 'bg-amber-100 text-amber-900';
  return 'bg-emerald-100 text-emerald-900';
}

function impactBadge(risk: 'low' | 'moderate' | 'high') {
  if (risk === 'high') return 'bg-red-50 text-red-700 border border-red-200';
  if (risk === 'moderate') return 'bg-amber-50 text-amber-800 border border-amber-200';
  return 'bg-emerald-50 text-emerald-800 border border-emerald-200';
}


