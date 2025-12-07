'use client';

import { useCallback, useEffect, useState } from 'react';
import { FileCheck, AlertTriangle, RefreshCw, MapPin } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';

interface LicenseContinuity {
  states: Array<{
    state: string;
    licenseNumber: string;
    status: string;
    expirationDate?: string;
    renewalDate?: string;
    compactEligible: boolean;
  }>;
  international: Array<{
    country: string;
    authority: string;
    licenseNumber: string;
    status: string;
  }>;
  continuityScore: number;
  gaps: Array<{
    type: string;
    state?: string;
    predictedDate: string;
    severity: string;
  }>;
}

export default function LicenseContinuityPage() {
  const [clinicianId, setClinicianId] = useState('');
  const [continuity, setContinuity] = useState<LicenseContinuity | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchContinuity = useCallback(async () => {
    if (!clinicianId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/license-continuity/${clinicianId}`);
      if (!res.ok) throw new Error(`Failed to load continuity (${res.status})`);
      const data = await res.json();
      setContinuity(data);
    } catch (err) {
      console.error('Failed to fetch license continuity', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [clinicianId]);

  useEffect(() => {
    if (clinicianId) {
      fetchContinuity();
    }
  }, [clinicianId, fetchContinuity]);

  const criticalGaps = continuity?.gaps.filter((g) => g.severity === 'critical') || [];
  const activeStates = continuity?.states.filter((s) => s.status === 'active') || [];

  return (
    <div className="p-8 space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">License Continuity Grid</h1>
          <p className="text-muted-foreground">
            Monitor license validity, synced status, and predictive gaps across states & countries.
          </p>
        </div>
        <div className="flex flex-col gap-2 md:flex-row md:items-center">
          <Input
            value={clinicianId}
            onChange={(e) => setClinicianId(e.target.value)}
            placeholder="Clinician ID"
            className="md:w-56"
          />
          <Button onClick={fetchContinuity} variant="secondary">
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
          <p className="text-muted-foreground">Loading license continuity...</p>
        </div>
      )}

      {!loading && continuity && (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Continuity Score</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{continuity.continuityScore.toFixed(0)}%</div>
                <Progress value={continuity.continuityScore} className="mt-2" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Active States</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{activeStates.length}</div>
                <p className="text-sm text-muted-foreground mt-1">
                  {activeStates.map((s) => s.state).join(', ')}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Critical Gaps</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-destructive">{criticalGaps.length}</div>
                <p className="text-sm text-muted-foreground mt-1">Requires immediate attention</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>License Timeline</CardTitle>
              <CardDescription>State and international license status</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {continuity.states.map((license, idx) => (
                  <div key={idx} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <MapPin className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <div className="font-medium">{license.state}</div>
                        <div className="text-sm text-muted-foreground">{license.licenseNumber}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={license.status === 'active' ? 'default' : 'destructive'}>
                        {license.status}
                      </Badge>
                      {license.compactEligible && <Badge variant="outline">Compact</Badge>}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {continuity.gaps.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Predicted Gaps</CardTitle>
                <CardDescription>Upcoming license interruptions</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {continuity.gaps.map((gap, idx) => (
                    <Alert key={idx} variant={gap.severity === 'critical' ? 'destructive' : 'default'}>
                      <AlertTriangle className="h-4 w-4" />
                      <AlertTitle>{gap.type} - {gap.state || 'Unknown'}</AlertTitle>
                      <AlertDescription>
                        Predicted: {new Date(gap.predictedDate).toLocaleDateString()}
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








