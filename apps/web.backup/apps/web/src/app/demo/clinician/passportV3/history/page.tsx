'use client';

import { useMemo } from 'react';
import { CalendarCheck2, Clock3, RefreshCw, ShieldCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const history = [
  {
    version: 'v3.4',
    generated: 'Nov 10, 2025 · 02:33 PT',
    reason: 'Org B request — telehealth onboarding packet',
    changes: ['Added telehealth privilege scope', 'NCI proof refresh', 'New PASSPORT_SHARED log'],
  },
  {
    version: 'v3.3',
    generated: 'Nov 02, 2025 · 11:21 PT',
    reason: 'DEA validation refresh',
    changes: ['DEA schedule expansion (IV)', 'MobilityEngine score recalculated'],
  },
  {
    version: 'v3.2',
    generated: 'Oct 18, 2025 · 08:08 PT',
    reason: 'Revalidation auto-run',
    changes: ['State license renewal proof appended', 'Selective disclosure defaults updated'],
  },
  {
    version: 'v3.1',
    generated: 'Sep 05, 2025 · 14:44 PT',
    reason: 'Org A internal audit follow-up',
    changes: ['Attached new OPPE PDF hash', 'Updated committee notes'],
  },
];

export default function PassportHistoryPage() {
  const totalVersions = history.length;
  const latestVersion = history[0];

  const summary = useMemo(
    () => `Latest version ${latestVersion.version}, ${totalVersions} versions total.`,
    [latestVersion.version, totalVersions],
  );

  return (
    <div className="container mx-auto max-w-4xl space-y-6 p-6">
      <header className="space-y-2">
        <Badge variant="outline" className="gap-1">
          <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
          Version history
        </Badge>
        <h1 className="text-3xl font-semibold tracking-tight">Passport v3 history</h1>
        <p className="text-muted-foreground">
          Regeneration reasons, timestamps, and change summaries for every passport release. Screen
          readers can use the structured list below to jump to any version.
        </p>
        <p className="sr-only" aria-live="polite">
          {summary}
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            Latest
          </CardTitle>
          <CardDescription>{latestVersion.reason}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p className="font-semibold">{latestVersion.version}</p>
          <p className="text-muted-foreground">{latestVersion.generated}</p>
          <ul className="list-disc space-y-1 pl-5">
            {latestVersion.changes.map((change) => (
              <li key={change}>{change}</li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarCheck2 className="h-4 w-4" aria-hidden="true" />
            All versions
          </CardTitle>
          <CardDescription>Ordered newest to oldest. Each entry is focusable for SR users.</CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="space-y-4" aria-label="Passport versions">
            {history.map((entry) => (
              <li
                key={entry.version}
                tabIndex={0}
                className="rounded-lg border border-border/70 p-4 outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                aria-describedby={`reason-${entry.version}`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold">{entry.version}</span>
                  <Badge variant="secondary">{entry.generated}</Badge>
                </div>
                <p id={`reason-${entry.version}`} className="text-sm text-muted-foreground">
                  {entry.reason}
                </p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                  {entry.changes.map((change) => (
                    <li key={change}>{change}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Regeneration reasons
          </CardTitle>
          <CardDescription>Common triggers for automatic passport rebuilds.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            • Org-to-org share request (logs <code>PASSPORT_SHARED</code>)<br />
            • DEA or board credential refresh<br />
            • Committee packet regeneration / audit trail sync
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

