'use client';

import { useEffect, useState } from 'react';
import { RefreshCcw, AlertTriangle, History } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { cn } from '@/lib/utils';

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.API_BASE_URL ||
  'http://localhost:4000';

interface LifecycleForensicsData {
  events: Array<{
    timestamp: string;
    eventType: string;
    actor: string;
    changes: Record<string, any>;
  }>;
  discrepancies: Array<{
    field: string;
    expected: any;
    actual: any;
    origin: string;
  }>;
  tamperHeatmap: Array<{
    segment: string;
    suspiciousScore: number;
    reason: string;
  }>;
}

export default function LifecycleForensicsPage() {
  const [data, setData] = useState<LifecycleForensicsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [credentialId] = useState('demo_credential_123');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/lifecycle-forensics/${credentialId}`);
      if (res.ok) {
        const forensics = await res.json();
        setData(forensics);
      }
    } catch (error) {
      console.error('Failed to load lifecycle forensics:', error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8">
      <header className="space-y-2">
        <Badge variant="secondary">Issuer · Lifecycle Forensics</Badge>
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <h1 className="text-3xl font-semibold leading-tight">Credential Lifecycle Forensics</h1>
            <p className="text-muted-foreground">
              Deep forensic visibility into every change, edit, update, anchor, revocation, correction & overwrite
            </p>
          </div>
          <Button
            variant="outline"
            className="ml-auto gap-2"
            onClick={loadData}
            disabled={loading}
          >
            <RefreshCcw className={cn('h-4 w-4', loading && 'animate-spin')} />
            Refresh
          </Button>
        </div>
      </header>

      {data && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Lifecycle Events</CardTitle>
              <CardDescription>Complete history of credential modifications</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {data.events.map((event, idx) => (
                  <div key={idx} className="rounded-lg border p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <History className="h-4 w-4 text-muted-foreground" />
                        <span className="font-semibold capitalize">{event.eventType}</span>
                        <Badge variant="outline">{event.actor}</Badge>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {new Date(event.timestamp).toLocaleString()}
                      </span>
                    </div>
                    {Object.keys(event.changes).length > 0 && (
                      <div className="text-xs text-muted-foreground">
                        {Object.keys(event.changes).length} field(s) changed
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {data.tamperHeatmap.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Tamper Heatmap</CardTitle>
                <CardDescription>Suspicious segments detected</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {data.tamperHeatmap.map((item, idx) => (
                    <div key={idx} className="rounded-lg border border-destructive/20 bg-destructive/5 p-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold">{item.segment}</span>
                        <Badge variant="destructive">{item.suspiciousScore}%</Badge>
                      </div>
                      <div className="text-sm text-muted-foreground">{item.reason}</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {data.discrepancies.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Discrepancies</CardTitle>
                <CardDescription>Inconsistencies detected in credential data</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {data.discrepancies.map((disc, idx) => (
                    <div key={idx} className="rounded-lg border p-3">
                      <div className="font-semibold mb-1">{disc.field}</div>
                      <div className="text-sm space-y-1">
                        <div>Expected: {String(disc.expected)}</div>
                        <div>Actual: {String(disc.actual)}</div>
                        <div className="text-muted-foreground">Origin: {disc.origin}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {loading && !data && (
        <div className="flex items-center justify-center py-12">
          <RefreshCcw className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}
    </div>
  );
}

