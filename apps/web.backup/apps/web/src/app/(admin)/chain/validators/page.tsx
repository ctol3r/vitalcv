'use client';

import { useEffect, useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle, Signal } from 'lucide-react';

const API_BASE = (process.env.NEXT_PUBLIC_PLATFORM_API ?? '').replace(/\/$/, '');

interface ValidatorNode {
  id: string;
  name: string;
  peers: number;
  finalityLag: number;
  status: 'active' | 'syncing' | 'degraded';
  lastSeen: string;
}

interface ValidatorHealthOverview {
  blockHeight: number;
  finalizedHeight: number;
  peers: number;
  syncStatus: 'synced' | 'syncing' | 'degraded';
  finalityLag: number;
  validators: ValidatorNode[];
  generatedAt: string;
}

export default function ValidatorHealthDashboard() {
  const [data, setData] = useState<ValidatorHealthOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadHealth() {
      setLoading(true);
      setError(null);
      try {
        const url = buildApiUrl('/api/chain/validators');
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Request failed with ${response.status}`);
        }
        const payload = (await response.json()) as ValidatorHealthOverview;
        if (!cancelled) {
          setData(payload);
        }
      } catch (err) {
        console.warn('Failed to load validator health', err);
        if (!cancelled) {
          setError('Unable to reach chain RPC. Metrics may be stale.');
          setData(buildMockValidatorHealth());
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }
    void loadHealth();
    const interval = setInterval(loadHealth, 30_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="container mx-auto max-w-6xl space-y-6 py-8">
      <header className="space-y-2">
        <p className="text-sm uppercase tracking-wide text-muted-foreground">Chain Admin</p>
        <h1 className="text-3xl font-bold">Validator Health</h1>
        <p className="text-muted-foreground max-w-3xl">
          Monitor block production, finality lag, and peer connectivity for the validator set.
        </p>
      </header>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" aria-hidden="true" />
          <AlertTitle>Heads up</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Network Metrics</CardTitle>
          <CardDescription>Snapshot from the validator RPC endpoint.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading || !data ? (
            <Skeleton className="h-24 w-full" />
          ) : (
            <div className="grid gap-4 md:grid-cols-3">
              <MetricTile label="Best Block" value={data.blockHeight} />
              <MetricTile label="Finalized Block" value={data.finalizedHeight} />
              <MetricTile
                label="Finality Lag"
                value={`${data.finalityLag} blocks`}
                status={data.syncStatus}
              />
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Validator Set</CardTitle>
          <CardDescription>Peer counts and last-seen timestamps.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading || !data ? (
            <TableSkeleton rows={4} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Validator</TableHead>
                  <TableHead>Peers</TableHead>
                  <TableHead>Finality Lag</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Seen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.validators.map((validator) => (
                  <TableRow key={validator.id}>
                    <TableCell className="font-medium">{validator.name}</TableCell>
                    <TableCell>{validator.peers}</TableCell>
                    <TableCell>{validator.finalityLag}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(validator.status)}>{validator.status}</Badge>
                    </TableCell>
                    <TableCell>{new Date(validator.lastSeen).toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function buildApiUrl(path: string): string {
  if (!API_BASE) return path;
  return `${API_BASE}${path}`;
}

function statusVariant(status: ValidatorNode['status']) {
  switch (status) {
    case 'active':
      return 'default';
    case 'syncing':
      return 'secondary';
    case 'degraded':
    default:
      return 'destructive';
  }
}

function TableSkeleton({ rows }: { rows: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, idx) => (
        <Skeleton key={`val-${idx}`} className="h-10 w-full" />
      ))}
    </div>
  );
}

function MetricTile({
  label,
  value,
  status,
}: {
  label: string;
  value: number | string;
  status?: ValidatorHealthOverview['syncStatus'];
}) {
  return (
    <div className="rounded-lg border p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-2xl font-semibold">{value}</p>
      {status && (
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Signal className="h-3 w-3" aria-hidden="true" /> {status.toUpperCase()}
        </div>
      )}
    </div>
  );
}

function buildMockValidatorHealth(): ValidatorHealthOverview {
  return {
    blockHeight: 123456,
    finalizedHeight: 123450,
    peers: 8,
    syncStatus: 'degraded',
    finalityLag: 6,
    generatedAt: new Date().toISOString(),
    validators: [
      {
        id: 'val-1',
        name: 'Alpha Validator',
        peers: 8,
        finalityLag: 1,
        status: 'active',
        lastSeen: new Date().toISOString(),
      },
      {
        id: 'val-2',
        name: 'Beta Validator',
        peers: 6,
        finalityLag: 3,
        status: 'syncing',
        lastSeen: new Date(Date.now() - 60_000).toISOString(),
      },
      {
        id: 'val-3',
        name: 'Gamma Validator',
        peers: 5,
        finalityLag: 6,
        status: 'degraded',
        lastSeen: new Date(Date.now() - 120_000).toISOString(),
      },
    ],
  };
}

