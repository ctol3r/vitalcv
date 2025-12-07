'use client';

import { AlertCircle, Anchor, Download, Globe, RefreshCw } from 'lucide-react';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || process.env.NEXT_PUBLIC_API_BASE_URL || '';

interface RegulatoryContinuityFabricData {
  clinicianId: string;
  continuityScore: number;
  gaps: {
    detected: boolean;
    gaps: Array<{ jurisdiction: string; type: string; severity: string }>;
  };
  harmonized: {
    canonical: {
      activeStates: number;
    };
    conflicts: string[];
  };
  drift: {
    direction: string;
    risk: number;
  };
}

export default function RegContinuityPage() {
  const [clinicianId, setClinicianId] = useState('');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<RegulatoryContinuityFabricData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchFabric = async () => {
    if (!clinicianId.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/regulatory-continuity/${clinicianId}`);
      if (!res.ok) throw new Error('Failed to fetch continuity fabric');
      setData(await res.json());
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Globe className="h-8 w-8" />
            Global Regulatory Continuity Fabric
          </h1>
          <p className="text-muted-foreground mt-2">
            Ensure regulatory continuity across all jurisdictions, states, compacts, and global regulatory frameworks
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Continuity Fabric Analysis</CardTitle>
          <CardDescription>Enter a clinician ID to view regulatory continuity</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Clinician ID"
              value={clinicianId}
              onChange={(e) => setClinicianId(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchFabric()}
            />
            <Button onClick={fetchFabric} disabled={loading || !clinicianId.trim()}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Analyze
            </Button>
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
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Continuity Score</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="text-3xl font-bold">{data.continuityScore}%</div>
                      <Progress value={data.continuityScore} />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Active States</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">{data.harmonized.canonical.activeStates}</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Drift Risk</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="text-3xl font-bold">{data.drift.risk}</div>
                      <Badge>{data.drift.direction}</Badge>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {data.gaps.detected && (
                <Card>
                  <CardHeader>
                    <CardTitle>Continuity Gaps</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {data.gaps.gaps.map((gap, i) => (
                        <div key={i} className="p-3 border rounded">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold">{gap.jurisdiction}</span>
                            <Badge variant={gap.severity === 'high' ? 'destructive' : 'default'}>
                              {gap.severity}
                            </Badge>
                          </div>
                          <div className="text-sm text-muted-foreground mt-1">{gap.type}</div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {data.harmonized.conflicts.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Conflicts</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {data.harmonized.conflicts.map((conflict, i) => (
                        <Badge key={i} variant="destructive">
                          {conflict}
                        </Badge>
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








