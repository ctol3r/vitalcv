/**
 * Task 474.18 - Truth radar visualization
 * Frontend visualization for cross-system truth enforcement engine
 */

'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle, XCircle } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';

interface TruthAxis {
  specialty: number;
  license: number;
  privileges: number;
  certifications: number;
  training: number;
  issuer: number;
  regulator: number;
  employer: number;
  chain: number;
  proof: number;
  document: number;
  temporal: number;
  provenance: number;
  volatility: number;
  coherence: number;
  drift: number;
  stress: number;
  stability: number;
  fragility: number;
  integrity: number;
  correction: number;
  reconciliation: number;
  augmentation: number;
  regulatory: number;
  privilege: number;
  zk: number;
  lifecycle: number;
  dossier: number;
}

interface TruthData {
  axes: TruthAxis;
  contradictions: Array<{ type: string; severity: number; details: any }>;
  stabilityScore: number;
  fragilityScore: number;
  updatedAt: string;
}

export default function TruthRadarPage() {
  const [truthData, setTruthData] = useState<TruthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Fetch truth data - in production, use actual clinician ID from auth
    const clinicianId = 'demo-clinician-id';

    fetch(`${API_BASE}/api/truth/engine/${clinicianId}`)
      .then(res => res.json())
      .then(data => {
        setTruthData(data);
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
        <h1 className="text-2xl font-bold mb-4">Truth Radar</h1>
        <p>Loading truth enforcement data...</p>
      </div>
    );
  }

  if (error || !truthData) {
    return (
      <div className="container mx-auto p-6">
        <h1 className="text-2xl font-bold mb-4">Truth Radar</h1>
        <div className="text-red-500">Error: {error || 'Failed to load truth data'}</div>
      </div>
    );
  }

  const axes = truthData.axes;
  const axisEntries = Object.entries(axes).map(([key, value]) => ({
    name: key.replace(/([A-Z])/g, ' $1').trim(),
    value: value * 100,
  }));

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Cross-System Truth Radar</h1>
        <p className="text-muted-foreground">
          30-axis truth enforcement engine monitoring consistency across systems
        </p>
      </div>

      {/* Overall Scores */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Stability Score</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{truthData.stabilityScore.toFixed(1)}</div>
            <Progress value={truthData.stabilityScore} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Fragility Score</CardTitle>
            <CardDescription>Lower is better</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{truthData.fragilityScore.toFixed(1)}</div>
            <Progress value={100 - truthData.fragilityScore} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Contradictions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{truthData.contradictions.length}</div>
            {truthData.contradictions.length > 0 && (
              <Badge variant="destructive" className="mt-2">
                Review Required
              </Badge>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Truth Axes */}
      <Card>
        <CardHeader>
          <CardTitle>30-Axis Truth Vector</CardTitle>
          <CardDescription>Truth consistency across all systems</CardDescription>
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

      {/* Contradictions */}
      {truthData.contradictions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-yellow-500" />
              Detected Contradictions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {truthData.contradictions.map((contradiction, idx) => (
                <div key={idx} className="border rounded p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div className="font-semibold">{contradiction.type}</div>
                    <Badge variant={contradiction.severity > 0.7 ? 'destructive' : 'warning'}>
                      Severity: {(contradiction.severity * 100).toFixed(0)}%
                    </Badge>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {JSON.stringify(contradiction.details, null, 2)}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Last Updated */}
      <div className="text-sm text-muted-foreground">
        Last updated: {new Date(truthData.updatedAt).toLocaleString()}
      </div>
    </div>
  );
}








