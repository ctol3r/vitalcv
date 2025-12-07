'use client';

import React, { useEffect, useState } from 'react';
import { Shield, Users, RotateCcw } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';

interface DidEventsResponse {
  rotations: Array<DidEvent>;
  delegations: Array<DidEvent>;
  recoveries: Array<DidEvent>;
  recoveryRegistry: Array<{
    id: string;
    clinicianId: string;
    recoveryDid: string;
    method: string;
    createdAt: string;
  }>;
}

interface DidEvent {
  id: string;
  clinicianId: string;
  category: string;
  payload: Record<string, any>;
  createdAt: string;
}

export default function DidAdminPage() {
  const [data, setData] = useState<DidEventsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function fetchEvents() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`${API_BASE}/api/did/events`, { cache: 'no-store' });
        if (!response.ok) {
          throw new Error(`Event feed error (${response.status})`);
        }
        const payload = (await response.json()) as DidEventsResponse;
        if (!cancelled) {
          setData(payload);
        }
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : 'Unable to load DID lifecycle events';
          setError(message);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }
    fetchEvents();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-6 p-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">DID Lifecycle Dashboard</h1>
          <p className="text-muted-foreground">Rotations, recoveries, delegations, and chain proofs.</p>
        </div>
        <Button onClick={() => location.reload()} variant="outline">
          Refresh events
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Unable to load lifecycle data</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <StatsCard
          icon={<RotateCcw className="h-5 w-5" />}
          label="Rotations"
          value={data?.rotations.length ?? 0}
          description="Key rotations anchored"
          loading={loading}
        />
        <StatsCard
          icon={<Users className="h-5 w-5" />}
          label="Delegations"
          value={data?.delegations.length ?? 0}
          description="Trusted agents on file"
          loading={loading}
        />
        <StatsCard
          icon={<Shield className="h-5 w-5" />}
          label="Recoveries"
          value={data?.recoveries.length ?? 0}
          description="Recovery events logged"
          loading={loading}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Chain proofs</CardTitle>
          <CardDescription>Aggregated from AuditEvidence digests</CardDescription>
        </CardHeader>
        <CardContent>{loading ? <Skeleton className="h-32 w-full" /> : <EventsTable events={data} />}</CardContent>
      </Card>
    </div>
  );
}

function StatsCard({
  icon,
  label,
  value,
  description,
  loading,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  description: string;
  loading?: boolean;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-3">
        <div className="rounded-full border p-2 text-muted-foreground">{icon}</div>
        <div>
          <CardTitle className="text-lg">{label}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-10 w-16" />
        ) : (
          <p className="text-3xl font-bold text-foreground">{value}</p>
        )}
      </CardContent>
    </Card>
  );
}

function EventsTable({ events }: { events: DidEventsResponse | null }) {
  if (!events) {
    return <p className="text-sm text-muted-foreground">No events yet.</p>;
  }
  const rows = [...events.rotations, ...events.delegations, ...events.recoveries].slice(0, 20);
  if (!rows.length) {
    return <p className="text-sm text-muted-foreground">No lifecycle evidence recorded.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Event</TableHead>
            <TableHead>Clinician</TableHead>
            <TableHead>Details</TableHead>
            <TableHead>Chain</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell>
                <Badge variant="outline" className="text-xs capitalize">
                  {row.category.replace('did-', '')}
                </Badge>
              </TableCell>
              <TableCell className="font-mono text-xs">{row.clinicianId}</TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {row.payload?.note ??
                  row.payload?.delegateDid ??
                  row.payload?.did ??
                  row.payload?.method ??
                  '—'}
              </TableCell>
              <TableCell className="text-xs font-mono text-muted-foreground">
                {row.payload?.anchor?.txHash ?? 'pending'}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}


