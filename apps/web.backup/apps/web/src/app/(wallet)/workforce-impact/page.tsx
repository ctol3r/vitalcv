'use client';

import { Activity, AlertCircle, Anchor, Download, RefreshCw, TrendingUp, Users } from 'lucide-react';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || process.env.NEXT_PUBLIC_API_BASE_URL || '';

interface ImpactTensorData {
  clinicianId: string;
  dimensions: {
    Readiness: number;
    Competency: number;
    Safety: number;
    BurnoutRisk: number;
    PrivilegeAdherence: number;
    VerificationConsistency: number;
    TimeToDeploy: number;
    EconomicYield: number;
    SkillBreadth: number;
    SkillDiversity: number;
    SkillGapRelief: number;
    WorkforceScarcity: number;
    RegionalResilience: number;
    ShortageRelief: number;
    Availability: number;
    PerformanceOutcome: number;
    OutcomeStability: number;
    SafetyBurdenMitigation: number;
    ComplianceAlignment: number;
    RevenuePreservation: number;
    CostAvoidance: number;
    EconomicImpact: number;
    CrossTeamHarmony: number;
    MultiEmployerNormalization: number;
    ImpactResilience: number;
    ImpactLikelihood: number;
    MultiYearTrajectory: number;
    BurnoutCoupling: number;
    Overall: number;
  };
  metadata: {
    computedAt: string;
    version: string;
    algorithm: string;
  };
  anomalies?: Array<{
    dimension: string;
    severity: 'low' | 'medium' | 'high';
    description: string;
    suggestedAction: string;
  }>;
  predictions?: {
    impactForecast: number;
    driftRisk: number;
    trajectory: Array<{ date: string; score: number }>;
  };
}

export default function WorkforceImpactPage() {
  const [clinicianId, setClinicianId] = useState('');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ImpactTensorData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchImpact = async () => {
    if (!clinicianId.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/workforce-impact/${clinicianId}`);
      if (!res.ok) throw new Error('Failed to fetch workforce impact');
      setData(await res.json());
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const exportDossier = async () => {
    if (!clinicianId.trim()) return;
    try {
      const res = await fetch(`${API_BASE}/api/workforce-impact/${clinicianId}/export`);
      if (!res.ok) throw new Error('Failed to export dossier');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `workforce-impact-${clinicianId}.json`;
      a.click();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const anchorSnapshot = async () => {
    if (!clinicianId.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/workforce-impact/${clinicianId}/anchor`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error('Failed to anchor snapshot');
      const result = await res.json();
      alert(`Snapshot anchored: ${result.digest}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const dimensionGroups = [
    {
      title: 'Core Impact',
      dimensions: ['Readiness', 'Competency', 'Safety', 'BurnoutRisk', 'PrivilegeAdherence', 'VerificationConsistency', 'TimeToDeploy', 'EconomicYield'],
    },
    {
      title: 'Skill & Diversity',
      dimensions: ['SkillBreadth', 'SkillDiversity', 'SkillGapRelief'],
    },
    {
      title: 'Workforce & Scarcity',
      dimensions: ['WorkforceScarcity', 'RegionalResilience', 'ShortageRelief', 'Availability'],
    },
    {
      title: 'Performance & Outcome',
      dimensions: ['PerformanceOutcome', 'OutcomeStability', 'SafetyBurdenMitigation', 'ComplianceAlignment'],
    },
    {
      title: 'Economic Impact',
      dimensions: ['RevenuePreservation', 'CostAvoidance', 'EconomicImpact'],
    },
    {
      title: 'Harmonization & Resilience',
      dimensions: ['CrossTeamHarmony', 'MultiEmployerNormalization', 'ImpactResilience'],
    },
    {
      title: 'Predictive & Trajectory',
      dimensions: ['ImpactLikelihood', 'MultiYearTrajectory', 'BurnoutCoupling'],
    },
  ];

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Users className="h-8 w-8" />
            Clinician Workforce Impact Tensor
          </h1>
          <p className="text-muted-foreground mt-2">
            Maps how each clinician impacts the workforce across shortages, safety, reliability, economics, skill diversity & readiness
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Impact Tensor Analysis</CardTitle>
          <CardDescription>Enter a clinician ID to view workforce impact metrics</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Clinician ID"
              value={clinicianId}
              onChange={(e) => setClinicianId(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchImpact()}
            />
            <Button onClick={fetchImpact} disabled={loading || !clinicianId.trim()}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Analyze
            </Button>
            {data && (
              <>
                <Button onClick={exportDossier} variant="outline">
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
                <Button onClick={anchorSnapshot} variant="outline" disabled={loading}>
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
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Overall Impact</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="text-3xl font-bold">{(data.dimensions.Overall * 100).toFixed(1)}%</div>
                      <Progress value={data.dimensions.Overall * 100} />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Impact Forecast</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="text-3xl font-bold">
                        {data.predictions ? (data.predictions.impactForecast * 100).toFixed(1) : 'N/A'}%
                      </div>
                      <Badge variant={data.predictions?.driftRisk && data.predictions.driftRisk < 0.3 ? 'default' : 'destructive'}>
                        Drift Risk: {data.predictions ? (data.predictions.driftRisk * 100).toFixed(1) : 'N/A'}%
                      </Badge>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Computed</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-sm text-muted-foreground">
                      {new Date(data.metadata.computedAt).toLocaleString()}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      v{data.metadata.version} • {data.metadata.algorithm}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {data.anomalies && data.anomalies.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Anomalies Detected</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {data.anomalies.map((anomaly, i) => (
                        <div key={i} className="p-3 border rounded">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold">{anomaly.dimension}</span>
                            <Badge variant={anomaly.severity === 'high' ? 'destructive' : anomaly.severity === 'medium' ? 'default' : 'secondary'}>
                              {anomaly.severity}
                            </Badge>
                          </div>
                          <div className="text-sm text-muted-foreground mt-1">{anomaly.description}</div>
                          <div className="text-sm text-muted-foreground mt-1">
                            <strong>Action:</strong> {anomaly.suggestedAction}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {dimensionGroups.map((group) => (
                <Card key={group.title}>
                  <CardHeader>
                    <CardTitle className="text-lg">{group.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {group.dimensions.map((dim) => {
                        const value = data.dimensions[dim as keyof typeof data.dimensions];
                        return (
                          <div key={dim} className="space-y-1">
                            <div className="flex items-center justify-between text-sm">
                              <span>{dim}</span>
                              <span className="font-semibold">{(value * 100).toFixed(1)}%</span>
                            </div>
                            <Progress value={value * 100} className="h-2" />
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

