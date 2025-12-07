/**
 * Task 475.9 - Vector field UI
 * Frontend visualization for employer integrity vector field
 */

'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, TrendingUp, TrendingDown } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';

interface IntegrityAxis {
  privilegeOutcomes: number;
  fairnessDrift: number;
  atsAnomalies: number;
  safetyCorrelations: number;
  burnoutPatterns: number;
  contractIntegrity: number;
  regulatoryAdherence: number;
  verificationAccuracy: number;
  ethicalDrift: number;
  compliancePressure: number;
  vectorEntropy: number;
  anomalySeverity: number;
  ethicalStress: number;
  multiHospitalHarmony: number;
  riskWeight: number;
  influencePropagation: number;
  burnoutDiffusion: number;
  contractCoherence: number;
  trustAlignment: number;
  ethicalTrajectory: number;
  reinforcementReadiness: number;
  outlierClassification: number;
  regulatoryIntegration: number;
  crossRegionComparison: number;
  trustPenalty: number;
  outcomeHarmony: number;
  privilegeConsistency: number;
  rehabilitationPotential: number;
  multiChainVerification: number;
  economicImpact: number;
}

interface IntegrityData {
  axes: IntegrityAxis;
  score: number;
  ethicalDrift: number;
  entropy: number;
  anomalies: Array<{ type: string; severity: number; details: any }>;
  updatedAt: string;
}

export default function IntegrityFieldPage() {
  const [integrityData, setIntegrityData] = useState<IntegrityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Fetch integrity data - in production, use actual org ID from auth
    const orgId = 'demo-org-id';

    fetch(`${API_BASE}/api/employer/integrity-field/${orgId}`)
      .then(res => res.json())
      .then(data => {
        setIntegrityData(data);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <h1 className="text-2xl font-bold mb-4">Integrity Vector Field</h1>
        <p>Loading integrity data...</p>
      </div>
    );
  }

  if (error || !integrityData) {
    return (
      <div className="container mx-auto p-6">
        <h1 className="text-2xl font-bold mb-4">Integrity Vector Field</h1>
        <div className="text-red-500">Error: {error || 'Failed to load integrity data'}</div>
      </div>
    );
  }

  const axes = integrityData.axes;
  const axisEntries = Object.entries(axes).map(([key, value]) => ({
    name: key.replace(/([A-Z])/g, ' $1').trim(),
    value: typeof value === 'number' ? value * 100 : 0,
  }));

  const getClassification = (cluster: number) => {
    if (cluster < 0.25) return { label: 'Ethical Leaders', color: 'bg-green-500' };
    if (cluster < 0.5) return { label: 'Stable', color: 'bg-blue-500' };
    if (cluster < 0.75) return { label: 'Drifting', color: 'bg-yellow-500' };
    return { label: 'Severe-Risk', color: 'bg-red-500' };
  };

  const classification = getClassification(axes.outlierClassification);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Employer Integrity Vector Field</h1>
        <p className="text-muted-foreground">
          30-axis predictive integrity analysis for employer behavior
        </p>
      </div>

      {/* Overall Scores */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Integrity Score</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{integrityData.score.toFixed(1)}</div>
            <Progress value={integrityData.score} className="mt-2" />
            <div className="text-xs text-muted-foreground mt-2">Risk-weighted 0-100</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Ethical Drift</CardTitle>
            <CardDescription>Lower is better</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{(integrityData.ethicalDrift * 100).toFixed(1)}%</div>
            <Progress value={(1 - integrityData.ethicalDrift) * 100} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Vector Entropy</CardTitle>
            <CardDescription>Stability measure</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{(integrityData.entropy * 100).toFixed(1)}%</div>
            <Progress value={(1 - integrityData.entropy) * 100} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Classification</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge className={classification.color}>
              {classification.label}
            </Badge>
            <div className="text-xs text-muted-foreground mt-2">
              Cluster: {(axes.outlierClassification * 100).toFixed(0)}%
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Integrity Axes */}
      <Card>
        <CardHeader>
          <CardTitle>30-Axis Integrity Vector</CardTitle>
          <CardDescription>Predictive integrity analysis across all dimensions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {axisEntries.map((axis) => (
              <div key={axis.name} className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="capitalize">{axis.name}</span>
                  <span className="font-mono">{axis.value.toFixed(0)}%</span>
                </div>
                <Progress value={axis.value} />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Anomalies */}
      {integrityData.anomalies.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              Detected Anomalies
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {integrityData.anomalies.map((anomaly, idx) => (
                <div key={idx} className="border rounded p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div className="font-semibold">{anomaly.type}</div>
                    <Badge variant={anomaly.severity > 0.7 ? 'destructive' : 'warning'}>
                      Severity: {(anomaly.severity * 100).toFixed(0)}%
                    </Badge>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {JSON.stringify(anomaly.details, null, 2)}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Last Updated */}
      <div className="text-sm text-muted-foreground">
        Last updated: {new Date(integrityData.updatedAt).toLocaleString()}
      </div>
    </div>
  );
}








