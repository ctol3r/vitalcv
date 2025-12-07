'use client';

import { useCallback, useEffect, useState } from 'react';
import { Scale, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';

export default function DecisionKernelPage() {
  const [clinicianId, setClinicianId] = useState('');
  const [kernel, setKernel] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchKernel = useCallback(async () => {
    if (!clinicianId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/api/privilege-decision-kernel/${clinicianId}`);
      if (!response.ok) {
        throw new Error(`Failed to load decision kernel (${response.status})`);
      }
      const data = await response.json();
      setKernel(data);
    } catch (err) {
      console.error('Failed to fetch decision kernel', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [clinicianId]);

  return (
    <div className="p-8 space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Privilege Decision Kernel</h1>
          <p className="text-muted-foreground">
            AI-driven privileging: fast, fair, evidence-based recommendations for committees
          </p>
        </div>
        <div className="flex flex-col gap-2 md:flex-row md:items-center">
          <Input
            value={clinicianId}
            onChange={(e) => setClinicianId(e.target.value)}
            placeholder="Clinician ID"
            className="md:w-64"
          />
          <Button onClick={fetchKernel} variant="secondary">
            Analyze
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading && <p className="text-muted-foreground">Analyzing privilege decisions...</p>}

      {kernel && kernel.kernel && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Scale className="h-4 w-4" />
                Recommendations
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {kernel.kernel.recommendations?.length ?? 0}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <CheckCircle className="h-4 w-4" />
                Grant
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600">
                {kernel.kernel.recommendations?.filter((r: any) => r.decision === 'grant').length ?? 0}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                Conditional
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-yellow-600">
                {kernel.kernel.recommendations?.filter((r: any) => r.decision === 'conditional').length ?? 0}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <XCircle className="h-4 w-4" />
                Deny
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-red-600">
                {kernel.kernel.recommendations?.filter((r: any) => r.decision === 'deny').length ?? 0}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {kernel && kernel.kernel?.recommendations && (
        <Card>
          <CardHeader>
            <CardTitle>Privilege Recommendations</CardTitle>
            <CardDescription>AI-driven decision support for privilege committees</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {kernel.kernel.recommendations.map((rec: any, idx: number) => (
                <div key={idx} className="p-4 border rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="font-semibold">{rec.privilege}</div>
                    <Badge
                      variant={
                        rec.decision === 'grant'
                          ? 'default'
                          : rec.decision === 'conditional'
                          ? 'secondary'
                          : 'destructive'
                      }
                    >
                      {rec.decision}
                    </Badge>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Confidence: {(rec.confidence * 100).toFixed(0)}%
                  </div>
                  <div className="text-sm">
                    <div className="font-medium mb-1">Reasons:</div>
                    <ul className="list-disc list-inside space-y-1">
                      {rec.reasons.map((reason: string, rIdx: number) => (
                        <li key={rIdx} className="text-muted-foreground">{reason}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {kernel && kernel.kernel?.progression && kernel.kernel.progression.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Privilege Progression Plan</CardTitle>
            <CardDescription>Pathway to obtain higher privileges</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {kernel.kernel.progression.map((prog: any, idx: number) => (
                <div key={idx} className="p-4 border rounded-lg">
                  <div className="font-semibold mb-2">{prog.privilege}</div>
                  <div className="text-sm text-muted-foreground mb-2">
                    Estimated time: {prog.estimatedTime} days
                  </div>
                  <div className="text-sm">
                    <div className="font-medium mb-1">Requirements:</div>
                    <ul className="list-disc list-inside space-y-1">
                      {prog.requirements.map((req: string, rIdx: number) => (
                        <li key={rIdx} className="text-muted-foreground">{req}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

