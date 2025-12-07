'use client';

import { useCallback, useEffect, useState } from 'react';
import { Shield, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface PrivilegeIntel {
  eligibility: {
    score: number;
    checks: Array<{ check: string; passed: boolean; reason?: string }>;
  };
  risk: {
    score: number;
    factors: Array<{ factor: string; severity: number }>;
  };
  comparison: {
    hospitals: Array<{ hospitalId: string; privileges: string[]; overlap: number }>;
  };
  confidence: number;
  trainingGaps: Array<{ gap: string; severity: 'low' | 'moderate' | 'high' }>;
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';

export default function PrivilegeIntelPage() {
  const [intel, setIntel] = useState<PrivilegeIntel | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchIntel = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/api/privileges/intel`);
      if (!response.ok) {
        throw new Error(`Failed to load privilege intel (${response.status})`);
      }
      const data = await response.json();
      setIntel(data);
    } catch (err) {
      console.error('Failed to fetch privilege intel', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchIntel();
  }, [fetchIntel]);

  const getSeverityColor = (severity: string) => {
    if (severity === 'high') return 'text-red-600';
    if (severity === 'moderate') return 'text-yellow-600';
    return 'text-green-600';
  };

  return (
    <div className="p-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Privilege Intelligence</h1>
          <p className="text-muted-foreground">
            AI mapping of privilege sets, risk, experience, and readiness across hospitals.
          </p>
        </div>
        <Button onClick={fetchIntel} disabled={loading}>
          Refresh
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {intel && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Overall Confidence</CardTitle>
              <CardDescription>How well you fit specific privileges</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <div className="text-4xl font-bold">{intel.confidence.toFixed(2)}</div>
                <Progress value={intel.confidence * 100} className="flex-1" />
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Eligibility Checks</CardTitle>
                <CardDescription>Credential and license verification</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {intel.eligibility.checks.map((check, idx) => (
                  <div key={idx} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {check.passed ? (
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-600" />
                      )}
                      <span className="text-sm">{check.check}</span>
                    </div>
                    {check.reason && (
                      <Badge variant="outline" className="text-xs">
                        {check.reason}
                      </Badge>
                    )}
                  </div>
                ))}
                <div className="mt-4 pt-4 border-t">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold">Eligibility Score</span>
                    <span className="text-sm font-bold">
                      {(intel.eligibility.score * 100).toFixed(1)}%
                    </span>
                  </div>
                  <Progress value={intel.eligibility.score * 100} className="mt-2" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Risk Assessment</CardTitle>
                <CardDescription>Safety signals and history analysis</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {intel.risk.factors.length > 0 ? (
                  <>
                    {intel.risk.factors.map((factor, idx) => (
                      <div key={idx}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm">{factor.factor}</span>
                          <Badge variant={factor.severity >= 0.7 ? 'destructive' : 'secondary'}>
                            {(factor.severity * 100).toFixed(0)}%
                          </Badge>
                        </div>
                        <Progress value={factor.severity * 100} />
                      </div>
                    ))}
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">No risk factors detected.</p>
                )}
                <div className="mt-4 pt-4 border-t">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold">Overall Risk Score</span>
                    <span className="text-sm font-bold">
                      {(intel.risk.score * 100).toFixed(1)}%
                    </span>
                  </div>
                  <Progress value={intel.risk.score * 100} className="mt-2" />
                </div>
              </CardContent>
            </Card>
          </div>

          {intel.trainingGaps.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Training Gaps</CardTitle>
                <CardDescription>Missing logs, case volumes, or CME requirements</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {intel.trainingGaps.map((gap, idx) => (
                    <Alert key={idx} variant={gap.severity === 'high' ? 'destructive' : 'default'}>
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>
                        <div className="flex items-center justify-between">
                          <span>{gap.gap}</span>
                          <Badge variant={gap.severity === 'high' ? 'destructive' : 'secondary'}>
                            {gap.severity.toUpperCase()}
                          </Badge>
                        </div>
                      </AlertDescription>
                    </Alert>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {intel.comparison.hospitals.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Cross-Hospital Comparison</CardTitle>
                <CardDescription>Privilege sets across different hospitals</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {intel.comparison.hospitals.map((hospital, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2 border rounded">
                      <div>
                        <span className="font-semibold">{hospital.hospitalId}</span>
                        <span className="text-sm text-muted-foreground ml-2">
                          {hospital.privileges.length} privileges
                        </span>
                      </div>
                      <Badge>{(hospital.overlap * 100).toFixed(0)}% overlap</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {loading && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">Loading privilege intelligence...</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

