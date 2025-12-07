'use client';

import { useCallback, useEffect, useState } from 'react';
import { Activity, TrendingUp, AlertCircle, CheckCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface ProcedureVolume {
  procedure: string;
  count: number;
  recencyScore: number;
  lastPerformed?: string;
  daysSinceLast: number;
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';

export default function ProcedureVolumePage() {
  const [volumes, setVolumes] = useState<ProcedureVolume[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [clinicianId, setClinicianId] = useState('');

  const fetchVolumes = useCallback(async () => {
    if (!clinicianId) return;

    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/api/procedure-volume/${clinicianId}`);
      if (!response.ok) {
        throw new Error(`Failed to load volumes (${response.status})`);
      }
      const data = await response.json();
      setVolumes(data);
    } catch (err) {
      console.error('Failed to fetch volumes', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [clinicianId]);

  useEffect(() => {
    // In production, would get clinicianId from auth context
    const storedId = localStorage.getItem('clinicianId');
    if (storedId) {
      setClinicianId(storedId);
    }
  }, []);

  useEffect(() => {
    if (clinicianId) {
      fetchVolumes();
    }
  }, [clinicianId, fetchVolumes]);

  const totalProcedures = volumes.reduce((sum, v) => sum + v.count, 0);
  const avgRecency = volumes.length > 0 ? volumes.reduce((sum, v) => sum + v.recencyScore, 0) / volumes.length : 0;

  return (
    <div className="p-8 space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Procedure Volume</h1>
          <p className="text-muted-foreground">
            Track procedure volume, recency, and competency proof.
          </p>
        </div>
        <Button onClick={fetchVolumes} variant="secondary" disabled={!clinicianId}>
          Refresh
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Procedures</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalProcedures}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Recency</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(avgRecency * 100).toFixed(1)}%</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Procedure Types</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{volumes.length}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Procedure Details</CardTitle>
          <CardDescription>Volume and recency by procedure</CardDescription>
        </CardHeader>
        <CardContent>
          {volumes.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No procedure data available</div>
          ) : (
            <div className="space-y-2">
              {volumes.map((volume, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex items-center gap-4">
                    <div>
                      <div className="font-medium">{volume.procedure}</div>
                      <div className="text-sm text-muted-foreground">
                        {volume.count} procedures
                        {volume.lastPerformed && ` • Last: ${new Date(volume.lastPerformed).toLocaleDateString()}`}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <Badge variant={volume.recencyScore > 0.7 ? 'default' : volume.recencyScore > 0.4 ? 'secondary' : 'destructive'}>
                      {(volume.recencyScore * 100).toFixed(0)}% recency
                    </Badge>
                    {volume.daysSinceLast > 180 && (
                      <AlertCircle className="h-4 w-4 text-yellow-500" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {loading && (
        <div className="flex items-center justify-center p-8">
          <div className="text-muted-foreground">Loading procedure volumes...</div>
        </div>
      )}
    </div>
  );
}








