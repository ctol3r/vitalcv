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
import { AlertTriangle, ShieldCheck } from 'lucide-react';

const API_BASE = (process.env.NEXT_PUBLIC_PLATFORM_API ?? '').replace(/\/$/, '');

interface SiteOverview {
  siteId: string;
  alignment: number;
  privilegeCoverage: number;
  autoPropagate: boolean;
  pendingReviews: number;
  lastPropagation?: string;
}

interface PropagationHistoryEntry {
  siteId: string;
  clinicianId: string;
  packId: string;
  propagatedAt: string;
  auto?: boolean;
  merkleProof?: { root: string; path: string[] };
}

interface SystemPrivilegeDashboard {
  systemId: string;
  policy: {
    propagate: boolean;
    sites: string[];
  };
  standardPrivileges: string[];
  sites: SiteOverview[];
  history: PropagationHistoryEntry[];
}

export default function SystemPrivilegeDashboardPage() {
  const [data, setData] = useState<SystemPrivilegeDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [systemId] = useState('system-alpha');

  useEffect(() => {
    let cancelled = false;
    async function loadDashboard() {
      setLoading(true);
      setError(null);
      try {
        const url = buildApiUrl(`/api/admin/privileges/system?systemId=${systemId}`);
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Request failed with ${response.status}`);
        }
        const payload = (await response.json()) as SystemPrivilegeDashboard;
        if (!cancelled) {
          setData(payload);
        }
      } catch (err) {
        console.warn('Failed to load system privilege dashboard, using mock data', err);
        if (!cancelled) {
          setError('Live system data unavailable — showing mock telemetry.');
          setData(buildMockDashboard(systemId));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }
    void loadDashboard();
    return () => {
      cancelled = true;
    };
  }, [systemId]);

  return (
    <div className="container mx-auto max-w-6xl space-y-6 py-8">
      <header className="space-y-2">
        <p className="text-sm uppercase tracking-wide text-muted-foreground">Admin Console</p>
        <h1 className="text-3xl font-bold">System Privilege Dashboard</h1>
        <p className="text-muted-foreground max-w-3xl">
          Audit multi-site privilege alignment, review policy propagation, and inspect anchor proofs
          before committee prep.
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
        <CardHeader className="flex flex-wrap justify-between gap-4">
          <div>
            <CardTitle>Policy Overview</CardTitle>
            <CardDescription>Delegated propagation policy for the selected system.</CardDescription>
          </div>
          {data && (
            <Badge variant={data.policy.propagate ? 'default' : 'secondary'} className="gap-2">
              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              {data.policy.propagate ? 'Auto-propagate enabled' : 'Manual review'}
            </Badge>
          )}
        </CardHeader>
        <CardContent>
          {loading || !data ? (
            <Skeleton className="h-20 w-full" />
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <p className="text-sm text-muted-foreground">System ID</p>
                <p className="text-lg font-medium">{data.systemId}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Sites Covered</p>
                <p className="text-lg font-medium">{data.policy.sites.join(', ')}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Standard Privileges</p>
                <p className="text-sm">
                  {data.standardPrivileges.length ? data.standardPrivileges.join(', ') : 'None'}
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Site Alignment</CardTitle>
          <CardDescription>Privilege coverage and propagation posture per site.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading || !data ? (
            <TableSkeleton rows={4} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Site</TableHead>
                  <TableHead>Alignment</TableHead>
                  <TableHead>Coverage</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Pending Reviews</TableHead>
                  <TableHead>Last Propagation</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.sites.map((site) => (
                  <TableRow key={site.siteId}>
                    <TableCell className="font-medium">{site.siteId}</TableCell>
                    <TableCell>{(site.alignment * 100).toFixed(1)}%</TableCell>
                    <TableCell>{(site.privilegeCoverage * 100).toFixed(1)}%</TableCell>
                    <TableCell>
                      <Badge variant={site.autoPropagate ? 'default' : 'secondary'}>
                        {site.autoPropagate ? 'Auto' : 'Manual'}
                      </Badge>
                    </TableCell>
                    <TableCell>{site.pendingReviews}</TableCell>
                    <TableCell>
                      {site.lastPropagation
                        ? new Date(site.lastPropagation).toLocaleString()
                        : 'Never'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {data && (
        <Card>
          <CardHeader>
            <CardTitle>Propagation History</CardTitle>
            <CardDescription>Anchored events with Merkle proof metadata.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.history.length === 0 ? (
              <p className="text-sm text-muted-foreground">No propagation events recorded.</p>
            ) : (
              data.history.slice(0, 8).map((event) => (
                <div
                  key={`${event.siteId}-${event.clinicianId}-${event.packId}-${event.propagatedAt}`}
                  className="rounded-md border p-3 text-sm"
                >
                  <div className="flex justify-between">
                    <span className="font-medium">{event.siteId}</span>
                    <span className="text-muted-foreground">
                      {new Date(event.propagatedAt).toLocaleString()}
                    </span>
                  </div>
                  <div>
                    Clinician <span className="font-mono">{event.clinicianId}</span> via pack{' '}
                    <span className="font-mono">{event.packId}</span>
                  </div>
                  <div className="text-muted-foreground">
                    Merkle root: {event.merkleProof?.root ?? 'n/a'}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function buildApiUrl(path: string): string {
  if (!API_BASE) return path;
  return `${API_BASE}${path}`;
}

function TableSkeleton({ rows }: { rows: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, idx) => (
        <Skeleton key={`row-${idx}`} className="h-10 w-full" />
      ))}
    </div>
  );
}

function buildMockDashboard(systemId: string): SystemPrivilegeDashboard {
  return {
    systemId,
    policy: {
      propagate: true,
      sites: ['NYC-001', 'NJ-002', 'PA-003'],
    },
    standardPrivileges: ['CORE_CARD', 'STRUCTURAL_HEART', 'CALL_24H'],
    sites: [
      {
        siteId: 'NYC-001',
        alignment: 0.95,
        privilegeCoverage: 0.98,
        autoPropagate: true,
        pendingReviews: 1,
        lastPropagation: new Date().toISOString(),
      },
      {
        siteId: 'NJ-002',
        alignment: 0.82,
        privilegeCoverage: 0.79,
        autoPropagate: false,
        pendingReviews: 3,
        lastPropagation: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
      },
      {
        siteId: 'PA-003',
        alignment: 0.66,
        privilegeCoverage: 0.72,
        autoPropagate: false,
        pendingReviews: 5,
        lastPropagation: null,
      },
    ],
    history: [
      {
        siteId: 'NYC-001',
        clinicianId: 'clin-123',
        packId: 'pack-ny-1',
        propagatedAt: new Date().toISOString(),
        auto: true,
        merkleProof: { root: '0xabc', path: ['0x1', '0x2'] },
      },
      {
        siteId: 'NJ-002',
        clinicianId: 'clin-456',
        packId: 'pack-nj-3',
        propagatedAt: new Date(Date.now() - 36 * 60 * 60 * 1000).toISOString(),
        auto: false,
        merkleProof: { root: '0xdef', path: ['0x3', '0x4'] },
      },
    ],
  };
}










