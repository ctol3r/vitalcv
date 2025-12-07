'use client';

import { AlertCircle, Anchor, Download, Link2, RefreshCw } from 'lucide-react';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || process.env.NEXT_PUBLIC_API_BASE_URL || '';

interface AccountabilityChainData {
  clinicianId: string;
  summary: {
    chainIntegrity: number;
    keyActors: string[];
  };
  drift: {
    detected: boolean;
    severity: string;
  };
  pressure: Array<{ actorId: string; pressureScore: number }>;
}

export default function AccountabilityChainPage() {
  const [clinicianId, setClinicianId] = useState('');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<AccountabilityChainData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchChain = async () => {
    if (!clinicianId.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/accountability-chain/${clinicianId}`);
      if (!res.ok) throw new Error('Failed to fetch accountability chain');
      setData(await res.json());
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    if (!clinicianId.trim()) return;
    try {
      const res = await fetch(`${API_BASE}/api/accountability-chain/${clinicianId}/export`);
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `accountability-chain-${clinicianId}.json`;
      a.click();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleAnchor = async () => {
    if (!clinicianId.trim()) return;
    try {
      const res = await fetch(`${API_BASE}/api/accountability-chain/${clinicianId}/anchor`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error('Anchor failed');
      alert('Accountability chain snapshot anchored successfully');
      fetchChain();
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Link2 className="h-8 w-8" />
            Clinician Chain-of-Accountability Engine
          </h1>
          <p className="text-muted-foreground mt-2">
            Trace every action, credential, verification, privilege, and regulatory event back to accountable sources
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Accountability Chain Analysis</CardTitle>
          <CardDescription>Enter a clinician ID to view accountability chain</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Clinician ID"
              value={clinicianId}
              onChange={(e) => setClinicianId(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchChain()}
            />
            <Button onClick={fetchChain} disabled={loading || !clinicianId.trim()}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Analyze
            </Button>
            {data && (
              <>
                <Button onClick={handleExport} variant="outline">
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
                <Button onClick={handleAnchor} variant="outline">
                  <Anchor className="h-4 w-4 mr-2" />
                  Anchor
                </Button>
              </>
            )}
          </div>

          {error && (
            <div className="bg-destructive/10 text-destructive p-3 rounded-md flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          )}

          {loading && !data && <Skeleton className="h-64 w-full" />}

          {data && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Chain Integrity</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="text-3xl font-bold">{data.summary.chainIntegrity}%</div>
                      <Progress value={data.summary.chainIntegrity} />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Drift Status</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <Badge variant={data.drift.detected ? 'destructive' : 'default'}>
                        {data.drift.detected ? 'Detected' : 'None'}
                      </Badge>
                      {data.drift.detected && (
                        <div className="text-sm text-muted-foreground">Severity: {data.drift.severity}</div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {data.summary.keyActors.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Key Actors</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {data.summary.keyActors.map((actor, i) => (
                        <Badge key={i} variant="outline">
                          {actor}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {data.pressure.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Accountability Pressure</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {data.pressure.map((p, i) => (
                        <div key={i} className="flex items-center justify-between p-2 border rounded">
                          <span>{p.actorId}</span>
                          <Progress value={p.pressureScore} className="w-32" />
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}








