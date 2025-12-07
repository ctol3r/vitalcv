'use client';

import { useCallback, useEffect, useState } from 'react';
import { TrendingUp, AlertTriangle, CheckCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';

export default function PerformancePage() {
  const [clinicianId, setClinicianId] = useState('');
  const [performance, setPerformance] = useState<any>(null);
  const [risk, setRisk] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPerformance = useCallback(async () => {
    if (!clinicianId) return;
    setLoading(true);
    setError(null);
    try {
      const [perfRes, riskRes] = await Promise.all([
        fetch(`${API_BASE}/api/performance/${clinicianId}`),
        fetch(`${API_BASE}/api/performance/risk/predict`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clinicianId }),
        }),
      ]);

      if (!perfRes.ok) {
        throw new Error(`Failed to load performance (${perfRes.status})`);
      }

      const perfData = await perfRes.json();
      setPerformance(perfData);

      if (riskRes.ok) {
        const riskData = await riskRes.json();
        setRisk(riskData);
      }
    } catch (err) {
      console.error('Failed to fetch performance', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [clinicianId]);

  return (
    <div className="p-8 space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Clinician Performance & Quality</h1>
          <p className="text-muted-foreground">
            Real-world performance signals integrated with credentialing, safety, and privileging
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>View Performance</CardTitle>
          <CardDescription>Enter a clinician ID to view performance metrics</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              value={clinicianId}
              onChange={(e) => setClinicianId(e.target.value)}
              placeholder="Clinician ID"
              className="flex-1"
            />
            <Button onClick={fetchPerformance} disabled={!clinicianId || loading}>
              Load
            </Button>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {loading && <p className="text-muted-foreground">Loading performance data...</p>}

          {performance && performance.metrics && (
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Readmission Rate</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {performance.metrics.readmissionRate?.toFixed(1)}%
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Complication Rate</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {performance.metrics.complicationRate?.toFixed(1)}%
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Patient Safety</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {performance.metrics.patientSafetyIndicators ? 'Good' : '--'}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {risk && (
                <Card>
                  <CardHeader>
                    <CardTitle>Risk Assessment</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Risk Level</span>
                      <Badge
                        variant={
                          risk.riskLevel === 'high'
                            ? 'destructive'
                            : risk.riskLevel === 'medium'
                            ? 'secondary'
                            : 'outline'
                        }
                      >
                        {risk.riskLevel.toUpperCase()}
                      </Badge>
                    </div>
                    {risk.factors && risk.factors.length > 0 && (
                      <div>
                        <p className="text-sm font-medium mb-1">Risk Factors:</p>
                        <ul className="list-disc list-inside text-sm text-muted-foreground">
                          {risk.factors.map((factor: string, i: number) => (
                            <li key={i}>{factor}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {risk.recommendations && risk.recommendations.length > 0 && (
                      <div>
                        <p className="text-sm font-medium mb-1">Recommendations:</p>
                        <ul className="list-disc list-inside text-sm text-muted-foreground">
                          {risk.recommendations.map((rec: string, i: number) => (
                            <li key={i}>{rec}</li>
                          ))}
                        </ul>
                      </div>
                    )}
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








