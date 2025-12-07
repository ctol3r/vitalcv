'use client';

import { useCallback, useEffect, useState } from 'react';
import { Activity, AlertTriangle, CheckCircle2, RefreshCw, Sync } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';

interface SyncState {
  regions: string[];
  credentials: Record<string, any>;
  readiness: Record<string, any>;
  privileges: Record<string, any>;
  schedule: Record<string, any>;
  lastSync: Record<string, string>;
  conflicts: any[];
}

interface SyncAnomalies {
  anomalies: any[];
  severity: 'low' | 'medium' | 'high';
}

export default function SyncStatusPage() {
  const [clinicianId, setClinicianId] = useState('demo-clinician');
  const [syncState, setSyncState] = useState<SyncState | null>(null);
  const [anomalies, setAnomalies] = useState<SyncAnomalies | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSyncStatus = useCallback(async () => {
    if (!clinicianId) return;
    setLoading(true);
    setError(null);
    try {
      const [syncRes, anomaliesRes] = await Promise.all([
        fetch(`${API_BASE}/api/workforce-sync/${clinicianId}`),
        fetch(`${API_BASE}/api/workforce-sync/anomalies/${clinicianId}`),
      ]);

      if (!syncRes.ok) throw new Error(`Failed to load sync status (${syncRes.status})`);
      if (!anomaliesRes.ok) throw new Error(`Failed to load anomalies (${anomaliesRes.status})`);

      const syncData = await syncRes.json();
      const anomaliesData = await anomaliesRes.json();

      setSyncState(syncData.syncState || syncData);
      setAnomalies(anomaliesData);
    } catch (err) {
      console.error('Failed to fetch sync status', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [clinicianId]);

  useEffect(() => {
    fetchSyncStatus();
    const interval = setInterval(fetchSyncStatus, 30_000);
    return () => clearInterval(interval);
  }, [fetchSyncStatus]);

  const lastSyncAges = syncState?.lastSync
    ? Object.entries(syncState.lastSync).map(([key, timestamp]) => ({
        key,
        age: Math.round((Date.now() - new Date(timestamp as string).getTime()) / (60 * 60 * 1000)),
      }))
    : [];

  return (
    <div className="p-8 space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Workforce Sync Status</h1>
          <p className="text-muted-foreground">
            Monitor synchronization across regions, systems, and platforms.
          </p>
        </div>
        <div className="flex flex-col gap-2 md:flex-row md:items-center">
          <Input
            value={clinicianId}
            onChange={(e) => setClinicianId(e.target.value)}
            placeholder="Clinician ID"
            className="md:w-56"
          />
          <Button onClick={fetchSyncStatus} variant="secondary">
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading && (
        <div className="text-center py-8">
          <p className="text-muted-foreground">Loading sync status...</p>
        </div>
      )}

      {!loading && syncState && (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Regions Synced</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{syncState.regions?.length || 0}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {syncState.regions?.join(', ') || 'None'}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Conflicts</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{syncState.conflicts?.length || 0}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {syncState.conflicts?.length === 0 ? 'No conflicts' : 'Requires resolution'}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Sync Health</CardTitle>
              </CardHeader>
              <CardContent>
                {anomalies && (
                  <>
                    <Badge variant={anomalies.severity === 'high' ? 'destructive' : anomalies.severity === 'medium' ? 'secondary' : 'outline'}>
                      {anomalies.severity.toUpperCase()}
                    </Badge>
                    <p className="text-xs text-muted-foreground mt-2">
                      {anomalies.anomalies.length} anomalies detected
                    </p>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Last Sync Times</CardTitle>
              <CardDescription>Age of last synchronization per component</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Component</TableHead>
                    <TableHead>Age</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lastSyncAges.map(({ key, age }) => (
                    <TableRow key={key}>
                      <TableCell className="font-medium">{key.replace('_', ' ')}</TableCell>
                      <TableCell>{age}h ago</TableCell>
                      <TableCell>
                        <Badge variant={age > 24 ? 'destructive' : age > 12 ? 'secondary' : 'outline'}>
                          {age > 24 ? 'Stale' : age > 12 ? 'Warning' : 'Fresh'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {anomalies && anomalies.anomalies.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Sync Anomalies</CardTitle>
                <CardDescription>Issues detected in synchronization</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {anomalies.anomalies.map((anomaly, idx) => (
                    <Alert key={idx} variant={anomalies.severity === 'high' ? 'destructive' : 'default'}>
                      <AlertTriangle className="h-4 w-4" />
                      <AlertTitle>{anomaly.type || 'Unknown Anomaly'}</AlertTitle>
                      <AlertDescription>
                        {anomaly.ageHours ? `Age: ${anomaly.ageHours}h` : `Count: ${anomaly.count}`}
                      </AlertDescription>
                    </Alert>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}








