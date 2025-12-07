'use client';

import { useCallback, useEffect, useState } from 'react';
import { Activity, TrendingUp, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';

interface LifecycleIntel {
  stage: string;
  privileges?: {
    alignment: number;
  };
  credentials?: {
    recency: number;
  };
  readiness?: {
    score: number;
  };
  trajectory?: {
    nextStage: string;
    probability: number;
  };
}

interface LifecycleStage {
  stage: string;
  confidence: number;
  indicators: string[];
}

export default function LifecycleIntelPage() {
  const [clinicianId, setClinicianId] = useState('demo-clinician');
  const [intel, setIntel] = useState<LifecycleIntel | null>(null);
  const [stage, setStage] = useState<LifecycleStage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchIntel = useCallback(async () => {
    if (!clinicianId) return;
    setLoading(true);
    setError(null);
    try {
      const [intelRes, stageRes] = await Promise.all([
        fetch(`${API_BASE}/api/lifecycle-intel/${clinicianId}`),
        fetch(`${API_BASE}/api/lifecycle-intel/${clinicianId}/stage`),
      ]);

      if (!intelRes.ok) throw new Error(`Failed to load lifecycle intel (${intelRes.status})`);
      if (stageRes.ok) {
        const stageData = await stageRes.json();
        setStage(stageData);
      }

      const intelData = await intelRes.json();
      setIntel(intelData.intel || intelData);
    } catch (err) {
      console.error('Failed to fetch lifecycle intel', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [clinicianId]);

  useEffect(() => {
    fetchIntel();
  }, [fetchIntel]);

  const stageDisplay = stage?.stage || intel?.stage || 'unknown';
  const privilegeAlignment = intel?.privileges?.alignment || 0;
  const credentialRecency = intel?.credentials?.recency || 0;
  const readinessScore = intel?.readiness?.score || 0;

  return (
    <div className="p-8 space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Clinician Lifecycle Intelligence</h1>
          <p className="text-muted-foreground">
            Career, privileges, credentials, readiness, performance, safety & trajectory.
          </p>
        </div>
        <div className="flex flex-col gap-2 md:flex-row md:items-center">
          <Input
            value={clinicianId}
            onChange={(e) => setClinicianId(e.target.value)}
            placeholder="Clinician ID"
            className="md:w-56"
          />
          <Button onClick={fetchIntel} variant="secondary">
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      {error && (
        <div className="text-red-500 text-sm">{error}</div>
      )}

      {loading && (
        <div className="text-center py-8">
          <p className="text-muted-foreground">Loading lifecycle intelligence...</p>
        </div>
      )}

      {!loading && intel && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Current Lifecycle Stage</CardTitle>
              <CardDescription>Detected career stage and confidence</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <Badge variant="outline" className="text-lg px-4 py-2">
                  {stageDisplay.toUpperCase()}
                </Badge>
                {stage && (
                  <div className="text-sm text-muted-foreground">
                    Confidence: {(stage.confidence * 100).toFixed(0)}%
                  </div>
                )}
              </div>
              {stage && stage.indicators.length > 0 && (
                <div className="mt-4 flex gap-2 flex-wrap">
                  {stage.indicators.map((indicator, idx) => (
                    <Badge key={idx} variant="secondary">
                      {indicator}
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Privilege Alignment</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{(privilegeAlignment * 100).toFixed(0)}%</div>
                <Progress value={privilegeAlignment * 100} className="mt-2" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Credential Recency</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{(credentialRecency * 100).toFixed(0)}%</div>
                <Progress value={credentialRecency * 100} className="mt-2" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Readiness Score</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{readinessScore.toFixed(0)}</div>
                <Progress value={readinessScore} className="mt-2" />
              </CardContent>
            </Card>
          </div>

          {intel.trajectory && (
            <Card>
              <CardHeader>
                <CardTitle>Career Trajectory</CardTitle>
                <CardDescription>Projected next stage and probability</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Next Stage</span>
                    <Badge variant="outline">{intel.trajectory.nextStage}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Probability</span>
                    <span className="text-sm font-semibold">
                      {(intel.trajectory.probability * 100).toFixed(0)}%
                    </span>
                  </div>
                  <Progress value={intel.trajectory.probability * 100} className="mt-2" />
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}








