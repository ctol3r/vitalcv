'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { AlertCircle, RefreshCw, Download, Anchor, TrendingDown, AlertTriangle } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';

export default function CredentialDensityPage() {
  const [density, setDensity] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const clinicianId = 'demo-clinician-id';

  useEffect(() => {
    loadDensity();
  }, []);

  const loadDensity = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/api/credential-density/${clinicianId}`);
      if (!res.ok) throw new Error('Failed to load density');
      const data = await res.json();
      setDensity(data.density);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAnchor = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/credential-density/${clinicianId}/anchor`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error('Failed to anchor');
      await loadDensity();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleExport = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/credential-density/${clinicianId}/export`);
      if (!res.ok) throw new Error('Failed to export');
      const data = await res.json();
      // Download PDF
      const link = document.createElement('a');
      link.href = `data:application/pdf;base64,${data.pack.pdf}`;
      link.download = 'credential-density-report.pdf';
      link.click();
    } catch (err: any) {
      setError(err.message);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              <p>{error}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Credential Density</h1>
          <p className="text-muted-foreground">
            Measure the density of your credential ecosystem: evidence strength, coverage, verification frequency
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadDensity}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button variant="outline" onClick={handleAnchor}>
            <Anchor className="h-4 w-4 mr-2" />
            Anchor
          </Button>
        </div>
      </div>

      {density && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Coverage Score</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{density.coverage?.score || 0}/100</div>
                <Progress value={density.coverage?.score || 0} className="mt-2" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Credential Count</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{density.credentialCount || 0}</div>
                <p className="text-sm text-muted-foreground mt-2">Total credentials</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Decay Risk</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <Badge
                    variant={
                      density.decayPrediction?.riskLevel === 'high'
                        ? 'destructive'
                        : density.decayPrediction?.riskLevel === 'medium'
                          ? 'default'
                          : 'secondary'
                    }
                  >
                    {density.decayPrediction?.riskLevel || 'low'}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    {density.decayPrediction?.monthsUntilDecay || 12} months
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Evidence Counts</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Documents</p>
                  <p className="text-2xl font-bold">{density.evidenceCounts?.documents || 0}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Chain Anchors</p>
                  <p className="text-2xl font-bold">{density.evidenceCounts?.chainAnchors || 0}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Verifications</p>
                  <p className="text-2xl font-bold">{density.evidenceCounts?.verifications || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {density.reinforcementSuggestions && density.reinforcementSuggestions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Reinforcement Suggestions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {density.reinforcementSuggestions.map((s: any, i: number) => (
                    <div key={i} className="flex items-start gap-2">
                      <Badge variant={s.priority === 'high' ? 'destructive' : 'default'}>
                        {s.priority}
                      </Badge>
                      <div>
                        <p className="font-medium">{s.action}</p>
                        <p className="text-sm text-muted-foreground">{s.reason}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {density.anomalies && density.anomalies.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" />
                  Anomalies Detected
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {density.anomalies.map((a: any, i: number) => (
                    <div key={i} className="flex items-start gap-2">
                      <Badge variant={a.severity === 'high' ? 'destructive' : 'default'}>
                        {a.severity}
                      </Badge>
                      <div>
                        <p className="font-medium">{a.type}</p>
                        <p className="text-sm text-muted-foreground">{a.description}</p>
                      </div>
                    </div>
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

